import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SLIDE_RENDER_DPI, RENDER_TIMEOUT_MS } from "../config/constants";

const execFileAsync = promisify(execFile);

/**
 * Renders a built .pptx buffer to one JPEG buffer per slide, for visual QA.
 *
 * This shells out to fixed, hardcoded commands (`soffice`, `pdftoppm`) on a
 * file we just built ourselves - unlike the AI-generated code that runs
 * inside `isolated-vm`, nothing here is attacker-influenced input reaching a
 * shell, so this doesn't reopen the risk that sandbox was built to close.
 *
 * Each call gets its own temp dir and its own LibreOffice profile
 * (`-env:UserInstallation`) so concurrent renders don't fight over the same
 * profile lock, and a timeout so a wedged `soffice` process can't hang a
 * request forever.
 */
export async function renderSlidesToImages(pptxBuffer: Buffer): Promise<Buffer[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "slaydbot-render-"));
  try {
    const pptxPath = path.join(dir, "deck.pptx");
    await writeFile(pptxPath, pptxBuffer);

    await execFileAsync(
      "soffice",
      [
        "--headless",
        `-env:UserInstallation=file://${path.join(dir, "loconfig")}`,
        "--convert-to",
        "pdf",
        "--outdir",
        dir,
        pptxPath,
      ],
      { timeout: RENDER_TIMEOUT_MS }
    );

    const pdfPath = path.join(dir, "deck.pdf");
    const slidePrefix = path.join(dir, "slide");
    await execFileAsync("pdftoppm", ["-jpeg", "-r", String(SLIDE_RENDER_DPI), pdfPath, slidePrefix], {
      timeout: RENDER_TIMEOUT_MS,
    });

    const files = (await readdir(dir))
      .filter((name) => name.startsWith("slide") && name.endsWith(".jpg"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return await Promise.all(files.map((name) => readFile(path.join(dir, name))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
