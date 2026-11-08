# FAQ

**Is this production?** No. Stellar Testnet, test assets only.

**Does AI decide the verdict?** No. Agent 1 proposes, Agent 2 can only stop, deterministic rules decide and a different person confirms.

**Why two agents?** The second one, ideally from a different provider, compares the structured data with the original message, so an invented or altered value is caught before anything is sealed.

**Are documents or personal data stored on-chain?** No. Only a 32-byte fingerprint per batch, states and events.

**What does `existe()` mean?** Registered and currently active. A revoked lot stays in history (`obtener`, events) but `existe` returns false.

**Why does `registrar` need three signatures?** The service, the person who loaded the data and a different person who approved it. Submitter and approver must differ.

**What if a lot is revoked after a deposit?** The escrow does not pay; after the deadline the payer recovers the deposit.

**How can I verify without trusting you?** With the verifier package (`packages/galcoa-comprobante`) and Stellar Lab Contract Explorer and `getEvents`.

**Which network and addresses?** Testnet. Canonical contract IDs and history: [`../arquitectura/DESPLIEGUE.md`](../arquitectura/DESPLIEGUE.md).

**Stack?** Next.js 16, React 19, TypeScript, `@stellar/stellar-sdk` 17, Rust with Soroban SDK 28, OpenZeppelin Stellar contracts 0.8.0, Vitest.

**License?** None yet: all rights reserved while the repository is private ([`../../LICENSE-NOTICE.md`](../../LICENSE-NOTICE.md)).
