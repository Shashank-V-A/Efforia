import { createHash } from "crypto";
import type { NormalizedFeatures } from "@efforia/shared";

/**
 * Deterministic, non-reversible fingerprint from normalized features.
 * Same session → same hash; hash does not reveal content.
 */
export function fingerprintHash(features: NormalizedFeatures): string {
  const payload = [
    features.totalKeystrokes,
    features.meanKeystrokeInterval,
    features.insertCount,
    features.deleteCount,
    features.replaceCount,
    features.pasteCount,
    features.pasteLongBucketRatio,
    features.activeRatio,
    features.sessionDurationSeconds,
    features.fileChangeCount,
  ].join(":");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
