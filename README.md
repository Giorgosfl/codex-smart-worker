# Codex Smart Worker

Codex plans and reviews. TypeSafe Jev decides whether a bounded task is safe to delegate. DeepSeek Flash produces a proposal for Codex to inspect before applying.

## What you need

- macOS
- Node.js 20 or newer
- A TypeSafe API key
- A DeepSeek API key

Never paste an API key into Codex chat, a GitHub issue, or a configuration file.

## Install and set up

First, [review the short installer](https://github.com/Giorgosfl/codex-smart-worker/blob/main/install.sh). Then open Terminal and run:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/main/install.sh)"
```

The installer runs the normal Codex commands:

```sh
codex plugin marketplace add Giorgosfl/codex-smart-worker
codex plugin add codex-smart-worker@codex-smart-worker
```

It then asks for each key using a hidden macOS Keychain prompt. The key values never appear in shell history, process arguments, the repository, or Codex chat. Restart Codex and begin a new task when it finishes.

## Change or remove individual keys

Change only the key you need:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/main/install.sh)" -- change typesafe
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/main/install.sh)" -- change deepseek
```

Remove one key or both keys:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/main/install.sh)" -- remove typesafe
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/main/install.sh)" -- remove deepseek
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/main/install.sh)" -- remove all
```

Removing a key from Keychain does not revoke it. If a key may have been exposed, revoke it on the TypeSafe or DeepSeek website too.

## How it works

The plugin exposes `delegate_task`. It asks Jev to classify a bounded task and sends only low-risk, high-confidence tasks to DeepSeek Flash. Every result returns to Codex as an untrusted proposal for review and testing.

The worker has no direct file or terminal access. Environment variables remain available as an optional fallback for automated or non-macOS environments.

## Troubleshooting

- **“API key is not configured”** — use `change typesafe` or `change deepseek`, restart Codex, and start a new task.
- **Setup cannot open a prompt** — run the installer in the Terminal app, not inside Codex chat.
- **Plugin changes are not visible** — reinstall the plugin, restart Codex, and start a new task.
