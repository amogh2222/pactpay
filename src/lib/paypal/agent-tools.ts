import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { tool, jsonSchema } from "ai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { searchChannel3Suppliers } from "../channel3/client";
import * as p from "./client";
/** Toolkit 1.x uses AI SDK 4; adapt its schemas to the application's AI SDK 7. */
export function createAgentTools(credentials?: p.Credentials) {
  const c = p.resolveCredentials(credentials);
  const toolkit = c.clientId
    ? new PayPalAgentToolkit({
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        configuration: {
          context: { sandbox: true },
          actions: { invoices: { list: true }, disputes: { list: true } },
        },
      })
    : undefined;
  const sponsorTools = Object.fromEntries(
    Object.entries(toolkit?.getTools() || {}).map(([name, t]) => [
      `paypal_${name}`,
      tool({
        description: t.description,
        inputSchema: jsonSchema<Record<string, unknown>>(
          zodToJsonSchema(t.parameters as z.ZodTypeAny) as Parameters<
            typeof jsonSchema
          >[0],
        ),
        execute: async (args) => {
          if (!t.execute) throw new Error("Tool cannot execute");
          return t.execute(args, {
            toolCallId: crypto.randomUUID(),
            messages: [],
          });
        },
      }),
    ]),
  );
  const key = z.string().min(1),
    price = z.number().positive(),
    reference = z.string().regex(/PP-\d{6}/);
  return {
    ...sponsorTools,
    search_suppliers: tool({
      description:
        "Compare three Channel3 suppliers; disclose assumed SLA terms.",
      inputSchema: z.object({ query: key, maxUnitPrice: price.optional() }),
      execute: ({ query, maxUnitPrice }) =>
        searchChannel3Suppliers(query, maxUnitPrice),
    }),
    create_catalog: tool({
      description: "Register a physical SKU in PayPal Sandbox.",
      inputSchema: z.object({ title: key, sku: key, operationKey: key }),
      execute: (i) => p.createCatalogProduct(i, credentials),
    }),
    create_invoice: tool({
      description: "Create and issue a Sandbox milestone invoice.",
      inputSchema: z.object({
        title: key,
        sku: key,
        quantity: z.number().int().positive(),
        unitPriceUsd: price,
        productId: key,
        invoiceNumber: reference,
        operationKey: key,
      }),
      execute: (i) => p.createAndSendInvoice(i, credentials),
    }),
    capture_order: tool({
      description:
        "Create a Sandbox order or capture an existing buyer-approved order. Caller must enforce CFO approval.",
      inputSchema: z.object({
        totalUsd: price,
        invoiceNumber: reference,
        customId: reference,
        operationKey: key,
        orderId: key.optional(),
      }),
      execute: (i) => p.createAndCaptureOrder(i, credentials),
    }),
    attach_tracking: tool({
      description: "Attach a carrier tracking number to a capture.",
      inputSchema: z.object({
        captureId: key,
        trackingNumber: key,
        carrier: z.enum(["FEDEX", "UPS", "DHL"]),
        operationKey: key,
      }),
      execute: (i) => p.attachShipmentTracking(i, credentials),
    }),
    refund_sla: tool({
      description:
        "Issue an approved contractual SLA partial refund in Sandbox.",
      inputSchema: z.object({
        captureId: key,
        grossUsd: price,
        penaltyPercent: z.number().min(1).max(100),
        reason: key,
        operationKey: key,
        invoiceNumber: reference,
      }),
      execute: (i) => p.issueSlaPartialRefund(i, credentials),
    }),
    build_evidence: tool({
      description:
        "Read disputes and prepare an evidence dossier locally; does not submit evidence.",
      inputSchema: z.object({
        orderId: key,
        invoiceId: key,
        refundId: key,
        carrierProof: key,
        contractClause: key,
        grossOrderUsd: price,
        refundedUsd: price,
        operationKey: key,
      }),
      execute: (i) => p.buildDisputeEvidencePacket(i, credentials),
    }),
  };
}
