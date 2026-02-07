import type { NormalizedFeatures } from "@efforia/shared";

/**
 * Human-effort score [0, 1] using transparent, explainable heuristics.
 * No ML; all weights and thresholds are explicit.
 */

const WEIGHTS = {
  /** More keystrokes → more effort (capped) */
  keystrokeScore: 0.25,
  /** Typing pace: not too fast (bot-like) or too slow (idle) */
  paceScore: 0.2,
  /** Mix of insert/delete/replace suggests real editing */
  editDiversityScore: 0.2,
  /** Low paste ratio → more manual typing */
  lowPasteScore: 0.15,
  /** High active ratio → sustained engagement */
  activeRatioScore: 0.1,
  /** Longer session → more effort */
  durationScore: 0.1,
};

export function humanEffortScore(features: NormalizedFeatures): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};

  // Keystrokes: log scale, cap at 1. 100+ keystrokes gets high contribution.
  const keystrokeNorm = Math.min(1, Math.log10(features.totalKeystrokes + 1) / 2.5);
  breakdown.keystrokes = keystrokeNorm;

  // Pace: mean interval 150–800 ms is "human-like"; too low = bot, too high = idle.
  const interval = features.meanKeystrokeInterval;
  let paceNorm = 0;
  if (interval >= 80 && interval <= 2000) {
    if (interval >= 150 && interval <= 800) paceNorm = 1;
    else if (interval < 150) paceNorm = 0.3 + (interval / 150) * 0.7;
    else paceNorm = Math.max(0.2, 1 - (interval - 800) / 2000);
  }
  breakdown.pace = paceNorm;

  // Edit diversity: having both inserts and deletes (or replaces) is human-like.
  const totalOps = features.insertCount + features.deleteCount + features.replaceCount;
  let diversityNorm = 0;
  if (totalOps >= 5) {
    const hasInsert = features.insertCount > 0;
    const hasDelete = features.deleteCount > 0;
    const hasReplace = features.replaceCount > 0;
    diversityNorm = (Number(hasInsert) + Number(hasDelete) + Number(hasReplace)) / 3;
  } else if (totalOps > 0) diversityNorm = 0.5;
  breakdown.editDiversity = diversityNorm;

  // Low paste ratio: fewer large pastes → more manual effort.
  const lowPasteNorm = 1 - features.pasteLongBucketRatio;
  breakdown.lowPaste = Math.max(0, lowPasteNorm);

  // Active ratio: time spent in active state.
  breakdown.activeRatio = features.activeRatio;

  // Duration: 5+ minutes = 1; scale below.
  const durationNorm = Math.min(1, features.sessionDurationSeconds / 300);
  breakdown.duration = durationNorm;

  const score =
    WEIGHTS.keystrokeScore * breakdown.keystrokes +
    WEIGHTS.paceScore * breakdown.pace +
    WEIGHTS.editDiversityScore * breakdown.editDiversity +
    WEIGHTS.lowPasteScore * breakdown.lowPaste +
    WEIGHTS.activeRatioScore * breakdown.activeRatio +
    WEIGHTS.durationScore * breakdown.duration;

  return {
    score: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)),
    breakdown,
  };
}

export function confidenceLevel(
  features: NormalizedFeatures,
  score: number
): "low" | "medium" | "high" {
  const totalActivity = features.totalKeystrokes + features.insertCount + features.deleteCount + features.replaceCount;
  if (totalActivity < 20 || features.sessionDurationSeconds < 60) return "low";
  if (totalActivity >= 100 && features.sessionDurationSeconds >= 300 && score >= 0.4) return "high";
  return "medium";
}
