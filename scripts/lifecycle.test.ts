import { test } from "node:test";
import assert from "node:assert/strict";
import * as p from "../src/lib/paypal/client";
import {
  advance,
  workflowSchema,
  parsePrompt,
} from "../src/lib/agents/workflow";
import { getStore, withLock } from "../src/lib/store/procurement-store";
const credentials = { clientId: "", clientSecret: "" };
const step = (step: string, orderId: string, extra = {}) =>
  workflowSchema.parse({ step, orderId, credentials, ...extra });
test("money serializes USD in exact two decimals and rejects invalid amounts", () => {
  assert.deepEqual(p.usd(185), { currency_code: "USD", value: "185.00" });
  assert.throws(() => p.usd(NaN));
  assert.throws(() => p.usd(-1));
});
test("credentials cannot be partial and simulation is disclosed", async () => {
  assert.throws(() => p.resolveCredentials({ clientId: "partial" }));
  const r = await p.verifyPayPalConnection(credentials);
  assert.equal(r.connected, false);
  assert.equal(r.mode, "SANDBOX_SIMULATION");
  assert.equal(r.telemetry.status, 200);
});
test("parser handles quantities, currency commas and department", () => {
  const r = parsePrompt(
    "Procure 35 Herman Miller chairs under $1,410/unit for Workspace Ops with 5-day SLA",
  );
  assert.equal(r.quantity, 35);
  assert.equal(r.maxUnitPrice, 1410);
  assert.equal(r.department, "Workspace Ops");
});
test("financial workflow guards, serialization and repeat actions", async () => {
  const store = getStore("test-" + crypto.randomUUID());
  const o = store.orders[0];
  await assert.rejects(
    advance(store, step("STEP_2_CAPTURE_ORDER", o.id)),
    /CFO approval/,
  );
  await assert.rejects(
    advance(store, step("STEP_4_SLA_REFUND", o.id)),
    /Attach shipment/,
  );
  await advance(
    store,
    step("STEP_2_CAPTURE_ORDER", o.id, { approveGuardrail: true }),
  );
  assert.equal(o.stage, "2_ESCROW_CAPTURED");
  assert.ok(o.paypalCaptureId);
  const capture = o.paypalCaptureId;
  await advance(store, step("STEP_2_CAPTURE_ORDER", o.id));
  assert.equal(o.paypalCaptureId, capture);
  await advance(store, step("STEP_3_ATTACH_TRACKING", o.id));
  const refundStep = step("STEP_4_SLA_REFUND", o.id);
  await Promise.all([
    withLock(o.id, () => advance(store, refundStep)),
    withLock(o.id, () => advance(store, refundStep)),
  ]);
  assert.equal(o.stage, "4_SLA_SETTLED");
  assert.equal(o.slaRefundAmountUsd, 2021.25);
  assert.equal(o.netSettledUsd, 11453.75);
  assert.equal(
    store.telemetryLogs.filter((l) => l.apiName === "Captures Refund v2")
      .length,
    1,
  );
  assert.ok(o.disputeDossier);
  assert.equal(o.disputeDossier.netFinalUsd, o.netSettledUsd);
});
test("simulation IDs cannot enter live workflow and sessions are isolated", async () => {
  const a = getStore("test-" + crypto.randomUUID()),
    b = getStore("test-" + crypto.randomUUID());
  a.orders[0].prompt = "changed";
  assert.notEqual(a.orders[0].prompt, b.orders[0].prompt);
  await assert.rejects(
    advance(
      a,
      workflowSchema.parse({
        step: "STEP_2_CAPTURE_ORDER",
        orderId: a.orders[0].id,
        credentials: { clientId: "fake", clientSecret: "fake" },
      }),
    ),
    /different mode/,
  );
});
test("all six operations produce schema-accurate linked simulation payloads", async () => {
  const key = "fixture-1",
    invoiceNumber = "TEST-PP-123456-abcd";
  const product = await p.createCatalogProduct(
    { title: "Test chair", sku: "CHAIR-01", operationKey: key },
    credentials,
  );
  const invoice = await p.createAndSendInvoice(
    {
      title: "Test chair",
      sku: "CHAIR-01",
      quantity: 2,
      unitPriceUsd: 185,
      productId: product.productId,
      invoiceNumber,
      operationKey: key,
    },
    credentials,
  );
  assert.equal(invoice.telemetryLogs.length, 2);
  const order = await p.createAndCaptureOrder(
    {
      totalUsd: 370,
      invoiceNumber,
      customId: invoiceNumber,
      operationKey: key,
    },
    credentials,
  );
  assert.equal(order.status, "COMPLETED");
  assert.ok(order.captureId);
  const tracking = await p.attachShipmentTracking(
    {
      captureId: order.captureId!,
      trackingNumber: "781234567890",
      carrier: "FEDEX",
      operationKey: key,
    },
    credentials,
  );
  assert.equal(tracking.status, "SHIPPED");
  const refund = await p.issueSlaPartialRefund(
    {
      captureId: order.captureId!,
      grossUsd: 370,
      penaltyPercent: 15,
      reason: "Damaged carton",
      operationKey: key,
      invoiceNumber,
    },
    credentials,
  );
  assert.equal(refund.refundAmountUsd, 55.5);
  const packet = await p.buildDisputeEvidencePacket(
    {
      orderId: order.orderId,
      invoiceId: invoice.invoiceId,
      refundId: refund.refundId,
      carrierProof: "Damaged carton",
      contractClause: "15% damage SLA",
      grossOrderUsd: 370,
      refundedUsd: 55.5,
      operationKey: key,
    },
    credentials,
  );
  assert.equal(packet.dossier.netFinalUsd, 314.5);
  assert.equal(packet.dossier.submittedToPayPal, false);
});
test("live OAuth failures are surfaced, not silently simulated", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "invalid_client" }), { status: 401 });
  try {
    const result = await p.verifyPayPalConnection({
      clientId: "invalid",
      clientSecret: "invalid",
    });
    assert.equal(result.connected, false);
    assert.equal(result.mode, "LIVE_SANDBOX");
    assert.equal(result.telemetry.status, 401);
  } finally {
    globalThis.fetch = original;
  }
});

