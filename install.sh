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

remove_keys() {
  local answer
  printf 'Remove both Codex Smart Worker keys from macOS Keychain? [y/N] '
  read -r answer </dev/tty
  if [[ ! "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    printf 'Nothing was removed.\n'
    return
  fi

  /usr/bin/security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$TYPESAFE_SERVICE" >/dev/null 2>&1 || true
  /usr/bin/security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$DEEPSEEK_SERVICE" >/dev/null 2>&1 || true
  printf 'Codex Smart Worker keys were removed from macOS Keychain.\n'
}

[[ "$(uname -s)" == "Darwin" ]] || fail "secure setup currently requires macOS."

case "${1:-}" in
  --dry-run)
    printf 'codex plugin marketplace add %s\n' "$MARKETPLACE"
    printf 'codex plugin add %s\n' "$PLUGIN"
    exit 0
    ;;
  --remove-keys)
    remove_keys
    exit 0
    ;;
  --keys-only)
    ;;
  "")
    command -v codex >/dev/null || fail "Codex is not installed or is not available in Terminal."
    command -v node >/dev/null || fail "Node.js 20 or newer is required."
    node_major="$(node -p 'process.versions.node.split(".")[0]')"
    (( node_major >= 20 )) || fail "Node.js 20 or newer is required."

    printf 'Installing Codex Smart Worker...\n'
    codex plugin marketplace add "$MARKETPLACE"
    codex plugin add "$PLUGIN"
    ;;
  *)
    fail "unknown option: $1"
    ;;
esac

printf '\nSecure API-key setup\n'
printf 'Each key is entered through a hidden macOS Keychain prompt. Nothing is saved in chat or configuration files.\n'
save_key "$TYPESAFE_SERVICE" "TypeSafe API key"
save_key "$DEEPSEEK_SERVICE" "DeepSeek API key"

printf '\nSetup complete. Restart Codex and begin a new task.\n'
