#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

import { KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICES } from "../credentials.mjs";

function runSecurity(args, stdio = "inherit") {
  return spawnSync("/usr/bin/security", args, { stdio }).status === 0;
}

function saveCredential(name, label) {
  process.stdout.write(`\n${label}\n`);
  const saved = runSecurity([
    "add-generic-password",
    "-U",
    "-a",
    KEYCHAIN_ACCOUNT,
    "-s",
    KEYCHAIN_SERVICES[name],
    "-l",
    `Codex Smart Worker — ${label}`,
    "-j",
    "Stored locally for the Codex Smart Worker plugin",
    "-w"
  ]);
  if (!saved) throw new Error(`Could not save ${label}.`);
}

async function removeCredentials() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question("Remove both Codex Smart Worker keys from macOS Keychain? [y/N] ");
  prompt.close();
  if (!/^y(es)?$/i.test(answer.trim())) {
    process.stdout.write("Nothing was removed.\n");
    return;
  }

  for (const service of Object.values(KEYCHAIN_SERVICES)) {
    runSecurity(["delete-generic-password", "-a", KEYCHAIN_ACCOUNT, "-s", service], "ignore");
  }
  process.stdout.write("Codex Smart Worker keys were removed from macOS Keychain.\n");
}

if (process.platform !== "darwin") {
  throw new Error("Secure Keychain setup currently requires macOS.");
}

if (process.argv.includes("--remove")) {
  await removeCredentials();
} else {
  if (!process.stdin.isTTY) {
    throw new Error("Run this setup command in an interactive Terminal window.");
  }
  process.stdout.write(
    "Codex Smart Worker secure setup\nYour keys are entered into macOS Keychain and are not shown or saved by this script.\n"
  );
  saveCredential("TYPESAFE_API_KEY", "TypeSafe API key");
  saveCredential("DEEPSEEK_API_KEY", "DeepSeek API key");
  process.stdout.write("\nSetup complete. Restart Codex and begin a new task.\n");
}
