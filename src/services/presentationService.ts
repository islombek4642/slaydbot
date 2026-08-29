import { randomUUID } from "node:crypto";
import type { AiClient } from "../ai/client";
import { validateGeneratedCode } from "../ai/codeValidator";
import { runInSandbox } from "../pptx/sandbox";
import { PresentationBuilder } from "../pptx/presentationBuilder";
import { createBridgeFunctions } from "../pptx/bridge";
import { IconCache } from "../pptx/icons/iconCache";
import { getTheme } from "../pptx/themes";
import type { ThemeName } from "../config/constants";
import type { PresentationRepository } from "../db/repositories/presentationRepository";
import { createLogger, type Logger } from "../logger";

export interface GeneratePresentationInput {
  userId: bigint;
  topic: string;
  slideCount: number;
  language: string;
  themeName: ThemeName;
}

export interface GeneratePresentationResult {
  success: boolean;
  requestId: string;
  buffer?: Buffer;
  errorMessage?: string;
}

export class PresentationService {
  constructor(
    private readonly aiClient: AiClient | null,
    private readonly presentationRepository: PresentationRepository,
    private readonly iconCache: IconCache = new IconCache(),
    private readonly logger: Logger = createLogger()
  ) {}

  getModel(): string | null {
    return this.aiClient?.getModel() ?? null;
  }

  setModel(model: string): void {
    this.aiClient?.setModel(model);
  }

  async generate(input: GeneratePresentationInput): Promise<GeneratePresentationResult> {
    const requestId = randomUUID();
    let recordId: string | undefined;

    this.logger.info(
      {
        requestId,
        userId: input.userId.toString(),
        topic: input.topic,
        themeName: input.themeName,
      },
      "Presentation generation started"
    );

    try {
      const theme = getTheme(input.themeName);
      const record = await this.presentationRepository.create({
        userId: input.userId,
        topic: input.topic,
        slideCount: input.slideCount,
        language: input.language,
        theme: input.themeName,
      });
      recordId = record.id;

      if (!this.aiClient) {
        throw new Error("ANTHROPIC_API_KEY is not configured; AI-based presentation generation is unavailable");
      }

      const code = await this.aiClient.generateSlideCode({
        topic: input.topic,
        slideCount: input.slideCount,
        language: input.language,
        theme,
      });

      const validation = validateGeneratedCode(code);
      if (!validation.valid) {
        throw new Error(validation.reason ?? "Generated code failed validation");
      }

      await this.iconCache.warmTheme(theme);

      const builder = new PresentationBuilder();
      const bridge = createBridgeFunctions(builder, this.iconCache);
      const sandboxResult = await runInSandbox(code, bridge);
      if (!sandboxResult.success) {
        throw new Error(sandboxResult.error ?? "Sandbox execution failed");
      }

      const buffer = await builder.toBuffer();
      await this.presentationRepository.markSuccess(recordId);
      this.logger.info({ requestId, recordId }, "Presentation generation succeeded");
      return { success: true, requestId, buffer };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (recordId) {
        await this.presentationRepository.markFailed(recordId, message);
      }
      this.logger.error({ requestId, recordId, error: message }, "Presentation generation failed");
      return { success: false, requestId, errorMessage: message };
    }
  }
}
