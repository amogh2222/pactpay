import { NextResponse } from "next/server";
import { z } from "zod";
import { body, errorResponse, session, headerCredentials } from "@/lib/api";
import { verifyPayPalConnection } from "@/lib/paypal/client";
import { appendLogs } from "@/lib/store/procurement-store";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const raw = await body(request);
    const credentials = z
      .object({
        clientId: z.string().max(300).optional(),
        clientSecret: z.string().max(300).optional(),
      })
      .parse(raw);
    const result = await verifyPayPalConnection(
      Object.keys(credentials).length
        ? credentials
        : headerCredentials(request),
    );
    const { store } = await session();
    appendLogs(store, [result.telemetry]);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
