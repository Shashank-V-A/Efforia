/**
 * Anchor a PoK certificate on Monad testnet.
 * Usage: CONTRACT_ADDRESS=0x... PRIVATE_KEY=0x... npx hardhat run scripts/anchor.ts --network monad-testnet
 * Certificate JSON can be piped or path as first arg.
 */
import { ethers } from "hardhat";

const contractAddress = process.env.CONTRACT_ADDRESS;
const certPath = process.argv[2] || "efforia-certificate.json";

interface Cert {
  fingerprint_hash: string;
  human_effort_score: number;
}

function hexToBytes32(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return "0x" + h.padStart(64, "0").slice(-64);
}

async function main() {
  if (!contractAddress) {
    console.error("Set CONTRACT_ADDRESS to the deployed PoKAnchor address.");
    process.exit(1);
  }
  const fs = await import("fs");
  const path = await import("path");
  const cert: Cert = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), certPath), "utf-8")
  );
  const hashBytes32 = hexToBytes32(cert.fingerprint_hash);
  const score = Math.round(cert.human_effort_score * 1000);
  if (score < 0 || score > 1000) {
    console.error("Score must be in [0, 1] (stored as 0-1000)");
    process.exit(1);
  }
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
