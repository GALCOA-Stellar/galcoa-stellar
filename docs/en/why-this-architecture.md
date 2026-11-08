# Why this architecture

**Thesis:** GALCOA+ turns a business condition that is normally opaque ("this delivery is proven") into a condition that is verifiable and reusable by contracts. The registry and the escrow are two halves of that idea, not two separate products.

## Why only a fingerprint on-chain
A public chain is the wrong place for documents or personal data (Argentine data-protection law, Ley 25.326). A 32-byte Merkle root per batch is enough for anyone to prove that the content existed unchanged, and it keeps fees to one transaction per batch.

## Why two contracts
The registry is the source of truth for validity. The escrow consumes that state through `existe()`. Separating them means other contracts can reuse the registry, and a revoked lot blocks payment without the escrow knowing anything about documents.

## Why AI agents, and why they cannot decide
Messages in plain words are how people really report deliveries. A registrar agent structures them; an independent verifier agent compares the result with the message and can only stop. Rules in code decide, because the verdict decides what is anchored permanently: the same input must always give the same result, and "red is never sealed" must be provable by tests.

## Why Soroban and Stellar
Native multi-account authorization (`require_auth` for three parties), cheap transactions, public events anyone can read, and a path to testnet anchors (SEP-24, SEP-10) for the real-money roadmap.

## History versus current validity
A revoked lot is not erased: `obtener` and the events keep who loaded it, who approved it and when it was revoked, while `existe()` becomes false. The system never rewrites the past, but it states clearly what is valid now. That separation is what makes the record auditable.

## Three signatures: multi-party attestation
Registration needs the service, the person who loaded the data and a different person who approved it. No single hand can assert validity. It does not make fraud impossible; it raises the cost and improves traceability.

## What this system does and does not guarantee
- It does **not** discover the truth of the physical world, and it cannot stop a person from lying before data is registered.
- It does guarantee that, once a state is accepted by the flow, it is represented in a verifiable, traceable way and can be reused by contracts. In short: truth *representation* and programmable consequence after acceptance, not truth *discovery*.

## Who must be trusted
- **Input:** the people and the approval flow, plus the rules and the two agents that prepare data before registration.
- **Execution:** the contract logic keeps and exposes the registered state.
- **Presentation:** the UI is the least trusted piece; it is not the source of truth.
- **Administration:** the escrow has pause and admin functions. That is explicit operational trust, not hidden.

## Thesis in one sentence
GALCOA+ is a Stellar Testnet prototype that models lot validity as verifiable on-chain state and uses that state to govern escrow behavior, with AI agents that only propose and stop and rules in code that decide.

## Threats and assumptions (short matrix)
| Risk | Mitigation today | Open |
|---|---|---|
| Same person loads and approves | Contract rejects loader = approver; rules enforce four eyes | Real identity of people (login) is sprint work |
| AI invents or alters a value | Verifier compares with the original; rules decide; failure never marks verified | Both agents on one provider are not independent; the app says so |
| Prompt injection in a message | Message is treated as data; output validated field by field | Not red-teamed yet |
| Stolen service key | Daily quota per account, fee cap, testnet only | Single service account today; multi-signature planned |
| Data expires on the network | `renovar` and instance renewal on every operation | Needs a scheduled renewal in production |
| Wrong inputs are accepted | Not solved: the system proves coherence and attribution, not truth | Out of scope by design |

Full model: [`../arquitectura/AMENAZAS.md`](../arquitectura/AMENAZAS.md).

## Fallback demo without the app
Open Stellar Lab Contract Explorer on Testnet, load the canonical registry ID from [`../arquitectura/DESPLIEGUE.md`](../arquitectura/DESPLIEGUE.md), call `existe` and `obtener`, then `getEvents`. Step by step: [`../demo/GUIA-DEMO-LAB.md`](../demo/GUIA-DEMO-LAB.md).
