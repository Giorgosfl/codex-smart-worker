# Codex Smart Worker

Codex plans and reviews. TypeSafe Jev decides whether a bounded task is safe to delegate. DeepSeek Flash produces a proposal for Codex to inspect before applying.

## Requirements

- Node.js 20 or newer
- `TYPESAFE_API_KEY`
- `DEEPSEEK_API_KEY`

Keep both keys in your local environment. Never commit them.

## Install in Codex

```sh
codex plugin marketplace add Giorgosfl/codex-smart-worker
codex plugin add codex-smart-worker@codex-smart-worker
```

Restart Codex and begin a new task after installation.

## How it works

The plugin exposes one MCP tool, `delegate_task`. It asks Jev to classify a bounded task. Only low-risk, high-confidence tasks are sent to DeepSeek Flash. Every worker result is returned to Codex as an untrusted proposal for review and testing.

The worker has no direct file or terminal access.
