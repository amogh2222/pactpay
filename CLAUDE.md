# PactPay
Read and enforce [.agents/rules/design-and-architecture.md](.agents/rules/design-and-architecture.md).
It is the authoritative engineering and light-only UI contract.
Use npm. App Router and TypeScript. Keep credentials server-side or ephemeral in browser memory.
The six REST modules live in src/lib/paypal/client.ts; lifecycle invariants in
src/lib/agents/workflow.ts; session state in src/lib/store/procurement-store.ts.
Run npm run test, npx tsc --noEmit, and npm run build before handoff.
