# Limitations

GALCOA+ is a prototype on Stellar Testnet with test assets only.

- Not production-ready; no external security audit; limited operational hardening.
- One service account today; multi-signature and key rotation are part of the sprint plan.
- Contracts have no upgrade path: a fix is a new deployment (see [`../arquitectura/DESPLIEGUE.md`](../arquitectura/DESPLIEGUE.md)).
- Rules are demonstration rules (`reglas-demo-0.2`), not a full rules engine.
- **AI agents:** they run on third-party model providers, so no personal or real customer data may be sent to them. They check that the structured data is faithful to the message, not that the facts are true. If both agents use the same provider they are not independent, and the app says so. Holding an entry because of the verifier is enforced when preparing the documents; sealing re-evaluates only the deterministic rules.
- The project does not prove goods physically exist; it checks coherence, attribution and that declared data did not change.
