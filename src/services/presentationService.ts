import type { AiClient } from "../ai/client";
import { validateGeneratedCode } from "../ai/codeValidator";
import { runInSandbox } from "../pptx/sandbox";
import { PresentationBuilder } from "../pptx/presentationBuilder";
import { createBridgeFunctions } from "../pptx/bridge";
import { IconCache } from "../pptx/icons/iconCache";
import { getTheme } from "../pptx/themes";
import type { ThemeName } from "../config/constants";
import type { PresentationRepository } from "../db/repositories/presentationRepository";

export interface GeneratePresentationInput {
  userId: bigint;
  topic: string;
  slideCount: number;
  language: string;
  themeName: ThemeName;
}

export interface GeneratePresentationResult {
  success: boolean;
  buffer?: Buffer;
  errorMessage?: string;
}

export class PresentationService {
  constructor(
    private readonly aiClient: AiClient,
    private readonly presentationRepository: PresentationRepository,
    private readonly iconCache: IconCache = new IconCache()
  ) {}

  async generate(input: GeneratePresentationInput): Promise<GeneratePresentationResult> {
    const theme = getTheme(input.themeName);
    const record = await this.presentationRepository.create({
      userId: input.userId,
      topic: input.topic,
      slideCount: input.slideCount,
      language: input.language,
      theme: input.themeName,
    });

    try {
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
      await this.presentationRepository.markSuccess(record.id);
      return { success: true, buffer };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.presentationRepository.markFailed(record.id, message);
      return { success: false, errorMessage: message };
    }
  }
}
