import assert from "node:assert/strict";
import test from "node:test";

import { delegateTask } from "../server.mjs";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

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
