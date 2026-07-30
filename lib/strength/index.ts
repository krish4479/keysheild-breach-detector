import { ZxcvbnFactory, type ZxcvbnResult } from "@zxcvbn-ts/core";
import * as common from "@zxcvbn-ts/language-common";
import * as en from "@zxcvbn-ts/language-en";

/**
 * Shared strength engine. Imported by BOTH the client checker and the server
 * /api/password/analyze route so verdicts are byte-for-byte identical.
 * Wraps zxcvbn-ts (reusing its walk/date/repeat/l33t/dictionary detection)
 * rather than re-implementing those rules. ponytail: don't rebuild the engine.
 */

export type StrengthScore = 0 | 1 | 2 | 3 | 4;
export type StrengthLabel = "Weak" | "Fair" | "Good" | "Strong";

export interface StrengthResult {
  score: StrengthScore;
  label: StrengthLabel;
  guessesLog10: number;
  entropyBits: number;
  crackTimeDisplay: string;
  reasons: string[];
  suggestions: string[];
}

let factory: ZxcvbnFactory | null = null;
function getFactory(): ZxcvbnFactory {
  if (!factory) {
    factory = new ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...en.dictionary },
      graphs: common.adjacencyGraphs,
      translations: en.translations,
    });
  }
  return factory;
}

export function labelForScore(score: StrengthScore): StrengthLabel {
  // Matches the "Entropy & Vault" ramp: 0-1 weak, 2 fair, 3 good, 4 strong.
  return score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
}

/**
 * True when the password reuses the username (or any part of it). We flag the
 * whole username, and any run of >= 4 characters shared with it — so a username
 * of "krishjosh" blocks passwords containing "krish", "rish", "josh", etc.
 * Shared client + server so the checker preview and the server verdict agree.
 */
export function passwordContainsUserToken(password: string, userInputs: string[]): boolean {
  const pw = password.toLowerCase();
  if (!pw) return false;
  for (const raw of userInputs) {
    const u = raw.trim().toLowerCase();
    if (!u) continue;
    if (u.length >= 3 && pw.includes(u)) return true; // whole username present
    for (const token of u.split(/[^a-z0-9]+/)) {
      for (let i = 0; i + 4 <= token.length; i++) {
        if (pw.includes(token.slice(i, i + 4))) return true;
      }
    }
  }
  return false;
}

const LOG2_10 = Math.log2(10);
type Match = ZxcvbnResult["sequence"][number];

export function analyzeStrength(password: string, userInputs: string[] = []): StrengthResult {
  const cleanInputs = userInputs.map((s) => s.trim()).filter(Boolean);
  const result = getFactory().check(password, cleanInputs);

  const score = Math.max(0, Math.min(4, result.score)) as StrengthScore;

  return {
    score,
    label: labelForScore(score),
    guessesLog10: Math.round(result.guessesLog10 * 100) / 100,
    entropyBits: Math.round(result.guessesLog10 * LOG2_10),
    crackTimeDisplay: result.crackTimes.offlineSlowHashingXPerSecond.display,
    reasons: collectReasons(result),
    suggestions: collectSuggestions(result),
  };
}

function collectReasons(result: ZxcvbnResult): string[] {
  const reasons: string[] = [];
  if (result.feedback.warning) reasons.push(result.feedback.warning);
  for (const match of result.sequence) {
    const reason = reasonForMatch(match);
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }
  return reasons;
}

function reasonForMatch(match: Match): string | null {
  switch (match.pattern) {
    case "spatial":
      return "Contains a keyboard walk (e.g. qwerty / asdf).";
    case "repeat":
      return "Contains repeated characters or runs.";
    case "sequence":
      return "Contains a sequential run (e.g. 1234 / abcd).";
    case "date":
      return "Contains a date, year, or birthday.";
    case "regex":
      return "Contains a predictable numeric pattern.";
    case "dictionary": {
      const parts: string[] = [];
      const name = "dictionaryName" in match ? String(match.dictionaryName) : "";
      if (name === "userInputs") parts.push("Contains personal or site-specific information.");
      else if (name.includes("passwords")) parts.push("Based on a common password.");
      else parts.push("Contains a common dictionary word.");
      if ("l33t" in match && match.l33t) parts.push("Leetspeak substitutions (e.g. P@ssw0rd) add little strength.");
      return parts.join(" ");
    }
    default:
      return null;
  }
}

function collectSuggestions(result: ZxcvbnResult): string[] {
  const suggestions = [...result.feedback.suggestions];
  if (suggestions.length === 0 && result.score >= 3) return ["Looks strong — keep it unique to this account."];
  if (suggestions.length === 0) suggestions.push("Use several unrelated words to form a long passphrase.");
  return [...new Set(suggestions)];
}
