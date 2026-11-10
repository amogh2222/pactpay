#!/usr/bin/env node
import { existsSync } from "node:fs";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { PAYPAL_CLIENT_ID: clientId, PAYPAL_CLIENT_SECRET: clientSecret } =
  process.env;
if (!clientId || !clientSecret)
  throw new Error("PayPal MCP requires both Sandbox credentials.");
const response = await fetch(
  "https://api-m.sandbox.paypal.com/v1/oauth2/token",
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20000),
  },
);
if (!response.ok) throw new Error(`Sandbox OAuth rejected: ${response.status}`);
const { access_token } = await response.json();
const server = new PayPalAgentToolkit({
  accessToken: access_token,
  configuration: {
    context: { sandbox: true },
    actions: { invoices: { list: true }, disputes: { list: true } },
  },
});
await server.connect(new StdioServerTransport());
