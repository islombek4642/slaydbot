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

export class AiClient {
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateSlideCode(params: GenerateCodeParams): Promise<string> {
    const systemPrompt = buildSystemPrompt(params.theme, params.slideCount, params.language);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: `Taqdimot mavzusi: ${params.topic}` }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("Claude did not return a text response");
    }

    return extractCodeBlock(textBlock.text);
  }
}
