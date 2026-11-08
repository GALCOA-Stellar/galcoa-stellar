# Architecture

```text
 Person ── plain-words message
            │
            ▼
 ┌────────────────────────────┐   proposes only
 │ Agent 1 · Registrar (AI)   │──────────────┐
 └────────────────────────────┘              ▼
 ┌────────────────────────────┐   can only stop
 │ Agent 2 · Verifier (AI,    │◄── compares with the original message
 │ a different provider)      │
 └──────────────┬─────────────┘
                ▼
 ┌────────────────────────────┐
 │ Rules in code (ALC-…)      │  decide green / yellow / red
 │ + four-eyes confirmation   │
 └──────────────┬─────────────┘
                ▼  only green and yellow, only a 32-byte fingerprint
 ┌──────────────────────────────────────────────┐
 │ Next.js app · stellar-sdk · SEP-53 signing   │
 └───────────┬──────────────────────┬───────────┘
             ▼                      ▼
   registro-lotes (Soroban)   escrow-entrega (Soroban)
   registrar · revocar        depositar · liberar · reembolsar
   existe · obtener · renovar        │
             ▲────── existe() ───────┘

 Independent path: packages/galcoa-comprobante + Stellar Lab (no GALCOA+ server)
```

## Components
- **Agents** (`src/lib/agentes/`): provider-agnostic (Gemini and Groq through plain `fetch`). The registrar cannot set who loaded, who confirmed or the registration date: the server sets them. The verifier adds rule `ALC-VER-01`, which can lower a verdict and never raise it. If the verifier fails, nothing is marked verified. A signed server state prevents changing what the agents said between steps.
- **Rules** (`src/lib/dominio/rules.ts`): deterministic, versioned, one ID per rule.
- **Contracts** (`contracts/`): Rust, Soroban SDK 28, OpenZeppelin Stellar contracts 0.8.0 for ownership and pause.
- **App** (`src/`): Next.js 16, React 19, TypeScript.
- **Verifier package** (`packages/galcoa-comprobante`): verifies a receipt without our server.

## Trust boundary
The UI and the AI agents are outside the trust core. The trust core is the deterministic rules, the deployed contracts and the events they emit.

Environment: Stellar Testnet, test assets only. Canonical addresses: see [`../arquitectura/DESPLIEGUE.md`](../arquitectura/DESPLIEGUE.md).
