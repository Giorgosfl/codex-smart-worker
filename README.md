# Codex Smart Worker

Codex plans and reviews. TypeSafe Jev decides whether a bounded task is safe to delegate. DeepSeek Flash produces a proposal for Codex to inspect before applying.

## What you need

- macOS
- Node.js 20 or newer
- A TypeSafe API key
- A DeepSeek API key

Never paste an API key into Codex chat, a GitHub issue, or a configuration file.

## Install and set up

Open Terminal and copy these commands one at a time:

```sh
git clone https://github.com/Giorgosfl/codex-smart-worker.git
cd codex-smart-worker/plugins/codex-smart-worker
npm run setup
```

The setup asks for each key using a hidden Terminal prompt. The keys go directly into your macOS Keychain: this repository, the setup script, and Codex chat never receive or save what you type.

Then install the plugin:

```sh
cd ../..
codex plugin marketplace add .
codex plugin add codex-smart-worker@codex-smart-worker
```

Restart Codex and begin a new task.

## Replace or remove keys

To replace either key, return to `codex-smart-worker/plugins/codex-smart-worker` and run:

```sh
npm run setup
```

To remove both saved keys:

```sh
npm run remove-keys
```

Removing a key from Keychain does not revoke it. If a key may have been exposed, revoke it on the TypeSafe or DeepSeek website too.

## How it works

The plugin exposes `delegate_task`. It asks Jev to classify a bounded task and sends only low-risk, high-confidence tasks to DeepSeek Flash. Every result returns to Codex as an untrusted proposal for review and testing.

The worker has no direct file or terminal access. Environment variables remain available as an optional fallback for automated or non-macOS environments.

## Troubleshooting

- **“API key is not configured”** — run `npm run setup`, restart Codex, and start a new task.
- **Setup says it needs Terminal** — run it in the Terminal app, not inside Codex chat.
- **Plugin changes are not visible** — reinstall the plugin, restart Codex, and start a new task.
