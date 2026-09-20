#!/bin/bash

set -euo pipefail

readonly MARKETPLACE="Giorgosfl/codex-smart-worker"
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
EOF
}

save_key() {
  local service="$1"
  local label="$2"

  printf '\n%s\n' "$label"
  /usr/bin/security add-generic-password \
    -U \
    -a "$KEYCHAIN_ACCOUNT" \
    -s "$service" \
    -l "Codex Smart Worker — $label" \
    -j "Stored locally for the Codex Smart Worker plugin" \
    -w </dev/tty
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
  read -r answer </dev/tty
  if [[ ! "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    printf 'Nothing was removed.\n'
    return
  fi

  if [[ "$target" == "typesafe" || "$target" == "all" ]]; then
    /usr/bin/security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$TYPESAFE_SERVICE" >/dev/null 2>&1 || true
  fi
  if [[ "$target" == "deepseek" || "$target" == "all" ]]; then
    /usr/bin/security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$DEEPSEEK_SERVICE" >/dev/null 2>&1 || true
  fi
  printf 'Removed %s from macOS Keychain.\n' "$description"
}

action="${1:-install}"
target="${2:-}"

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
