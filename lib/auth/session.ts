import { and, eq, isNull } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { db } from "../db/client";
import { sessions, users, type User } from "../db/schema";
import { env } from "../env";
import { ApiError } from "../http";

/**
 * Sessions live in the DB; the encrypted cookie carries only the session id.
 * This gives us rotation, idle + absolute timeouts, server-side revocation, and
 * "log out everywhere" — none of which a stateless JWT could do. Tokens are never
 * placed in localStorage.
 */
interface CookiePayload {
  sessionId?: string;
}

const sessionOptions: SessionOptions = {
  password: env.SESSION_SECRET,
  cookieName: env.SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

async function cookieSession() {
  return getIronSession<CookiePayload>(await cookies(), sessionOptions);
}

export interface AuthContext {
  user: User;
  sessionId: string;
  mfaVerified: boolean;
}

export async function createSession(
  userId: string,
  opts: { ip?: string | null; userAgent?: string | null; mfaVerified: boolean },
): Promise<string> {
  const expiresAt = new Date(Date.now() + env.SESSION_ABSOLUTE_TIMEOUT_MIN * 60 * 1000);
  const inserted = await db
    .insert(sessions)
    .values({
      userId,
      mfaVerified: opts.mfaVerified,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      expiresAt,
    })
    .returning({ id: sessions.id });
  const row = inserted[0];
  if (!row) throw new ApiError(500, "session_error", "Could not create session.");

  const cs = await cookieSession();
  cs.sessionId = row.id;
  await cs.save();
  return row.id;
}

/** Load + validate the current session, enforcing idle & absolute timeouts. */
export async function getAuth(): Promise<AuthContext | null> {
  const cs = await cookieSession();
  const sessionId = cs.sessionId;
  if (!sessionId) return null;

  const found = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
    .limit(1);
  const row = found[0];
  if (!row) return null;

  const now = new Date();
  if (row.expiresAt <= now) {
    await revokeSession(sessionId);
    return null;
  }
  const idleMs = env.SESSION_IDLE_TIMEOUT_MIN * 60 * 1000;
  if (now.getTime() - row.lastSeenAt.getTime() > idleMs) {
    await revokeSession(sessionId);
    return null;
  }
  await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, sessionId));

  const foundUser = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  const user = foundUser[0];
  if (!user) return null;

  return { user, sessionId, mfaVerified: row.mfaVerified };
}

/** Rotate to a fresh MFA-verified session (called after a successful TOTP/passkey step). */
export async function elevateToMfaVerified(sessionId: string): Promise<string> {
  const found = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const old = found[0];
  if (!old) throw new ApiError(401, "unauthenticated", "Session not found.");
  const newId = await createSession(old.userId, {
    ip: old.ip,
    userAgent: old.userAgent,
    mfaVerified: true,
  });
  await revokeSession(sessionId);
  return newId;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

/** Revoke every active session for a user — "log out all sessions". */
export async function revokeAllForUser(userId: string): Promise<number> {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return revoked.length;
}

export async function destroyCurrentSession(): Promise<void> {
  const cs = await cookieSession();
  if (cs.sessionId) await revokeSession(cs.sessionId);
  cs.destroy();
}
