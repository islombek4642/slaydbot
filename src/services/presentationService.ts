import { randomUUID } from "node:crypto";
import type { AiClient, PreviousAttempt } from "../ai/client";
import { validateGeneratedCode } from "../ai/codeValidator";
import { runInSandbox } from "../pptx/sandbox";
import { PresentationBuilder } from "../pptx/presentationBuilder";
import { createBridgeFunctions } from "../pptx/bridge";
import { IconCache } from "../pptx/icons/iconCache";
import { getTheme } from "../pptx/themes";
import { renderSlidesToImages } from "../pptx/render";
import { MAX_GENERATION_ATTEMPTS, type ThemeName } from "../config/constants";
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

export type RenderSlidesFn = (buffer: Buffer) => Promise<Buffer[]>;

export class PresentationService {
  constructor(
    private readonly aiClient: AiClient | null,
    private readonly presentationRepository: PresentationRepository,
    private readonly iconCache: IconCache = new IconCache(),
    private readonly logger: Logger = createLogger(),
    private readonly renderSlides: RenderSlidesFn = renderSlidesToImages,
    private readonly maxAttempts: number = MAX_GENERATION_ATTEMPTS
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
      const aiClient = this.aiClient;

      await this.iconCache.warmTheme(theme);

      let previousAttempt: PreviousAttempt | undefined;
      let lastGoodBuffer: Buffer | undefined;

      for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
        this.logger.info({ requestId, attempt }, "Generation attempt");

        const code = await aiClient.generateSlideCode({
          topic: input.topic,
          slideCount: input.slideCount,
          language: input.language,
          theme,
          previousAttempt,
        });

        const validation = validateGeneratedCode(code);
        if (!validation.valid) {
          const feedback = validation.reason ?? "Kod statik tekshiruvdan o'tmadi";
          this.logger.warn({ requestId, attempt, reason: feedback }, "Static validation failed, retrying");
          previousAttempt = { code, feedback };
          continue;
        }

        const builder = new PresentationBuilder();
        const bridge = createBridgeFunctions(builder, this.iconCache);
        const sandboxResult = await runInSandbox(code, bridge);
        if (!sandboxResult.success) {
          const feedback = sandboxResult.error ?? "Sandbox execution failed";
          this.logger.warn({ requestId, attempt, error: feedback }, "Sandbox execution failed, retrying");
          previousAttempt = { code, feedback };
          continue;
        }

        const buffer = await builder.toBuffer();
        lastGoodBuffer = buffer;

        let issues: string[] = [];
        try {
          const images = await this.renderSlides(buffer);
          issues = (await aiClient.reviewSlides(images)).issues;
        } catch (qaError) {
          const message = qaError instanceof Error ? qaError.message : String(qaError);
          this.logger.warn({ requestId, attempt, error: message }, "Visual QA could not run, accepting this attempt as-is");
        }

        if (issues.length === 0) {
          await this.presentationRepository.markSuccess(recordId);
          this.logger.info({ requestId, recordId, attempts: attempt }, "Presentation generation succeeded");
          return { success: true, requestId, buffer };
        }

        this.logger.warn({ requestId, attempt, issues }, "Visual QA found issues, regenerating");
        previousAttempt = { code, feedback: issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n") };
      }

      if (lastGoodBuffer) {
        await this.presentationRepository.markSuccess(recordId);
        this.logger.warn(
          { requestId, recordId, attempts: this.maxAttempts },
          "Hit the generation attempt cap with lingering visual QA issues; delivering the last valid attempt"
        );
        return { success: true, requestId, buffer: lastGoodBuffer };
      }

      throw new Error(
        `${this.maxAttempts} urinishdan keyin ham yaroqli kod yaratib bo'lmadi. Oxirgi xatolik: ${
          previousAttempt?.feedback ?? "noma'lum"
        }`
      );
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
