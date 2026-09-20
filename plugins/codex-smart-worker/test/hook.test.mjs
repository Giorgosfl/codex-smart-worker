import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("prompt hook adds general routing guidance without echoing the prompt", () => {
  const secret = "never-echo-this-prompt";
  const hook = fileURLToPath(new URL("../hooks/user_prompt_submit.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [hook], { input: secret, encoding: "utf8" });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes(secret), false);
  assert.match(output.hookSpecificOutput.additionalContext, /general work, not only coding/);
});
