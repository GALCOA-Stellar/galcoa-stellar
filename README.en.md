# GALCOA+ on Stellar (testnet prototype)

GALCOA+ checks delivery data between companies **before** it is anchored, and leaves a single 32-byte fingerprint per batch on **Stellar testnet**. Anything that needs review (red) is never anchored.
Every document gets a receipt that anyone can verify alone. This is "data verification with a source": AI does not decide the verdict. Deterministic code rules decide, and a person reviews what is red.

Spanish is the main language of this repository: [`README.md`](README.md).

## Status (honest)
- **Testnet prototype:** no real money, no mainnet, no personal data on the network.
- Rules are **demonstration rules** (`reglas-demo-0.2`): they show the principle and do not replace a full rules engine.
- No external audit yet. Contracts have no upgrade path: a fix is a new deployment.

## What is on Stellar today (testnet, 06/11/2026)
| Contract | Address |
|---|---|
| `registro-lotes` (batch registry) | `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV` |
| `escrow-entrega` (test escrow) | `CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6` |
| Service / admin account | `GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y` |

- **Registry:** stores the batch fingerprint and its state (active or revoked). `registrar` requires authorization from three accounts (the service, the loader and the approver) and rejects loader = approver. Emits one event per registration and per revocation.
- **Escrow:** calls the registry (`existe`) before releasing a test payment. If the batch is revoked, nothing is paid and the deposit goes back to the payer after the deal deadline. Emits `depositado`, `liberado`, `reembolsado`.
- **Semantics:** `existe(fingerprint)` means "registered and active". A revoked fingerprint stays in the history (`obtener`, events) but `existe` returns false. `renovar` only extends the data's lifetime.
- **Source of truth:** the contracts' state and events on the network. The web app is a convenience.
- **Independent verification:** package `packages/galcoa-comprobante` and the public guide at `/spec`. Anyone can recompute the fingerprint and ask the network, or use Stellar Lab.
- **Evidence:** `docs/evidencia/TABLA-EVIDENCIA.md` (claim, proof, link, limit) and `scripts/criterios-de-exito.mjs` (reproducible testnet run).

## How it works
1. Deliveries are loaded and the rules (`src/lib/rules.ts`) mark each one green, yellow (declared) or red (needs review).
2. A preview shows what enters the batch and what stays out, without touching the network.
3. An authorized account **electronically signs** (SEP-53) the exact fingerprint of the batch.
4. The server re-evaluates everything, builds the Merkle tree and sends **one** transaction with the 32-byte fingerprint in the memo. If everything is red, it does not call the network.
5. A batch file is downloaded with one receipt per document. Anyone can verify it: recompute the fingerprint and compare it with the network, or verify offline with the stored proof.

## Run it
```bash
npm install
npm run crear-cuenta   # creates a TESTNET account and writes .env.local (not in git)
npm run dev            # http://localhost:4180
npm test
npm run typecheck
npm run build
```
Contracts (Rust): from `contracts/registro-lotes` or `contracts/escrow-entrega`, `stellar contract build` and `cargo test`. The escrow tests only link on Linux (they run in CI).

## Security
See [`SECURITY.md`](SECURITY.md) and [`docs/amenazas.md`](docs/amenazas.md). Testnet only, test assets only. Environment variables live in `.env.local` or the hosting panel, never in git (see `.env.example`).

## Documentation
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md), [`docs/GLOSARIO.md`](docs/GLOSARIO.md), [`docs/adr/`](docs/adr/), [`docs/instawards/APLICACION-FORMAL-EN.md`](docs/instawards/APLICACION-FORMAL-EN.md).

This project does not imply endorsement by the Stellar Development Foundation.
