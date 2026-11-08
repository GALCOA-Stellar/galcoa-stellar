# Demo flow

**Goal:** show that a verified lot becomes on-chain state that changes what a contract does. Testnet prototype, not production.

## Happy path
1. **Problem (20 s):** paper delivery notes get lost and someone pays for what cannot be proven.
2. **Load with words (`/agentes`):** type a delivery message. Agent 1 structures it, Agent 2 compares it with the message, the rules mark it green, yellow or red.
3. **Four eyes:** a different person confirms. Whoever loaded cannot confirm.
4. **Seal:** the batch fingerprint is anchored on Stellar. Show the transaction.
5. **Verify without us:** in Stellar Lab Contract Explorer call `existe` (true) and open `getEvents` to see `lote_registrado`.
6. **Escrow:** the escrow consults the registry before paying. See [`../demo/GUIA-DEMO-LAB.md`](../demo/GUIA-DEMO-LAB.md) for the exact steps.

## Negative path
1. A message whose numbers do not match: the verifier agent flags it and the entry is held (red, never sealed).
2. A lot already registered gets revoked: `existe` becomes false but `obtener` shows history.
3. The escrow does not pay a revoked lot; the payer recovers the deposit after the deadline.

## If the web fails
"The interface is a convenience. The source of truth is the contract." Continue in Stellar Lab.

## Say exactly
- Testnet prototype, test assets only.
- AI proposes and controls; rules decide; a person signs.
- The web verification page goes through our server; independent verification is the package plus a node, or Lab.

## Do not say
"Complies", "validated", that goods exist physically, or that the refund after revocation is immediate.
