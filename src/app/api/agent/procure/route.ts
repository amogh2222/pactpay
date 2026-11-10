import { NextResponse } from "next/server";
import { body, errorResponse, session, headerCredentials } from "@/lib/api";
import { procure, procureSchema } from "@/lib/agents/workflow";
import { withLock, publicOrder } from "@/lib/store/procurement-store";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const { id, store } = await session();
  try {
    const raw = await body(request);
    const input = procureSchema.parse({
      ...raw,
      credentials: raw.credentials ?? headerCredentials(request),
    });
    const result = await withLock(id, () => procure(store, input));
    return NextResponse.json({ ...result, order: publicOrder(result.order) });
  } catch (e) {
    return errorResponse(e, store);
  }
}
