# Contributing to Efforia PoK

Thanks for your interest in improving the Proof-of-Knowledge system. This doc covers how to run, test, and submit changes.

## Setup

```bash
git clone https://github.com/Shashank-V-A/Efforia.git
cd Efforia
npm install
```

## Build

From repo root:

```bash
npm run build
```

This builds `@efforia/shared`, `@efforia/fingerprint`, the VS Code extension, Hardhat contracts, and the verifier. To build a single package:

```bash
npm run build -w @efforia/shared
npm run compile -w packages/extension
npm run build -w @efforia/fingerprint
npm run compile -w packages/contracts
npm run build -w packages/verifier
```

## Tests

- **Contracts (Hardhat):**  
  `cd packages/contracts && npm run test`

- **Fingerprint (Node):**  
  `cd packages/fingerprint && npm test`  
  (if unit tests are added; see `packages/fingerprint/README` or test script.)

Run all tests from root (if configured):  
`npm run test`

## Code style

- TypeScript: strict mode, no `any` where avoidable.
- Prefer existing patterns in each package (e.g. shared types in `@efforia/shared`).

## Submitting changes

1. Open an issue or pick an existing one.
2. Create a branch from `main`.
3. Make your changes; run `npm run build` and `npm run test` (or the relevant package tests).
4. Commit with a clear message; reference the issue if applicable.
5. Push and open a pull request. Describe what changed and how to verify it.

## Pre-push (optional)

To avoid pushing broken builds, you can run before pushing:

```bash
npm run build
npm run test -w packages/contracts
```

You can add a `prepush` script in root `package.json` or use a git hook (e.g. husky) to run these automatically.
