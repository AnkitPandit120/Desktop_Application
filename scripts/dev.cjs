const { spawn } = require("node:child_process");

const children = new Set();
const apiPort = process.env.PORT || "3000";
const vitePort = process.env.VITE_PORT || "5173";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const viteUrl = `http://127.0.0.1:${vitePort}`;
let stopping = false;

function run(directory, script, extra = [], env = process.env) {
  const child = spawn("npm", ["--prefix", directory, "run", script, ...extra], {
    stdio: "inherit",
    env,
    detached: process.platform !== "win32",
  });
  children.add(child);
  child.once("exit", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${script} stopped with code ${code}`);
      stop(code || 1);
    }
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  }
  process.exitCode = code;
}

async function waitFor(url, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The service may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${label} did not start at ${url}`);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

async function main() {
  run("athena-backend", "start", [], { ...process.env, PORT: apiPort });
  run("athena-frontend", "dev", ["--", "--host", "127.0.0.1", "--port", vitePort, "--strictPort"]);
  await Promise.all([waitFor(apiUrl, "Backend"), waitFor(viteUrl, "Frontend")]);
  run("athena-frontend", "start", [], {
    ...process.env,
    ATHENA_API_URL: apiUrl,
    VITE_DEV_SERVER_URL: viteUrl,
  });
}

main().catch((error) => {
  console.error(error.message);
  stop(1);
});
