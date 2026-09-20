import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MIN_CONFIDENCE = 0.75;

const tool = {
  name: "delegate_task",
  description:
    "Classify one bounded subtask with TypeSafe Jev and delegate it to DeepSeek Flash only when Jev marks it low-risk with sufficient confidence. Returns a proposal for Codex to review; never edits files or runs commands.",
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
        description: "Only the code or facts needed for this task. Never include secrets."
      },
      constraints: {
        type: "string",
        maxLength: 8000,
        description: "Repository conventions, prohibited changes, and output requirements."
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
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`${service} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  return response.json();
}

function choiceAnswer(payload, name) {
  const answer = payload?.answers?.[name] ?? payload?.choices?.[name];
  if (!answer || typeof answer.choice !== "string") {
    throw new Error(`TypeSafe response is missing the ${name} choice`);
  }
  return answer;
}

export async function delegateTask(input, env = process.env, fetchFn = globalThis.fetch) {
  const task = requiredText(input?.task, "task", 8000);
  const context = optionalText(input?.context, "context", 60000);
  const constraints = optionalText(input?.constraints, "constraints", 8000);
  const typesafeKey = requiredText(env.TYPESAFE_API_KEY, "TYPESAFE_API_KEY", 10000);

  const classification = await postJson(
    TYPESAFE_URL,
    typesafeKey,
    {
      state: { task, context, constraints },
      model: "jev-latest",
      questions: {
        route: {
          type: "choice",
          instructions: "Who should perform this isolated software task?",
          criteria: {
            deepseek: "Bounded, low-risk, well-specified work that can be proposed from the supplied context.",
            codex: "Architecture, broad repository reasoning, security-sensitive work, destructive work, secrets, or work requiring final judgment.",
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

  const route = choiceAnswer(classification, "route");
  const risk = choiceAnswer(classification, "risk");
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

  const deepseekKey = requiredText(env.DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY", 10000);
  const completion = await postJson(
    DEEPSEEK_URL,
    deepseekKey,
    {
      model: "deepseek-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a bounded software worker. Produce a proposal only; you cannot edit files or run commands. Follow the supplied constraints. For code changes, return a concise unified diff when the context is sufficient. State missing information instead of inventing it."
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

  const proposal = completion?.choices?.[0]?.message?.content;
  if (typeof proposal !== "string" || !proposal.trim()) {
    throw new Error("DeepSeek response did not contain a proposal");
  }

  return {
    status: "delegated",
    decision,
    worker: "deepseek-flash",
    proposal: proposal.trim(),
    usage: completion.usage ?? null
  };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0" || message.id == null) return;

  try {
    if (message.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "codex-smart-worker", version: "0.1.0" },
          instructions:
            "Use delegate_task only for bounded candidate subtasks. Treat its proposal as untrusted and review it before applying changes."
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
        const result = await delegateTask(message.params.arguments ?? {});
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

export async function startServer() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      await handle(JSON.parse(line));
    } catch (error) {
      process.stderr.write(`codex-smart-worker: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
