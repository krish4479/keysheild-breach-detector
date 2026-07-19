import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    BREACH_MODE: "online" as "online" | "offline",
    HIBP_API_BASE: "https://api.pwnedpasswords.com",
    HIBP_ADD_PADDING: true,
    HIBP_TIMEOUT_MS: 3500,
    BREACH_CACHE_TTL_SEC: 300,
    BREACH_CORPUS_PATH: "lib/breach/offline-corpus.txt",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/env", () => ({ env: mockEnv, isProd: false }));
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 1) }),
  pingRedis: vi.fn(async () => true),
}));

// Import after the mocks are registered.
const { checkBreach } = await import("@/lib/breach");

// SHA1("123456") = 7C4A8D09CA3762AF61E59520943DC26494F8941B → prefix 7C4A8, suffix:
const SUFFIX_123456 = "D09CA3762AF61E59520943DC26494F8941B";

afterEach(() => {
  vi.unstubAllGlobals();
  mockEnv.BREACH_MODE = "online";
});

describe("breach detection — online (mocked HIBP)", () => {
  it("reports breached with the count when the suffix is present", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`${SUFFIX_123456}:436545\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:0`)));
    const r = await checkBreach("123456");
    expect(r.breached).toBe(true);
    expect(r.count).toBe(436545);
    expect(r.status).toBe("breached");
  });

  it("reports safe when the suffix is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("0000000000000000000000000000000000:5")));
    const r = await checkBreach("some-unique-passphrase");
    expect(r.breached).toBe(false);
    expect(r.status).toBe("safe");
  });

  it("degrades to unknown when HIBP is unreachable — never hard-fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const r = await checkBreach("anything");
    expect(r.status).toBe("unknown");
    expect(r.breached).toBe(false);
  });

  it("only ever sends the 5-char prefix — never the password or full hash", async () => {
    const fetchMock = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", fetchMock);
    await checkBreach("123456");
    const calls = fetchMock.mock.calls as unknown as unknown[][];
    const url = String(calls[0]?.[0]);
    expect(url).toContain("/range/7C4A8");
    expect(url).not.toContain("123456");
    expect(url).not.toContain(SUFFIX_123456);
  });
});

describe("breach detection — offline corpus", () => {
  beforeEach(() => {
    mockEnv.BREACH_MODE = "offline";
  });

  it("finds a known breached password in the offline corpus", async () => {
    const r = await checkBreach("123456");
    expect(r.breached).toBe(true);
    expect(r.source).toBe("offline");
  });

  it("reports safe for a password absent from the corpus", async () => {
    const r = await checkBreach("9x!Qm2#vLp8@Tz6&Rw-unique");
    expect(r.breached).toBe(false);
  });
});
