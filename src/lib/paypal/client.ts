import { createHash, randomUUID } from "node:crypto";

export type Mode = "LIVE_SANDBOX" | "SANDBOX_SIMULATION";
export interface Credentials {
  clientId?: string;
  clientSecret?: string;
}
export interface TelemetryLog {
  id: string;
  timestamp: string;
  agent: "SOURCING" | "TREASURY" | "AUDITOR";
  apiName: string;
  method: "GET" | "POST";
  endpoint: string;
  status: number;
  durationMs: number;
  mode: Mode;
  requestBody: unknown;
  responseBody: unknown;
}
export const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";
export const money = (n: number) => {
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid currency amount");
  return (Math.round(n * 100) / 100).toFixed(2);
};
export const usd = (n: number) => ({ currency_code: "USD", value: money(n) });
export const uniqueReference = (base: string) =>
  `${base.slice(0, 6)}-PP-${Date.now().toString().slice(-6)}-${randomUUID().slice(0, 8)}`;
export function resolveCredentials(c?: Credentials) {
  const explicit = c !== undefined;
  const clientId =
    (explicit ? c.clientId : process.env.PAYPAL_CLIENT_ID)?.trim() || "";
  const clientSecret =
    (explicit ? c.clientSecret : process.env.PAYPAL_CLIENT_SECRET)?.trim() ||
    "";
  if (!!clientId !== !!clientSecret)
    throw new Error("Provide both Sandbox Client ID and Secret.");
  return { clientId, clientSecret };
}
export const modeFor = (c?: Credentials): Mode =>
  resolveCredentials(c).clientId ? "LIVE_SANDBOX" : "SANDBOX_SIMULATION";
export const credentialFingerprint = (c?: Credentials) =>
  createHash("sha256")
    .update(JSON.stringify(resolveCredentials(c)))
    .digest("hex");
