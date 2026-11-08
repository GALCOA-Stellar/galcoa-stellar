# Threat model

An architectural risk overview of a Testnet prototype. It is not an audit and not a production certification. The detailed Spanish model is [`../arquitectura/AMENAZAS.md`](../arquitectura/AMENAZAS.md).

**Scope:** Stellar Testnet, test assets only; `registro-lotes`, `escrow-entrega`, the web app, the AI agents and the independent verifier package.

**What is protected:** not a document, but the integrity of the validity state and the correctness of the economic consequence derived from it: current validity, traceability of registration and revocation, correct release or refund, clear canonical deployment references, and independence from UI-only trust.

## Trust boundaries
1. **Real-world input.** The system does not verify that physical facts are true. It relies on the people and the approval flow, plus rules and two AI agents that prepare the data.
2. **Contract execution.** Once accepted, the contracts store and expose the state and enforce escrow behavior.
3. **Presentation.** The UI is not the source of truth; contract state, events and the verifier package are.
4. **Administration.** The escrow has pause and admin controls: an explicit operational trust layer.

## Threats, mitigations and what remains
| # | Threat | Mitigation today | Residual risk |
|---|---|---|---|
| 1 | False or misleading input | Three signatures; submitter and approver differ; attributable state; rules and a verifier agent compare data with the message | Does not remove fraud or human error |
| 2 | Over-trusting the UI | Contract state is the source of truth; events; independent verifier; canonical IDs | Users may still over-trust the UI |
| 3 | Ambiguous deployments | Canonical IDs, old ones marked obsolete, ADR and deployment document | Any redeploy must be documented |
| 4 | Wrong escrow release | Escrow calls `existe()` before release; revoked lots are not paid; refund after deadline | No external audit yet |
| 5 | Admin misuse or error | Explicit admin interface; OpenZeppelin `ownable` and `pausable`; two-step admin transfer | Administrative trust remains |
| 6 | Contract lifetime | Instance and data lifetime renewed on every operation; `renovar`; documented redeploy | Needs scheduled renewal in production |
| 7 | Secret leakage | `.env` files excluded; secret scan in CI; testnet keys only | Major operational risk in any blockchain project |
| 8 | Overclaiming maturity | Testnet scope stated repeatedly; no audit or production claim | Language must stay disciplined |
| 9 | **AI agent invents or alters data** | Verifier agent (different provider when possible) compares with the original message and can only stop; rules decide; if it fails nothing is marked verified | Same-provider agents are not independent (the app says so) |
| 10 | **Prompt injection in a message** | Message treated as data; model output validated field by field; the server sets who loaded, who confirmed and the date | Not red-teamed yet |
| 11 | **Sensitive data sent to a model provider** | UI warning; no personal data allowed; agents off unless keys are configured | Depends on user discipline |
| 12 | **Abuse of the agent endpoint** | Per-IP rate limit and a daily cap; signed server state between steps | Best effort on a stateless host |

## What the system protects well
Representing accepted state on-chain, separating history from current validity, making validity contract-readable, making escrow depend on it, and reducing UI-only trust.

## What it does not solve
Truth of physical-world inputs, legal enforceability, full production security, external audit assurance, and a final governance design.

## Conclusion
Evaluate GALCOA+ as a prototype that makes a previously opaque condition more verifiable and programmable. It does not claim to remove all trust.
