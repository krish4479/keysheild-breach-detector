import { z } from "zod";
import { policySettingsSchema } from "../policy";

/**
 * Shared request schemas — the single source of truth for API input types.
 * Every schema is strict (unknown fields rejected). `z.infer` gives the client
 * its types; the server validates with the same object. ponytail: no
 * hand-duplicated interfaces.
 */

// Bounded to prevent abuse while still allowing 64+ char passphrases (NIST).
const passwordField = z.string().max(4096);
const userInputsField = z.array(z.string().max(256)).max(25).optional();

export const analyzeRequestSchema = z.strictObject({
  password: passwordField,
  userInputs: userInputsField,
});
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const checkBreachRequestSchema = z.strictObject({
  password: passwordField,
});
export type CheckBreachRequest = z.infer<typeof checkBreachRequestSchema>;

export const validateRequestSchema = z.strictObject({
  password: passwordField,
  userInputs: userInputsField,
  mfaEnabled: z.boolean().optional(),
});
export type ValidateRequest = z.infer<typeof validateRequestSchema>;

export const policyUpdateSchema = policySettingsSchema;
export type PolicyUpdate = z.infer<typeof policyUpdateSchema>;

export const loginRequestSchema = z.strictObject({
  email: z.email().max(320),
  password: z.string().min(1).max(4096),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const mfaRequestSchema = z.strictObject({
  code: z.string().regex(/^\d{6}$/, "Six-digit code required"),
});
export type MfaRequest = z.infer<typeof mfaRequestSchema>;

// WebAuthn ceremony payloads are browser-generated objects; validate the outer
// envelope loosely and let @simplewebauthn parse the nested structure.
export const webauthnResponseSchema = z.looseObject({
  id: z.string().min(1),
  type: z.string().optional(),
});
export type WebauthnResponse = z.infer<typeof webauthnResponseSchema>;
