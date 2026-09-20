import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const KEYCHAIN_ACCOUNT = "codex-smart-worker";
export const KEYCHAIN_SERVICES = Object.freeze({
  TYPESAFE_API_KEY: "com.giorgosfl.codex-smart-worker.typesafe",
  DEEPSEEK_API_KEY: "com.giorgosfl.codex-smart-worker.deepseek"
});

async function readKeychain(service) {
  const { stdout } = await execFileAsync("/usr/bin/security", [
    "find-generic-password",
    "-a",
    KEYCHAIN_ACCOUNT,
    "-s",
    service,
    "-w"
  ]);
  return stdout.trim();
}

export async function getCredential(
  name,
  env = process.env,
  { platform = process.platform, keychainReader = readKeychain } = {}
) {
  const environmentValue = env[name];
  if (typeof environmentValue === "string" && environmentValue.trim()) {
    return environmentValue.trim();
  }

  const service = KEYCHAIN_SERVICES[name];
  if (!service) throw new Error(`Unknown credential: ${name}`);
  if (platform !== "darwin") {
    throw new Error(`${name} is not configured. Set it as an environment variable.`);
  }

  try {
    const value = await keychainReader(service);
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    // Replace the Keychain command's noisy error with a safe setup instruction.
  }

  throw new Error(`${name} is not configured. Run the secure installer linked in the plugin README.`);
}
