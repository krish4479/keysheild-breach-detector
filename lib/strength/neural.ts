import modelJson from "./neural-model.json";

/**
 * Neural guessability — a character-level neural n-gram language model (NPLM)
 * trained offline on the rockyou breach corpus, weighted by real HIBP breach
 * frequency. It predicts the next character of a password; passwords it predicts
 * easily resemble leaked ones (weak), passwords that surprise it are strong.
 *
 * A COMPLEMENT to zxcvbn, not a replacement. Runs 100% locally in the browser —
 * the password never leaves the device, exactly like the rest of the engine.
 *
 * Every path is defensive: if the model is missing/malformed or anything throws,
 * scoreNeural() returns null and the caller silently falls back to zxcvbn. This
 * feature can NEVER crash the checker.
 */

export type NeuralLabel = "Weak" | "Fair" | "Good" | "Strong";

export interface NeuralScore {
  /** 0–100; higher = stronger (less predictable to the model). */
  score: number;
  label: NeuralLabel;
  /** log10 of the model's estimated guesses to reach this password. */
  guessesLog10: number;
  /** average per-character surprise (negative log-likelihood, nats). */
  avgSurprise: number;
  /** how many passwords the model was trained on (for display). */
  trainedOn: number;
}

interface NeuralModel {
  k: number;
  d: number;
  h: number;
  V: number;
  chars: string;
  pad: number;
  end: number;
  unk: number;
  base: number;
  emb: number[][];
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
  /** score anchors on the log10-estimated-guesses scale (accounts for length). */
  calib: { low: number; high: number };
  meta?: { trainedOnPasswords?: number };
}

const MODEL: NeuralModel | null = loadModel();

function loadModel(): NeuralModel | null {
  try {
    const m = modelJson as unknown as NeuralModel;
    if (!m || typeof m.chars !== "string") return null;
    if (typeof m.k !== "number" || typeof m.d !== "number" || typeof m.h !== "number") return null;
    if (m.k <= 0 || m.d <= 0 || m.h <= 0 || m.V <= 0) return null;
    if (!Array.isArray(m.emb) || !Array.isArray(m.W1) || !Array.isArray(m.W2)) return null;
    if (!Array.isArray(m.b1) || !Array.isArray(m.b2)) return null;
    if (!m.calib || typeof m.calib.low !== "number" || m.calib.high === m.calib.low) return null;
    return m;
  } catch {
    return null;
  }
}

/** True when a usable model is loaded — lets the UI decide whether to render. */
export function neuralAvailable(): boolean {
  return MODEL !== null;
}

function tokenIndex(m: NeuralModel, ch: string): number {
  const p = m.chars.indexOf(ch);
  return p < 0 ? m.unk : p + m.base;
}

function labelFor(score: number): NeuralLabel {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Good";
  if (score >= 25) return "Fair";
  return "Weak";
}

/**
 * Score a password with the neural model. Returns null for empty input, when no
 * model is loaded, or on any internal error (never throws).
 */
export function scoreNeural(password: string): NeuralScore | null {
  const m = MODEL;
  if (!m || !password) return null;
  try {
    const { k, d, h, V } = m;

    // tokens = k padding + one index per character + end-of-string
    const tokens: number[] = [];
    for (let i = 0; i < k; i++) tokens.push(m.pad);
    for (const ch of password) tokens.push(tokenIndex(m, ch));
    tokens.push(m.end);

    let totalNll = 0;
    let preds = 0;

    for (let t = k; t < tokens.length; t++) {
      const target = tokens[t] ?? m.unk;

      // input x = concatenated embeddings of the previous k tokens
      const x = new Array<number>(k * d).fill(0);
      for (let c = 0; c < k; c++) {
        const tok = tokens[t - k + c] ?? m.pad;
        const row = m.emb[tok];
        if (!row) continue;
        for (let j = 0; j < d; j++) x[c * d + j] = row[j] ?? 0;
      }

      // hidden a1 = tanh(x · W1 + b1)
      const a1 = new Array<number>(h).fill(0);
      for (let j = 0; j < h; j++) {
        let s = m.b1[j] ?? 0;
        for (let i = 0; i < k * d; i++) {
          const wrow = m.W1[i];
          if (wrow) s += (x[i] ?? 0) * (wrow[j] ?? 0);
        }
        a1[j] = Math.tanh(s);
      }

      // logits = a1 · W2 + b2, then softmax probability of the target
      let maxLogit = -Infinity;
      const logits = new Array<number>(V).fill(0);
      for (let vi = 0; vi < V; vi++) {
        let s = m.b2[vi] ?? 0;
        for (let j = 0; j < h; j++) {
          const wrow = m.W2[j];
          if (wrow) s += (a1[j] ?? 0) * (wrow[vi] ?? 0);
        }
        logits[vi] = s;
        if (s > maxLogit) maxLogit = s;
      }
      let sumExp = 0;
      for (let vi = 0; vi < V; vi++) sumExp += Math.exp((logits[vi] ?? 0) - maxLogit);
      const pTarget = Math.exp((logits[target] ?? -Infinity) - maxLogit) / (sumExp || 1);
      totalNll += -Math.log(pTarget + 1e-12);
      preds++;
    }

    if (preds === 0) return null;

    // Score on total guessability = log10(estimated guesses); this accounts for
    // length, so long passphrases score high (unlike a per-character measure).
    const guessesLog10 = totalNll / Math.LN10;
    const { low, high } = m.calib;
    const raw = ((guessesLog10 - low) / (high - low)) * 100;
    const score = Math.max(0, Math.min(100, raw));

    return {
      score: Math.round(score),
      label: labelFor(score),
      guessesLog10: Math.round(guessesLog10 * 10) / 10,
      avgSurprise: Math.round((totalNll / preds) * 100) / 100,
      trainedOn: m.meta?.trainedOnPasswords ?? 0,
    };
  } catch {
    return null;
  }
}
