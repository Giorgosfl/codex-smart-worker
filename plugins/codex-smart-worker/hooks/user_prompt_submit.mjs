for await (const _ of process.stdin) {
  // Consume and discard hook input. The user's prompt never leaves this process.
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext:
      "Use the Smart Worker skill automatically without waiting for a plugin mention. Throughout each nontrivial request, call delegate_task for each worthwhile independent bounded candidate, reassessing after results and phase changes; there is no one-call limit. Batch tiny related work and avoid redundant delegation. This applies to general work, not only coding. Send only minimum sanitized facts and explicit acceptance criteria. Keep trivial conversation, planning, ambiguous requirements, secrets, credentials, private data, tool use, security-sensitive work, destructive or external actions, high-stakes decisions, and final judgment in Codex. Skip delegation when no safe bounded candidate exists or the user asks not to use external providers. Review every proposal. Delegate sequentially and honor provider-failure choices: continue_with_codex ends all delegation for the current user request; stopped ends work; needs_user_choice requires the native choice prompt. Aggregate returned stats across all calls in the current request for one scoped usage receipt, not only the last call."
  }
}));
