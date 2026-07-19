import { env } from "../env";
import { logger } from "../logging/logger";

/**
 * OpenTelemetry + error-reporting seams, behind env flags. No heavy SDKs are
 * installed; wire Sentry/OTel here when the flags are set. ponytail: a seam, not
 * a speculative integration — add the SDK the day you turn the flag on.
 */
export const telemetryEnabled = Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT);
export const errorReportingEnabled = Boolean(env.SENTRY_DSN);

export function reportError(err: unknown, context?: Record<string, unknown>): void {
  if (errorReportingEnabled) {
    // e.g. Sentry.captureException(err, { extra: context });
  }
  logger.error({ err, ...context }, "unhandled_error");
}
