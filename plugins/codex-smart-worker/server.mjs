import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import { getCredential } from "./credentials.mjs";

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MIN_CONFIDENCE = 0.75;

class ProviderError extends Error {
  constructor(provider, status) {
    super(`${provider} request failed`);
    this.status = status;
  }
}

const tool = {
  name: "delegate_task",
  description:
    "Classify one bounded subtask with TypeSafe Jev and delegate it to DeepSeek Flash only when Jev marks it low-risk with sufficient confidence. Returns a proposal for Codex to review. If either provider fails, asks the user whether to continue with Codex or stop.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["task"],
    properties: {
      task: {
        type: "string",
        minLength: 1,
        maxLength: 8000,
        description: "One self-contained task with explicit acceptance criteria."
      },
      context: {
        type: "string",
        maxLength: 60000,
        description: "Only the sanitized facts or content needed for this task. Never include secrets or private data."
      },
      constraints: {
        type: "string",
        maxLength: 8000,
        description: "Relevant conventions, prohibited actions, and output requirements."
      }
    }
  }
};

function requiredText(value, name, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw new Error(`${name} exceeds ${maxLength} characters`);
  }
  return value.trim();
}

function optionalText(value, name, maxLength) {
  if (value == null || value === "") return "";
  return requiredText(value, name, maxLength);
}

async function postJson(url, apiKey, body, service, fetchFn) {
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    throw new ProviderError(service, response.status);
  }

  return response.json();
}

