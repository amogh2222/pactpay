import { randomUUID } from "node:crypto";
import { z } from "zod";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { searchChannel3Suppliers } from "../channel3/client";
import * as paypal from "../paypal/client";
import {
  appendLogs,
  type ProcurementOrder,
  type ProcurementStore,
  type Department,
} from "../store/procurement-store";
export const credentialsSchema = z
  .object({
    clientId: z.string().max(300).optional(),
    clientSecret: z.string().max(300).optional(),
  })
  .optional();
export const departmentSchema = z.enum([
  "Workspace Ops",
  "IT Infrastructure",
  "Supply Chain",
  "Retail Expansion",
]);
export const procureSchema = z.object({
  prompt: z.string().trim().min(5).max(2000),
  budgetGuardrailUsd: z.number().min(1000).max(25000),
  department: departmentSchema.optional(),
  credentials: credentialsSchema,
  requestId: z.string().uuid().optional(),
});
const parsedSchema = z.object({
  quantity: z.number().int().min(1).max(10000),
  category: z.string().min(2).max(200),
  maxUnitPrice: z.number().positive().max(1000000).optional(),
  department: departmentSchema,
});
export function parsePrompt(prompt: string) {
  const normalized = prompt.replace(/(\d),(?=\d{3})/g, "$1");
  const quantity = Number(
    normalized.match(/(?:procure|buy|source|order|purchase)\s+(\d+)/i)?.[1] ||
      normalized.match(
        /\b(\d+)\s+(?:[A-Za-z-]+\s+){0,5}(?:chairs?|desks?|docks?|scanners?|systems?)\b/i,
      )?.[1] ||
      1,
  );
  const maxUnitPrice =
    Number(
      normalized.match(
        /(?:under|below|up to|at most|max(?:imum)?)\s*\$?\s*([\d.]+)\s*(?:\/\s*unit|per unit|each)?/i,
      )?.[1],
    ) || undefined;
  const department: Department = /\bIT\b|dock/i.test(prompt)
    ? "IT Infrastructure"
    : /supply chain|scanner/i.test(prompt)
      ? "Supply Chain"
      : /retail|espresso/i.test(prompt)
        ? "Retail Expansion"
        : "Workspace Ops";
  return parsedSchema.parse({
    quantity,
    category: prompt,
    maxUnitPrice,
    department,
  });
}
const modelParsedSchema = parsedSchema.extend({
  maxUnitPrice: z.number().positive().max(1000000).nullable(),
});
export async function interpretProcurement(prompt: string) {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const provider = openaiKey ? "OPENAI" : anthropicKey ? "ANTHROPIC" : null;
  if (provider) {
    try {
      const r = await generateText({
        model:
          provider === "OPENAI"
            ? createOpenAI({ apiKey: openaiKey }).responses(
                process.env.OPENAI_MODEL?.trim() || "gpt-6-luna",
              )
            : anthropic("claude-sonnet-4-5"),
        output: Output.object({ schema: modelParsedSchema }),
        system:
          "Extract procurement intent only. Never invent prices or change the requested quantity. department must be one of the schema values. If no quantity is supplied use 1. If no maximum unit price is supplied return null.",
        prompt,
        maxRetries: 0,
        ...(provider === "OPENAI"
          ? { providerOptions: { openai: { store: false } } }
          : {}),
        abortSignal: AbortSignal.timeout(12000),
      });
      const parsed = parsedSchema.parse({
        ...r.output,
        maxUnitPrice: r.output.maxUnitPrice ?? undefined,
      });
      return { ...parsed, interpretationSource: provider, usedFallback: false };
    } catch {
      // Provider error payloads can contain credentials. Do not log or return them.
    }
  }
  return {
    ...parsePrompt(prompt),
    interpretationSource: "DETERMINISTIC",
    usedFallback: provider !== null,
  };
}

