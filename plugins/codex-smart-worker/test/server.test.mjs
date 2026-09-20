import assert from "node:assert/strict";
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
        answers: {
          route: { choice: "deepseek", confidence: 0.94, probabilities: { deepseek: 0.94 } },
          risk: { choice: "low", confidence: 0.97 }
        }
      });
    }
    return response({
      choices: [{ message: { content: "Proposed patch" } }],
      usage: { total_tokens: 12 }
    });
  };

  const result = await delegateTask(
    { task: "Rename one local variable and preserve behavior." },
    { TYPESAFE_API_KEY: "test-typesafe", DEEPSEEK_API_KEY: "test-deepseek" },
    fetchFn
  );

  assert.equal(result.status, "delegated");
  assert.equal(result.worker, "deepseek-flash");
  assert.equal(result.proposal, "Proposed patch");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.model, "deepseek-flash");
});

test("keeps risky work in Codex without calling DeepSeek", async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return response({
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
