import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getCredential } from "../credentials.mjs";
import { createServer, delegateTask } from "../server.mjs";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function toolResult(messages, id) {
  const message = messages.find((item) => item.id === id && item.result?.content);
  return JSON.parse(message.result.content[0].text);
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test("delegates a low-risk, high-confidence task to DeepSeek Flash", async () => {
  const requests = [];
  const fetchFn = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    if (url.includes("typesafe")) {
      return response({
        model: "jev-latest",
        usage: { input_tokens: 1000, output_tokens: 20 },
        answers: {
          route: { choice: "deepseek", confidence: 0.94, probabilities: { deepseek: 0.94 } },
          risk: { choice: "low", confidence: 0.97 }
        }
      });
    }
    return response({
      model: "deepseek-flash",
      choices: [{ message: { content: "Proposed patch" } }],
      usage: {
        prompt_tokens: 3000,
        completion_tokens: 3000,
        total_tokens: 6000,
        prompt_cache_hit_tokens: 1000,
        prompt_cache_miss_tokens: 2000,
        completion_tokens_details: { reasoning_tokens: 2500 }
      }
    });
  };

  const result = await delegateTask(
    { task: "Summarize these meeting notes into three action items." },
    {
      TYPESAFE_API_KEY: "test-typesafe",
      DEEPSEEK_API_KEY: "test-deepseek",
      DEEPSEEK_REASONING_EFFORT: "high"
    },
    fetchFn
  );

  assert.equal(result.status, "delegated");
  assert.equal(result.worker, "deepseek-flash");
  assert.equal(result.proposal, "Proposed patch");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.questions.route.instructions.includes("software"), false);
  assert.equal(requests[1].body.model, "deepseek-flash");
  assert.deepEqual(requests[1].body.thinking, { type: "enabled" });
  assert.equal(requests[1].body.reasoning_effort, "high");
  assert.equal(requests[1].body.max_tokens, 16000);
  assert.equal(result.thinking_effort, "high");
  assert.equal(result.stats.typesafe.requests, 1);
  assert.equal(result.stats.typesafe.estimated_cost_usd, 0.000042);
  assert.equal(result.stats.deepseek.requests, 1);
  assert.equal(result.stats.deepseek.reasoning_tokens, 2500);
  assert.deepEqual(result.stats.deepseek.estimated_cost_usd, {
    minimum: 0.002103,
    maximum: 0.004206
  });
  assert.deepEqual(result.stats.estimated_total_cost_usd, {
    minimum: 0.002145,
    maximum: 0.004248
  });
});

test("changes DeepSeek thinking effort through the MCP tool", async () => {
  const codexHome = await mkdtemp(join(tmpdir(), "codex-smart-worker-"));
  const messages = [];
  const requests = [];
  const server = createServer({
    send: (message) => messages.push(message),
    env: {
      CODEX_HOME: codexHome,
      TYPESAFE_API_KEY: "test-typesafe",
      DEEPSEEK_API_KEY: "test-deepseek"
    },
    fetchFn: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url.includes("typesafe")) {
        return response({
          answers: {
            route: { choice: "deepseek", confidence: 0.99 },
            risk: { choice: "low", confidence: 0.99 }
          }
        });
      }
      return response({ choices: [{ message: { content: "Configured proposal" } }] });
    }
  });

  try {
    await server.receive({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    });
    await server.receive({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "set_thinking_effort", arguments: { effort: "low" } }
    });

    assert.equal(messages[0].result.tools.some((tool) => tool.name === "set_thinking_effort"), true);
    assert.equal(toolResult(messages, 2).thinking_effort, "low");
    const settings = JSON.parse(await readFile(join(codexHome, "codex-smart-worker", "settings.json"), "utf8"));
    assert.equal(settings.thinkingEffort, "low");

    await server.receive({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "delegate_task", arguments: { task: "Draft three headings." } }
    });
    assert.equal(requests[1].body.reasoning_effort, "low");
    assert.deepEqual(requests[1].body.thinking, { type: "enabled" });
    assert.equal(requests[1].body.max_tokens, 8000);
    assert.equal(toolResult(messages, 3).thinking_effort, "low");
  } finally {
    await rm(codexHome, { recursive: true, force: true });
  }
});

test("keeps risky work in Codex without calling DeepSeek", async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return response({
      usage: { input_tokens: 200, output_tokens: 10 },
      answers: {
        route: { choice: "codex", confidence: 0.99 },
        risk: { choice: "high", confidence: 0.99 }
      }
    });
  };

  const result = await delegateTask(
    { task: "Rotate production credentials." },
    { TYPESAFE_API_KEY: "test-typesafe" },
    fetchFn
  );

  assert.equal(result.status, "not_delegated");
  assert.equal(result.decision.route, "codex");
  assert.equal(result.stats.typesafe.requests, 1);
  assert.equal(result.stats.deepseek.requests, 0);
  assert.equal(calls, 1);
});