export function log(
  apiName: string,
  method: "GET" | "POST",
  endpoint: string,
  status: number,
  durationMs: number,
  mode: Mode,
  requestBody: unknown,
  responseBody: unknown,
  agent: TelemetryLog["agent"] = "TREASURY",
): TelemetryLog {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    agent,
    apiName,
    method,
    endpoint,
    status,
    durationMs: Math.round(durationMs),
    mode,
    requestBody,
    responseBody,
  };
}
export class PayPalError extends Error {
  constructor(
    message: string,
    public telemetryLogs: TelemetryLog[],
    public status = 502,
  ) {
    super(message);
  }
}
const tokens = new Map<string, { token: string; expires: number }>();
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /access_token|client_secret|authorization|payer_id|email_address/i.test(
          k,
        )
          ? "[REDACTED]"
          : redact(v),
      ]),
    );
  return value;
}
async function oauth(c?: Credentials, force = false) {
  const credentials = resolveCredentials(c),
    mode = modeFor(c),
    start = performance.now();
  if (mode === "SANDBOX_SIMULATION") {
    const response = {
      scope:
        "https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/payments/payment",
      app_id: "APP-SIMULATION",
      token_type: "Bearer",
      expires_in: 32400,
      access_token: "[REDACTED]",
    };
    return {
      token: "",
      data: response,
      telemetry: log(
        "OAuth2",
        "POST",
        `${PAYPAL_BASE}/v1/oauth2/token`,
        200,
        0,
        mode,
        { grant_type: "client_credentials" },
        response,
      ),
    };
  }
  const key = credentialFingerprint(c),
    cached = tokens.get(key);
  if (!force && cached && cached.expires > Date.now())
    return { token: cached.token };
  let response: Response;
  try {
    response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new PayPalError("PayPal OAuth connection timed out or failed.", [
      log(
        "OAuth2",
        "POST",
        `${PAYPAL_BASE}/v1/oauth2/token`,
        503,
        performance.now() - start,
        mode,
        { grant_type: "client_credentials" },
        { error: "Connection failure" },
      ),
    ]);
  }
  const data = await response.json();
  const telemetry = log(
    "OAuth2",
    "POST",
    `${PAYPAL_BASE}/v1/oauth2/token`,
    response.status,
    performance.now() - start,
    mode,
    { grant_type: "client_credentials" },
    redact(data),
  );
  if (!response.ok || !data.access_token)
    throw new PayPalError(
      "PayPal rejected these Sandbox credentials.",
      [telemetry],
      401,
    );
  if (tokens.size > 100) tokens.clear();
  tokens.set(key, {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  });
  return { token: data.access_token as string, data, telemetry };
}
export async function verifyPayPalConnection(c?: Credentials) {
  try {
    const r = await oauth(c, true);
    return {
      connected: modeFor(c) === "LIVE_SANDBOX",
      mode: modeFor(c),
      latencyMs: r.telemetry!.durationMs,
      appId: r.data.app_id as string,
      scopes: String(r.data.scope).split(" "),
      telemetry: r.telemetry!,
    };
  } catch (e) {
    if (e instanceof PayPalError)
      return {
        connected: false,
        mode: modeFor(c),
        latencyMs: e.telemetryLogs[0].durationMs,
        appId: "",
        scopes: [],
        telemetry: e.telemetryLogs[0],
        error: e.message,
      };
    throw e;
  }
}
async function request<T>(
  api: string,
  path: string,
  method: "GET" | "POST",
  body: unknown,
  simulated: T,
  c?: Credentials,
  key = path,
  agent: TelemetryLog["agent"] = "TREASURY",
): Promise<{ data: T; telemetry: TelemetryLog }> {
  const mode = modeFor(c),
    start = performance.now();
  if (mode === "SANDBOX_SIMULATION")
    return {
      data: simulated,
      telemetry: log(
        api,
        method,
        PAYPAL_BASE + path,
        method === "GET" ? 200 : path.endsWith("/send") ? 202 : 201,
        0,
        mode,
        body,
        simulated,
        agent,
      ),
    };
  const auth = await oauth(c);
  let res: Response;
  try {
    res = await fetch(PAYPAL_BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": createHash("sha256")
          .update(key)
          .digest("hex")
          .slice(0, 38),
        Prefer: "return=representation",
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
  } catch {
    throw new PayPalError(
      "PayPal request failed. Retry the same operation safely.",
      [
        log(
          api,
          method,
          PAYPAL_BASE + path,
          503,
          performance.now() - start,
          mode,
          body,
          { error: "Network failure" },
          agent,
        ),
      ],
    );
  }
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: "Non-JSON PayPal response" };
  }
  const telemetry = log(
    api,
    method,
    PAYPAL_BASE + path,
    res.status,
    performance.now() - start,
    mode,
    redact(body),
    redact(data),
    agent,
  );
  if (!res.ok)
    throw new PayPalError(
      `PayPal ${api}: ${data.name || res.status} — ${data.message || "request rejected"}`,
      [telemetry],
    );
  return { data, telemetry };
}
const simId = (prefix: string, key: string) =>
  `${prefix}-${createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase()}`;
