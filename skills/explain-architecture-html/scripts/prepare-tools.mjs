import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const folder = process.argv[2] && path.resolve(process.argv[2]);
if (!folder)
  throw new Error("Usage: node prepare-tools.mjs <new-task-tool-directory>");
const tools = JSON.parse(
  fs.readFileSync(new URL("./toolchain.json", import.meta.url), "utf8"),
);
const git = (args) =>
  execFileSync(
    "git",
    process.platform === "win32"
      ? ["-c", "http.sslBackend=openssl", ...args]
      : args,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
for (const name of Object.keys(tools)) {
  if (fs.existsSync(path.join(folder, name)))
    throw new Error(
      `Use a new task directory; existing checkout will not be reset: ${path.join(folder, name)}`,
    );
}
fs.mkdirSync(folder, { recursive: true });
const paths = {};
for (const [name, tool] of Object.entries(tools)) {
  const checkout = path.join(folder, name);
  if (fs.existsSync(checkout)) {
    throw new Error(
      `Use a new task directory; existing checkout will not be reset: ${checkout}`,
    );
  }
  git(["init", checkout]);
  git(["-C", checkout, "remote", "add", "origin", tool.url]);
  git(["-C", checkout, "fetch", "--depth=1", "origin", tool.revision]);
  git(["-C", checkout, "checkout", "--detach", "FETCH_HEAD"]);
  if (git(["-C", checkout, "rev-parse", "HEAD"]) !== tool.revision)
    throw new Error(`Unexpected ${name} revision`);
  const cli = path.join(checkout, tool.cli);
  if (!fs.existsSync(cli)) throw new Error(`CLI missing: ${cli}`);
  paths[name] = { checkout, cli, revision: tool.revision };
}
fs.writeFileSync(
  path.join(folder, "tool-paths.json"),
  JSON.stringify(paths, null, 2) + "\n",
);
console.log(JSON.stringify(paths, null, 2));
