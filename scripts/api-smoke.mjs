import assert from "node:assert/strict";
const base = process.env.PACTPAY_TEST_URL || "http://localhost:3000";
const initial = await fetch(`${base}/api/orders`);
assert.equal(initial.status, 200);
const cookie = initial.headers.get("set-cookie").split(";")[0];
const first = await initial.json();
assert.equal(first.orders.length, 4);
async function post(path, body) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
const verify = await post("/api/paypal/verify", {
  clientId: "",
  clientSecret: "",
});
assert.equal(verify.data.mode, "SANDBOX_SIMULATION");
const denied = await post("/api/paypal/workflow", {
  step: "STEP_2_CAPTURE_ORDER",
  orderId: first.orders[0].id,
  credentials: { clientId: "", clientSecret: "" },
});
assert.equal(denied.status, 400);
assert.match(denied.data.error, /CFO/);
const invalid = await post("/api/agent/procure", {
  prompt: "Buy desks",
  budgetGuardrailUsd: -1,
});
assert.equal(invalid.status, 400);
const requestId = crypto.randomUUID();
const body = {
  prompt: "Procure 35 ergonomic mesh chairs under $410/unit for Workspace Ops",
  budgetGuardrailUsd: 15000,
  credentials: { clientId: "", clientSecret: "" },
  requestId,
};
const sourced = await post("/api/agent/procure", body);
assert.equal(sourced.status, 200, JSON.stringify(sourced.data));
assert.equal(sourced.data.order.stage, "1_INVOICED");
assert.equal(sourced.data.order.competingQuotes.length, 3);
assert.equal(sourced.data.order.credentialFingerprint, undefined);
const repeat = await post("/api/agent/procure", body);
assert.equal(repeat.data.order.id, sourced.data.order.id);
let order = sourced.data.order;
for (const step of [
  "STEP_2_CAPTURE_ORDER",
  "STEP_3_ATTACH_TRACKING",
  "STEP_4_SLA_REFUND",
]) {
  const r = await post("/api/paypal/workflow", {
    step,
    orderId: order.id,
    credentials: { clientId: "", clientSecret: "" },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  order = r.data.order;
}
assert.equal(order.stage, "4_SLA_SETTLED");
assert.ok(order.disputeDossier);
assert.equal(
  Math.round((order.netSettledUsd + order.slaRefundAmountUsd) * 100),
  Math.round(order.totalGrossUsd * 100),
);
const separate = await fetch(`${base}/api/orders`).then((r) => r.json());
assert.equal(separate.orders.length, 4);
assert.ok(!separate.orders.some((o) => o.id === order.id));
console.log(
  "PASS: HTTP session isolation, validation, CFO guardrail, procurement retry, all four stages and balanced settlement.",
);
