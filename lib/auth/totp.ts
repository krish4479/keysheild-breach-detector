import { generateSecret, generateURI, verify } from "otplib";

/** Verify a 6-digit TOTP code, tolerating ±1 time step (30s) of clock drift. */
export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token, epochTolerance: 30 });
    return result.valid;
  } catch {
    return false;
  }
}

export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI for enrolling in an authenticator app. */
export function totpAuthUri(accountEmail: string, secret: string): string {
  return generateURI({ issuer: "KeyShield", label: accountEmail, secret });
}
