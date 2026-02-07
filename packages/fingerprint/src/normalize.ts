import type { NormalizedFeatures, SessionTelemetry } from "@efforia/shared";

/**
 * Derive normalized, numeric features from session telemetry.
 * No raw content or identifiers; suitable for hashing.
 */
export function normalize(session: SessionTelemetry): NormalizedFeatures {
  const totalKeystrokes = session.keystrokes.reduce((s, k) => s + k.count, 0);
  let weightedInterval = 0;
  let totalWeight = 0;
  for (const k of session.keystrokes) {
    weightedInterval += k.meanIntervalMs * k.count;
    totalWeight += k.count;
  }
  const meanKeystrokeInterval = totalWeight > 0 ? weightedInterval / totalWeight : 0;

  const pasteCount = session.pasteBuckets.reduce((s, p) => s + p.count, 0);
  const longPasteCount = session.pasteBuckets
    .filter((p) => p.bucket === "201-500" || p.bucket === "501+")
    .reduce((s, p) => s + p.count, 0);
  const pasteLongBucketRatio = pasteCount > 0 ? longPasteCount / pasteCount : 0;

  const totalSeconds = session.idleActive.activeSeconds + session.idleActive.idleSeconds;
  const activeRatio = totalSeconds > 0 ? session.idleActive.activeSeconds / totalSeconds : 0;

  const start = new Date(session.sessionStart).getTime();
  const end = new Date(session.sessionEnd).getTime();
  const sessionDurationSeconds = Math.max(0, Math.round((end - start) / 1000));

  return {
    totalKeystrokes,
    meanKeystrokeInterval: Math.round(meanKeystrokeInterval),
    insertCount: session.editOps.insert,
    deleteCount: session.editOps.delete,
    replaceCount: session.editOps.replace,
    pasteCount,
    pasteLongBucketRatio: Math.round(pasteLongBucketRatio * 1000) / 1000,
    activeRatio: Math.round(activeRatio * 1000) / 1000,
    sessionDurationSeconds,
    fileChangeCount: session.fileChangeCount ?? 0,
  };
}
