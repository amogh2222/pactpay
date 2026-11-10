#!/usr/bin/env node
import { tsImport } from "tsx/esm/api";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const p = await tsImport("../src/lib/paypal/client.ts", import.meta.url);
const live = Boolean(
  process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_SECRET,
);
const execute = process.argv.includes("--execute");
const statePath = ".pactpay/verifier-state.json";
let state =
  live && existsSync(statePath) && !process.argv.includes("--new")
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : {};
function checkpoint() {
  if (live) {
    mkdirSync(".pactpay", { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  }
}
const rows = [];
function row(module, status, detail) {
  rows.push({ module, status, detail });
}
try {
  const connection = await p.verifyPayPalConnection();
  row(
    "OAuth2",
    connection.connected ? "PASS" : live ? "FAIL" : "SIMULATED",
    `${connection.mode} · ${connection.latencyMs}ms`,
  );
  if (live && !connection.connected)
    throw new Error("OAuth failed. Check your Sandbox app credentials.");
  if (!live || execute) {
    if (state.fingerprint && state.fingerprint !== p.credentialFingerprint())
      throw new Error(
        "Verifier checkpoint belongs to another Sandbox account. Use --new for a new test.",
      );
    state.fingerprint = p.credentialFingerprint();
    state.key ||= p.uniqueReference("CLI");
    state.reference ||= p.uniqueReference("CLI-INVOICE");
    checkpoint();
    const key = state.key,
      reference = state.reference;
    const product =
      state.product ||
      (await p.createCatalogProduct({
        title: "PactPay SLA verifier — enterprise dock",
        sku: "VERIFY-TB4-001",
        operationKey: key,
      }));
    state.product = product;
    checkpoint();
    row("Catalog v1", live ? "PASS" : "SIMULATED", product.productId);
    const invoice =
      state.invoice ||
      (await p.createAndSendInvoice({
        title: "Enterprise dock verification",
        sku: "VERIFY-TB4-001",
        quantity: 1,
        unitPriceUsd: 10,
        productId: product.productId,
        invoiceNumber: reference,
        operationKey: key,
        invoiceId: state.draftId,
        onCreated: (id) => {
          state.draftId = id;
          checkpoint();
        },
      }));
    state.invoice = invoice;
    checkpoint();
    row("Invoicing v2", live ? "PASS" : "SIMULATED", invoice.invoiceId);
    if (
      process.env.PAYPAL_VERIFY_ORDER_ID &&
      process.env.PAYPAL_VERIFY_ORDER_ID !== state.orderId
    )
      throw new Error(
        "Only the order created by this verifier checkpoint can be captured.",
      );
    const order = state.order?.captureId
      ? state.order
      : await p.createAndCaptureOrder({
          totalUsd: 10,
          invoiceNumber: reference,
          customId: reference,
          operationKey: key,
          orderId: state.orderId,
          onCreated: (id) => {
            state.orderId = id;
            checkpoint();
          },
        });
    state.order = order;
    checkpoint();
    row(
      "Orders v2",
      live ? "PASS" : "SIMULATED",
      `${order.orderId} / ${order.status}`,
    );
    if (!order.captureId) {
      row(
        "Shipping Trackers v1",
        "BLOCKED",
        "Requires approved and completed capture",
      );
      row(
        "Captures Refund v2",
        "BLOCKED",
        "Requires approved and completed capture",
      );
      console.log(
        `\nApprove this Sandbox order: ${order.approveUrl || order.orderId}\nThen rerun with --execute; the checkpoint resumes order ${order.orderId}.\n`,
      );
    } else {
      const trackingNumber =
        process.env.PAYPAL_VERIFY_TRACKING_NUMBER || "781234567890";
      const tracker =
        state.tracker ||
        (await p.attachShipmentTracking({
          captureId: order.captureId,
          trackingNumber,
          carrier: "FEDEX",
          operationKey: key,
        }));
      state.tracker = tracker;
      checkpoint();
      row("Shipping Trackers v1", live ? "PASS" : "SIMULATED", tracker.status);
      const refund =
        state.refund ||
        (await p.issueSlaPartialRefund({
          captureId: order.captureId,
          grossUsd: 10,
          penaltyPercent: 15,
          reason:
            "CLI Sandbox test: 15% SLA rebate, synthetic carrier exception.",
          operationKey: key,
          invoiceNumber: reference,
        }));
      state.refund = refund;
      checkpoint();
      row(
        "Captures Refund v2",
        live ? "PASS" : "SIMULATED",
        `${refund.refundId} / ${refund.status} / USD ${p.money(refund.refundAmountUsd)}`,
      );
    }
    const packet = await p.buildDisputeEvidencePacket({
      orderId: order.orderId,
      invoiceId: invoice.invoiceId,
      refundId: state.refund?.refundId || "NO_REFUND_YET",
      carrierProof: "Synthetic CLI test event",
      contractClause: "CLI test clause: 15% rebate",
      grossOrderUsd: 10,
      refundedUsd: order.captureId ? 1.5 : 0,
      operationKey: key,
    });
    row(
      "Customer Disputes v1",
      live ? "PASS" : "SIMULATED",
      `GET ${packet.telemetry.status}; dossier prepared locally`,
    );
  } else {
    // Read-only probes do not assert permission for write operations.
    const tokenRes = await fetch(`${p.PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(20000),
    });
    const token = await tokenRes.json();
    for (const [name, path] of [
      ["Catalog v1", "/v1/catalogs/products?page_size=1"],
      ["Invoicing v2", "/v2/invoicing/invoices?page_size=1"],
      ["Customer Disputes v1", "/v1/customer/disputes"],
    ]) {
      const r = await fetch(p.PAYPAL_BASE + path, {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(20000),
      });
      row(
        name,
        r.ok ? "READ PASS" : "FAIL",
        `HTTP ${r.status}; write permission not tested`,
      );
    }
    for (const name of [
      "Orders v2",
      "Shipping Trackers v1",
      "Captures Refund v2",
    ])
      row(name, "NOT RUN", "Use --execute for a USD 10 Sandbox lifecycle");
  }
} catch (e) {
  row("Verification", "FAIL", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
}
const widths = [23, 12, 80];
const border = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
const line = (values) =>
  "|" +
  values
    .map(
      (v, i) =>
        ` ${String(v)
          .replace(/[^\x20-\x7E]/g, " ")
          .slice(0, widths[i])
          .padEnd(widths[i])} `,
    )
    .join("|") +
  "|";
console.log(
  "\nPactPay / PayPal Sandbox verification\n" +
    border +
    "\n" +
    line(["Module", "Result", "Evidence"]) +
    "\n" +
    border,
);
for (const r of rows) console.log(line([r.module, r.status, r.detail]));
console.log(border);
console.log(
  live
    ? "Live Sandbox only. NOT RUN/BLOCKED rows are not successful validation."
    : "No credentials: all six modules exercised against deterministic simulated payloads. Live access NOT verified.",
);
if (rows.some((r) => ["FAIL", "BLOCKED", "NOT RUN"].includes(r.status)))
  process.exitCode = 1;