export interface ProductInput {
  title: string;
  sku: string;
  operationKey: string;
}
export async function createCatalogProduct(
  input: ProductInput,
  c?: Credentials,
) {
  const r = await request(
    "Catalog v1",
    "/v1/catalogs/products",
    "POST",
    {
      name: input.title.slice(0, 127),
      type: "PHYSICAL",
      description: `B2B procurement SKU ${input.sku}`,
    },
    { id: simId("PROD", input.operationKey), name: input.title },
    c,
    input.operationKey + ":catalog",
    "SOURCING",
  );
  return { productId: r.data.id, telemetry: r.telemetry };
}
export interface InvoiceInput {
  title: string;
  sku: string;
  quantity: number;
  unitPriceUsd: number;
  productId: string;
  invoiceNumber: string;
  operationKey: string;
  invoiceId?: string;
  onCreated?: (id: string) => void;
}
export async function createAndSendInvoice(
  input: InvoiceInput,
  c?: Credentials,
) {
  if (input.invoiceNumber.length > 25)
    throw new Error("PayPal invoice numbers must be at most 25 characters.");
  const logs: TelemetryLog[] = [];
  let id = input.invoiceId;
  if (!id) {
    const r = await request(
      "Invoicing v2",
      "/v2/invoicing/invoices",
      "POST",
      {
        detail: {
          invoice_number: input.invoiceNumber,
          currency_code: "USD",
          reference: input.productId,
          note: "Milestone reference invoice. Pay via the linked Checkout order only; do not pay twice. Bank transfer preferred where eligible.",
          payment_term: { term_type: "DUE_ON_RECEIPT" },
        },
        items: [
          {
            name: input.title,
            description: `SKU ${input.sku}`,
            quantity: String(input.quantity),
            unit_amount: usd(input.unitPriceUsd),
            unit_of_measure: "QUANTITY",
          },
        ],
        configuration: {
          partial_payment: { allow_partial_payment: false },
          allow_tip: false,
          tax_inclusive: false,
        },
      },
      { id: simId("INV2", input.operationKey), status: "DRAFT" },
      c,
      input.operationKey + ":invoice",
    );
    id = r.data.id;
    if (!id) throw new Error("PayPal invoice response omitted its ID");
    logs.push(r.telemetry);
    input.onCreated?.(id);
  }
  try {
    const sent = await request(
      "Invoicing v2",
      `/v2/invoicing/invoices/${encodeURIComponent(id)}/send`,
      "POST",
      { send_to_invoicer: false, send_to_recipient: false },
      { href: `https://www.sandbox.paypal.com/invoice/p/#${id}` },
      c,
      input.operationKey + ":send",
    );
    logs.push(sent.telemetry);
  } catch (e) {
    if (e instanceof PayPalError) e.telemetryLogs.unshift(...logs);
    throw e;
  }
  return {
    invoiceId: id,
    invoiceNumber: input.invoiceNumber,
    invoiceUrl: `https://www.sandbox.paypal.com/invoice/p/#${id}`,
    paymentPreference: "PAY_BY_BANK" as const,
    telemetry: logs[logs.length - 1],
    telemetryLogs: logs,
  };
}
export interface OrderInput {
  totalUsd: number;
  invoiceNumber: string;
  customId: string;
  operationKey: string;
  orderId?: string;
  onCreated?: (id: string, url?: string) => void;
}
export async function createAndCaptureOrder(
  input: OrderInput,
  c?: Credentials,
) {
  const logs: TelemetryLog[] = [];
  let id = input.orderId;
  let approveUrl: string | undefined;
  type OrderResponse = {
    id: string;
    status: string;
    links?: { rel: string; href: string }[];
    purchase_units?: {
      payments?: { captures?: { id: string; status: string }[] };
    }[];
  };
  if (!id) {
    const url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const r = await request<OrderResponse>(
      "Orders v2",
      "/v2/checkout/orders",
      "POST",
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            invoice_id: input.invoiceNumber,
            custom_id: input.customId,
            amount: usd(input.totalUsd),
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: `${url}/?paypal=approved`,
              cancel_url: `${url}/?paypal=cancelled`,
              user_action: "PAY_NOW",
            },
          },
        },
      },
      { id: simId("ORDER", input.operationKey), status: "APPROVED", links: [] },
      c,
      input.operationKey + ":order",
    );
    logs.push(r.telemetry);
    id = r.data.id;
    approveUrl = r.data.links?.find(
      (l) => l.rel === "payer-action" || l.rel === "approve",
    )?.href;
    input.onCreated?.(id, approveUrl);
    if (modeFor(c) === "LIVE_SANDBOX")
      return {
        orderId: id,
        captureId: undefined,
        status: r.data.status,
        approveUrl,
        telemetry: r.telemetry,
        telemetryLogs: logs,
      };
  }
  try {
    const r = await request<OrderResponse>(
      "Orders v2",
      `/v2/checkout/orders/${encodeURIComponent(id!)}/capture`,
      "POST",
      {},
      {
        id: id!,
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                { id: simId("CAP", input.operationKey), status: "COMPLETED" },
              ],
            },
          },
        ],
      },
      c,
      input.operationKey + ":capture",
    );
    logs.push(r.telemetry);
    const capture = r.data.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      orderId: id!,
      captureId: capture?.id,
      status: capture?.status || r.data.status,
      approveUrl,
      telemetry: r.telemetry,
      telemetryLogs: logs,
    };
  } catch (e) {
    if (e instanceof PayPalError) e.telemetryLogs.unshift(...logs);
    throw e;
  }
}
export interface TrackingInput {
  captureId: string;
  trackingNumber: string;
  carrier: "FEDEX" | "UPS" | "DHL";
  operationKey: string;
}
export async function attachShipmentTracking(
  input: TrackingInput,
  c?: Credentials,
) {
  const body = {
    trackers: [
      {
        transaction_id: input.captureId,
        tracking_number: input.trackingNumber,
        status: "SHIPPED",
        carrier: input.carrier,
      },
    ],
  };
  const r = await request<{ trackers: unknown[]; errors?: unknown[] }>(
    "Shipping Trackers v1",
    "/v1/shipping/trackers-batch",
    "POST",
    body,
    { trackers: body.trackers },
    c,
    input.operationKey + ":tracking",
  );
  if (r.data.errors?.length)
    throw new PayPalError("PayPal rejected one or more shipment trackers.", [
      r.telemetry,
    ]);
  return {
    trackingNumber: input.trackingNumber,
    status: "SHIPPED",
    telemetry: r.telemetry,
  };
}
export interface RefundInput {
  captureId: string;
  grossUsd: number;
  penaltyPercent: number;
  reason: string;
  operationKey: string;
  invoiceNumber: string;
}
export async function issueSlaPartialRefund(
  input: RefundInput,
  c?: Credentials,
) {
  if (input.penaltyPercent <= 0 || input.penaltyPercent > 100)
    throw new Error("Invalid SLA penalty");
  const refundAmountUsd =
    Math.round(
      (Math.round(input.grossUsd * 100) * input.penaltyPercent) / 100,
    ) / 100;
  const r = await request(
    "Captures Refund v2",
    `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
    "POST",
    {
      amount: usd(refundAmountUsd),
      invoice_id: input.invoiceNumber,
      note_to_payer: input.reason.slice(0, 255),
    },
    {
      id: simId("REFUND", input.operationKey),
      status: "COMPLETED",
      amount: usd(refundAmountUsd),
    },
    c,
    input.operationKey + ":refund",
    "AUDITOR",
  );
  return {
    refundId: r.data.id,
    status: r.data.status,
    refundAmountUsd,
    netFinalUsd: Math.round((input.grossUsd - refundAmountUsd) * 100) / 100,
    telemetry: r.telemetry,
  };
}
export interface EvidenceInput {
  orderId: string;
  invoiceId: string;
  refundId: string;
  carrierProof: string;
  contractClause: string;
  grossOrderUsd: number;
  refundedUsd: number;
  operationKey: string;
}
export async function buildDisputeEvidencePacket(
  input: EvidenceInput,
  c?: Credentials,
) {
  const r = await request<{ items: unknown[] }>(
    "Customer Disputes v1",
    "/v1/customer/disputes",
    "GET",
    null,
    { items: [] },
    c,
    input.operationKey + ":disputes",
    "AUDITOR",
  );
  return {
    dossier: {
      ...input,
      dossierId: simId("DOSSIER", input.operationKey),
      createdAt: new Date().toISOString(),
      netFinalUsd:
        Math.round((input.grossOrderUsd - input.refundedUsd) * 100) / 100,
      disputes: r.data.items,
      submittedToPayPal: false,
    },
    telemetry: r.telemetry,
  };
}

export async function readRefundStatus(refundId: string, c?: Credentials) {
  const r = await request<{ id: string; status: string }>(
    "Captures Refund v2",
    `/v2/payments/refunds/${encodeURIComponent(refundId)}`,
    "GET",
    null,
    { id: refundId, status: "COMPLETED" },
    c,
    refundId + ":status",
    "AUDITOR",
  );
  return { status: r.data.status, telemetry: r.telemetry };
}
