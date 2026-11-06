# Formal application (English): ready-to-paste answers

The official form arrives **in English** after the pre-registration is accepted. Its questions: Client, Assumptions, Traction, Learnings, Evidence, Next 30 days. Evidence the program lists as examples: demo video with a customer, UX testing sessions, interview summary, analytics report, pilot results. Budget rule: only **developer hours, product/UX design hours and direct work tied to the SOW deliverables** are eligible (no marketing, recruiting or overhead). Payment is in XLM after KYC with the Stellar Development Foundation, per agreed milestones. Source for Spanish versions: `FORMULARIO-LISTO-PARA-PEGAR.md` and `BORRADOR-POSTULACION.md`.

## Client
Small and mid-size distributors in northeastern Argentina and the brands that supply them. The user is the person at the distributor who records deliveries and the brand or retailer that confirms what was received. Use case: prove that a delivery happened as declared, so that disputes over missing or damaged goods and the brand's trust checks do not depend on paper delivery notes.

## Assumptions
1. Lost or illegible paper delivery notes are a frequent, costly problem (two interviews say so).
2. Brands ask distributors for a provable history before granting representation.
3. A verifiable proof that a third party can check without trusting us is more useful than another internal approval log.
4. **Unvalidated:** that payments with terms or retention exist often enough in these operations for a conditional payment to matter. The sprint tests this with interviews.
5. Two distinct people approving each batch is acceptable to users in daily operation.

## Traction
Two structured interviews (a distributor and a distributor for a brand) plus informal conversations with other distributors. Both interviewees allowed us to quote them without names. The problem was first worked on with a previous version of the product on another network; we have no usage data we can prove, so we claim none: what we measure is the Stellar version. On Stellar testnet: two contracts deployed, 12 batches registered, 36 verifiable proofs, 5 verified by an independent check without our server, and 2 conditional-payment flows completed with test assets.

## Learnings
- Validated: the same pain in two different roles: lost or illegible delivery notes, and someone absorbing the cost of what cannot be proven ("we end up covering the cost so as not to lose the customer"; "the brand ends up paying for the replacement").
- Validated: brands ask for sales history, fleet size, a provable client portfolio and technical capacity for traceability.
- Not validated: late payments. Neither interviewee mentioned payment delays, so the conditional payment is still a hypothesis. We changed our framing from "late payments" to "proof of delivery", and the sprint will test where conditional payment helps.
- One interviewee said he would ask his distributors for a system like ours: stated interest, not a commitment.

## Evidence (links)
- Public site and live on-chain state: https://galcoa-stellar.vercel.app/
- Public verification guide, verifier and example proof: https://galcoa-stellar.vercel.app/spec
- Registry contract: https://stellar.expert/explorer/testnet/contract/CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV
- Escrow contract: https://stellar.expert/explorer/testnet/contract/CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6
- Interview summary (anonymized): `docs/evidencia/ENTREVISTAS-RESUMEN.md` (attach as a file)
- Evidence report with transaction links: `docs/evidencia/EVIDENCIA-8435d44b.md` (attach as a file)
- Demo video: **[COMPLETE: link once recorded]**

## Next 30 days (activities and measurable result)
- Week 1: both contracts already emit an event for every state change (readable with `getEvents`): show them in the app and the public guide; reproducible evidence report and public specification (done as a baseline; now repeated by outside people).
- Week 2: two-person wallet test with real Stellar wallets and a counter of fees paid by the service versus business actions.
- Week 3: at least 10 more interviews (goal: 20) and a guided test with an interested company; measure time to complete the flow.
- Week 4: recorded demo, final documentation and report with what worked and what did not.
- **Measurable results:** at least 10 batches registered with distinct accounts; at least 3 independent verifications by people outside the team; 1 to 2 complete conditional-payment flows; at least 10 new interviews (goal: 20); 1 guided test with an interested company, documented; public specification and demo video.
- **Out of scope:** mainnet, real payments, bank integration, own KYC, factoring, ERP integration, multi-company dashboard.
- **Budget requested: USD 5,000** as developer and design hours tied to the deliverables above: contracts and tests 2,100; frontend and wallet 1,100; public spec and independent verification 700; demo, guided-test work and evidence 1,100. **[COMPLETE: express each line as hours × rate once the team confirms who does what, because only hours tied to deliverables are eligible.]**
- **Team:** Juan Facundo Ayala, Nahuel Noir, Gastón Persoglia and Thomas Skarp. Nahuel Noir confirmed participation if the project is selected.
- **Not an arbitrary data storage service:** every on-chain record exists because it unlocks or blocks a payment. Only hashes and states go on-chain; no documents or personal data.
