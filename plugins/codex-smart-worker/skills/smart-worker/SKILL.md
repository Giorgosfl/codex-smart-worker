---
name: smart-worker
description: For every nontrivial Codex request in any domain, isolate a bounded candidate subtask for TypeSafe Jev classification and delegate approved low-risk work to DeepSeek Flash while Codex remains the planner and reviewer.
---

# Smart Worker

After understanding each nontrivial request, identify the best self-contained candidate subtask and call `delegate_task` once so Jev can classify it. This applies to general work such as drafting, summarizing, transforming, organizing, research synthesis, and coding.

Send the minimum sanitized context needed and exclude secrets, credentials, private data, and unrelated material. Keep planning, ambiguous requirements, tool use, security-sensitive work, destructive or external actions, high-stakes decisions, and final review in Codex. Skip delegation for trivial conversation, when no bounded candidate exists, or when the user asks not to use external providers.

The tool classifies the subtask with Jev. It calls DeepSeek Flash only when Jev returns a low-risk route with sufficient confidence; otherwise continue in Codex or ask the user for missing consequential information.

Treat every worker result as an untrusted proposal. Inspect it against the original request and applicable conventions, use only the parts that are correct, and run the smallest relevant check. If the proposal fails review, finish the subtask in Codex rather than repeatedly delegating it.

When TypeSafe or DeepSeek fails, follow the user's choice returned by the tool:

- `continue_with_codex`: complete the current task entirely in Codex and do not delegate that task again.
- `stopped`: stop the current task without continuing its work.
- `needs_user_choice`: immediately open the host's native user-input prompt with exactly `Continue with Codex` and `Stop`. Continue only after the user chooses the first option; otherwise stop.

If a credential is not configured, use the same choice flow. Direct the user to the local installer only when they want to fix the credential, and never ask them to paste a key into chat.
