import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { env } from "../env";

const rpID = env.WEBAUTHN_RP_ID;
const rpName = env.WEBAUTHN_RP_NAME;
const origin = env.WEBAUTHN_ORIGIN;

export function publicKeyToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
export function base64UrlToPublicKey(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, "base64url");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new Uint8Array(ab);
}

interface StoredCred {
  id: string;
  transports?: string[] | null;
}

export function registrationOptions(user: { id: string; email: string }, existing: StoredCred[]) {
  return generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
}

export function verifyRegistration(response: RegistrationResponseJSON, expectedChallenge: string) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });
}

export function authenticationOptions(allow: StoredCred[]) {
  return generateAuthenticationOptions({
    rpID,
    allowCredentials: allow.map((c) => ({
      id: c.id,
      transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    userVerification: "preferred",
  });
}

export function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: WebAuthnCredential,
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential,
  });
}
