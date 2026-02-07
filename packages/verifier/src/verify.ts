import type { NormalizedFeatures, PoKCertificate, SessionTelemetry } from "@efforia/shared";

const MONAD_TESTNET_CHAIN_ID = 10143;
const DEFAULT_CONTRACT_ADDRESS = import.meta.env.VITE_POK_CONTRACT_ADDRESS || "";

/** Normalize session to features (browser-safe, mirrors @efforia/fingerprint) */
function normalize(session: SessionTelemetry): NormalizedFeatures {
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

/** SHA-256 hex using Web Crypto (browser-safe) */
async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Recompute fingerprint hash from normalized features */
async function fingerprintHash(features: NormalizedFeatures): Promise<string> {
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
  return sha256Hex(payload);
}

/** Recompute hash from session JSON; returns hex hash or error */
export async function recomputeHashFromSession(session: SessionTelemetry): Promise<string> {
  const features = normalize(session);
  return fingerprintHash(features);
}

/** Compare certificate fingerprint to recomputed session hash */
export async function certificateMatchesSession(
  cert: PoKCertificate,
  session: SessionTelemetry
): Promise<boolean> {
  const computed = await recomputeHashFromSession(session);
  return computed.toLowerCase() === cert.fingerprint_hash.toLowerCase();
}

export function getDefaultContractAddress(): string {
  return DEFAULT_CONTRACT_ADDRESS;
}

export function getMonadChainId(): number {
  return MONAD_TESTNET_CHAIN_ID;
}
