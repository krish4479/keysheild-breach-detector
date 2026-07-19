// Browser-side fetch helpers. Public endpoints don't need CSRF; cookie-authed
// mutations do (obtain + echo the double-submit token).

export async function ensureCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not obtain CSRF token");
  const data = (await res.json()) as { token: string };
  return data.token;
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export async function apiPost<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiMutate<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  const token = await ensureCsrfToken();
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-csrf-token": token },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}
