import { describe, it, expect, vi } from "vitest";
import { runInSandbox } from "../../src/pptx/sandbox";

describe("runInSandbox", () => {
  it("calls the exposed bridge function", async () => {
    const addSlide = vi.fn(() => 0);
    const result = await runInSandbox("addSlide();", { addSlide });
    expect(result.success).toBe(true);
    expect(addSlide).toHaveBeenCalledTimes(1);
  });

  it("passes arguments across the isolate boundary", async () => {
    const addText = vi.fn();
    const result = await runInSandbox('addText(0, "Salom dunyo");', { addText });
    expect(result.success).toBe(true);
    expect(addText).toHaveBeenCalledWith(0, "Salom dunyo");
  });

  it("returns success: false and captures the message when the code throws", async () => {
    const result = await runInSandbox("throw new Error('boom');", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("boom");
  });

  it("returns success: false when execution exceeds the timeout", async () => {
    const result = await runInSandbox("while (true) {}", {});
    expect(result.success).toBe(false);
  });

  it("does not expose require or process to the sandboxed code", async () => {
    const result = await runInSandbox("require('fs');", {});
    expect(result.success).toBe(false);
  });
});
