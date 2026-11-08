# GALCOA+ on Stellar

Spanish is the main language of this repository: [`README.md`](README.md).

> **Status: Stellar Testnet prototype.** Focus: the delivery note confirmed by whoever receives it (WhatsApp link, no wallet), with verifiable proof. No validated customer or payment yet. No real money, no mainnet, no external audit.

## In 30 seconds
When someone anchors data on Stellar, the network proves it **did not change**; it does not prove it is **correct**. GALCOA+ is a prototype that checks the data **before** it is anchored:

1. A person loads a delivery (for example, a delivery note).
2. **Rules written in code** mark it green (anchored), yellow (declared, anchored with a flag) or red (needs review, **never anchored**).
3. Two AI agents help structure the data, but they **can only propose or stop**: AI never decides the verdict.
4. Only a **32-byte fingerprint** per batch goes on-chain, never documents or personal data.
5. Anyone can verify the proof afterwards, without an account and without trusting us.

It does not prove goods physically exist or that data is true in the world: it checks coherence, source, who loaded it and that what was declared did not change.

## Try it (nothing to install)
- Site: https://galcoa-stellar.vercel.app/ (Spanish) · [load a delivery](https://galcoa-stellar.vercel.app/agentes) · [verify a proof](https://galcoa-stellar.vercel.app/verificar)
- Testnet demonstration with sample data.

## What exists and what does not
| Exists | Does not exist |
|---|---|
| Two Soroban contracts on Testnet: a **registry** (three signatures, one from an approver different from the loader) and a test **escrow** that pays only if the registry says the batch is valid | External audit, real money or mainnet |
| Rules with IDs (`ALC-…`), agents with tested instructions, defense against hidden instructions in text | A complete rules engine: the rules are **demonstration rules** |
| Public verifier that fails closed: if the network does not answer, it never says "verified" | Real users or proven demand |
| 362 automated tests and continuous integration; measured logic coverage: 79.6% of lines ([details](docs/evidencia/COBERTURA.md)) | Signing tested from a real phone |

## What we learned
- We talked to roles at distributors: the pain of badly loaded delivery notes exists, but it was **stated interest, not validation**.
- We reviewed projects in the Stellar community to see how they load and verify data: most record the data and its fingerprint, but almost none check the content first. That was the gap we wanted to test.
- We have not yet confirmed that anyone needs this enough to pay for it or use it daily: that is what we will measure with a brand and its distributors.

## Technical details
<details>
<summary>Testnet deployment, run it locally, limits</summary>

### Canonical deployment (Testnet, 06/11/2026)
| Contract | Address |
|---|---|
| `registro-lotes` (registry) | `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV` |
| `escrow-entrega` (escrow) | `CDLP7XWLU6QU6JA6O4RCYPGKRA5UHQTHAAM7PYRGM5EWWJNLCK4T5GAX` |
| Service / admin account | `GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y` |

Previous deployments are deprecated. Testnet resets periodically, so these may stop existing. Details: [`docs/arquitectura/DESPLIEGUE.md`](docs/arquitectura/DESPLIEGUE.md). You can inspect both contracts in [Stellar Lab Contract Explorer](https://lab.stellar.org/smart-contracts/contract-explorer) (choose Testnet): see [`docs/demo/GUIA-DEMO-LAB.md`](docs/demo/GUIA-DEMO-LAB.md).

`existe(fingerprint)` means "registered and active"; a revoked fingerprint remains in the history but `existe` returns false.

### Stack
Next.js 16, React 19, TypeScript, `@stellar/stellar-sdk` (SEP-53 signing); Rust with `soroban-sdk` 28 (`contracts/`); Vitest and `cargo test`.

### Run it locally
```bash
npm install
npm run crear-cuenta   # creates a TESTNET account and writes .env.local (not in git)
npm run dev            # http://localhost:4180
npm test && npm run typecheck && npm run build
```
Environment variables are in `.env.example`; secrets never go in git.

### Limits
- Does not prove that goods physically exist.
- No external audit; demonstration rules (`reglas-demo-0.2`); contracts have no upgrade path.
- More in English: [`docs/en/`](docs/en/). Evidence: [`docs/evidencia/TABLA-EVIDENCIA.md`](docs/evidencia/TABLA-EVIDENCIA.md). Security: [`SECURITY.md`](SECURITY.md). License: all rights reserved for now ([`LICENSE-NOTICE.md`](LICENSE-NOTICE.md)).

</details>

Independent project that uses the Stellar network; no endorsement by the Stellar Development Foundation.
