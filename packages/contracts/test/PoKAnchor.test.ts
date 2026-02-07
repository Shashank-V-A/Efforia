import { expect } from "chai";
import { ethers } from "hardhat";

// SHA-256 hex (64 chars) as bytes32 for testing
function hexToBytes32(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return ethers.zeroPadValue("0x" + h.padStart(64, "0").slice(-64), 32);
}

describe("PoKAnchor", function () {
  it("Should anchor and verify a fingerprint", async function () {
    const PoKAnchor = await ethers.getContractFactory("PoKAnchor");
    const pok = await PoKAnchor.deploy();
    const fingerprintHash = hexToBytes32(ethers.keccak256(ethers.toUtf8Bytes("test-fingerprint-hex")).slice(2));
    const score = 750; // 0.75

    await pok.anchor(fingerprintHash, score);
    const exists = await pok.verify(fingerprintHash);
    expect(exists).to.be.true;

    const r = await pok.getRecord(fingerprintHash);
    expect(r.exists).to.be.true;
    expect(r.score).to.equal(750n);
    expect(r.author).to.equal((await ethers.getSigners())[0].address);
  });

  it("Should reject duplicate anchor", async function () {
    const PoKAnchor = await ethers.getContractFactory("PoKAnchor");
    const pok = await PoKAnchor.deploy();
    const fingerprintHash = hexToBytes32(ethers.keccak256(ethers.toUtf8Bytes("dup")).slice(2));
    await pok.anchor(fingerprintHash, 500);
    await expect(pok.anchor(fingerprintHash, 500)).to.be.revertedWith("PoK: already anchored");
  });

  it("Should reject score > 1000", async function () {
    const PoKAnchor = await ethers.getContractFactory("PoKAnchor");
    const pok = await PoKAnchor.deploy();
    const fingerprintHash = hexToBytes32(ethers.keccak256(ethers.toUtf8Bytes("high")).slice(2));
    await expect(pok.anchor(fingerprintHash, 1001)).to.be.revertedWith("PoK: score must be 0-1000");
  });

  it("Should anchor and verify real SHA-256 fingerprint (from fingerprint tool)", async function () {
    const PoKAnchor = await ethers.getContractFactory("PoKAnchor");
    const pok = await PoKAnchor.deploy();
    // Real output from: node packages/fingerprint/dist/cli.js packages/fingerprint/sample-session.json
    const realFingerprintHex = "5f7260dbcd7609e0bb15834d3af02649281dcbe0cad71e00d4bb896a8dba3090";
    const fingerprintHash = hexToBytes32(realFingerprintHex);
    const score = 947; // 0.947 from sample session
    await pok.anchor(fingerprintHash, score);
    expect(await pok.verify(fingerprintHash)).to.be.true;
    const r = await pok.getRecord(fingerprintHash);
    expect(r.score).to.equal(947n);
  });
});
