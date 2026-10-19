// PostToolUse hook: po Edit/Write pliku w src/ uruchamia `pnpm check`.
// Błędy zwraca z kodem 2, żeby Claude zobaczył je i poprawił.
import { execSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;

const filePath = JSON.parse(input || "{}").tool_input?.file_path ?? "";
if (!/[\\/]src[\\/]/.test(filePath)) process.exit(0);

try {
  execSync("pnpm check", { cwd: process.env.CLAUDE_PROJECT_DIR, stdio: "pipe", encoding: "utf8" });
} catch (err) {
  process.stderr.write(`pnpm check failed:\n${err.stdout ?? ""}${err.stderr ?? ""}`.slice(-4000));
  process.exit(2);
}
