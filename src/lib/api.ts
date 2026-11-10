import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PayPalError } from "./paypal/client";
import { appendLogs, getStore } from "./store/procurement-store";
export async function session() {
  const jar = await cookies();
  let id = jar.get("pactpay-session")?.value;
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = randomUUID();
    jar.set("pactpay-session", id, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 86400,
    });
  }
  return { id, store: getStore(id) };
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host)
    throw new Error("Cross-origin requests are not allowed.");
  const text = await request.text();
  if (text.length > 16000) throw new Error("Request is too large.");
  return JSON.parse(text || "{}");
}
export function errorResponse(e: unknown, store?: ReturnType<typeof getStore>) {
  if (e instanceof PayPalError) {
    if (store) appendLogs(store, e.telemetryLogs);
    return NextResponse.json(
      { error: e.message, telemetryLogs: e.telemetryLogs },
      { status: e.status },
    );
  }
  return NextResponse.json(
    {
      error:
        e instanceof ZodError
          ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
          : e instanceof Error
            ? e.message
            : "Request failed",
    },
    { status: 400 },
  );
}

export function headerCredentials(request: Request) {
  const clientId = request.headers.get("x-paypal-client-id");
  const clientSecret = request.headers.get("x-paypal-client-secret");
  return clientId !== null || clientSecret !== null
    ? { clientId: clientId || "", clientSecret: clientSecret || "" }
    : undefined;
}
