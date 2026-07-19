import { describe, expect, it } from "vitest";
import { analyzeStrength, labelForScore } from "@/lib/strength";

describe("strength engine", () => {
  it("labels the ramp: 0-1 Weak, 2 Fair, 3 Good, 4 Strong", () => {
    expect(labelForScore(0)).toBe("Weak");
    expect(labelForScore(1)).toBe("Weak");
    expect(labelForScore(2)).toBe("Fair");
    expect(labelForScore(3)).toBe("Good");
    expect(labelForScore(4)).toBe("Strong");
  });

  it("rates a heavily-used password as Weak", () => {
    const r = analyzeStrength("123456");
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.label).toBe("Weak");
  });

  it("rates a long unrelated passphrase as Strong", () => {
    const r = analyzeStrength("correct horse battery staple");
    expect(r.label).toBe("Strong");
    expect(r.entropyBits).toBeGreaterThan(50);
  });

  it("is deterministic — the same input always yields the same verdict (client == server)", () => {
    const a = analyzeStrength("Summer2024!");
    const b = analyzeStrength("Summer2024!");
    expect(a).toEqual(b);
    expect(a.label).toBe("Fair");
  });

  it("penalizes passwords built from user-specific terms", () => {
    const withContext = analyzeStrength("keyshield2024", ["keyshield", "keyshield.local"]);
    const without = analyzeStrength("keyshield2024");
    expect(withContext.score).toBeLessThanOrEqual(without.score);
    expect(withContext.reasons.length).toBeGreaterThan(0);
  });

  it("flags keyboard walks", () => {
    const r = analyzeStrength("qwertyuiop");
    expect(r.reasons.join(" ").toLowerCase()).toMatch(/keyboard|common/);
  });
});