test("asks for a decision when TypeSafe is unavailable without calling DeepSeek", async () => {
  let failure;
  let calls = 0;
  const result = await delegateTask(
    { task: "Rename one local variable." },
    { TYPESAFE_API_KEY: "test-typesafe", DEEPSEEK_API_KEY: "test-deepseek" },
    async () => {
      calls += 1;
      return response({ message: "private provider detail" }, 402);
    },
    async (value) => {
      failure = value;
      return { status: "continue_with_codex", failure: value };
    }
  );

  assert.equal(result.status, "continue_with_codex");
  assert.equal(failure.provider, "TypeSafe");
  assert.equal(failure.issue, "billing_or_quota");
  assert.equal(failure.message.includes("private provider detail"), false);
  assert.equal(calls, 1);
});

test("asks for a decision when DeepSeek is unavailable", async () => {
  let failure;
  let calls = 0;
  const fetchFn = async (url) => {
    calls += 1;
    if (url.includes("typesafe")) {
      return response({
        answers: {
          route: { choice: "deepseek", confidence: 0.99 },
          risk: { choice: "low", confidence: 0.99 }
        }
      });
    }
    return response({ message: "insufficient balance" }, 429);
  };

  const result = await delegateTask(
    { task: "Rename one local variable." },
    { TYPESAFE_API_KEY: "test-typesafe", DEEPSEEK_API_KEY: "test-deepseek" },
    fetchFn,
    async (value) => {
      failure = value;
      return { status: "stopped", failure: value };
    }
  );

  assert.equal(result.status, "stopped");
  assert.equal(failure.provider, "DeepSeek");
  assert.equal(failure.issue, "rate_limit_or_quota");
  assert.equal(calls, 2);
});

test("opens native elicitation and continues with Codex after a provider failure", async () => {
  const messages = [];
  const server = createServer({
    send: (message) => messages.push(message),
    env: { TYPESAFE_API_KEY: "test-typesafe" },
    fetchFn: async () => response({}, 402)
  });

  await server.receive({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: { elicitation: {} } }
  });

  const call = server.receive({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "delegate_task", arguments: { task: "Rename one variable." } }
  });
  await nextTurn();

  const prompt = messages.find((message) => message.method === "elicitation/create");
  assert.deepEqual(prompt.params.requestedSchema.properties.decision.enum, ["Continue with Codex", "Stop"]);

  await server.receive({
    jsonrpc: "2.0",
    id: prompt.id,
    result: { action: "accept", content: { decision: "Continue with Codex" } }
  });
  await call;

  const result = toolResult(messages, 2);
  assert.equal(result.status, "continue_with_codex");
  assert.equal(result.failure.provider, "TypeSafe");
});

test("stops after the user chooses Stop in native elicitation", async () => {
  const messages = [];
  const server = createServer({
    send: (message) => messages.push(message),
    env: { TYPESAFE_API_KEY: "test-typesafe" },
    fetchFn: async () => response({}, 503)
  });

  await server.receive({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: { elicitation: {} } }
  });
  const call = server.receive({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "delegate_task", arguments: { task: "Rename one variable." } }
  });
  await nextTurn();

  const prompt = messages.find((message) => message.method === "elicitation/create");
  await server.receive({
    jsonrpc: "2.0",
    id: prompt.id,
    result: { action: "accept", content: { decision: "Stop" } }
  });
  await call;

  assert.equal(toolResult(messages, 2).status, "stopped");
});

test("returns a prompt instruction when the client lacks elicitation support", async () => {
  const messages = [];
  const server = createServer({
    send: (message) => messages.push(message),
    env: { TYPESAFE_API_KEY: "test-typesafe" },
    fetchFn: async () => response({}, 429)
  });

  await server.receive({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {} }
  });
  await server.receive({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "delegate_task", arguments: { task: "Rename one variable." } }
  });

  assert.equal(messages.some((message) => message.method === "elicitation/create"), false);
  assert.equal(toolResult(messages, 2).status, "needs_user_choice");
});

test("loads a missing environment credential from the local credential file", async () => {
  let requestedPath;
  const value = await getCredential("TYPESAFE_API_KEY", {}, {
    directory: "/private/credentials",
    fileReader: async (path, encoding) => {
      requestedPath = path;
      assert.equal(encoding, "utf8");
      return "stored-secret";
    }
  });

  assert.equal(value, "stored-secret");
  assert.equal(requestedPath, "/private/credentials/TYPESAFE_API_KEY");
});

test("prefers an environment credential without reading a file", async () => {
  const value = await getCredential(
    "DEEPSEEK_API_KEY",
    { DEEPSEEK_API_KEY: " environment-secret " },
    { fileReader: async () => assert.fail("file should not be read") }
  );

  assert.equal(value, "environment-secret");
});
