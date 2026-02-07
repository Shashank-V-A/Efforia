/**
 * Shared types and constants for the Proof-of-Knowledge (PoK) system.
 * Certificate format is agreed between extension → fingerprint → contract → verifier.
 */

// --- Session telemetry (exported by VS Code extension; never contains raw content) ---

export interface KeystrokeSample {
  /** Count of keystrokes in this bucket */
  count: number;
  /** Mean interval in ms (bucketed) */
  meanIntervalMs: number;
  /** Bucket index for variance (e.g. low/med/high) */
  varianceBucket: number;
}

export interface EditOpCounts {
  insert: number;
  delete: number;
  replace: number;
}

export interface PasteBucket {
  /** Bucket label: e.g. "0-50", "51-200", "201-500", "501+" */
  bucket: string;
  count: number;
}

export interface IdleActiveSummary {
  /** Seconds in active (typing/editing) state */
  activeSeconds: number;
  /** Seconds in idle (no input) state */
  idleSeconds: number;
}

export interface SessionTelemetry {
  /** Session start ISO timestamp */
  sessionStart: string;
  /** Session end ISO timestamp */
  sessionEnd: string;
  /** Keystroke timing aggregates only */
  keystrokes: KeystrokeSample[];
  /** Edit operation counts only */
  editOps: EditOpCounts;
  /** Paste events by length bucket only */
  pasteBuckets: PasteBucket[];
  /** Idle vs active time */
  idleActive: IdleActiveSummary;
  /** Optional: number of distinct "files" (no names), for diversity signal */
  fileChangeCount?: number;
}

// --- Normalized features (internal to fingerprint; derived from SessionTelemetry) ---

export interface NormalizedFeatures {
  totalKeystrokes: number;
  meanKeystrokeInterval: number;
  insertCount: number;
  deleteCount: number;
  replaceCount: number;
  pasteCount: number;
  pasteLongBucketRatio: number;
  activeRatio: number;
  sessionDurationSeconds: number;
  fileChangeCount: number;
}

// --- PoK Certificate (output of fingerprint; can be anchored on-chain) ---

export type ConfidenceLevel = "low" | "medium" | "high";

/** Optional score breakdown (explainable heuristics) for verifier display */
export interface ScoreBreakdown {
  keystrokes?: number;
  pace?: number;
  editDiversity?: number;
  lowPaste?: number;
  activeRatio?: number;
  duration?: number;
}

export interface PoKCertificate {
  /** SHA-256 hex of normalized features (deterministic, non-reversible) */
  fingerprint_hash: string;
  /** Human effort score in [0, 1] */
  human_effort_score: number;
  confidence_level: ConfidenceLevel;
  /** ISO timestamp when certificate was generated */
  timestamp: string;
  /** Optional: author address (set when preparing for on-chain anchor) */
  author_address?: string;
  /** Optional: session duration in seconds (for display) */
  session_duration_seconds?: number;
  /** Optional: score breakdown for verifier display */
  score_breakdown?: ScoreBreakdown;
}

// --- Verifier input: certificate + optional chain proof ---

export interface VerificationInput {
  certificate: PoKCertificate;
  /** If set, verifier will check this hash on-chain */
  chainId?: number;
  contractAddress?: string;
}

export interface VerificationResult {
  valid: boolean;
  message: string;
  certificate?: PoKCertificate;
  onChain?: {
    found: boolean;
    score: string;
    timestamp: string;
    author: string;
    blockNumber?: number;
  };
}
