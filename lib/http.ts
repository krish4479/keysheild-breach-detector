import type { z } from "zod";
import { env } from "./env";
import { reportError } from "./telemetry";

/** Typed API error that maps cleanly to an HTTP response. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Read + size-limit a JSON body. Empty body → {}. */
export async function readJsonBody(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "payload_too_large", "Request body too large.");
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
}

/** Validate `data` against a schema, throwing a 400 ApiError on failure. */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(400, "validation_error", "Request failed validation.", {
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        message: i.message,
      })),
    });
  }
  return parsed.data;
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = { error: err.code, message: err.message };
    if (err.details) body.details = err.details;
    const headers: Record<string, string> = {};
    const retryAfter = err.details?.retryAfter;
    if (err.code === "rate_limited" && typeof retryAfter === "number") {
      headers["Retry-After"] = String(retryAfter);
    }
    return Response.json(body, { status: err.status, headers });
  }
  reportError(err);
  return Response.json({ error: "internal_error", message: "An unexpected error occurred." }, { status: 500 });
}

/** Wrap a handler so thrown ApiErrors/errors become well-formed responses. */
export function route(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/**
 * Client IP from X-Forwarded-For, read as the client seen by the outermost
 * *trusted* proxy (counting TRUSTED_PROXY_COUNT hops from the right). A client can
 * prepend fake left-most entries, but trusted proxies append the real peer on the
 * right, so this can't be spoofed when the hop count matches the deployment.
 * With 0 trusted proxies, XFF is ignored entirely.
 */
export function clientIp(req: Request): string {
  const count = env.TRUSTED_PROXY_COUNT;
  if (count > 0) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const chain = xff
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (chain.length > 0) {
        const idx = Math.min(chain.length - 1, Math.max(0, chain.length - count));
        const ip = chain[idx];
        if (ip) return ip;
      }
    }
  }
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}
