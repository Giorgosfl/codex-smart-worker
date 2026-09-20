<div align="center">

# 🧠 Codex Smart Worker

**Codex plans and reviews. TypeSafe Jev routes. DeepSeek Flash drafts.**

![Local only](https://img.shields.io/badge/setup-local--only-2563eb)
![No Keychain](https://img.shields.io/badge/Apple%20Keychain-not%20used-111827)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-059669)
![License](https://img.shields.io/badge/license-MIT-7c3aed)

</div>

Codex Smart Worker gives Codex a guarded way to delegate small, well-defined tasks to a cheaper model. TypeSafe Jev classifies each candidate first. DeepSeek Flash receives it only when the task is low-risk and the classification is confident enough. Codex remains responsible for the plan, review, edits, and tests.

```text
Your request
    │
    ▼
  Codex ──► TypeSafe Jev
               │
        ┌──────┴──────┐
        │             │
   keep in Codex   DeepSeek Flash
        │             │
        └──────┬──────┘
               ▼
        Codex reviews it
```

## ✨ What you get

| Feature | Behavior |
| --- | --- |
| Local setup | The plugin and API keys stay on your computer |
| Guarded delegation | Jev must approve the task before DeepSeek is called |
| Human-friendly setup | One menu installs, updates, removes keys, or uninstalls |
| Codex stays in control | Worker output is only a proposal; Codex reviews it |
| Cross-platform | macOS, Linux, and Windows setup scripts |

## 🚀 Install

### macOS or Linux

Open Terminal and run:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/259455b1b96fa3d406ce449f551f4b8a1645231d/install.sh)"
```

### Windows

Open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/259455b1b96fa3d406ce449f551f4b8a1645231d/install.ps1 | iex
```

> The installer links are pinned to a specific reviewed commit. You can inspect [install.sh](install.sh) or [install.ps1](install.ps1) before running them.

The same menu handles everything:

```text
1) Install plugin and set up both API keys
2) Change TypeSafe API key
3) Change DeepSeek API key
4) Remove TypeSafe API key
5) Remove DeepSeek API key
6) Remove both API keys
7) Uninstall plugin and remove both API keys
8) Exit
```

Choose **1**, paste each key into its hidden prompt, restart Codex, and begin a new task.

## ✅ Requirements

- Codex with local plugin support
- Node.js 20 or newer
- A TypeSafe API key
- A DeepSeek API key

There is no hosting service, account system, database, or monthly plugin charge. You pay only for your own TypeSafe and DeepSeek usage.

## 🔐 Where your keys live

The installer creates one private file per key:

| System | Local folder |
| --- | --- |
| macOS / Linux | `~/.codex/codex-smart-worker/credentials/` |
| Windows | `%USERPROFILE%\.codex\codex-smart-worker\credentials\` |

- macOS and Linux use user-only directory and file permissions (`700` and `600`).
- Windows removes inherited access from each key file and grants access to the current Windows user.
- The values do not enter shell history, Git, the README, or Codex chat.
- Apple Keychain is not used.
- On macOS, installer v3 removes any matching credentials left behind by the older Keychain-based installer.
- Keys are stored as local plaintext protected by operating-system file permissions; they are not encrypted at rest.
- Keys are not synchronized. Run the installer once on every computer where you want to use the plugin.

Environment variables named `TYPESAFE_API_KEY` and `DEEPSEEK_API_KEY` remain supported and take priority over the local files for automation.

## 🛠 Manage or remove keys

Run the same installation command whenever you need the menu again. You can replace or remove either key without touching the other.

Option **7** removes the plugin, marketplace entry, and both local key files after confirmation. Removing a local key does not revoke it at the provider. If a key may have been exposed, revoke it in the TypeSafe or DeepSeek dashboard as well.

## 🧩 How delegation works

The plugin exposes one tool: `delegate_task`.

1. Codex isolates a bounded task and sends only the necessary context to TypeSafe Jev.
2. Jev chooses `deepseek`, `codex`, or `ask_user` and assigns a risk level.
3. DeepSeek Flash runs only for a low-risk `deepseek` decision with sufficient confidence.
4. The result returns to Codex as an untrusted proposal.
5. Codex reviews the proposal and decides whether to apply and test it.

The worker cannot edit files or run terminal commands directly.

## 🩺 Troubleshooting

| Problem | Fix |
| --- | --- |
| `API key is not configured` | Run the installer again, choose option 2 or 3, then restart Codex |
| Nothing appears while entering a key | That is expected; the prompt intentionally hides the value |
| Setup cannot read input | Run it in Terminal or PowerShell, not inside Codex chat |
| Plugin changes are missing | Reinstall the plugin, restart Codex, and start a new task |
| Using a custom Codex home | Set `CODEX_HOME` before running the installer and before starting Codex |

## 🧪 Development

```sh
cd plugins/codex-smart-worker
npm test
```

The plugin uses only Node.js built-ins at runtime.

## License

[MIT](LICENSE)
