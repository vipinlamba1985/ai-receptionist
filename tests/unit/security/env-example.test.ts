import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe(".env.example", () => {
  it("defaults to simulation mode", () => {
    const example = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(example).toMatch(/^SIMULATION=true$/m);
  });

  it("contains placeholders rather than a real Twilio Account SID", () => {
    const example = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(example).toContain("ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  });
});
