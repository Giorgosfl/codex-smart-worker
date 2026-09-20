#!/usr/bin/env bash

set -euo pipefail
umask 077

readonly MARKETPLACE="Giorgosfl/codex-smart-worker"
readonly MARKETPLACE_NAME="codex-smart-worker"
readonly PLUGIN="codex-smart-worker@codex-smart-worker"
readonly CREDENTIALS_DIR="${CODEX_HOME:-${HOME}/.codex}/codex-smart-worker/credentials"
readonly SETTINGS_FILE="${CODEX_HOME:-${HOME}/.codex}/codex-smart-worker/settings.json"
readonly TYPESAFE_FILE="${CREDENTIALS_DIR}/TYPESAFE_API_KEY"
readonly DEEPSEEK_FILE="${CREDENTIALS_DIR}/DEEPSEEK_API_KEY"
readonly KEYCHAIN_ACCOUNT="codex-smart-worker"
readonly TYPESAFE_KEYCHAIN_SERVICE="com.giorgosfl.codex-smart-worker.typesafe"
readonly DEEPSEEK_KEYCHAIN_SERVICE="com.giorgosfl.codex-smart-worker.deepseek"

fail() {
  printf 'Codex Smart Worker: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Codex Smart Worker installer

  bash install.sh install          Install the plugin and save missing API keys
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

╭────────────────────────────────────────────╮
│       Codex Smart Worker Installer v6      │
╰────────────────────────────────────────────╯

  1) Install plugin and set up missing API keys
  2) Change TypeSafe API key
  3) Change DeepSeek API key
  4) Remove TypeSafe API key
  5) Remove DeepSeek API key
  6) Remove both API keys
  7) Uninstall plugin and remove both API keys
  8) Exit
EOF
    printf '\nChoose an option [1-8]: '
    read -r choice </dev/tty || fail "run this installer in an interactive terminal."

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

credential_file() {
  case "$1" in
    typesafe) printf '%s' "$TYPESAFE_FILE" ;;
    deepseek) printf '%s' "$DEEPSEEK_FILE" ;;
    *) fail "choose typesafe, deepseek, or all." ;;
  esac
}

credential_label() {
  case "$1" in
    typesafe) printf 'TypeSafe API key' ;;
    deepseek) printf 'DeepSeek API key' ;;
    *) fail "choose typesafe, deepseek, or all." ;;
  esac
}

delete_legacy_keychain_key() {
  [[ "$(uname -s)" == "Darwin" ]] || return 0

  local service
  case "$1" in
    typesafe) service="$TYPESAFE_KEYCHAIN_SERVICE" ;;
    deepseek) service="$DEEPSEEK_KEYCHAIN_SERVICE" ;;
    all)
      delete_legacy_keychain_key typesafe
      delete_legacy_keychain_key deepseek
      return
      ;;
    *) fail "choose typesafe, deepseek, or all." ;;
  esac

  /usr/bin/security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$service" >/dev/null 2>&1 || true
}

save_key() {
  local target="$1"
  local file label key
  file="$(credential_file "$target")"
  label="$(credential_label "$target")"

  printf '\nPaste your %s, then press Return.\n' "$label"
  printf 'Nothing will appear while you type or paste: '
  IFS= read -r -s key </dev/tty || fail "could not read the API key."
  printf '\n'
  [[ -n "$key" ]] || fail "$label cannot be empty."

  mkdir -p "$CREDENTIALS_DIR"
  chmod 700 "${CREDENTIALS_DIR%/credentials}" "$CREDENTIALS_DIR"
  printf '%s' "$key" >"$file"
  chmod 600 "$file"
  unset key
  delete_legacy_keychain_key "$target"

  printf 'Saved %s in a private local file.\n' "$label"
}

change_keys() {
  case "$1" in
    typesafe|deepseek) save_key "$1" ;;
    all)
      save_key typesafe
      save_key deepseek
      ;;
    *) fail "choose typesafe, deepseek, or all." ;;
  esac
}

setup_missing_keys() {
  local target file label

  for target in typesafe deepseek; do
    file="$(credential_file "$target")"
    label="$(credential_label "$target")"
    if [[ -s "$file" ]]; then
      chmod 700 "${CREDENTIALS_DIR%/credentials}" "$CREDENTIALS_DIR"
      chmod 600 "$file"
      delete_legacy_keychain_key "$target"
      printf '%s already exists. Keeping the saved value.\n' "$label"
    else
      save_key "$target"
    fi
  done
}

delete_keys() {
  case "$1" in
    typesafe) rm -f -- "$TYPESAFE_FILE" ;;
    deepseek) rm -f -- "$DEEPSEEK_FILE" ;;
    all) rm -f -- "$TYPESAFE_FILE" "$DEEPSEEK_FILE" ;;
    *) fail "choose typesafe, deepseek, or all." ;;
  esac

  delete_legacy_keychain_key "$1"

  rmdir "$CREDENTIALS_DIR" 2>/dev/null || true
  rmdir "${CREDENTIALS_DIR%/credentials}" 2>/dev/null || true
}

remove_keys() {
  local target="$1"
  local answer description

  case "$target" in
    typesafe) description="the TypeSafe API key" ;;
    deepseek) description="the DeepSeek API key" ;;
    all) description="both API keys" ;;
    *) fail "choose typesafe, deepseek, or all." ;;
  esac

  printf 'Permanently remove %s from this computer? [y/N] ' "$description"
  read -r answer </dev/tty
  if [[ ! "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    printf 'Nothing was removed.\n'
    return
  fi

  delete_keys "$target"
  printf 'Removed %s from this computer.\n' "$description"
}

check_requirements() {
  command -v codex >/dev/null || fail "Codex is not installed or is not available in this terminal."
  command -v node >/dev/null || fail "Node.js 20 or newer is required."
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  (( node_major >= 20 )) || fail "Node.js 20 or newer is required."
}

uninstall_plugin() {
  local answer

  command -v codex >/dev/null || fail "Codex is not installed or is not available in this terminal."
  printf 'Uninstall Codex Smart Worker and permanently remove both saved API keys? [y/N] '
  read -r answer </dev/tty
  if [[ ! "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    printf 'Nothing was removed.\n'
    return
  fi

  codex plugin remove "$PLUGIN" || printf 'Plugin was already absent; continuing cleanup.\n' >&2
  codex plugin marketplace remove "$MARKETPLACE_NAME" || printf 'Marketplace was already absent; continuing cleanup.\n' >&2
  delete_keys all
  rm -f -- "$SETTINGS_FILE"
  rmdir "${CREDENTIALS_DIR%/credentials}" 2>/dev/null || true
  printf 'Codex Smart Worker, its marketplace, API keys, and local settings were removed.\n'
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
    printf 'codex plugin marketplace upgrade %s\n' "$MARKETPLACE_NAME"
    printf 'codex plugin add %s\n' "$PLUGIN"
    exit 0
    ;;
esac

case "$action" in
  install)
    check_requirements
    printf 'Installing Codex Smart Worker...\n'
    codex plugin marketplace add "$MARKETPLACE"
    codex plugin marketplace upgrade "$MARKETPLACE_NAME"
    codex plugin add "$PLUGIN"
    printf '\nChecking local API keys...\n'
    setup_missing_keys
    printf '\nOne-time Codex step: review and trust the Codex Smart Worker hook after restarting.\n'
    printf 'If Codex does not show the review automatically, type /hooks in Codex.\n'
    ;;
  change)
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
    setup_missing_keys
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

printf '\nDone. Restart Codex and begin a new task.\n'
