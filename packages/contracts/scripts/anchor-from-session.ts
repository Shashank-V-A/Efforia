/**
 * Generate certificate from session and anchor on chain in one go.
 * Usage: CONTRACT_ADDRESS=0x... PRIVATE_KEY=0x... SESSION_FILE=session.json [CERT_OUTPUT=cert.json] npx hardhat run scripts/anchor-from-session.ts --network monad-testnet
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { ethers } from "hardhat";
import { sessionToCertificate, validateSession } from "@efforia/fingerprint";
import type { SessionTelemetry } from "@efforia/shared";

const contractAddress = process.env.CONTRACT_ADDRESS;
const sessionPath = process.env.SESSION_FILE || "efforia-session.json";
const certOutputPath = process.env.CERT_OUTPUT;

function hexToBytes32(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return "0x" + h.padStart(64, "0").slice(-64);
}

async function main() {

  if (!contractAddress) {
    console.error("Set CONTRACT_ADDRESS and PRIVATE_KEY. See .env.example.");
    process.exit(1);
  }

  let session: unknown;
  try {
    const raw = readFileSync(resolve(process.cwd(), sessionPath), "utf-8");
    session = JSON.parse(raw);
    validateSession(session);
  } catch (e) {
    console.error("Invalid session file:", (e as Error).message);
    process.exit(1);
  }

  const cert = sessionToCertificate(session as SessionTelemetry);
  if (certOutputPath) {
    writeFileSync(resolve(process.cwd(), certOutputPath), JSON.stringify(cert, null, 2), "utf-8");
    console.log("Certificate written to", certOutputPath);
  }

  const hashBytes32 = hexToBytes32(cert.fingerprint_hash);
  const score = Math.round(cert.human_effort_score * 1000);
  const pok = await ethers.getContractAt("PoKAnchor", contractAddress);
  const tx = await pok.anchor(hashBytes32, score);
  console.log("Tx hash:", tx.hash);
  await tx.wait();
  console.log("Anchored. Fingerprint:", cert.fingerprint_hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
