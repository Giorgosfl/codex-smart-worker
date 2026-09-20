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

The installer opens this menu:

```text
1) Install plugin and set up both API keys
2) Change TypeSafe API key
3) Change DeepSeek API key
4) Remove TypeSafe API key
5) Remove DeepSeek API key
6) Remove both API keys
7) Exit
```

Option 1 runs the normal Codex marketplace and plugin installation commands, then asks for each key using a hidden macOS Keychain prompt. The key values never appear in shell history, process arguments, the repository, or Codex chat. Restart Codex and begin a new task when it finishes.

## Change or remove individual keys

Run the same installer command again and select the key you want to change or remove from the menu.

Removing a key from Keychain does not revoke it. If a key may have been exposed, revoke it on the TypeSafe or DeepSeek website too.

## How it works

The plugin exposes `delegate_task`. It asks Jev to classify a bounded task and sends only low-risk, high-confidence tasks to DeepSeek Flash. Every result returns to Codex as an untrusted proposal for review and testing.

The worker has no direct file or terminal access. Environment variables remain available as an optional fallback for automated or non-macOS environments.

## Troubleshooting

- **“API key is not configured”** — rerun the installer and select the matching change-key option, then restart Codex and start a new task.
- **Setup cannot open a prompt** — run the installer in the Terminal app, not inside Codex chat.
- **Plugin changes are not visible** — reinstall the plugin, restart Codex, and start a new task.
