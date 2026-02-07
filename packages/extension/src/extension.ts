import * as vscode from "vscode";
import type { EditOpCounts, IdleActiveSummary, KeystrokeSample, PasteBucket, SessionTelemetry } from "@efforia/shared";

const PASTE_BUCKETS = ["0-50", "51-200", "201-500", "501+"] as const;
const KEYSTROKE_INTERVAL_BUCKETS = [0, 100, 200, 500, 1000, 2000, 5000, 10000]; // ms
const IDLE_THRESHOLD_MS = 2000;
const THROTTLE_MS = 100; // batch document changes so handler doesn't run hundreds of times per second

interface KeystrokeAccum {
  count: number;
  intervals: number[];
}

function getPasteBucket(length: number): string {
  if (length <= 50) return "0-50";
  if (length <= 200) return "51-200";
  if (length <= 500) return "201-500";
  return "501+";
}

function bucketMeanInterval(ms: number): number {
  for (let i = KEYSTROKE_INTERVAL_BUCKETS.length - 1; i >= 0; i--) {
    if (ms >= KEYSTROKE_INTERVAL_BUCKETS[i]) return KEYSTROKE_INTERVAL_BUCKETS[i];
  }
  return 0;
}

function varianceBucket(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((s, x) => s + (x - mean) ** 2, 0) / intervals.length;
  const std = Math.sqrt(variance);
  if (std < 100) return 0;
  if (std < 400) return 1;
  return 2;
}