function safeFailure(provider, error) {
  const status = error instanceof ProviderError ? error.status : null;
  let issue = "service_unavailable";

  if (status === 401 || status === 403) issue = "authentication";
  else if (status === 402) issue = "billing_or_quota";
  else if (status === 429) issue = "rate_limit_or_quota";
  else if (error instanceof Error && error.message.includes("not configured")) issue = "configuration";
  else if (error instanceof Error && /missing|did not contain/i.test(error.message)) issue = "invalid_response";
  else if (error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`)) issue = "timeout";

  const descriptions = {
    authentication: "rejected the API key",
    billing_or_quota: "reported a billing or credit problem",
    rate_limit_or_quota: "reported a rate or quota limit",
    configuration: "API key is not configured",
    invalid_response: "returned an invalid response",
    timeout: "did not respond in time",
    service_unavailable: "could not complete the request"
  };

  return {
    provider,
    issue,
    message: `${provider} ${descriptions[issue]}.`
  };
}

async function resolveFailure(provider, error, onProviderFailure) {
  const failure = safeFailure(provider, error);
  if (typeof onProviderFailure === "function") return onProviderFailure(failure);
  return { status: "needs_user_choice", failure };
}

function choiceAnswer(payload, name) {
  const answer = payload?.answers?.[name] ?? payload?.choices?.[name];
  if (!answer || typeof answer.choice !== "string") {
    throw new Error(`TypeSafe response is missing the ${name} choice`);
  }
  return answer;
}

export async function delegateTask(
  input,
  env = process.env,
  fetchFn = globalThis.fetch,
  onProviderFailure
) {
  const task = requiredText(input?.task, "task", 8000);
  const context = optionalText(input?.context, "context", 60000);
  const constraints = optionalText(input?.constraints, "constraints", 8000);
  let classification;
  let route;
  let risk;

  try {
    const typesafeKey = requiredText(await getCredential("TYPESAFE_API_KEY", env), "TYPESAFE_API_KEY", 10000);
    classification = await postJson(
      TYPESAFE_URL,
      typesafeKey,
      {
        state: { task, context, constraints },
        model: "jev-latest",
        questions: {
          route: {
            type: "choice",
            instructions: "Who should produce a proposal for this isolated task?",
            criteria: {
              deepseek: "Bounded, low-risk, well-specified drafting, summarizing, transformation, organization, analysis, research synthesis, or coding that can be proposed from the supplied context.",
              codex: "Planning, broad context, tools, private data, security-sensitive work, destructive or external actions, high-stakes decisions, or work requiring final judgment.",
              ask_user: "A consequential requirement or permission is missing."
            }
          },
          risk: {
            type: "choice",
            instructions: "What is the execution risk of delegating this task to a model with no tools?",
            criteria: {
              low: "The proposal is easily reviewed and cannot directly change systems or data.",
              medium: "The proposal could cause meaningful defects or disclose sensitive context.",
              high: "The task involves security, secrets, destructive actions, permissions, money, or high-stakes decisions."
            }
          }
        }
      },
      "TypeSafe",
      fetchFn
    );
    route = choiceAnswer(classification, "route");
    risk = choiceAnswer(classification, "risk");
  } catch (error) {
    return resolveFailure("TypeSafe", error, onProviderFailure);
  }

  const confidence = Number.isFinite(route.confidence) ? route.confidence : 0;
  const decision = {
    route: route.choice,
    risk: risk.choice,
    confidence,
    probabilities: route.probabilities ?? null,
    model: classification.model ?? "jev-latest"
  };

  if (route.choice !== "deepseek" || risk.choice !== "low" || confidence < MIN_CONFIDENCE) {
    return {
      status: "not_delegated",
      decision,
      reason: "Jev kept this task with Codex or requested user input."
    };
  }

  let completion;
  let proposal;
  try {
    const deepseekKey = requiredText(await getCredential("DEEPSEEK_API_KEY", env), "DEEPSEEK_API_KEY", 10000);
    completion = await postJson(
      DEEPSEEK_URL,
      deepseekKey,
      {
        model: "deepseek-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a bounded general-purpose worker. Produce a proposal only; you cannot use tools, edit files, or take external actions. Follow the supplied constraints. Match the requested output format. For code changes, return a concise unified diff when the context is sufficient. State missing information instead of inventing it."
          },
          {
            role: "user",
            content: JSON.stringify({ task, context, constraints })
          }
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 4000
      },
      "DeepSeek",
      fetchFn
    );

    proposal = completion?.choices?.[0]?.message?.content;
    if (typeof proposal !== "string" || !proposal.trim()) {
      throw new Error("DeepSeek response did not contain a proposal");
    }
  } catch (error) {
    return resolveFailure("DeepSeek", error, onProviderFailure);
  }

  return {
    status: "delegated",
    decision,
    worker: "deepseek-flash",
    proposal: proposal.trim(),
    usage: completion.usage ?? null
  };
}

export function createServer({
  send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`),
  env = process.env,
  fetchFn = globalThis.fetch
} = {}) {
  let supportsElicitation = false;
  let nextRequestId = 0;
  const pendingRequests = new Map();

  function requestClient(method, params) {
    const id = `codex-smart-worker-${++nextRequestId}`;
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      send({ jsonrpc: "2.0", id, method, params });
    });
  }

  async function askAfterFailure(failure) {
    const prompt = {
      question: `${failure.message} Continue this task using full Codex, or stop?`,
      options: ["Continue with Codex", "Stop"]
    };

    if (!supportsElicitation) {
      return { status: "needs_user_choice", failure, prompt };
    }

    let response;
    try {
      response = await requestClient("elicitation/create", {
        mode: "form",
        message: prompt.question,
        requestedSchema: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              title: "What should Codex do?",
              enum: prompt.options
            }
          },
          required: ["decision"],
          additionalProperties: false
        }
      });
    } catch {
      return { status: "needs_user_choice", failure, prompt };
    }

    if (response?.action === "accept" && response.content?.decision === "Continue with Codex") {
      return {
        status: "continue_with_codex",
        failure,
        instruction: "Continue the current task entirely with Codex. Do not delegate this task again."
      };
    }

    return { status: "stopped", failure };
  }

  async function handleRequest(message) {
    try {
      if (message.method === "initialize") {
        supportsElicitation = Boolean(message.params?.capabilities?.elicitation);
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "codex-smart-worker", version: "0.1.0" },
            instructions:
              "Consider bounded candidate subtasks from any domain, not only coding. Send only sanitized minimum context, review every proposal, and follow the returned user decision when a provider fails."
          }
        });
        return;
      }

      if (message.method === "ping") {
        send({ jsonrpc: "2.0", id: message.id, result: {} });
        return;
      }

      if (message.method === "tools/list") {
        send({ jsonrpc: "2.0", id: message.id, result: { tools: [tool] } });
        return;
      }

      if (message.method === "tools/call" && message.params?.name === tool.name) {
        try {
          const result = await delegateTask(
            message.params.arguments ?? {},
            env,
            fetchFn,
            askAfterFailure
          );
          send({
            jsonrpc: "2.0",
            id: message.id,
            result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
          });
        } catch (error) {
          send({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              isError: true,
              content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }]
            }
          });
        }
        return;
      }

      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: `Method not found: ${message.method}` }
      });
    } catch (error) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32603, message: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  async function receive(message) {
    if (!message || message.jsonrpc !== "2.0" || message.id == null) return;

    if (!message.method) {
      const pending = pendingRequests.get(message.id);
      if (!pending) return;
      pendingRequests.delete(message.id);
      if (message.error) pending.reject(new Error("The client could not show the user prompt."));
      else pending.resolve(message.result);
      return;
    }

    await handleRequest(message);
  }

  return { receive };
}

export async function startServer() {
  const server = createServer();
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      void server.receive(message).catch((error) => {
        process.stderr.write(`codex-smart-worker: ${error instanceof Error ? error.message : String(error)}\n`);
      });
    } catch (error) {
      process.stderr.write(`codex-smart-worker: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
