import { describe, it, expect } from "vitest";
import { createLogger } from "../src/logger";

describe("createLogger", () => {
  it("creates a logger exposing the standard log level methods", () => {
    const logger = createLogger();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });
});
