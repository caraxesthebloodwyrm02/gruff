import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INGESTER_BIN = existsSync(join(__dirname, "../package.json"))
  ? resolve(__dirname, "trust/ingester.js")
  : resolve(__dirname, "../../dist/trust/ingester.js");

const SERVICE = `[Unit]
Description=gruff audit ingester — tails ~/.echoes/audit.ndjson into ~/.gruff/trust.sqlite
After=network.target

[Service]
Type=oneshot
ExecStart=node ${INGESTER_BIN}
StandardOutput=journal
StandardError=journal
`;

const TIMER = `[Unit]
Description=gruff audit ingester timer

[Timer]
OnBootSec=30s
OnUnitActiveSec=1min
Unit=gruff-ingester.service

[Install]
WantedBy=timers.target
`;

export async function runInitAutomation(): Promise<void> {
  const systemdDir = join(homedir(), ".config", "systemd", "user");
  mkdirSync(systemdDir, { recursive: true });

  const svcPath = join(systemdDir, "gruff-ingester.service");
  const timerPath = join(systemdDir, "gruff-ingester.timer");

  writeFileSync(svcPath, SERVICE);
  process.stdout.write(`wrote ${svcPath}\n`);

  writeFileSync(timerPath, TIMER);
  process.stdout.write(`wrote ${timerPath}\n`);

  try {
    execSync("systemctl --user daemon-reload", { stdio: "inherit" });
    execSync("systemctl --user enable --now gruff-ingester.timer", { stdio: "inherit" });
    process.stdout.write("gruff-ingester.timer enabled and started.\n");
    process.stdout.write('Check status: systemctl --user status gruff-ingester.timer\n');
  } catch (e: any) {
    process.stderr.write(`systemd setup failed (non-fatal if not on systemd): ${e.message}\n`);
    process.stdout.write(
      `You can run the ingester manually:\n  node ${INGESTER_BIN} --watch\n`,
    );
  }
}
