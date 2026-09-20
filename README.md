<div align="center">

# 🧠 Codex Smart Worker

**Codex plans and reviews. TypeSafe Jev routes. DeepSeek Flash drafts.**

![Local only](https://img.shields.io/badge/setup-local--only-2563eb)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-059669)
![License](https://img.shields.io/badge/license-MIT-7c3aed)

</div>

Codex Smart Worker considers general work—not only coding—for guarded delegation to a cheaper model. TypeSafe Jev classifies each sanitized candidate first. DeepSeek Flash receives it only when the task is low-risk and the classification is confident enough. Codex remains responsible for the plan, tools, decisions, review, and final result.

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
| General routing | Every nontrivial request is considered, not only coding |
| Guarded delegation | Jev must approve the task before DeepSeek is called |
| Human-friendly setup | One menu installs, updates, removes keys, or uninstalls |
| Codex stays in control | Worker output is only a proposal; Codex reviews it |
| Adjustable thinking | DeepSeek defaults to `high`; change it later from Codex |
| Automatic usage receipt | Each completed routed task shows requests, reported tokens, and estimated cost |
| Cross-platform | macOS, Linux, and Windows setup scripts |

## 🚀 Install

### macOS or Linux

Open Terminal and run:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/8cc092ada82cd6ecff5e2c39e78fbc891ef0eecb/install.sh)"
```

### Windows

Open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/Giorgosfl/codex-smart-worker/8cc092ada82cd6ecff5e2c39e78fbc891ef0eecb/install.ps1 | iex
```

> The installer links are pinned to a specific reviewed commit. You can inspect [install.sh](install.sh) or [install.ps1](install.ps1) before running them.

The same menu handles everything:

```text
1) Install plugin and set up missing API keys
2) Change TypeSafe API key
3) Change DeepSeek API key
4) Remove TypeSafe API key
5) Remove DeepSeek API key
6) Remove both API keys
7) Uninstall plugin and remove both API keys
8) Exit
```

Choose **1** and paste any missing key into its hidden prompt. Restart Codex, review and trust the **Codex Smart Worker** hook once, then begin a new task. If the review does not appear automatically, type `/hooks` in Codex. On reinstall, non-empty saved keys are kept automatically. Use options **2** or **3** only when you want to replace a key.

## ✅ Requirements

- Codex with local plugin and lifecycle-hook support
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
- Keys are stored as local plaintext protected by operating-system file permissions; they are not encrypted at rest.
- Keys are not synchronized. Run the installer once on every computer where you want to use the plugin.

Environment variables named `TYPESAFE_API_KEY` and `DEEPSEEK_API_KEY` remain supported and take priority over the local files for automation.

## 🛠 Manage or remove keys

Run the same installation command whenever you need the menu again. You can replace or remove either key without touching the other.

Option **7** removes the plugin, marketplace entry, and both local key files after confirmation. Removing a local key does not revoke it at the provider. If a key may have been exposed, revoke it in the TypeSafe or DeepSeek dashboard as well.

## 🧩 How delegation works

The plugin includes a local `UserPromptSubmit` hook and exposes two tools: `delegate_task` and `set_thinking_effort`.

1. The hook locally reminds Codex to consider every nontrivial request for delegation. It discards the original prompt and makes no API request.
2. Codex understands the request and isolates one bounded candidate with only the minimum sanitized context.
3. TypeSafe Jev chooses `deepseek`, `codex`, or `ask_user` and assigns a risk level.
4. DeepSeek Flash runs only for a low-risk `deepseek` decision with sufficient confidence.
5. The result returns to Codex as an untrusted proposal for final review.

After Codex finishes the request, it appends a compact **Smart Worker usage** receipt. It reports one TypeSafe request, whether DeepSeek was called, token counts supplied by each provider, DeepSeek cache and reasoning tokens when available, and an estimated USD cost range. The estimate uses published rates dated **2026-09-19**; provider billing dashboards remain authoritative. No usage history is stored or uploaded by the plugin.

This applies to drafting, summarizing, transforming, organizing, research synthesis, and coding. Trivial conversation, secrets, private data, ambiguous planning, tool use, destructive actions, high-stakes decisions, and final judgment stay in Codex. The worker cannot edit files, run terminal commands, or take external actions directly.

### Change DeepSeek thinking effort

DeepSeek Flash uses **high** thinking by default. Ask Codex with any of these commands:

```text
Set Smart Worker thinking to none
Set Smart Worker thinking to low
Set Smart Worker thinking to high
Set Smart Worker thinking to max
```

Codex calls the plugin's local `set_thinking_effort` action. The choice is saved on that computer and applies to future DeepSeek delegations without reinstalling the plugin. `none` disables thinking; the other levels enable it with progressively larger output budgets.

Codex requires one-time review because installed-plugin hooks can influence every task. New or changed hook code must be trusted again; the installer never bypasses this safety check.

## 🛟 When a provider fails

If TypeSafe or DeepSeek has an outage, rejects a key, reaches a rate limit, or runs out of credits, Codex Smart Worker immediately opens a native choice window:

```text
Provider could not complete the request.

[ Continue with Codex ]  [ Stop ]
```

| Choice | Result |
| --- | --- |
| Continue with Codex | Codex completes the current task itself and does not delegate it again |
| Stop | The current task stops without continuing the work |

TypeSafe failures stop the flow before DeepSeek is called. DeepSeek failures are not automatically retried. Provider response bodies are not shown, so billing or account details from an error cannot leak into the conversation.

If a Codex client does not advertise native MCP elicitation support, the tool returns the same two-choice instruction for Codex to present through its built-in user prompt.

## 🩺 Troubleshooting

| Problem | Fix |
| --- | --- |
| `API key is not configured` | Run the installer again, choose option 2 or 3, then restart Codex |
| Nothing appears while entering a key | That is expected; the prompt intentionally hides the value |
| Setup cannot read input | Run it in Terminal or PowerShell, not inside Codex chat |
| No TypeSafe request appears | Open `/hooks`, trust the Smart Worker hook, restart Codex, and test in a new task; trivial or unsafe work may correctly remain in Codex |
| Plugin changes are missing | Run installer v6 again; it refreshes the marketplace before reinstalling. Then restart Codex and start a new task |
| Using a custom Codex home | Set `CODEX_HOME` before running the installer and before starting Codex |

## 🧪 Development

```sh
cd plugins/codex-smart-worker
npm test
```

The plugin uses only Node.js built-ins at runtime.

## License

[MIT](LICENSE)
