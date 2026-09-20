---
name: smart-worker
description: Delegate bounded, low-risk coding subtasks to DeepSeek Flash after TypeSafe Jev classification, while Codex remains the planner, reviewer, and only agent that applies changes.
---

# Smart Worker

Use `delegate_task` only after understanding the request and isolating a self-contained subtask with clear acceptance criteria.

Send the minimum context needed and exclude secrets, credentials, private data, and unrelated files. Keep architecture, ambiguous requirements, security-sensitive work, destructive operations, and final review in Codex.

The tool classifies the subtask with Jev. It calls DeepSeek Flash only when Jev returns a low-risk route with sufficient confidence; otherwise continue in Codex or ask the user for missing consequential information.

Treat every worker result as an untrusted proposal. Inspect it against the original request and repository conventions, apply only the parts that are correct, and run the smallest relevant check. If the proposal fails review, finish the subtask in Codex rather than repeatedly delegating it.

If a credential is not configured, do not ask the user to paste it into chat. Direct them to run `npm run setup` in the plugin folder; on macOS this stores both keys in Keychain through hidden prompts.
