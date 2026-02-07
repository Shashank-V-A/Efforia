#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { SessionTelemetry } from "@efforia/shared";
import { sessionToCertificate } from "./index";
import { validateSession } from "./validateSession";

function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0] || "efforia-session.json";
  const outputPath = args[1] || "efforia-certificate.json";

  let session: SessionTelemetry;
  try {
    const raw = readFileSync(resolve(process.cwd(), inputPath), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    validateSession(parsed);
    session = parsed;
  } catch (e) {
    console.error("Failed to read or validate session JSON:", (e as Error).message);
    process.exit(1);
  }

  const cert = sessionToCertificate(session);
  const out = JSON.stringify(cert, null, 2);
  writeFileSync(resolve(process.cwd(), outputPath), out, "utf-8");
  console.log("PoK certificate written to", outputPath);
  console.log("  fingerprint_hash:", cert.fingerprint_hash);
  console.log("  human_effort_score:", cert.human_effort_score);
  console.log("  confidence_level:", cert.confidence_level);
}

main();
