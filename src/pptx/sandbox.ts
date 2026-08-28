import ivm from "isolated-vm";
import type { BridgeFunctions } from "./bridge";
import { SANDBOX_TIMEOUT_MS, SANDBOX_MEMORY_LIMIT_MB } from "../config/constants";

export interface SandboxResult {
  success: boolean;
  error?: string;
}

/**
 * Runs Claude-generated JavaScript inside an isolated-vm isolate.
 *
 * The isolate is a fresh v8 context: it has no `require`, `process`, `fetch`,
 * or any other Node/browser global. The only things reachable from inside
 * the sandboxed code are the functions listed in `bridgeFunctions`, which are
 * exposed as plain global functions. Because isolated-vm auto-wraps plain
 * functions passed across the isolate boundary as *synchronous* callbacks by
 * default, calling e.g. `addSlide()` from sandboxed code blocks and returns
 * the host function's return value directly - no `.then()` required.
 */
export async function runInSandbox(code: string, bridgeFunctions: BridgeFunctions): Promise<SandboxResult> {
  const isolate = new ivm.Isolate({ memoryLimit: SANDBOX_MEMORY_LIMIT_MB });

  try {
    const context = await isolate.createContext();
    const jail = context.global;

    for (const [name, fn] of Object.entries(bridgeFunctions)) {
      // Passing a plain function is auto-wrapped by isolated-vm as a
      // synchronous Callback, so it appears in the isolate as a normal
      // synchronous function.
      await jail.set(name, (...args: unknown[]) => fn(...args));
    }

    const script = await isolate.compileScript(code);
    await script.run(context, { timeout: SANDBOX_TIMEOUT_MS });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (!isolate.isDisposed) {
      isolate.dispose();
    }
  }
}
