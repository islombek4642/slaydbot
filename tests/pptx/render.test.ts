import { describe, it, expect, vi, beforeEach } from "vitest";

const execFileMock = vi.fn((_file: string, _args: string[], _options: unknown, callback: Function) => {
  callback(null, "", "");
});

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => (execFileMock as any)(...args),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readdir: vi.fn().mockResolvedValue(["slide-2.jpg", "slide-1.jpg", "deck.pdf"]),
    readFile: vi.fn((path: string) => Promise.resolve(Buffer.from(`fake-image:${path}`))),
  };
});

import { renderSlidesToImages } from "../../src/pptx/render";
import { readFile as mockedReadFile } from "node:fs/promises";

describe("renderSlidesToImages", () => {
  beforeEach(() => {
    execFileMock.mockClear();
    (mockedReadFile as any).mockClear?.();
  });

  it("converts the deck to PDF, then to per-slide JPEGs in order", async () => {
    const images = await renderSlidesToImages(Buffer.from("fake-pptx-bytes"));

    expect(execFileMock).toHaveBeenCalledTimes(2);
    const [sofficeCall, pdftoppmCall] = execFileMock.mock.calls;
    expect(sofficeCall[0]).toBe("soffice");
    expect(sofficeCall[1]).toEqual(
      expect.arrayContaining(["--headless", "--convert-to", "pdf", "--outdir"])
    );
    expect(pdftoppmCall[0]).toBe("pdftoppm");
    expect(pdftoppmCall[1]).toEqual(expect.arrayContaining(["-jpeg", "-r", "150"]));

    // slide-1.jpg before slide-2.jpg despite readdir returning them out of order, and deck.pdf excluded.
    expect(images).toHaveLength(2);
    expect(images[0].toString()).toContain("slide-1.jpg");
    expect(images[1].toString()).toContain("slide-2.jpg");
  });
});
