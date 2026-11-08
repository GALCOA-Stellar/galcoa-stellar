# Product overview

**GALCOA+ on Stellar** is a Testnet prototype that verifies delivery data between companies before it is anchored, registers a verifiable lot fingerprint and its validity in a Soroban contract, and uses that state as the condition for a proof-of-concept escrow. Test assets only.

## The problem
Proof of delivery between distributors, brands and retailers lives in paper delivery notes, spreadsheets and chat messages. When a note is lost or illegible, someone absorbs the cost of what cannot be proven. A verification result shown by an application is also hard to check independently.

## What the prototype does
1. **Two AI agents prepare the data, rules decide.** A person describes a delivery in plain words. The *registrar agent* turns it into structured data (it only proposes). A second, independent *verifier agent* compares that data with the original message (it can only stop). Deterministic code rules then decide green, yellow or red, and a second person confirms (four eyes). AI never approves anything.
2. **Only a 32-byte fingerprint per batch goes on the network.** No documents and no personal data on-chain.
3. **A registry contract** keeps the fingerprint and its state (active or revoked). Registering needs three signatures: the service, the person who loaded the data and a different person who approved it.
4. **An escrow contract** checks the registry before releasing a test payment. A revoked lot is not paid; the deposit returns to the payer after the deadline.
5. **Anyone can verify independently** with a verifier package and Stellar Lab. The web app is a convenience; the contracts are the source of truth.

## What it does not claim
Production readiness, external audit, final governance, or that goods physically exist. It checks coherence, attribution and that declared data did not change.

## Key message
The UI is not the source of truth. The contract is.
