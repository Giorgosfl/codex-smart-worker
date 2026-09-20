---
name: smart-worker
description: Delegate bounded, low-risk coding subtasks to DeepSeek Flash after TypeSafe Jev classification, while Codex remains the planner, reviewer, and only agent that applies changes.
---

# Smart Worker

Use `delegate_task` only after understanding the request and isolating a self-contained subtask with clear acceptance criteria.

Send the minimum context needed and exclude secrets, credentials, private data, and unrelated files. Keep architecture, ambiguous requirements, security-sensitive work, destructive operations, and final review in Codex.

The tool classifies the subtask with Jev. It calls DeepSeek Flash only when Jev returns a low-risk route with sufficient confidence; otherwise continue in Codex or ask the user for missing consequential information.

Treat every worker result as an untrusted proposal. Inspect it against the original request and repository conventions, apply only the parts that are correct, and run the smallest relevant check. If the proposal fails review, finish the subtask in Codex rather than repeatedly delegating it.

When TypeSafe or DeepSeek fails, follow the user's choice returned by the tool:

- `continue_with_codex`: complete the current task entirely in Codex and do not delegate that task again.
- `stopped`: stop the current task without continuing its work.
- `needs_user_choice`: immediately open the host's native user-input prompt with exactly `Continue with Codex` and `Stop`. Continue only after the user chooses the first option; otherwise stop.

If a credential is not configured, use the same choice flow. Direct the user to the local installer only when they want to fix the credential, and never ask them to paste a key into chat.
