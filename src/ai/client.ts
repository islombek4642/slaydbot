import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./designGuide";
import type { Theme } from "../pptx/themes/types";

export interface GenerateCodeParams {
  topic: string;
  slideCount: number;
  language: string;
  theme: Theme;
}

export function extractCodeBlock(text: string): string {
  const match = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

/** Injectable delay so tests can stub out real waiting. */
export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_ATTEMPTS = 3; // 1 initial attempt + 2 retries
const BASE_BACKOFF_MS = 1000; // 1s, then 2s

/**
 * Whether `error` looks like a transient Anthropic API failure worth retrying.
 *
 * The real SDK (`@anthropic-ai/sdk`) represents API failures as `Anthropic.APIError`
 * subclasses that all carry a numeric `.status` — except connection-level failures
 * (`APIConnectionError` / `APIConnectionTimeoutError`), whose `.status` is `undefined`.
 * We treat "no status" (network/connection errors) and HTTP 429 (rate limit) / 5xx
 * (server error) as transient. Any other 4xx (400 bad request, 401/403 auth, 404, 409,
 * 422) is a client-side problem that retrying can't fix, so it is not transient. We
 * check duck-typed shape (`"status" in error`) rather than `instanceof Anthropic.APIError`
 * so this also works against test doubles that mimic the SDK's error shape without
 * constructing the real class.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error) || !("status" in error)) {
    return false;
  }
  const status = (error as { status?: number }).status;
  return status === undefined || status === 429 || status >= 500;
}

export class AiClient {
  private readonly client: Anthropic;
  private readonly delay: DelayFn;

  constructor(apiKey: string, private readonly model: string, delay: DelayFn = defaultDelay) {
    this.client = new Anthropic({ apiKey });
    this.delay = delay;
  }

  async generateSlideCode(params: GenerateCodeParams): Promise<string> {
    const systemPrompt = buildSystemPrompt(params.theme, params.slideCount, params.language);
    const response = await this.createWithRetry(systemPrompt, params.topic);

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("Claude did not return a text response");
    }

    return extractCodeBlock(textBlock.text);
  }

  private async createWithRetry(systemPrompt: string, topic: string) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: `Taqdimot mavzusi: ${topic}` }],
        });
      } catch (error) {
        const isLastAttempt = attempt === MAX_ATTEMPTS;
        if (isLastAttempt || !isTransientError(error)) {
          throw error;
        }
        const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        await this.delay(backoffMs);
      }
    }
    // Unreachable: the loop always returns or throws.
    throw new Error("Claude API retry loop exited unexpectedly");
  }
}
