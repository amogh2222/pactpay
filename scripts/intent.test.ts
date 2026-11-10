import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretProcurement } from "../src/lib/agents/workflow";

async function withOpenAIFixture(
  response: () => Response,
  run: (
    requests: { url: string; body: Record<string, unknown> }[],
  ) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const previous = {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  process.env.OPENAI_API_KEY = "fixture-secret";
  process.env.OPENAI_MODEL = "gpt-6-luna";
  process.env.ANTHROPIC_API_KEY = "unused-anthropic-fixture";
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return response();
  };
  try {
    await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      OPENAI_API_KEY: previous.key,
      OPENAI_MODEL: previous.model,
      ANTHROPIC_API_KEY: previous.anthropic,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
test("OpenAI parses structured procurement with no stored response and takes provider precedence", async () => {
  await withOpenAIFixture(
    () =>
      Response.json({
        id: "resp_fixture",
        created_at: 1,
        model: "gpt-6-luna",
        status: "completed",
        output: [
          {
            type: "message",
            id: "msg_fixture",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  quantity: 24,
                  category: "enterprise docks",
                  maxUnitPrice: null,
                  department: "IT Infrastructure",
                }),
                annotations: [],
              },
            ],
          },
        ],
        usage: { input_tokens: 20, output_tokens: 20, total_tokens: 40 },
      }),
    async (requests) => {
      const result = await interpretProcurement(
        "Procure twenty-four enterprise docks for IT",
      );
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
      assert.equal(requests[0].body.store, false);
      assert.equal(result.quantity, 24);
      assert.equal(result.maxUnitPrice, undefined);
      assert.equal(result.interpretationSource, "OPENAI");
      assert.equal(result.usedFallback, false);
    },
  );
});
test("OpenAI rejection falls back without exposing provider errors or secrets", async () => {
  await withOpenAIFixture(
    () =>
      Response.json(
        {
          error: {
            message: "Invalid credential fixture-secret",
            code: "invalid_api_key",
            type: "invalid_request_error",
          },
        },
        { status: 401 },
      ),
    async (requests) => {
      const result = await interpretProcurement(
        "Procure 35 mesh chairs under $410/unit",
      );
      assert.equal(requests.length, 1);
      assert.equal(result.quantity, 35);
      assert.equal(result.maxUnitPrice, 410);
      assert.equal(result.interpretationSource, "DETERMINISTIC");
      assert.equal(result.usedFallback, true);
      assert.ok(!JSON.stringify(result).includes("fixture-secret"));
    },
  );
});
