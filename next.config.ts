import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Slim, self-contained server output for the non-root Docker image.
  output: "standalone",
  // Never advertise the framework/version.
  poweredByHeader: false,
  // Native / node-only deps must not be bundled by the server compiler.
  serverExternalPackages: ["@node-rs/argon2", "@simplewebauthn/server", "postgres", "ioredis", "pino"],
};

export default nextConfig;
