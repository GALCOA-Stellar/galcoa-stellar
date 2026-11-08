# Demo defense sheet

Short answers for live demos and jury questions. Be precise, be honest, do not overclaim, say "Testnet prototype" clearly.

**Thesis:** GALCOA+ is a Stellar Testnet prototype that turns lot validity into verifiable on-chain state and uses that state to govern escrow behavior. Two AI agents prepare the data (they only propose and stop); rules in code decide.

**One sentence:** a business condition that usually lives in closed workflows becomes contract-readable state, and another contract uses it to decide an economic outcome.

**Repeat often:** the UI is not the source of truth, the contract is · Testnet prototype · the claim is architectural, not production maturity.

## Questions
**What problem?** Delivery proof lives in paper, spreadsheets and chats; when it is lost someone pays. We make the accepted state verifiable and reusable.

**Why not a database?** A database stays inside one operator's trust boundary. Here the condition is shared, contract-readable state another contract can consume.

**Why two contracts?** The separation is the point: one defines validity, the other decides what happens economically. Validity becomes a reusable primitive.

**What happens if a lot is revoked?** History remains, `existe()` becomes false, the escrow does not pay, and after the deadline the payer recovers the deposit.

**What does `existe()` mean?** Registered and currently valid, not "was ever seen".

**Why three signatures?** To avoid a single-actor assertion: the service, the loader and a different approver. It improves control and traceability; it does not eliminate fraud.

**Documents on-chain?** No. Only a 32-byte fingerprint per batch, states and events.

**Do the AI agents decide?** No. The registrar proposes, the verifier can only stop, rules in code decide, and a second person confirms.

**What if the AI hallucinates?** The verifier (a different provider when possible) compares the data with the original message; a critical finding holds the entry; if the verifier fails nothing is marked verified. Rules and people remain the decision layer.

**Are the AI agents independent?** Only if they use different providers; the app tells you when they do not. It checks fidelity to the message, not that the facts are true.

**Is it trustless?** No. It makes a relevant condition more verifiable and less dependent on UI trust. Trust remains in the input process, the signers and the escrow admin controls.

**Production? Audited?** No and no. Testnet prototype, no external audit.

**Why Testnet?** This stage validates architecture and behavior before stronger claims.

**What if the frontend is down?** Contract state, events and the independent verifier still work; show it in Stellar Lab Contract Explorer.

**What did the redeploy teach you?** Contract lifetime and canonical references must be explicit and documented even when business logic does not change.

**Real money?** Not now. A staged roadmap exists (SEP-24 and SEP-10 against a test anchor in the sprint) and needs legal review first.

## Closing
The UI shows it. The contract proves it.

## If the interface fails
"The interface is a convenience. I can show the source of truth directly from the deployed contracts."
