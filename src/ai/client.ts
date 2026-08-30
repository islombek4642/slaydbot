import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, VISUAL_QA_PROMPT } from "./designGuide";
import type { Theme } from "../pptx/themes/types";

export interface PreviousAttempt {
  code: string;
  feedback: string;
}

export interface GenerateCodeParams {
  topic: string;
  slideCount: number;
  language: string;
  theme: Theme;
  /** When set, asks Claude to fix the previous attempt instead of starting fresh. */
  previousAttempt?: PreviousAttempt;
}

export interface VisualQaResult {
  /** Empty means the render passed QA. */
  issues: string[];
}

export function extractCodeBlock(text: string): string {
  const match = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

function buildUserMessage(topic: string, previousAttempt?: PreviousAttempt): string {
  if (!previousAttempt) {
    return `Taqdimot mavzusi: ${topic}`;
  }
  return `Taqdimot mavzusi: ${topic}

Oldingi urinishda siz quyidagi kodni yozgan edingiz:
\`\`\`javascript
${previousAttempt.code}
\`\`\`

Bu kodda quyidagi muammo(lar) topildi:
${previousAttempt.feedback}

Kodni shu muammolarni hisobga olib TO'LIQ qaytadan yozing (faqat JavaScript kod, boshqa hech qanday izoh yozmang).`;
}

export function parseVisualQaResult(text: string): VisualQaResult {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = match ? match[1].trim() : text.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Visual QA response is not valid JSON: ${text}`);
  }
  const issues = (parsed as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(issues) || !issues.every((issue) => typeof issue === "string")) {
    throw new Error(`Visual QA response is not in the expected { issues: string[] } shape: ${text}`);
  }
  return { issues };
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
 * We treat "no status" (network/connection errors), HTTP 408 (request timeout), HTTP 429
 * (rate limit), and 5xx (server error) as transient. Any other 4xx (400 bad request,
 * 401/403 auth, 404, 409, 422) is a client-side problem that retrying can't fix, so it
 * is not transient. We check duck-typed shape (`"status" in error`) rather than
 * `instanceof Anthropic.APIError` so this also works against test doubles that mimic
 * the SDK's error shape without constructing the real class.
 *
 * Note: the SDK's own default retries (`maxRetries`) are disabled via `maxRetries: 0`
 * in the `Anthropic` client constructor below, so this retry loop is the sole retry
 * layer — 408 previously landed here only after the SDK partially retried it itself.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error) || !("status" in error)) {
    return false;
  }
  const status = (error as { status?: number }).status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

export class AiClient {
  private readonly client: Anthropic;
  private readonly delay: DelayFn;
  private model: string;

  constructor(apiKey: string, model: string, delay: DelayFn = defaultDelay) {
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
    this.model = model;
    this.delay = delay;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async generateSlideCode(params: GenerateCodeParams): Promise<string> {
    const systemPrompt = buildSystemPrompt(params.theme, params.slideCount, params.language);
    const response = await this.createWithRetry({
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: buildUserMessage(params.topic, params.previousAttempt) }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("Claude did not return a text response");
    }

    return extractCodeBlock(textBlock.text);
  }

  async reviewSlides(images: Buffer[]): Promise<VisualQaResult> {
    const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: VISUAL_QA_PROMPT }];
    images.forEach((image, index) => {
      content.push({ type: "text", text: `Slayd ${index + 1}:` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: image.toString("base64") },
      });
    });

    const response = await this.createWithRetry({
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("Claude did not return a text response for visual QA");
    }

    return parseVisualQaResult(textBlock.text);
  }

  private async createWithRetry(
    params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model">
  ) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.client.messages.create({ ...params, model: this.model });
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