test("invoice reference suffix fits the PayPal 25-character contract", () => {
  const refs = Array.from({ length: 100 }, () =>
    p.uniqueReference("PO-2026-4091-LONG-REFERENCE"),
  );
  assert.equal(new Set(refs).size, 100);
  for (const ref of refs) {
    assert.ok(ref.length <= 25);
    assert.match(ref, /PP-\d{6}-[a-f0-9]{8}$/);
  }
});
test("live checkout pauses for approval, captures on resume and redacts tokens", async () => {
  const original = globalThis.fetch;
  const requests: {
    url: string;
    body: Record<string, unknown>;
    key: string | null;
  }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/token"))
      return Response.json({
        access_token: "test-secret-token",
        expires_in: 3600,
        scope: "payments",
        app_id: "APP-TEST",
      });
    requests.push({
      url,
      body: JSON.parse(String(init?.body || "{}")),
      key: new Headers(init?.headers).get("PayPal-Request-Id"),
    });
    return Response.json(
      url.endsWith("/capture")
        ? {
            id: "5O190127TN364715T",
            status: "COMPLETED",
            purchase_units: [
              {
                payments: {
                  captures: [{ id: "3C679366HH908993F", status: "COMPLETED" }],
                },
              },
            ],
          }
        : {
            id: "5O190127TN364715T",
            status: "PAYER_ACTION_REQUIRED",
            links: [
              {
                rel: "payer-action",
                href: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
              },
            ],
          },
      { status: 201 },
    );
  };
  try {
    const c = { clientId: "checkout-test", clientSecret: "test" };
    const input = {
      totalUsd: 185,
      invoiceNumber: "INV-PP-123456-abcd",
      customId: "PO-PP-123456-abcd",
      operationKey: "approved-flow",
    };
    const created = await p.createAndCaptureOrder(input, c);
    assert.equal(created.captureId, undefined);
    assert.equal(requests.length, 1);
    assert.ok(created.approveUrl);
    const captured = await p.createAndCaptureOrder(
      { ...input, orderId: created.orderId },
      c,
    );
    assert.equal(captured.captureId, "3C679366HH908993F");
    assert.equal(captured.status, "COMPLETED");
    assert.ok(requests[1].url.endsWith("/capture"));
    assert.ok(requests[1].key);
    const verified = await p.verifyPayPalConnection(c);
    assert.ok(!JSON.stringify(verified).includes("test-secret-token"));
  } finally {
    globalThis.fetch = original;
  }
});
test("shipping batch-level errors prevent successful fulfillment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith("/token")
      ? Response.json({ access_token: "test", expires_in: 3600 })
      : Response.json({
          trackers: [],
          errors: [{ name: "INVALID_TRANSACTION_ID" }],
        });
  try {
    await assert.rejects(
      p.attachShipmentTracking(
        {
          captureId: "bad",
          trackingNumber: "781234567890",
          carrier: "FEDEX",
          operationKey: "batch-error",
        },
        { clientId: "batch-test", clientSecret: "test" },
      ),
      /rejected one or more/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
