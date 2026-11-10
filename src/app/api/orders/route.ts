import { NextResponse } from "next/server";
import { session } from "@/lib/api";
import { publicOrder } from "@/lib/store/procurement-store";
export const dynamic = "force-dynamic";
export async function GET() {
  const { store } = await session();
  return NextResponse.json(
    {
      orders: store.orders.map(publicOrder),
      telemetryLogs: store.telemetryLogs,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
