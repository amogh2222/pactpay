# PactPay engineering contract

## Strict anti-AI-slop UI mandate: light only
Never use navy/black backgrounds, neon borders, purple-to-cyan gradients,
glassmorphism blobs, or sci-fi jargon. Follow Ramp / Mercury / Stripe editorial design.
Canvas #F8FAFC; surfaces #FFFFFF; borders 1px #E2E8F0; dividers #F1F5F9.
Elevation: 0 1px 2px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.03).
Plus Jakarta Sans or Inter headings: tracking-tight, text-slate-900, font-semibold.
Secondary text #475569. JetBrains Mono, tabular-nums for money, SKUs, latency, PayPal IDs.
Primary #0060F0 / #0070BA, hover #F0F7FF.
Verified: #059669 on #ECFDF5, border #A7F3D0.
Guardrail: #D97706 on #FFFBEB, border #FDE68A.
Exception: #E11D48 on #FFF1F2, border #FECDD3.

## Sandbox engineering
Use real HTTPS https://api-m.sandbox.paypal.com with complete environment or runtime
credentials; deterministic schema-accurate simulation only with empty credentials.
Never silently simulate failed live requests. Reject partial credentials. Never log secrets/tokens.
All invoice_id, invoice_number, custom_id values carry PP-${Date.now().toString().slice(-6)}
plus collision-resistant entropy. Allocate identifiers once; reuse on retry. API path IDs
returned by PayPal must never be modified. Use stable PayPal-Request-Id per operation.
USD only, integer-cent arithmetic and two-decimal wire values with currency_code USD.
Buyer approval is required before live capture. Captured payments are not regulated escrow.
Invoicing v2 does not support a PAY_BY_BANK configuration field: expose it as payment preference,
not an API guarantee. Never pay the invoice and Checkout for the same procurement.
No claims of verified carrier events or supplier SLA terms when they are scenario assumptions.
Validate inputs, enforce lifecycle and explicit CFO approval on server, serialize mutations,
isolate each browser session, and never mix simulated resource IDs into live operations.
Keep dynamic APIs force-dynamic and cacheComponents disabled. Run typecheck/build and
lifecycle tests after changing financial behavior. This demo's store is process-local, not a database.
