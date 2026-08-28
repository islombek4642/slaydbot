import { describe, it, expect } from "vitest";
import { validateGeneratedCode } from "../../src/ai/codeValidator";

describe("validateGeneratedCode", () => {
  it("accepts plain bridge calls", () => {
    const code = 'const s = addSlide();\naddText(s, "Salom");';
    expect(validateGeneratedCode(code)).toEqual({ valid: true });
  });

  it("rejects code using require", () => {
    const result = validateGeneratedCode("require('fs').readFileSync('/etc/passwd');");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/require/);
  });

  it("rejects code using process", () => {
    expect(validateGeneratedCode("process.exit(1);").valid).toBe(false);
  });

  it("rejects code using eval", () => {
    expect(validateGeneratedCode("eval('1+1');").valid).toBe(false);
  });

  it("rejects code using the Function constructor", () => {
    expect(validateGeneratedCode("Function('return 1')();").valid).toBe(false);
  });

  it("rejects code touching __proto__", () => {
    expect(validateGeneratedCode("({}).__proto__.polluted = true;").valid).toBe(false);
  });
});
