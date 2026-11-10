import { randomUUID } from "node:crypto";
import { demoQuotes, type SupplierQuote } from "../channel3/client";
import { log, type TelemetryLog, type Mode } from "../paypal/client";
export type Department =
  "Workspace Ops" | "IT Infrastructure" | "Supply Chain" | "Retail Expansion";
export interface ProcurementOrder {
  id: string;
  createdAt: string;
  requesterDept: Department;
  prompt: string;
  quantity: number;
  budgetGuardrailUsd: number;
  selectedQuote: SupplierQuote;
  competingQuotes: SupplierQuote[];
  unitPriceUsd: number;
  totalGrossUsd: number;
  guardrailStatus: "AUTO_CLEARED" | "AWAITING_CFO_APPROVAL" | "CFO_APPROVED";
  stage: "1_INVOICED" | "2_ESCROW_CAPTURED" | "3_IN_TRANSIT" | "4_SLA_SETTLED";
  paypalCatalogId: string;
  paypalInvoiceId: string;
  paypalInvoiceNumber: string;
  paypalInvoiceUrl: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  carrier?: "FEDEX" | "UPS" | "DHL";
  trackingNumber?: string;
  shipmentStatus?:
    | "AWAITING_DISPATCH"
    | "IN_TRANSIT_ON_TIME"
    | "EXCEPTION_DAMAGED_DELAYED"
    | "DELIVERED";
  slaRiskScore: number;
  slaExceptionReport?: string;
  slaRefundAmountUsd?: number;
  netSettledUsd: number;
  paypalRefundId?: string;
  disputeDossier?: {
    dossierId: string;
    createdAt: string;
    contractClause: string;
    carrierProof: string;
    grossOrderUsd: number;
    refundedUsd: number;
    netFinalUsd: number;
  };
  agentTimeline: {
    id: string;
    agent: "SOURCING" | "TREASURY" | "AUDITOR";
    title: string;
    detail: string;
    timestamp: string;
    apiEndpoint: string;
  }[];
  mode: Mode;
  credentialFingerprint?: string;
  approveUrl?: string;
  invoiceSent?: boolean;
  refundStatus?: string;
}
export interface ProcurementStore {
  orders: ProcurementOrder[];
  telemetryLogs: TelemetryLog[];
  requests: Map<string, string>;
  touchedAt: number;
}
export function seedOrders(): ProcurementOrder[] {
  return ["chair", "dock", "desk", "scanner"].map((category, i) => {
    const quotes = demoQuotes(category),
      selectedQuote = quotes[0],
      quantity = [35, 24, 18, 40][i],
      gross = Math.round(selectedQuote.unitPriceUsd * quantity * 100) / 100,
      refund = i === 3 ? Math.round(gross * 15) / 100 : 0;
    const id = `PO-2026-${4091 + i}`;
    return {
      id,
      createdAt: new Date(Date.UTC(2026, 10, 10 - i, 8, 30)).toISOString(),
      requesterDept: (
        [
          "Workspace Ops",
          "IT Infrastructure",
          "Workspace Ops",
          "Supply Chain",
        ] as Department[]
      )[i],
      prompt: `Procure ${quantity} ${selectedQuote.title}`,
      quantity,
      budgetGuardrailUsd: i === 0 ? 10000 : 25000,
      selectedQuote,
      competingQuotes: quotes,
      unitPriceUsd: selectedQuote.unitPriceUsd,
      totalGrossUsd: gross,
      guardrailStatus: i === 0 ? "AWAITING_CFO_APPROVAL" : "AUTO_CLEARED",
      stage: (
        [
          "1_INVOICED",
          "2_ESCROW_CAPTURED",
          "3_IN_TRANSIT",
          "4_SLA_SETTLED",
        ] as ProcurementOrder["stage"][]
      )[i],
      paypalCatalogId: `PROD-DEMO${4091 + i}`,
      paypalInvoiceId: `INV2-DEMO-${4091 + i}`,
      paypalInvoiceNumber: `INV-${4091 + i}-PP-00000${i}`,
      paypalInvoiceUrl: `https://www.sandbox.paypal.com/invoice/p/#INV2-DEMO-${4091 + i}`,
      paypalOrderId: i > 0 ? `ORDER-DEMO${4091 + i}` : undefined,
      paypalCaptureId: i > 0 ? `CAP-DEMO${4091 + i}` : undefined,
      carrier: i > 1 ? "FEDEX" : undefined,
      trackingNumber: i > 1 ? `78123456${4091 + i}` : undefined,
      shipmentStatus:
        i === 3
          ? "EXCEPTION_DAMAGED_DELAYED"
          : i === 2
            ? "IN_TRANSIT_ON_TIME"
            : "AWAITING_DISPATCH",
      slaRiskScore: [12, 8, 24, 92][i],
      slaExceptionReport:
        i === 3
          ? "Demo carrier event: carton damage and 48-hour delay beyond the five-day SLA."
          : undefined,
      slaRefundAmountUsd: refund || undefined,
      netSettledUsd: i === 3 ? gross - refund : 0,
      paypalRefundId: i === 3 ? "REFUND-DEMO4094" : undefined,
      refundStatus: i === 3 ? "COMPLETED" : undefined,
      disputeDossier:
        i === 3
          ? {
              dossierId: "DOSSIER-DEMO4094",
              createdAt: "2026-11-10T08:30:00Z",
              contractClause:
                "Illustrative clause 4.2: damage or delay beyond five days triggers a 15% rebate.",
              carrierProof:
                "SIMULATED FedEx damage scan; 48-hour delivery delay.",
              grossOrderUsd: gross,
              refundedUsd: refund,
              netFinalUsd: gross - refund,
            }
          : undefined,
      agentTimeline: [
        {
          id: randomUUID(),
          agent: i === 3 ? "AUDITOR" : "SOURCING",
          title:
            i === 3
              ? "SLA rebate recovered"
              : "Three supplier quotes benchmarked",
          detail:
            i === 3
              ? "15% partial refund completed in the demo scenario."
              : selectedQuote.selectionRationale,
          timestamp: "2026-11-10T08:30:00Z",
          apiEndpoint:
            i === 3
              ? "/v2/payments/captures/{id}/refund"
              : "https://mcp.trychannel3.com/",
        },
      ],
      mode: "SANDBOX_SIMULATION",
      invoiceSent: true,
    };
  });
}
const globalStore = globalThis as unknown as {
  pactpayStores?: Map<string, ProcurementStore>;
  pactpayLocks?: Map<string, Promise<unknown>>;
};
const stores = (globalStore.pactpayStores ||= new Map());
const locks = (globalStore.pactpayLocks ||= new Map());
export function getStore(session: string): ProcurementStore {
  let store = stores.get(session);
  if (!store) {
    for (const [key, value] of stores)
      if (Date.now() - value.touchedAt > 86400000) stores.delete(key);
    if (stores.size >= 200)
      throw new Error("Demo session capacity reached. Try again later.");
    const orders = seedOrders();
    store = {
      orders,
      telemetryLogs: orders.map((o) =>
        log(
          "Seeded scenario",
          "POST",
          "https://api-m.sandbox.paypal.com/v2/invoicing/invoices",
          201,
          0,
          "SANDBOX_SIMULATION",
          {
            detail: {
              invoice_number: o.paypalInvoiceNumber,
              currency_code: "USD",
            },
          },
          {
            id: o.paypalInvoiceId,
            source: "Pre-seeded demonstration; no network request",
          },
        ),
      ),
      requests: new Map(),
      touchedAt: Date.now(),
    };
    stores.set(session, store);
  }
  store.touchedAt = Date.now();
  return store;
}
export function appendLogs(store: ProcurementStore, logs: TelemetryLog[]) {
  store.telemetryLogs.unshift(...logs.slice().reverse());
  store.telemetryLogs = store.telemetryLogs.slice(0, 500);
}
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prior = locks.get(key) || Promise.resolve();
  const next = prior.catch(() => {}).then(fn);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}
export function publicOrder(o: ProcurementOrder) {
  const { credentialFingerprint: _private, ...safe } = o;
  void _private;
  return safe;
}
