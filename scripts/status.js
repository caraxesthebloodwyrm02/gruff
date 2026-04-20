import fs from "node:fs";
import path from "node:path";
import os from "node:os";

async function getStatus() {
  const routineName = process.argv[2];
  if (!routineName) {
    console.error("Usage: node scripts/status.js <routine_name>");
    process.exit(1);
  }

  const auditPath = process.env.ECHOES_AUDIT_PATH || path.resolve(os.homedir(), ".echoes", "audit.ndjson");

  if (!fs.existsSync(auditPath)) {
    console.error(`Audit log not found at ${auditPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(auditPath, "utf8");
  const lines = content.split("\n").filter(line => line.trim() !== "");
  
  // Search backwards for the latest event related to this routine
  let latestEvent = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const event = JSON.parse(lines[i]);
      if (event.source === "dispatcher" && event.metadata?.routine === routineName) {
        // We found an event for this routine. 
        // If it's a "started" event, and there's no subsequent "completed" or "failed", it might still be running.
        // But for this basic system, we just report the very latest entry.
        latestEvent = event;
        break;
      }
    } catch (err) {
      // Skip invalid JSON
    }
  }

  if (!latestEvent) {
    console.log(`No status found for routine '${routineName}'.`);
  } else {
    const timestamp = latestEvent.timestamp;
    const status = latestEvent.status;
    const runId = latestEvent.metadata?.runId;
    const error = latestEvent.metadata?.error;

    console.log(`--- Status: ${routineName} ---`);
    console.log(`Last Event: ${status.toUpperCase()}`);
    console.log(`Timestamp:  ${timestamp}`);
    console.log(`Run ID:     ${runId}`);
    if (error) {
      console.log(`Error:      ${error}`);
    }
    console.log(`--------------------------`);
  }
}

getStatus().catch(err => {
  console.error(err);
  process.exit(1);
});
