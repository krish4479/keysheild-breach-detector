import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/http";

// TRUSTED_PROXY_COUNT defaults to 1, so the real client is the right-most XFF entry;
// attacker-prepended left-most values must be ignored.
function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api", { headers });
}

describe("clientIp — trusted-proxy X-Forwarded-For resolution", () => {
  it("ignores a spoofed left-most XFF value and takes the trusted right-most hop", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(reqWith({ "x-forwarded-for": "evil-spoof, evil-2, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("uses the single XFF value when there is one hop", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then a sentinel, when XFF is absent", () => {
    expect(clientIp(reqWith({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(reqWith({}))).toBe("0.0.0.0");
  });
});
