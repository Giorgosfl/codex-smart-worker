for await (const _ of process.stdin) {
  // Consume and discard hook input. The user's prompt never leaves this process.
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext:
      "Codex Smart Worker routing: after understanding every nontrivial request, identify the best self-contained candidate subtask and call delegate_task once so TypeSafe Jev can classify it. This applies to general work, not only coding. Send only minimum sanitized facts and explicit acceptance criteria. Keep trivial conversation, planning, ambiguous requirements, secrets, credentials, private data, tool use, security-sensitive work, destructive or external actions, high-stakes decisions, and final judgment in Codex. Skip delegation when no safe bounded candidate exists or the user asks not to use external providers. Review every worker proposal before using it."
  }
}));