export function activate(context: vscode.ExtensionContext) {
  let sessionStart: string | null = null;
  let lastEventTime = 0;
  const keystrokeAccum: KeystrokeAccum = { count: 0, intervals: [] };
  const editOps: EditOpCounts = { insert: 0, delete: 0, replace: 0 };
  const pasteCountByBucket: Record<string, number> = { "0-50": 0, "51-200": 0, "201-500": 0, "501+": 0 };
  let activeMs = 0;
  let idleMs = 0;
  const fileChangeIds = new Set<string>();
  let isRunning = false;

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBarItem);
  function updateStatusBar() {
    const total = keystrokeAccum.count + editOps.insert + editOps.delete + editOps.replace;
    if (isRunning) {
      statusBarItem.text = `$(circle-filled) Efforia: active ${total > 0 ? `• ${total} edits` : ""}`;
      statusBarItem.tooltip = "PoK telemetry running. Use command palette: Efforia: Export session telemetry.";
      statusBarItem.show();
    } else {
      statusBarItem.text = "$(circle-outline) Efforia: stopped";
      statusBarItem.tooltip = "Start telemetry: Efforia: Start telemetry session";
      statusBarItem.show();
    }
  }
  updateStatusBar();

  function ensureSessionStarted() {
    if (!sessionStart) {
      sessionStart = new Date().toISOString();
      lastEventTime = Date.now();
    }
  }

  let throttleTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingEvents: { e: vscode.TextDocumentChangeEvent; now: number }[] = [];

  function processBatch() {
    throttleTimer = undefined;
    if (pendingEvents.length === 0) return;
    const batch = pendingEvents;
    pendingEvents = [];
    const now = batch[batch.length - 1].now;

    ensureSessionStarted();
    const elapsed = now - lastEventTime;
    if (elapsed > IDLE_THRESHOLD_MS) {
      idleMs += elapsed;
    } else {
      activeMs += Math.min(elapsed, IDLE_THRESHOLD_MS);
    }

    let prevEventTime = lastEventTime;
    for (const { e, now: eventNow } of batch) {
      fileChangeIds.add(e.document.uri.toString());
      for (const change of e.contentChanges) {
        const insertLen = change.text.length;
        const deleteLen = change.rangeLength;
        const isPaste = insertLen > 1;

        if (isPaste) {
          const bucket = getPasteBucket(insertLen);
          pasteCountByBucket[bucket] = (pasteCountByBucket[bucket] ?? 0) + 1;
          editOps.insert += 1;
        } else {
          if (deleteLen > 0 && insertLen > 0) editOps.replace += 1;
          else if (deleteLen > 0) editOps.delete += 1;
          else if (insertLen === 1) {
            keystrokeAccum.count += 1;
            if (prevEventTime > 0 && keystrokeAccum.intervals.length < 500) {
              const interval = eventNow - prevEventTime;
              if (interval >= 0 && interval <= 60000) keystrokeAccum.intervals.push(interval);
            }
            editOps.insert += 1;
          }
        }
        prevEventTime = eventNow;
      }
    }
    lastEventTime = now;
    if (isRunning) updateStatusBar();
  }

  const disposableDoc = vscode.workspace.onDidChangeTextDocument((e) => {
    if (!isRunning) return;
    const now = Date.now();
    pendingEvents.push({ e, now });
    if (!throttleTimer) {
      throttleTimer = setTimeout(processBatch, THROTTLE_MS);
    }
  });

  function buildSessionJson(): SessionTelemetry {
    const sessionEnd = new Date().toISOString();
    const intervals = keystrokeAccum.intervals;

    // Build keystroke samples: one bucket per mean-interval bucket
    const byIntervalBucket: Record<number, number[]> = {};
    for (const ms of intervals) {
      const b = bucketMeanInterval(ms);
      if (!byIntervalBucket[b]) byIntervalBucket[b] = [];
      byIntervalBucket[b].push(ms);
    }
    const keystrokes: KeystrokeSample[] = Object.entries(byIntervalBucket).map(([bucketMs, arr]) => ({
      count: arr.length,
      meanIntervalMs: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
      varianceBucket: varianceBucket(arr),
    }));

    const pasteBuckets: PasteBucket[] = PASTE_BUCKETS.map((bucket) => ({
      bucket,
      count: pasteCountByBucket[bucket] ?? 0,
    }));

    const idleActive: IdleActiveSummary = {
      activeSeconds: Math.round(activeMs / 1000),
      idleSeconds: Math.round(idleMs / 1000),
    };

    return {
      sessionStart: sessionStart ?? sessionEnd,
      sessionEnd,
      keystrokes,
      editOps: { ...editOps },
      pasteBuckets,
      idleActive,
      fileChangeCount: fileChangeIds.size,
    };
  }

  function resetSession() {
    sessionStart = null;
    lastEventTime = 0;
    keystrokeAccum.count = 0;
    keystrokeAccum.intervals = [];
    editOps.insert = 0;
    editOps.delete = 0;
    editOps.replace = 0;
    for (const k of PASTE_BUCKETS) pasteCountByBucket[k] = 0;
    activeMs = 0;
    idleMs = 0;
    fileChangeIds.clear();
  }

  context.subscriptions.push(
    disposableDoc,
    vscode.commands.registerCommand("efforia.startSession", () => {
      resetSession();
      isRunning = true;
      updateStatusBar();
      vscode.window.showInformationMessage("Efforia PoK: Telemetry session started.");
    }),
    vscode.commands.registerCommand("efforia.stopSession", () => {
      isRunning = false;
      updateStatusBar();
      vscode.window.showInformationMessage("Efforia PoK: Telemetry session stopped.");
    }),
    vscode.commands.registerCommand("efforia.exportSession", async () => {
      ensureSessionStarted();
      const session = buildSessionJson();
      const json = JSON.stringify(session, null, 2);
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      const defaultUri = workspaceRoot
        ? vscode.Uri.joinPath(workspaceRoot, `efforia-session-${Date.now()}.json`)
        : vscode.Uri.file(`efforia-session-${Date.now()}.json`);
      const uri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { JSON: ["json"] },
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, "utf-8"));
        if (workspaceRoot) {
          const efforiaDir = vscode.Uri.joinPath(workspaceRoot, ".efforia");
          try {
            await vscode.workspace.fs.createDirectory(efforiaDir);
            const lastPath = vscode.Uri.joinPath(efforiaDir, "last-session.json");
            await vscode.workspace.fs.writeFile(lastPath, Buffer.from(json, "utf-8"));
          } catch (_) {}
        }
        vscode.window.showInformationMessage("Efforia PoK: Session telemetry exported.");
      }
    }),
    vscode.commands.registerCommand("efforia.exportLastSession", async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!workspaceRoot) {
        vscode.window.showWarningMessage("Efforia: Open a workspace first to use Export last session.");
        return;
      }
      const lastPath = vscode.Uri.joinPath(workspaceRoot, ".efforia", "last-session.json");
      let data: Uint8Array;
      try {
        data = await vscode.workspace.fs.readFile(lastPath);
      } catch {
        vscode.window.showWarningMessage("Efforia: No last session found. Export a session first.");
        return;
      }
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(workspaceRoot, `efforia-last-session-${Date.now()}.json`),
        filters: { JSON: ["json"] },
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, data);
        vscode.window.showInformationMessage("Efforia PoK: Last session exported.");
      }
    })
  );

  // Auto-start session on activation so we capture from first use
  isRunning = true;
  ensureSessionStarted();
}

export function deactivate() {}
