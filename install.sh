#!/bin/bash

set -euo pipefail

readonly MARKETPLACE="Giorgosfl/codex-smart-worker"
readonly MARKETPLACE_NAME="codex-smart-worker"
readonly PLUGIN="codex-smart-worker@codex-smart-worker"
readonly KEYCHAIN_ACCOUNT="codex-smart-worker"
readonly TYPESAFE_SERVICE="com.giorgosfl.codex-smart-worker.typesafe"
readonly DEEPSEEK_SERVICE="com.giorgosfl.codex-smart-worker.deepseek"

fail() {
  printf 'Codex Smart Worker: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Codex Smart Worker installer

  bash install.sh install          Install the plugin and save both API keys
  bash install.sh change typesafe  Change only the TypeSafe API key
  bash install.sh change deepseek  Change only the DeepSeek API key
  bash install.sh change all       Change both API keys
  bash install.sh remove typesafe  Remove only the TypeSafe API key
  bash install.sh remove deepseek  Remove only the DeepSeek API key
  bash install.sh remove all       Remove both API keys
  bash install.sh uninstall        Remove the plugin, marketplace, and both keys
EOF
}

choose_action() {
  local choice

  while true; do
    cat <<'EOF'

Codex Smart Worker

  1) Install plugin and set up both API keys
  2) Change TypeSafe API key
  3) Change DeepSeek API key
  4) Remove TypeSafe API key
  5) Remove DeepSeek API key
  6) Remove both API keys
  7) Uninstall plugin and remove both API keys
  8) Exit
EOF
    printf '\nChoose an option [1-8]: '
    read -r choice || fail "run this installer in an interactive Terminal window."

    case "$choice" in
      1) action="install"; target=""; return ;;
      2) action="change"; target="typesafe"; return ;;
      3) action="change"; target="deepseek"; return ;;
      4) action="remove"; target="typesafe"; return ;;
      5) action="remove"; target="deepseek"; return ;;
      6) action="remove"; target="all"; return ;;
      7) action="uninstall"; target=""; return ;;
      8) printf 'Goodbye.\n'; exit 0 ;;
      *) printf 'Please choose a number from 1 to 8.\n' ;;
    esac
  done
}

save_key() {
  local service="$1"
  local label="$2"

  printf '\nPaste your %s at the next prompt, then press Return.\n' "$label"
  printf 'This is NOT your Mac login password. Nothing will appear while you type or paste.\n'
  /usr/bin/security add-generic-password \
    -U \
    -a "$KEYCHAIN_ACCOUNT" \
    -s "$service" \
    -l "Codex Smart Worker — $label" \
    -j "Stored locally for the Codex Smart Worker plugin" \
    -w </dev/tty
  printf 'Saved %s securely in macOS Keychain.\n' "$label"
}

change_keys() {
  case "$1" in
    typesafe)
      save_key "$TYPESAFE_SERVICE" "TypeSafe API key"
      ;;
    deepseek)
      save_key "$DEEPSEEK_SERVICE" "DeepSeek API key"
      ;;
    all)
      save_key "$TYPESAFE_SERVICE" "TypeSafe API key"
      save_key "$DEEPSEEK_SERVICE" "DeepSeek API key"
      ;;
    *)
      fail "choose typesafe, deepseek, or all."
      ;;
  esac
}

delete_keys() {
  local target="$1"

  if [[ "$target" == "typesafe" || "$target" == "all" ]]; then
    /usr/bin/security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$TYPESAFE_SERVICE" >/dev/null 2>&1 || true
  fi
  if [[ "$target" == "deepseek" || "$target" == "all" ]]; then
    /usr/bin/security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$DEEPSEEK_SERVICE" >/dev/null 2>&1 || true
  fi
}

remove_keys() {
  local target="$1"
  local answer
  local description

  case "$target" in
    typesafe) description="the TypeSafe API key" ;;
    deepseek) description="the DeepSeek API key" ;;
    all) description="both API keys" ;;
    *) fail "choose typesafe, deepseek, or all." ;;
  esac

  printf 'Remove %s from macOS Keychain? [y/N] ' "$description"
  read -r answer
  if [[ ! "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    printf 'Nothing was removed.\n'
    return
  fi

  delete_keys "$target"
  printf 'Removed %s from macOS Keychain.\n' "$description"
}

uninstall_plugin() {
  local answer

  command -v codex >/dev/null || fail "Codex is not installed or is not available in Terminal."
  printf 'Uninstall Codex Smart Worker and permanently remove both saved API keys? [y/N] '
  read -r answer
  if [[ ! "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    printf 'Nothing was removed.\n'
    return
  fi

  if ! codex plugin remove "$PLUGIN"; then
    printf 'Plugin was already absent or could not be removed. Continuing cleanup.\n' >&2
  fi
  if ! codex plugin marketplace remove "$MARKETPLACE_NAME"; then
    printf 'Marketplace was already absent or could not be removed. Continuing cleanup.\n' >&2
  fi
  delete_keys all
  printf 'Codex Smart Worker, its marketplace, and both saved API keys were removed.\n'
}

action="${1:-}"
target="${2:-}"

if [[ -z "$action" ]]; then
  choose_action
fi

case "$action" in
  help|-h|--help)
    usage
    exit 0
    ;;
  --dry-run)
    printf 'codex plugin marketplace add %s\n' "$MARKETPLACE"
    printf 'codex plugin add %s\n' "$PLUGIN"
    exit 0
    ;;
esac

[[ "$(uname -s)" == "Darwin" ]] || fail "secure setup currently requires macOS."

case "$action" in
  install)
    command -v codex >/dev/null || fail "Codex is not installed or is not available in Terminal."
    command -v node >/dev/null || fail "Node.js 20 or newer is required."
    node_major="$(node -p 'process.versions.node.split(".")[0]')"
    (( node_major >= 20 )) || fail "Node.js 20 or newer is required."

    printf 'Installing Codex Smart Worker...\n'
    codex plugin marketplace add "$MARKETPLACE"
    codex plugin add "$PLUGIN"
    printf '\nEach API key is entered through a hidden macOS Keychain prompt.\n'
    change_keys all
    ;;
  change)
    printf 'The API key is entered through a hidden macOS Keychain prompt.\n'
    change_keys "$target"
    ;;
  remove)
    remove_keys "$target"
    exit 0
    ;;
  uninstall)
    uninstall_plugin
    exit 0
    ;;
  --keys-only)
    change_keys all
    ;;
  --remove-keys)
    remove_keys all
    exit 0
    ;;
  *)
    usage >&2
    fail "unknown command: $action"
    ;;
esac

printf '\nAPI-key update complete. Restart Codex and begin a new task.\n'
