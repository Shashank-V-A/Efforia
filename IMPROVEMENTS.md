# Efforia PoK — Improvement ideas

Prioritized suggestions to improve reliability, UX, security, and maintainability. Pick what fits your goals.

---

## 1. Reliability & correctness

| Improvement | Why | Effort |
|-------------|-----|--------|
| **Validate session JSON** in fingerprint (e.g. Zod schema) | Reject malformed or tampered session files early with clear errors. | Low |
| **Extension: persist session** | If the user closes the Export dialog without saving, session is lost. Optionally auto-save to a temp file or workspace `.efforia/` and offer “Export last session”. | Medium |
| **Contract: emit events** | You already have `Anchored`. Consider indexing by author or timestamp for explorers / future UIs. | Low |
| **Verifier: validate certificate shape** | Before calling the chain, validate all required fields and hex length of `fingerprint_hash` (64 chars). | Low |

---

## 2. User experience

| Improvement | Why | Effort |
|-------------|-----|--------|
| **Extension: status bar** | Show “Efforia: ● active” and keystroke count so the user knows telemetry is running without opening the command palette. | Low |
| **Extension: default save location** | Pre-fill save path to workspace root or `~/Downloads` so export is one click. | Low |
| **Verifier: drag-and-drop** | Allow dragging certificate/session JSON onto the page instead of only “Choose File”. | Low |
| **Verifier: score breakdown** | If you store a `score_breakdown` in the certificate (optional), show it in the verifier (e.g. “Pace: 0.8, Diversity: 0.6”). | Medium |
| **Verifier: loading / empty states** | Clear “Verifying…” and “No certificate uploaded” states; disable buttons while loading. | Low |
| **Verifier: responsive layout** | Ensure the card and hash text wrap nicely on small screens. | Low |

---

## 3. Security & privacy

| Improvement | Why | Effort |
|-------------|-----|--------|
| **.env.example** | Add `packages/contracts/.env.example` and `packages/verifier/.env.example` with `PRIVATE_KEY=`, `VITE_POK_CONTRACT_ADDRESS=` (no real values) so others know what to set without reading code. | Low |
| **Verifier: no cert in console** | Avoid `console.log(cert)` or logging full certificate in production. | Low |
| **README: security note** | Add a short “Never commit .env or private keys; use a testnet-only wallet for deploy.” | Low |

---

## 4. Features

| Improvement | Why | Effort |
|-------------|-----|--------|
| **Support multiple chains** | Allow verifier (and contract deploy) to target another chain (e.g. Sepolia) via env or dropdown. Contract is chain-agnostic. | Medium |
| **Verifier: link to anchor tx** | If you store `transactionHash` when anchoring (e.g. in a separate index), show “View anchor tx” in the verifier. Otherwise, link to contract address on explorer. | Low |
| **CLI: anchor from fingerprint** | One command that takes session JSON, runs fingerprint, and anchors (e.g. `node cli.js session.json --anchor --network monad`). Requires PRIVATE_KEY and CONTRACT_ADDRESS. | Medium |
| **Certificate: optional metadata URI** | Contract could store an optional `metadataUri` (e.g. IPFS hash of the certificate JSON) for verifiers that want to fetch the full cert. | Medium |

---

## 5. Developer experience & quality

| Improvement | Why | Effort |
|-------------|-----|--------|
| **Unit tests for fingerprint** | Test `normalize()`, `fingerprintHash()`, and `humanEffortScore()` with fixed session JSON; assert deterministic hash and score range. | Medium |
| **Extension tests** | Use `@vscode/test-electron` to run the extension in a test workspace and assert export produces valid session shape. | Medium |
| **Contract tests: real hash** | Add a test that uses a real SHA-256 hex (e.g. from fingerprint output) and anchors/verifies. | Low |
| **CONTRIBUTING.md** | How to run tests, build, and submit changes. | Low |
| **Pre-push hook** | Run `npm run test` (and maybe lint) before push to avoid breaking the repo. | Low |

---

## 6. Performance & scale

| Improvement | Why | Effort |
|-------------|-----|--------|
| **Extension: throttle document changes** | On very fast typing or large paste, batch or throttle so the handler doesn’t run hundreds of times per second. | Low |
| **Verifier: lazy load chain libs** | Dynamic `import('viem')` only when user clicks “Verify on chain” to keep initial bundle smaller and first load faster. | Low |
| **Fingerprint: stream large sessions** | If session JSON could get large, parse in chunks or stream to avoid loading the whole file into memory (optional). | Medium |

---

## Quick wins (do first) — ✅ done

1. Add **.env.example** in `packages/contracts` and `packages/verifier`.
2. Add **status bar** in the extension (“Efforia: ● active”).
3. **Validate** session JSON in fingerprint (Zod or minimal checks).
4. **Verifier**: drag-and-drop for files and clearer loading/empty states.
5. **README**: one short “Security” subsection (no keys in repo, testnet wallet).

---

## Implemented by category (current repo)

- **Reliability:** Verifier validates certificate shape (64-char hex, score 0–1) before chain call. Extension persists last session to `.efforia/last-session.json` and adds “Export last session” command. Default save path uses workspace root.
- **UX:** Score breakdown (optional) in certificate and verifier UI. Responsive verifier (mobile). Chain dropdown and multi-chain (Monad Testnet, Sepolia).
- **Features:** Multi-chain verifier; `anchor-from-session` script (session → cert → anchor in one command via `SESSION_FILE` / `CERT_OUTPUT` env).
- **DevEx:** CONTRIBUTING.md; contract test with real SHA-256 fingerprint; fingerprint unit tests (normalize, hash, score, sessionToCertificate); `prepush` script (build + contract + fingerprint tests).
- **Performance:** Extension throttles document changes (100 ms batching).

---

## Optional: roadmap

- **v1.1:** UX polish (status bar, drag-drop, .env.example, validation).
- **v1.2:** Tests (fingerprint unit tests, one contract test with real hash).
- **v1.3:** Multi-chain verifier + optional “anchor from CLI” pipeline.

Use this as a checklist; you can open issues or PRs from each item.
