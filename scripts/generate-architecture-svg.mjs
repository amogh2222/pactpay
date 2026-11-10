import { writeFileSync } from "node:fs";

const W = 1600;
const H = 1200;

// High-fidelity, self-contained 4:3 architectural diagram for PactPay
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <!-- Background Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090D16"/>
      <stop offset="50%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#0A0F1D"/>
    </linearGradient>

    <!-- Card Gradients -->
    <linearGradient id="cardGradDark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.95"/>
    </linearGradient>

    <!-- Glowing Accent Gradients -->
    <linearGradient id="blueGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0070BA"/>
      <stop offset="100%" stop-color="#003087"/>
    </linearGradient>
    <linearGradient id="purpleGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
    <linearGradient id="emeraldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="amberGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="roseGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F43F5E"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>
    <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>

    <!-- Filters & Shadows -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <filter id="glowLight" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>

    <!-- Marker Arrowheads -->
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#A78BFA"/>
    </marker>
    <marker id="arrow-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34D399"/>
    </marker>
    <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#FBBF24"/>
    </marker>
    <marker id="arrow-rose" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#FB7185"/>
    </marker>
    <marker id="arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B"/>
    </marker>

    <!-- Subtle Grid Pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" stroke-width="0.75" stroke-opacity="0.4"/>
    </pattern>
  </defs>

  <style>
    .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 800; fill: #FFFFFF; }
    .subtitle { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 400; fill: #94A3B8; }
    .phase-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 700; letter-spacing: 1.5px; font-size: 11px; text-transform: uppercase; }
    .card-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 700; font-size: 14px; fill: #F8FAFC; }
    .card-subtitle { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 500; font-size: 11px; fill: #94A3B8; }
    .card-body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 400; font-size: 11px; fill: #CBD5E1; line-height: 15px; }
    .code-text { font-family: "JetBrains Mono", Consolas, Menlo, monospace; font-size: 10px; fill: #38BDF8; }
    .badge-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 700; font-size: 10px; }
    .flow-line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .subtle-line { fill: none; stroke: #334155; stroke-width: 1.5; stroke-dasharray: 4 4; }
  </style>

  <!-- Background Layer -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <!-- ==================== TOP BANNER / HEADER (y: 35 -> 125) ==================== -->
  <g transform="translate(60, 45)">
    <!-- Logo Icon -->
    <rect x="0" y="0" width="56" height="56" rx="14" fill="url(#blueGlow)" filter="url(#shadow)"/>
    <path d="M 16 20 L 40 20 L 36 26 L 16 26 Z M 16 28 L 34 28 L 30 34 L 16 34 Z M 16 36 L 28 36 L 24 42 L 16 42 Z" fill="#FFFFFF"/>
    
    <!-- Title & Subtitle -->
    <text x="74" y="28" class="title" font-size="28">PactPay Architecture Workflow</text>
    <text x="74" y="50" class="subtitle" font-size="14">Autonomous Sourcing, Spend Guardrails, Milestone Payments &amp; SLA Recovery • 4:3 System Specification</text>

    <!-- Header Badges -->
    <g transform="translate(1000, 8)">
      <!-- PayPal AI Hackathon -->
      <rect x="0" y="0" width="165" height="34" rx="8" fill="#1E293B" stroke="#0070BA" stroke-width="1.5"/>
      <circle cx="16" cy="17" r="5" fill="#0070BA"/>
      <text x="28" y="21" class="badge-text" fill="#E2E8F0">PayPal AI Hackathon 2026</text>

      <!-- 6 Chained APIs -->
      <rect x="180" y="0" width="140" height="34" rx="8" fill="#1E293B" stroke="#10B981" stroke-width="1.5"/>
      <circle cx="196" cy="17" r="5" fill="#10B981"/>
      <text x="208" y="21" class="badge-text" fill="#E2E8F0">6 Chained REST APIs</text>

      <!-- AI SDK 7 + MCP -->
      <rect x="335" y="0" width="145" height="34" rx="8" fill="#1E293B" stroke="#8B5CF6" stroke-width="1.5"/>
      <circle cx="351" cy="17" r="5" fill="#8B5CF6"/>
      <text x="363" y="21" class="badge-text" fill="#E2E8F0">AI SDK 7 • MCP Tools</text>
    </g>
  </g>

  <!-- Horizontal Divider -->
  <line x1="60" y1="125" x2="1540" y2="125" stroke="#1E293B" stroke-width="1.5"/>

  <!-- ========================================================================= -->
  <!-- 4 PRIMARY LANES:                                                         -->
  <!-- Lane 1: SOURCING & INTENT (y: 145 -> 380, h: 235)                         -->
  <!-- Lane 2: TREASURY & PAYPAL WORKFLOW (y: 405 -> 675, h: 270)                 -->
  <!-- Lane 3: FULFILLMENT & SLA AUDITOR (y: 700 -> 935, h: 235)                  -->
  <!-- Lane 4: FINANCIAL LEDGER & TELEMETRY (y: 960 -> 1150, h: 190)             -->
  <!-- ========================================================================= -->

  <!-- ========================================================================= -->
  <!-- LANE 1: 01 / SOURCING & DISCOVERY PHASE                                   -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 145)">
    <!-- Phase Background Container -->
    <rect x="0" y="0" width="1480" height="235" rx="14" fill="#0E1626" stroke="#1E293B" stroke-width="1.5"/>
    <rect x="0" y="0" width="6" height="235" rx="3" fill="url(#purpleGlow)"/>
    <text x="24" y="24" class="phase-label" fill="#A78BFA">PHASE 01 • AUTONOMOUS SOURCING &amp; MULTI-VENDOR DISCOVERY</text>

    <!-- Card 1.1: Human / System Input -->
    <g transform="translate(24, 40)" filter="url(#shadow)">
      <rect width="260" height="170" rx="10" fill="url(#cardGradDark)" stroke="#334155" stroke-width="1.2"/>
      <rect width="260" height="4" rx="2" fill="#64748B"/>
      <text x="16" y="26" class="card-title">Procurement Request</text>
      <text x="16" y="44" class="card-subtitle">Natural Language Intent + Limit</text>
      <rect x="16" y="58" width="228" height="50" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="76" class="code-text" fill="#93C5FD">"Procure 35 ergonomic chairs</text>
      <text x="24" y="94" class="code-text" fill="#93C5FD">under $410 for Workspace Ops"</text>
      <text x="16" y="128" class="card-body">Spend Guardrail: <tspan fill="#F59E0B" font-weight="700">$15,000 USD</tspan></text>
      <text x="16" y="146" class="card-body">Session isolated cookie store</text>
    </g>

    <!-- Flow Arrow 1.1 -> 1.2 -->
    <path d="M 284 125 L 324 125" class="flow-line" stroke="#A78BFA" marker-end="url(#arrow-purple)"/>

    <!-- Card 1.2: Intent Engine -->
    <g transform="translate(324, 40)" filter="url(#shadow)">
      <rect width="280" height="170" rx="10" fill="url(#cardGradDark)" stroke="#475569" stroke-width="1.2"/>
      <rect width="280" height="4" rx="2" fill="url(#purpleGlow)"/>
      <text x="16" y="26" class="card-title">01 / Sourcing Agent</text>
      <text x="16" y="44" class="card-subtitle">Vercel AI SDK 7 • Intent Extraction</text>
      <text x="16" y="68" class="card-body">• <tspan font-weight="700">OpenAI GPT-6 Luna / GPT-4o</tspan></text>
      <text x="26" y="84" class="code-text" fill="#64748B">Structured Output · store: false</text>
      <text x="16" y="104" class="card-body">• <tspan font-weight="700">Anthropic Claude 3.5 Sonnet</tspan></text>
      <text x="16" y="124" class="card-body">• <tspan font-weight="700" fill="#34D399">Deterministic Parser Fallback</tspan></text>
      <text x="26" y="140" class="code-text" fill="#34D399">0ms latency · Zero-cost resilient</text>
      <text x="16" y="158" class="code-text" fill="#CBD5E1">Output: { qty: 35, maxUsd: 410 }</text>
    </g>

    <!-- Flow Arrow 1.2 -> 1.3 -->
    <path d="M 604 125 L 644 125" class="flow-line" stroke="#A78BFA" marker-end="url(#arrow-purple)"/>

    <!-- Card 1.3: Channel3 Sourcing -->
    <g transform="translate(644, 40)" filter="url(#shadow)">
      <rect width="360" height="170" rx="10" fill="url(#cardGradDark)" stroke="#6366F1" stroke-width="1.2"/>
      <rect width="360" height="4" rx="2" fill="url(#purpleGlow)"/>
      <text x="16" y="26" class="card-title">Channel3 Supplier Network</text>
      <text x="16" y="44" class="card-subtitle">Multi-Vendor Quote Discovery (REST / MCP)</text>
      
      <rect x="16" y="56" width="328" height="42" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="74" class="code-text">POST https://api.trychannel3.com/v1/search</text>
      <text x="24" y="88" class="code-text" fill="#94A3B8">MCP Host: https://mcp.trychannel3.com/</text>

      <text x="16" y="116" class="card-body"><tspan font-weight="700" fill="#818CF8">Vendor 1 (Winner):</tspan> Walmart / Northline ($385 / 4d / 98.6%)</text>
      <text x="16" y="132" class="card-body"><tspan fill="#64748B">Vendor 2:</tspan> Pacific Contract Supply ($415.80 / 3d / 99.1%)</text>
      <text x="16" y="148" class="card-body"><tspan fill="#64748B">Vendor 3:</tspan> Meridian Workplace ($361.90 / 8d / 93.2%)</text>
      <text x="16" y="162" class="code-text" fill="#FBBF24">termsVerified: false (Disclosed scenario terms)</text>
    </g>

    <!-- Flow Arrow 1.3 -> 1.4 -->
    <path d="M 1004 125 L 1044 125" class="flow-line" stroke="#A78BFA" marker-end="url(#arrow-purple)"/>

    <!-- Card 1.4: Benchmarking Engine -->
    <g transform="translate(1044, 40)" filter="url(#shadow)">
      <rect width="412" height="170" rx="10" fill="url(#cardGradDark)" stroke="#38BDF8" stroke-width="1.2"/>
      <rect width="412" height="4" rx="2" fill="url(#cyanGlow)"/>
      <text x="16" y="26" class="card-title">Multi-Variable Quote Benchmarking</text>
      <text x="16" y="44" class="card-subtitle">Algorithmic Scoring Matrix (100-Point Scale)</text>
      
      <g transform="translate(16, 58)">
        <rect width="180" height="24" rx="4" fill="#0B0F19"/>
        <text x="8" y="16" class="code-text">Price &amp; MOQ Compliance</text>
        
        <rect x="195" width="185" height="24" rx="4" fill="#0B0F19"/>
        <text x="203" y="16" class="code-text">On-Time Delivery Rate (98.6%)</text>
        
        <rect y="32" width="180" height="24" rx="4" fill="#0B0F19"/>
        <text x="8" y="48" class="code-text">Lead Time (4 Days)</text>

        <rect x="195" y="32" width="185" height="24" rx="4" fill="#0B0F19"/>
        <text x="203" y="48" class="code-text">Contract SLA Rebate (15%)</text>
      </g>

      <rect x="16" y="122" width="380" height="34" rx="6" fill="#10B981" fill-opacity="0.1" stroke="#10B981" stroke-width="1"/>
      <text x="26" y="143" class="badge-text" fill="#34D399">Selected Quote Score: 95/100 · Gross: $13,475.00 USD</text>
    </g>
  </g>

  <!-- Connection from Lane 1 to Lane 2 -->
  <path d="M 1250 380 L 1250 405" class="flow-line" stroke="#38BDF8" marker-end="url(#arrow-blue)"/>

  <!-- ========================================================================= -->
  <!-- LANE 2: 02 / TREASURY & PAYPAL WORKFLOW PHASE                             -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 405)">
    <rect x="0" y="0" width="1480" height="270" rx="14" fill="#0E1626" stroke="#1E293B" stroke-width="1.5"/>
    <rect x="0" y="0" width="6" height="270" rx="3" fill="url(#blueGlow)"/>
    <text x="24" y="24" class="phase-label" fill="#38BDF8">PHASE 02 • TREASURY AGENT &amp; CHAINED PAYPAL SANDBOX REST APIS</text>

    <!-- Card 2.1: PayPal Catalog v1 -->
    <g transform="translate(24, 40)" filter="url(#shadow)">
      <rect width="260" height="205" rx="10" fill="url(#cardGradDark)" stroke="#0070BA" stroke-width="1.2"/>
      <rect width="260" height="4" rx="2" fill="url(#blueGlow)"/>
      <text x="16" y="26" class="card-title">1. Catalog v1</text>
      <text x="16" y="44" class="code-text">POST /v1/catalogs/products</text>
      <text x="16" y="68" class="card-body">Registers physical procurement SKU</text>
      <rect x="16" y="78" width="228" height="52" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="96" class="code-text" fill="#93C5FD">name: "Ergonomic Task Chair"</text>
      <text x="24" y="112" class="code-text" fill="#93C5FD">type: "PHYSICAL"</text>
      <text x="16" y="148" class="card-body">Returns PayPal Product ID:</text>
      <text x="16" y="166" class="code-text" fill="#38BDF8">PROD-DEMO4091 / PROD-C303...</text>
      <text x="16" y="190" class="card-subtitle">Stored as audit evidence</text>
    </g>

    <!-- Arrow 2.1 -> 2.2 -->
    <path d="M 284 142 L 314 142" class="flow-line" stroke="#38BDF8" marker-end="url(#arrow-blue)"/>

    <!-- Card 2.2: PayPal Invoicing v2 -->
    <g transform="translate(314, 40)" filter="url(#shadow)">
      <rect width="290" height="205" rx="10" fill="url(#cardGradDark)" stroke="#0070BA" stroke-width="1.2"/>
      <rect width="290" height="4" rx="2" fill="url(#blueGlow)"/>
      <text x="16" y="26" class="card-title">2. Invoicing v2</text>
      <text x="16" y="44" class="code-text">POST /v2/invoicing/invoices</text>
      <text x="16" y="68" class="card-body">Itemized reference invoice + QR</text>
      
      <rect x="16" y="78" width="258" height="66" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="94" class="code-text" fill="#94A3B8">invoice_number: &lt;= 25 chars</text>
      <text x="24" y="110" class="code-text" fill="#38BDF8">"PO-202-PP-127563-18c55854"</text>
      <text x="24" y="126" class="code-text" fill="#94A3B8">send_to_recipient: false</text>

      <text x="16" y="162" class="card-body">Call: <tspan class="code-text">POST .../invoices/{id}/send</tspan></text>
      <text x="16" y="180" class="card-body">Generates Sandbox Invoice URL &amp; QR</text>
      <text x="16" y="196" class="code-text" fill="#34D399">INV2-C30368ABA436A64C (SENT)</text>
    </g>

    <!-- Arrow 2.2 -> 2.3 -->
    <path d="M 604 142 L 634 142" class="flow-line" stroke="#38BDF8" marker-end="url(#arrow-blue)"/>

    <!-- Card 2.3: CFO Spend Guardrail (Decision Diamond) -->
    <g transform="translate(634, 40)" filter="url(#shadow)">
      <rect width="260" height="205" rx="10" fill="url(#cardGradDark)" stroke="#F59E0B" stroke-width="1.5"/>
      <rect width="260" height="4" rx="2" fill="url(#amberGlow)"/>
      <text x="16" y="26" class="card-title" fill="#FBBF24">02 / Spend Guardrail</text>
      <text x="16" y="44" class="card-subtitle">Autonomous Limit vs CFO Escalation</text>
      
      <path d="M 130 65 L 210 105 L 130 145 L 50 105 Z" fill="#1E293B" stroke="#F59E0B" stroke-width="1.5"/>
      <text x="130" y="102" text-anchor="middle" class="badge-text" fill="#FBBF24">Total Usd &lt;=</text>
      <text x="130" y="116" text-anchor="middle" class="badge-text" fill="#FBBF24">Guardrail?</text>

      <text x="16" y="172" class="card-body"><tspan fill="#34D399" font-weight="700">YES (&lt;= $15k):</tspan> AUTO_CLEARED</text>
      <text x="16" y="190" class="card-body"><tspan fill="#FB7185" font-weight="700">NO (&gt; $15k):</tspan> Pauses for CFO signoff</text>
      <text x="16" y="204" class="code-text" fill="#94A3B8">Human-in-the-Loop financial safety</text>
    </g>

    <!-- Arrow 2.3 -> 2.4 -->
    <path d="M 894 142 L 924 142" class="flow-line" stroke="#38BDF8" marker-end="url(#arrow-blue)"/>

    <!-- Card 2.4: Orders v2 Checkout & Capture -->
    <g transform="translate(924, 40)" filter="url(#shadow)">
      <rect width="280" height="205" rx="10" fill="url(#cardGradDark)" stroke="#0070BA" stroke-width="1.2"/>
      <rect width="280" height="4" rx="2" fill="url(#blueGlow)"/>
      <text x="16" y="26" class="card-title">3. Checkout Orders v2</text>
      <text x="16" y="44" class="code-text">POST /v2/checkout/orders</text>
      
      <text x="16" y="68" class="card-body">Binds purchase unit to invoice ID:</text>
      <rect x="16" y="78" width="248" height="52" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="96" class="code-text" fill="#94A3B8">intent: "CAPTURE"</text>
      <text x="24" y="112" class="code-text" fill="#38BDF8">custom_id: invoice_number</text>

      <text x="16" y="148" class="card-body">Call: <tspan class="code-text">POST .../orders/{id}/capture</tspan></text>
      <text x="16" y="166" class="card-body">Buyer Authorization → COMPLETED</text>
      <text x="16" y="184" class="code-text" fill="#34D399">Capture ID: CAP-C30368ABA436</text>
      <text x="16" y="200" class="card-subtitle">Internal milestone accounting</text>
    </g>

    <!-- Arrow 2.4 -> 2.5 -->
    <path d="M 1204 142 L 1234 142" class="flow-line" stroke="#10B981" marker-end="url(#arrow-emerald)"/>

    <!-- Card 2.5: Shipping Trackers v1 -->
    <g transform="translate(1234, 40)" filter="url(#shadow)">
      <rect width="222" height="205" rx="10" fill="url(#cardGradDark)" stroke="#10B981" stroke-width="1.2"/>
      <rect width="222" height="4" rx="2" fill="url(#emeraldGlow)"/>
      <text x="16" y="26" class="card-title">4. Shipping Trackers v1</text>
      <text x="16" y="44" class="code-text">POST /v1/shipping/trackers-batch</text>
      <text x="16" y="68" class="card-body">Links fulfillment to capture</text>
      <rect x="16" y="78" width="190" height="54" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="96" class="code-text" fill="#34D399">carrier: "FEDEX"</text>
      <text x="24" y="114" class="code-text" fill="#34D399">tracking: "781234567890"</text>
      <text x="16" y="152" class="card-body">Status: <tspan fill="#34D399" font-weight="700">SHIPPED</tspan></text>
      <text x="16" y="170" class="card-body">Validates batch-level errors</text>
      <text x="16" y="194" class="card-subtitle">Ready for delivery audit</text>
    </g>
  </g>

  <!-- Connection Lane 2 to Lane 3 -->
  <path d="M 1345 675 L 1345 700" class="flow-line" stroke="#10B981" marker-end="url(#arrow-emerald)"/>

  <!-- ========================================================================= -->
  <!-- LANE 3: 03 / FULFILLMENT & CONTRACTUAL SLA RECOVERY                       -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 700)">
    <rect x="0" y="0" width="1480" height="235" rx="14" fill="#0E1626" stroke="#1E293B" stroke-width="1.5"/>
    <rect x="0" y="0" width="6" height="235" rx="3" fill="url(#emeraldGlow)"/>
    <text x="24" y="24" class="phase-label" fill="#34D399">PHASE 03 • 03 / SLA AUDITOR AGENT &amp; CONTRACTUAL PENALTY RECOVERY</text>

    <!-- Card 3.1: Carrier Exception Ingestion -->
    <g transform="translate(24, 40)" filter="url(#shadow)">
      <rect width="320" height="170" rx="10" fill="url(#cardGradDark)" stroke="#F43F5E" stroke-width="1.2"/>
      <rect width="320" height="4" rx="2" fill="url(#roseGlow)"/>
      <text x="16" y="26" class="card-title">Carrier Exception Ingestion</text>
      <text x="16" y="44" class="card-subtitle">FedEx / UPS / DHL Delivery Scan Event</text>
      
      <rect x="16" y="58" width="288" height="52" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="76" class="code-text" fill="#FB7185">STATUS: EXCEPTION_DAMAGED_DELAYED</text>
      <text x="24" y="94" class="code-text" fill="#94A3B8">Report: "Carton torn; 72h transit delay"</text>

      <text x="16" y="130" class="card-body">SLA Risk Score elevated to <tspan fill="#FB7185" font-weight="700">92/100</tspan></text>
      <text x="16" y="148" class="card-body">Dispatched to autonomous SLA Auditor</text>
    </g>

    <!-- Arrow 3.1 -> 3.2 -->
    <path d="M 344 125 L 384 125" class="flow-line" stroke="#10B981" marker-end="url(#arrow-emerald)"/>

    <!-- Card 3.2: SLA Contract Evaluator -->
    <g transform="translate(384, 40)" filter="url(#shadow)">
      <rect width="320" height="170" rx="10" fill="url(#cardGradDark)" stroke="#10B981" stroke-width="1.2"/>
      <rect width="320" height="4" rx="2" fill="url(#emeraldGlow)"/>
      <text x="16" y="26" class="card-title">03 / SLA Auditor Agent</text>
      <text x="16" y="44" class="card-subtitle">Contractual Penalty Mathematical Evaluation</text>
      
      <text x="16" y="68" class="card-body">• Contract Clause 4.2: <tspan fill="#34D399" font-weight="700">15% Delivery Rebate</tspan></text>
      <text x="16" y="86" class="card-body">• Gross Order Amount: <tspan class="code-text">$3,499.90 USD</tspan></text>
      <text x="16" y="104" class="card-body">• Integer-Cent Penalty Math:</text>
      
      <rect x="16" y="112" width="288" height="42" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="128" class="code-text" fill="#34D399">Math.round(3499.90 * 15) / 100</text>
      <text x="24" y="144" class="code-text" fill="#34D399">= $524.69 USD Partial Refund</text>
    </g>

    <!-- Arrow 3.2 -> 3.3 -->
    <path d="M 704 125 L 744 125" class="flow-line" stroke="#10B981" marker-end="url(#arrow-emerald)"/>

    <!-- Card 3.3: Captures Refund v2 -->
    <g transform="translate(744, 40)" filter="url(#shadow)">
      <rect width="330" height="170" rx="10" fill="url(#cardGradDark)" stroke="#0070BA" stroke-width="1.2"/>
      <rect width="330" height="4" rx="2" fill="url(#blueGlow)"/>
      <text x="16" y="26" class="card-title">5. Captures Refund v2</text>
      <text x="16" y="44" class="code-text">POST /v2/payments/captures/{id}/refund</text>

      <rect x="16" y="58" width="298" height="52" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="76" class="code-text" fill="#38BDF8">amount: { value: "524.69", cur: "USD" }</text>
      <text x="24" y="94" class="code-text" fill="#94A3B8">note_to_payer: "SLA 15% delay penalty"</text>

      <text x="16" y="130" class="card-body">PayPal Refund ID: <tspan class="code-text">REFUND-C30368ABA4</tspan></text>
      <text x="16" y="148" class="card-body">Status: <tspan fill="#34D399" font-weight="700">COMPLETED</tspan> · Net Settled: $2,975.21</text>
    </g>

    <!-- Arrow 3.3 -> 3.4 -->
    <path d="M 1074 125 L 1114 125" class="flow-line" stroke="#10B981" marker-end="url(#arrow-emerald)"/>

    <!-- Card 3.4: Customer Disputes & Evidence Packet -->
    <g transform="translate(1114, 40)" filter="url(#shadow)">
      <rect width="342" height="170" rx="10" fill="url(#cardGradDark)" stroke="#8B5CF6" stroke-width="1.2"/>
      <rect width="342" height="4" rx="2" fill="url(#purpleGlow)"/>
      <text x="16" y="26" class="card-title">6. Disputes v1 &amp; Audit Dossier</text>
      <text x="16" y="44" class="code-text">GET /v1/customer/disputes (Read Probe)</text>
      
      <text x="16" y="68" class="card-body">Assembles tamper-evident proof packet:</text>
      <rect x="16" y="78" width="310" height="54" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="94" class="code-text" fill="#A78BFA">dossierId: "DOSSIER-C30368ABA4"</text>
      <text x="24" y="108" class="code-text" fill="#94A3B8">orderId + invoiceId + captureId + refundId</text>
      <text x="24" y="122" class="code-text" fill="#34D399">carrierProof + contractClause + SHA-256</text>

      <text x="16" y="152" class="card-body">Exportable JSON for enterprise accounting</text>
    </g>
  </g>

  <!-- Connection Lane 3 to Lane 4 -->
  <path d="M 800 935 L 800 960" class="flow-line" stroke="#38BDF8" marker-end="url(#arrow-blue)"/>

  <!-- ========================================================================= -->
  <!-- LANE 4: VERIFIED FINANCIAL LEDGER & TELEMETRY INSPECTOR                   -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 960)">
    <rect x="0" y="0" width="1480" height="190" rx="14" fill="#0E1626" stroke="#1E293B" stroke-width="1.5"/>
    <rect x="0" y="0" width="6" height="190" rx="3" fill="url(#cyanGlow)"/>
    <text x="24" y="22" class="phase-label" fill="#38BDF8">PHASE 04 • VERIFIED FINANCIAL LEDGER, AG GRID &amp; AUDIT TELEMETRY</text>

    <!-- Card 4.1: AG Grid Ledger -->
    <g transform="translate(24, 35)" filter="url(#shadow)">
      <rect width="450" height="135" rx="10" fill="url(#cardGradDark)" stroke="#E0234E" stroke-width="1.2"/>
      <rect width="450" height="4" rx="2" fill="url(#roseGlow)"/>
      <text x="16" y="24" class="card-title">Enterprise AG Grid Financial Ledger</text>
      <text x="16" y="40" class="card-subtitle">ag-grid-react • themeQuartz • Custom Financial Renderers</text>
      <text x="16" y="62" class="card-body">• Dynamic columns: PO ID, Sourced Item, Gross USD, Guardrail, Stage</text>
      <text x="16" y="78" class="card-body">• Status Badges: AWAITING_APPROVAL, PAID, IN_TRANSIT, SLA_SETTLED</text>
      <text x="16" y="94" class="card-body">• Multi-column sorting, quick search, and CSV evidence export</text>
      <text x="16" y="112" class="code-text" fill="#FB7185">AG Grid $5,000 Sponsor Category Integration</text>
    </g>

    <!-- Card 4.2: AG Studio Query Bar -->
    <g transform="translate(494, 35)" filter="url(#shadow)">
      <rect width="470" height="135" rx="10" fill="url(#cardGradDark)" stroke="#8B5CF6" stroke-width="1.2"/>
      <rect width="470" height="4" rx="2" fill="url(#purpleGlow)"/>
      <text x="16" y="24" class="card-title">AG Studio Natural Language Query Agent</text>
      <text x="16" y="40" class="card-subtitle">Natural Language to Programmatic Grid Filters / Sort</text>
      <rect x="16" y="52" width="438" height="48" rx="6" fill="#0B0F19" stroke="#1E293B"/>
      <text x="24" y="70" class="code-text" fill="#A78BFA">"show orders over $5,000" → filter: totalGrossUsd &gt; 5000</text>
      <text x="24" y="88" class="code-text" fill="#A78BFA">"filter to SLA refunded"  → filter: stage == '4_SLA_SETTLED'</text>
      <text x="16" y="118" class="card-body">Instant grid manipulation without manual column configuration</text>
    </g>

    <!-- Card 4.3: Real-Time Telemetry & AG Charts -->
    <g transform="translate(984, 35)" filter="url(#shadow)">
      <rect width="472" height="135" rx="10" fill="url(#cardGradDark)" stroke="#0284C7" stroke-width="1.2"/>
      <rect width="472" height="4" rx="2" fill="url(#cyanGlow)"/>
      <text x="16" y="24" class="card-title">Real-Time Telemetry Inspector &amp; AG Charts</text>
      <text x="16" y="40" class="card-subtitle">Complete Auditability • 0 Secrets Leaked • Spend Visuals</text>
      <text x="16" y="62" class="card-body">• Inspectable raw HTTP request/response bodies and latencies</text>
      <text x="16" y="78" class="card-body">• SHA-256 idempotency locking via <tspan class="code-text">PayPal-Request-Id</tspan></text>
      <text x="16" y="94" class="card-body">• Interactive spend category allocation with <tspan class="code-text">ag-charts-react</tspan></text>
      <text x="16" y="112" class="code-text" fill="#38BDF8">Mode Disclosures: LIVE_SANDBOX vs SANDBOX_SIMULATION</text>
    </g>
  </g>

</svg>
`;

writeFileSync("artifacts/pactpay-architecture-4x3.svg", svg, "utf8");
writeFileSync("public/pactpay-architecture-4x3.svg", svg, "utf8");
console.log("Successfully generated artifacts/pactpay-architecture-4x3.svg (1600x1200, 4:3)");
