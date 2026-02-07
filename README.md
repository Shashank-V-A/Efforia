# Efforia — Proof-of-Knowledge (PoK) System

End-to-end system that **proves human effort in content creation** using privacy-safe process telemetry and on-chain verification. No raw text, filenames, or clipboard content is ever captured or stored.

## Repository structure

| Package | Purpose |
|--------|---------|
| `packages/extension` | VS Code extension: captures telemetry (keystrokes, edits, paste buckets, idle/active) and exports session JSON |
| `packages/shared` | Shared types: `SessionTelemetry`, `PoKCertificate`, etc. |
| `packages/fingerprint` | Normalizes session → features, SHA-256 fingerprint, heuristic human-effort score, outputs PoK certificate JSON |
| `packages/contracts` | Solidity `PoKAnchor`: store fingerprint hash, score, timestamp, author on Monad testnet |
| `packages/verifier` | Web app: upload certificate, optionally verify hash from session, verify on chain |

## Trust model

1. **Telemetry is local and privacy-safe**  
   The VS Code extension runs only on your machine. It records:
   - Keystroke **counts** and **intervals** (no key codes or content)
   - Edit **counts** (insert/delete/replace)
   - Paste **length buckets** (e.g. 0–50, 51–200 chars), not content
   - Idle vs active **time**
   - Number of **files** touched (no paths or names)

2. **Fingerprint is deterministic and non-reversible**  
   Normalized features (numbers only) are hashed with SHA-256. Same session → same hash; the hash does not reveal the underlying behavior in any useful way.

3. **Human-effort score is heuristic and explainable**  
   A single score in [0, 1] is computed from:
   - Keystroke volume (log-scaled)
   - Typing pace (human-like interval range)
   - Edit diversity (insert/delete/replace mix)
   - Low paste ratio (more typing vs pasting)
   - Active time ratio and session duration  
   No ML; all weights and thresholds are in code.

4. **On-chain anchor is a commitment**  
   The author submits `(fingerprint_hash, score)` to the smart contract. Anyone can later verify that a given certificate’s hash exists on-chain and read the stored score and author. The chain does not see telemetry or content.

5. **Verifier checks two things**  
   - **Hash match (optional):** If you have both the certificate and the session JSON, the verifier can recompute the hash from the session and confirm it matches the certificate.  
   - **On-chain:** The verifier checks Monad testnet for the certificate’s `fingerprint_hash` and displays anchored score, timestamp, and author.

## Local development

### Prerequisites

- Node.js 18+
- npm (or pnpm/yarn with workspaces)

### Setup

```bash
cd d:\Efforia
npm install
```

### Build all packages

```bash
npm run build
```

(If `shared` or `fingerprint` are not built yet, build them first: `npm run build -w @efforia/shared` then `npm run build -w @efforia/fingerprint`.)

### VS Code extension

1. Build shared and extension:
   ```bash
   npm run build -w @efforia/shared
   npm run build -w packages/extension
   ```
2. Open `d:\Efforia` in VS Code.
3. Run the extension: F5 or “Run and Debug” → “Run Extension”.
4. In the new window: **Efforia: Export session telemetry (PoK)** exports the current session as JSON. Use **Start/Stop telemetry session** to control collection.

### Fingerprint (certificate from session)

From repo root, with a session JSON file (e.g. from the extension):

```bash
node packages/fingerprint/dist/cli.js path/to/efforia-session.json path/to/efforia-certificate.json
```

Or after building:

```bash
npm run build -w @efforia/fingerprint
node packages/fingerprint/dist/cli.js efforia-session.json efforia-certificate.json
```

Output: `efforia-certificate.json` with `fingerprint_hash`, `human_effort_score`, `confidence_level`, `timestamp`.

### Smart contract (Monad testnet)

1. Install and compile:
   ```bash
   npm run build -w @efforia/contracts
   cd packages/contracts
   npm run compile
   npm run test
   ```

2. Deploy (need testnet MON and private key):
   ```bash
   set PRIVATE_KEY=0x...
   npm run deploy:monad
   ```
   Save the printed contract address.

3. Anchor a certificate:
   ```bash
   set CONTRACT_ADDRESS=0x...
   npm run anchor -- efforia-certificate.json
   ```

RPC: `https://testnet-rpc.monad.xyz` (default in `hardhat.config.ts`).  
Chain ID: **10143**.  
Faucet: e.g. Alchemy Monad testnet faucet.

### Verifier web app

1. Optional: set deployed contract address for “Verify on chain”:
   ```bash
   cd packages/verifier
   echo "VITE_POK_CONTRACT_ADDRESS=0xYourContractAddress" > .env
   ```

2. Run dev server:
   ```bash
  npm run verifier:dev
  ```
   Open http://localhost:5173.

3. **Upload certificate** (JSON from fingerprint tool).  
4. Optionally **upload session** and click **Check hash match** to recompute hash and compare.  
5. Enter **contract address** (or use default from `.env`) and click **Verify on chain** to check Monad testnet.

## End-to-end flow (demo)

1. **Capture:** Open project in VS Code, run extension, do some editing, run **Export session telemetry** → save `efforia-session.json`.
2. **Certificate:** Run fingerprint CLI on that file → get `efforia-certificate.json`.
3. **Anchor:** Deploy `PoKAnchor` on Monad testnet (once), then run anchor script with the certificate and `CONTRACT_ADDRESS` / `PRIVATE_KEY`.
4. **Verify:** Open verifier app, upload the certificate, enter contract address, click **Verify on chain** → see “Anchored on chain” with score, timestamp, author.

## Privacy rules (summary)

- **Never** capture or store: raw text, filenames, file paths, clipboard content, key codes.
- Telemetry: **aggregated only** (counts, intervals, buckets, durations).
- All **raw telemetry stays local**; only the derived certificate (hash + score + timestamp) is intended for anchoring.
- The **fingerprint hash** is non-reversible and does not expose behavior details.

## License

MIT.
