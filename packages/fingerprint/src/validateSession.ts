import type { SessionTelemetry } from "@efforia/shared";

/**
 * Minimal validation for session JSON. Throws with a clear message if invalid.
 */
export function validateSession(data: unknown): asserts data is SessionTelemetry {
  if (data === null || typeof data !== "object") {
    throw new Error("Session must be a JSON object");
  }
  const o = data as Record<string, unknown>;

  if (typeof o.sessionStart !== "string" || typeof o.sessionEnd !== "string") {
    throw new Error("Session must have sessionStart and sessionEnd (ISO strings)");
  }
  if (!Array.isArray(o.keystrokes)) {
    throw new Error("Session must have keystrokes (array)");
  }
  for (const k of o.keystrokes) {
    if (typeof k !== "object" || k === null) continue;
    const sample = k as Record<string, unknown>;
    if (typeof sample.count !== "number" || typeof sample.meanIntervalMs !== "number") {
      throw new Error("Each keystroke sample must have count and meanIntervalMs (numbers)");
    }
  }
  const editOps = o.editOps;
  if (typeof editOps !== "object" || editOps === null) {
    throw new Error("Session must have editOps (object with insert, delete, replace)");
  }
  const e = editOps as Record<string, unknown>;
  if (typeof e.insert !== "number" || typeof e.delete !== "number" || typeof e.replace !== "number") {
    throw new Error("editOps must have insert, delete, replace (numbers)");
  }
  if (!Array.isArray(o.pasteBuckets)) {
    throw new Error("Session must have pasteBuckets (array)");
  }
  const idleActive = o.idleActive;
  if (typeof idleActive !== "object" || idleActive === null) {
    throw new Error("Session must have idleActive (object with activeSeconds, idleSeconds)");
  }
  const ia = idleActive as Record<string, unknown>;
  if (typeof ia.activeSeconds !== "number" || typeof ia.idleSeconds !== "number") {
    throw new Error("idleActive must have activeSeconds and idleSeconds (numbers)");
  }
}