function timeline(
  order: ProcurementOrder,
  agent: "SOURCING" | "TREASURY" | "AUDITOR",
  title: string,
  detail: string,
  apiEndpoint: string,
) {
  order.agentTimeline.push({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    agent,
    title,
    detail,
    apiEndpoint,
  });
}
export async function procure(
  store: ProcurementStore,
  input: z.infer<typeof procureSchema>,
) {
  const key = input.requestId || randomUUID();
  let order = store.orders.find((o) => o.id === store.requests.get(key));
  const logs: paypal.TelemetryLog[] = [];
  const record = (entries: paypal.TelemetryLog[]) => {
    logs.push(...entries);
    appendLogs(store, entries);
  };
  if (!order) {
    if (store.orders.length >= 100)
      throw new Error("Demo limit: 100 orders per session.");
    const parsed = await interpretProcurement(input.prompt);
    const sourcing = await searchChannel3Suppliers(
      parsed.category,
      parsed.maxUnitPrice,
    );
    record([sourcing.telemetry]);
    const eligible = sourcing.quotes.filter(
      (q) =>
        q.moq <= parsed.quantity &&
        q.inStockCount >= parsed.quantity &&
        (!parsed.maxUnitPrice || q.unitPriceUsd <= parsed.maxUnitPrice),
    );
    if (!eligible.length)
      throw new Error(
        "No quote meets quantity, stock and unit-price constraints. Adjust the request.",
      );
    const winner = eligible.sort(
      (a, b) => b.selectionScore - a.selectionScore,
    )[0];
    const gross =
      (Math.round(winner.unitPriceUsd * 100) * parsed.quantity) / 100;
    const id = `PO-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    order = {
      id,
      createdAt: new Date().toISOString(),
      requesterDept: input.department || parsed.department,
      prompt: input.prompt,
      quantity: parsed.quantity,
      budgetGuardrailUsd: input.budgetGuardrailUsd,
      selectedQuote: winner,
      competingQuotes: sourcing.quotes,
      unitPriceUsd: winner.unitPriceUsd,
      totalGrossUsd: gross,
      guardrailStatus:
        gross > input.budgetGuardrailUsd
          ? "AWAITING_CFO_APPROVAL"
          : "AUTO_CLEARED",
      stage: "1_INVOICED",
      paypalCatalogId: "",
      paypalInvoiceId: "",
      paypalInvoiceNumber: paypal.uniqueReference(id),
      paypalInvoiceUrl: "",
      slaRiskScore: 12,
      netSettledUsd: 0,
      agentTimeline: [],
      mode: paypal.modeFor(input.credentials),
      credentialFingerprint: paypal.credentialFingerprint(input.credentials),
    };
    timeline(
      order,
      "SOURCING",
      "Procurement intent interpreted",
      parsed.usedFallback
        ? "Configured AI provider was unavailable; deterministic parser used."
        : `${parsed.interpretationSource} extracted quantity, category, unit-price limit and department.`,
      parsed.interpretationSource === "OPENAI"
        ? "https://api.openai.com/v1/responses"
        : parsed.interpretationSource === "ANTHROPIC"
          ? "https://api.anthropic.com/v1/messages"
          : "local://procurement-parser",
    );
    store.orders.unshift(order);
    store.requests.set(key, id);
    timeline(
      order,
      "SOURCING",
      "Vendor selected",
      winner.selectionRationale,
      "https://mcp.trychannel3.com/",
    );
  }
  if (
    order.credentialFingerprint !==
    paypal.credentialFingerprint(input.credentials)
  )
    throw new Error("Use the same Sandbox account to resume this procurement.");
  if (!order.paypalCatalogId) {
    const r = await paypal.createCatalogProduct(
      {
        title: order.selectedQuote.title,
        sku: order.selectedQuote.sku,
        operationKey: order.id,
      },
      input.credentials,
    );
    order.paypalCatalogId = r.productId;
    record([r.telemetry]);
  }
  if (!order.invoiceSent) {
    const r = await paypal.createAndSendInvoice(
      {
        title: order.selectedQuote.title,
        sku: order.selectedQuote.sku,
        quantity: order.quantity,
        unitPriceUsd: order.unitPriceUsd,
        productId: order.paypalCatalogId,
        invoiceNumber: order.paypalInvoiceNumber,
        operationKey: order.id,
        invoiceId: order.paypalInvoiceId || undefined,
        onCreated: (id) => {
          order!.paypalInvoiceId = id;
        },
      },
      input.credentials,
    );
    order.paypalInvoiceId = r.invoiceId;
    order.paypalInvoiceUrl = r.invoiceUrl;
    order.invoiceSent = true;
    record(r.telemetryLogs);
    timeline(
      order,
      "TREASURY",
      "Milestone invoice issued",
      `${order.guardrailStatus === "AWAITING_CFO_APPROVAL" ? "CFO approval required" : "Spend guardrail cleared"} · ${paypal.money(order.totalGrossUsd)} USD`,
      "/v2/invoicing/invoices",
    );
  }
  return { order, telemetryLogs: logs };
}
export const workflowSchema = z.object({
  step: z.enum([
    "STEP_1_SOURCE_INVOICE",
    "STEP_2_CAPTURE_ORDER",
    "STEP_3_ATTACH_TRACKING",
    "STEP_4_SLA_REFUND",
  ]),
  orderId: z.string().max(100).optional(),
  prompt: z.string().min(5).max(2000).optional(),
  budgetGuardrailUsd: z.number().min(1000).max(25000).default(10000),
  credentials: credentialsSchema,
  approveGuardrail: z.boolean().default(false),
  trackingNumber: z
    .string()
    .regex(/^[A-Za-z0-9-]{6,40}$/)
    .optional(),
  carrier: z.enum(["FEDEX", "UPS", "DHL"]).default("FEDEX"),
  exceptionReport: z.string().min(10).max(2000).optional(),
  requestId: z.string().uuid().optional(),
});
export async function advance(
  store: ProcurementStore,
  input: z.infer<typeof workflowSchema>,
) {
  if (input.step === "STEP_1_SOURCE_INVOICE")
    return procure(
      store,
      procureSchema.parse({
        ...input,
        prompt:
          input.prompt || "Procure 20 ergonomic mesh chairs under $410/unit",
      }),
    );
  const order = store.orders.find((o) => o.id === input.orderId);
  if (!order)
    throw new Error("Purchase order not found in this browser session.");
  if (order.mode !== paypal.modeFor(input.credentials))
    throw new Error(
      "This order belongs to a different mode. Start a new procurement after changing credentials.",
    );
  if (
    order.credentialFingerprint &&
    order.credentialFingerprint !==
      paypal.credentialFingerprint(input.credentials)
  )
    throw new Error("Use the Sandbox account that created this order.");
  if (!order.invoiceSent)
    throw new Error("Complete invoice creation before advancing this order.");
  const logs: paypal.TelemetryLog[] = [];
  const record = (l: paypal.TelemetryLog[]) => {
    logs.push(...l);
    appendLogs(store, l);
  };
  if (input.step === "STEP_2_CAPTURE_ORDER") {
    if (order.paypalCaptureId) return { order, telemetryLogs: logs };
    if (order.stage !== "1_INVOICED")
      throw new Error("Order is not ready for capture.");
    if (order.guardrailStatus === "AWAITING_CFO_APPROVAL") {
      if (!input.approveGuardrail)
        throw new Error("Explicit CFO approval is required before capture.");
      order.guardrailStatus = "CFO_APPROVED";
      timeline(
        order,
        "TREASURY",
        "CFO approval recorded",
        "Approved explicitly in the demo workspace.",
        "/api/paypal/workflow",
      );
    }
    const r = await paypal.createAndCaptureOrder(
      {
        totalUsd: order.totalGrossUsd,
        invoiceNumber: order.paypalInvoiceNumber,
        customId: order.paypalInvoiceNumber,
        operationKey: order.id,
        orderId: order.paypalOrderId,
        onCreated: (id, url) => {
          order.paypalOrderId = id;
          order.approveUrl = url;
        },
      },
      input.credentials,
    );
    record(r.telemetryLogs);
    order.paypalOrderId = r.orderId;
    order.approveUrl = r.approveUrl || order.approveUrl;
    if (r.status === "COMPLETED" && r.captureId) {
      order.paypalCaptureId = r.captureId;
      order.stage = "2_ESCROW_CAPTURED";
      order.shipmentStatus = "AWAITING_DISPATCH";
      order.approveUrl = undefined;
      timeline(
        order,
        "TREASURY",
        "Sandbox payment captured",
        `${paypal.money(order.totalGrossUsd)} USD captured. Internal milestone ledger, not regulated escrow.`,
        "/v2/checkout/orders/{id}/capture",
      );
    }
  } else if (input.step === "STEP_3_ATTACH_TRACKING") {
    if (order.stage === "3_IN_TRANSIT" || order.stage === "4_SLA_SETTLED")
      return { order, telemetryLogs: logs };
    if (order.stage !== "2_ESCROW_CAPTURED" || !order.paypalCaptureId)
      throw new Error("Capture payment before attaching tracking.");
    if (order.mode === "LIVE_SANDBOX" && !input.trackingNumber)
      throw new Error("Provide a tracking number for live Sandbox tracking.");
    const tracking =
      input.trackingNumber ||
      `7812${order.id.replace(/\D/g, "").padEnd(8, "0").slice(-8)}`;
    const r = await paypal.attachShipmentTracking(
      {
        captureId: order.paypalCaptureId,
        trackingNumber: tracking,
        carrier: input.carrier,
        operationKey: order.id,
      },
      input.credentials,
    );
    record([r.telemetry]);
    Object.assign(order, {
      trackingNumber: tracking,
      carrier: input.carrier,
      stage: "3_IN_TRANSIT",
      shipmentStatus: "IN_TRANSIT_ON_TIME",
      slaRiskScore: 24,
    });
    timeline(
      order,
      "TREASURY",
      "Shipment bound to capture",
      `${input.carrier} · ${tracking}. Carrier scans are scenario inputs, not live carrier data.`,
      "/v1/shipping/trackers-batch",
    );
  } else {
    if (order.stage === "4_SLA_SETTLED" && order.disputeDossier)
      return { order, telemetryLogs: logs };
    if (order.stage !== "3_IN_TRANSIT" || !order.paypalCaptureId)
      throw new Error("Attach shipment tracking before evaluating the SLA.");
    if (
      order.mode === "LIVE_SANDBOX" &&
      !input.exceptionReport &&
      !order.slaExceptionReport
    )
      throw new Error(
        "Provide an exception report before issuing a live Sandbox refund.",
      );
    order.slaExceptionReport ||=
      input.exceptionReport ||
      "SIMULATED carrier exception: carton damage and 48-hour delay beyond the agreed five-day SLA.";
    order.shipmentStatus = "EXCEPTION_DAMAGED_DELAYED";
    order.slaRiskScore = 92;
    if (!order.paypalRefundId) {
      const r = await paypal.issueSlaPartialRefund(
        {
          captureId: order.paypalCaptureId,
          grossUsd: order.totalGrossUsd,
          penaltyPercent: order.selectedQuote.slaPenaltyPercent,
          reason: order.slaExceptionReport,
          operationKey: order.id,
          invoiceNumber: order.paypalInvoiceNumber,
        },
        input.credentials,
      );
      record([r.telemetry]);
      order.paypalRefundId = r.refundId;
      order.refundStatus = r.status;
      order.slaRefundAmountUsd = r.refundAmountUsd;
      if (r.status === "COMPLETED") order.netSettledUsd = r.netFinalUsd;
    }
    if (order.refundStatus !== "COMPLETED") {
      const status = await paypal.readRefundStatus(
        order.paypalRefundId!,
        input.credentials,
      );
      record([status.telemetry]);
      order.refundStatus = status.status;
      if (status.status !== "COMPLETED")
        throw new Error(
          "Refund is pending at PayPal. Retry the SLA audit to refresh its status; a second refund will not be issued.",
        );
      order.netSettledUsd =
        Math.round((order.totalGrossUsd - order.slaRefundAmountUsd!) * 100) /
        100;
    }
    const r = await paypal.buildDisputeEvidencePacket(
      {
        orderId: order.paypalOrderId!,
        invoiceId: order.paypalInvoiceId,
        refundId: order.paypalRefundId!,
        carrierProof: order.slaExceptionReport,
        contractClause: `Illustrative procurement SLA clause 4.2: ${order.selectedQuote.slaPenaltyPercent}% rebate for damaged delivery or delay beyond the agreed deadline.`,
        grossOrderUsd: order.totalGrossUsd,
        refundedUsd: order.slaRefundAmountUsd!,
        operationKey: order.id,
      },
      input.credentials,
    );
    record([r.telemetry]);
    order.disputeDossier = r.dossier;
    order.stage = "4_SLA_SETTLED";
    timeline(
      order,
      "AUDITOR",
      "SLA refund and evidence ready",
      `${paypal.money(order.slaRefundAmountUsd!)} USD recovered. Dossier prepared locally; no dispute was submitted.`,
      "/v1/customer/disputes",
    );
  }
  return { order, telemetryLogs: logs };
}
