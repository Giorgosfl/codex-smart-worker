import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const CREDENTIAL_NAMES = Object.freeze([
  "TYPESAFE_API_KEY",
  "DEEPSEEK_API_KEY"
]);

export function credentialsDirectory(env = process.env) {
  const codexHome = env.CODEX_HOME?.trim() || join(homedir(), ".codex");
  return join(codexHome, "codex-smart-worker", "credentials");
}

export async function getCredential(
  name,
  env = process.env,
  { directory = credentialsDirectory(env), fileReader = readFile } = {}
) {
  if (!CREDENTIAL_NAMES.includes(name)) throw new Error(`Unknown credential: ${name}`);

  const environmentValue = env[name];
  if (typeof environmentValue === "string" && environmentValue.trim()) {
    return environmentValue.trim();
  }

  try {
    const value = await fileReader(join(directory, name), "utf8");
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    // Replace filesystem details with one safe setup instruction.
  }

  throw new Error(`${name} is not configured. Run the local installer linked in the plugin README.`);
}
