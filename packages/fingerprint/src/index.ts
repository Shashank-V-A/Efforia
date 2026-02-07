import type { PoKCertificate, SessionTelemetry } from "@efforia/shared";
import { fingerprintHash } from "./hash";
import { normalize } from "./normalize";
import { humanEffortScore, confidenceLevel } from "./score";

/**
 * Produce a PoK certificate from session telemetry.
 * Deterministic: same session → same fingerprint_hash and score.
 */
export function sessionToCertificate(session: SessionTelemetry): PoKCertificate {
  const features = normalize(session);
  const hash = fingerprintHash(features);
  const { score } = humanEffortScore(features);
  const confidence = confidenceLevel(features, score);
  const start = new Date(session.sessionStart).getTime();
  const end = new Date(session.sessionEnd).getTime();
  const sessionDurationSeconds = Math.max(0, Math.round((end - start) / 1000));

  return {
    fingerprint_hash: hash,
    human_effort_score: score,
    confidence_level: confidence,
    timestamp: new Date().toISOString(),
    session_duration_seconds: sessionDurationSeconds,
  };
}

export { normalize, fingerprintHash, humanEffortScore, confidenceLevel };
export type { SessionTelemetry, PoKCertificate, NormalizedFeatures } from "@efforia/shared";
