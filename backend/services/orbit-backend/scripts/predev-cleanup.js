/* eslint-disable no-console */
const { execSync } = require("node:child_process");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const port = Number(process.env.PORT || 4001);

function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function getWindowsPortPids(listenPort) {
  try {
    const output = execSync("netstat -ano -p tcp", { encoding: "utf8" });
    const pids = [];

    for (const line of parseLines(output)) {
      const parts = line.split(/\s+/);
      if (parts.length < 5) continue;
      if (parts[0].toUpperCase() !== "TCP") continue;
      if (parts[3].toUpperCase() !== "LISTENING") continue;

      const localAddress = parts[1];
      const pid = Number(parts[4]);
      if (!Number.isInteger(pid) || pid <= 0) continue;

      const localPort = Number(localAddress.split(":").pop());
      if (localPort === listenPort) pids.push(pid);
    }

    return unique(pids);
  } catch {
    return [];
  }
}

function getWindowsOrbitBackendPids() {
  const command =
    "powershell -NoProfile -ExecutionPolicy Bypass -Command " +
    '"Get-CimInstance Win32_Process | ' +
    "Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'orbit-backend' -and $_.CommandLine -match 'src/server.ts' } | " +
    "Select-Object -ExpandProperty ProcessId\"";

  try {
    const output = execSync(command, { encoding: "utf8" });
    return unique(
      parseLines(output)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    );
  } catch {
    return [];
  }
}

function getUnixPortPids(listenPort) {
  try {
    const output = execSync(`lsof -nP -iTCP:${listenPort} -sTCP:LISTEN -t`, {
      encoding: "utf8",
    });

    return unique(
      parseLines(output)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    );
  } catch {
    return [];
  }
}

function killWindowsPid(pid) {
  execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
}

function killUnixPid(pid) {
  process.kill(pid, "SIGKILL");
}

function killPids(pids) {
  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      if (process.platform === "win32") {
        killWindowsPid(pid);
      } else {
        killUnixPid(pid);
      }
      console.log(`[predev] Stopped process ${pid}`);
    } catch {
      // Ignore races or permission edge-cases; verification happens after cleanup.
    }
  }
}

function main() {
  const isWindows = process.platform === "win32";
  const portPids = isWindows ? getWindowsPortPids(port) : getUnixPortPids(port);
  const backendPids = isWindows ? getWindowsOrbitBackendPids() : [];

  const targets = unique([...portPids, ...backendPids]).filter(
    (pid) => pid !== process.pid
  );

  if (targets.length === 0) {
    console.log(`[predev] Port ${port} is free`);
    return;
  }

  console.log(
    `[predev] Cleaning up stale backend processes before dev start (port ${port})`
  );
  killPids(targets);

  const remaining = isWindows ? getWindowsPortPids(port) : getUnixPortPids(port);
  if (remaining.length > 0) {
    console.warn(
      `[predev] Warning: port ${port} still in use by PID(s): ${remaining.join(", ")}`
    );
  } else {
    console.log(`[predev] Port ${port} is free`);
  }
}

main();
