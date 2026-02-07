"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("path");

const indexPath = path.join(__dirname, "..", "dist", "index.js");
const { normalize, fingerprintHash, humanEffortScore, sessionToCertificate } = require(indexPath);

const sampleSession = {
  sessionStart: "2025-02-07T10:00:00.000Z",
  sessionEnd: "2025-02-07T10:15:00.000Z",
  keystrokes: [
    { count: 80, meanIntervalMs: 180, varianceBucket: 1 },
    { count: 120, meanIntervalMs: 250, varianceBucket: 1 },
  ],
  editOps: { insert: 150, delete: 30, replace: 12 },
  pasteBuckets: [
    { bucket: "0-50", count: 2 },
    { bucket: "51-200", count: 0 },
    { bucket: "201-500", count: 0 },
    { bucket: "501+", count: 0 },
  ],
  idleActive: { activeSeconds: 600, idleSeconds: 300 },
  fileChangeCount: 3,
};

describe("normalize", () => {
  it("produces normalized features with expected shape", () => {
    const f = normalize(sampleSession);
    assert.strictEqual(typeof f.totalKeystrokes, "number");
    assert.strictEqual(typeof f.meanKeystrokeInterval, "number");
    assert.strictEqual(typeof f.activeRatio, "number");
    assert.strictEqual(f.totalKeystrokes, 200);
    assert.ok(f.sessionDurationSeconds >= 0);
  });
});

describe("fingerprintHash", () => {
  it("is deterministic (same session -> same hash)", () => {
    const f = normalize(sampleSession);
    const h1 = fingerprintHash(f);
    const h2 = fingerprintHash(f);
    assert.strictEqual(h1, h2);
  });
  it("returns 64-char hex", () => {
    const f = normalize(sampleSession);
    const h = fingerprintHash(f);
    assert.match(h, /^[0-9a-f]{64}$/);
  });
});

describe("humanEffortScore", () => {
  it("returns score in [0, 1]", () => {
    const f = normalize(sampleSession);
    const { score } = humanEffortScore(f);
    assert.ok(score >= 0 && score <= 1);
  });
  it("returns breakdown with expected keys", () => {
    const f = normalize(sampleSession);
    const { breakdown } = humanEffortScore(f);
    assert.ok("keystrokes" in breakdown);
    assert.ok("pace" in breakdown);
  });
});

describe("sessionToCertificate", () => {
  it("produces certificate with fingerprint_hash and score", () => {
    const cert = sessionToCertificate(sampleSession);
    assert.strictEqual(cert.fingerprint_hash.length, 64);
    assert.ok(cert.human_effort_score >= 0 && cert.human_effort_score <= 1);
    assert.ok(["low", "medium", "high"].includes(cert.confidence_level));
  });
});
