---
name: smart-worker
description: Automatically delegate worthwhile bounded subtasks throughout nontrivial Codex work, without a plugin mention. TypeSafe Jev routes low-risk proposals to DeepSeek Flash; Codex plans, uses tools and reviews.
---

# Smart Worker

Apply this skill automatically when it is enabled and available; do not wait for the user to mention the plugin or remind you. This applies to general work such as drafting, summarizing, transforming, organizing, research synthesis, and coding.

After understanding the request, identify each worthwhile, self-contained candidate subtask. Call `delegate_task` for each eligible candidate, then reassess the remaining work after reviewing a result, entering a new phase or receiving material user steering. There is no one-call-per-request limit. Prefer Smart Worker for routine proposals that can be reviewed locally; retain work requiring Codex's judgment or tools in Codex.

Use concrete deliverables and acceptance criteria. Batch tiny related changes into a meaningful candidate. Do not split trivial work to increase request counts, delegate the same work twice, or repeat a rejected classification without materially new information. Submit candidates sequentially so a provider-failure choice can stop further delegation before another call starts.

Send the minimum sanitized context needed and exclude secrets, credentials, private data, and unrelated material. Keep planning, ambiguous requirements, tool use, security-sensitive work, destructive or external actions, high-stakes decisions, and final review in Codex. Skip delegation for trivial conversation, when no bounded candidate exists, or when the user asks not to use external providers.

The tool classifies the subtask with Jev. It calls DeepSeek Flash only when Jev returns a low-risk route with sufficient confidence; otherwise continue in Codex or ask the user for missing consequential information.

A `not_delegated` routing result applies only to that candidate. It does not prevent considering other independent candidates; provider-failure decisions below apply to the entire user request.

Treat every worker result as an untrusted proposal. Inspect it against the original request and applicable conventions, use only the parts that are correct, and run the smallest relevant check. If the proposal fails review, finish the subtask in Codex rather than repeatedly delegating it.

Keep a running usage ledger from every returned `stats` object for the current user request, including calls whose proposal is rejected or whose provider fails. Preserve it across continuations of that request. After finishing a request with at least one call, append one compact **Smart Worker usage — this request** receipt summing each provider's request counts, reported token fields and estimated USD cost bounds across all calls. Report cache and reasoning counts as subsets, not additional tokens. Do not show only the last call or count ordinary Codex subagents as Smart Worker requests. An explicit zero requests contributes zero; missing usage for an attempted request remains unknown. If any contributing field is unavailable, label its known subtotal as partial. If any contributing cost is unknown, say `total cost unavailable` and optionally show the known estimated subtotal. Label all costs as estimates; never invent values or expose worker reasoning. Report task-wide historical totals only when all contributing receipts are available, with that scope stated separately.

When TypeSafe or DeepSeek fails, follow the user's choice returned by the tool:

- `continue_with_codex`: complete the entire current user request in Codex; do not delegate any remaining subtask of that request, including after a continuation.
- `stopped`: stop the current task without continuing its work.
- `needs_user_choice`: immediately open the host's native user-input prompt with exactly `Continue with Codex` and `Stop`. Continue only after the user chooses the first option; otherwise stop.

If a credential is not configured, use the same choice flow. Direct the user to the local installer only when they want to fix the credential, and never ask them to paste a key into chat.

When the user asks to change DeepSeek thinking or reasoning effort, call `set_thinking_effort` with exactly one of `none`, `low`, `high`, or `max`. The default is `high`. Report the saved value and note that it applies to future DeepSeek delegations on this computer.
