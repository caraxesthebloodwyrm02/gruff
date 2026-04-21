import yaml from "../CascadeProjects/node_modules/js-yaml/index.js";
import { emitAudit } from "../CascadeProjects/Components/shared-types/dist/audit-client.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function dispatch() {
  const routineName = process.argv[2];
  if (!routineName) {
    console.error("Usage: node scripts/dispatch.js <routine_name>");
    process.exit(1);
  }

  const routinePath = path.resolve(__dirname, "..", "racks", "routines", routineName, "routine.yaml");
  if (!fs.existsSync(routinePath)) {
    console.error(`Routine not found at ${routinePath}`);
    process.exit(1);
  }

  let routine;
  try {
    const content = fs.readFileSync(routinePath, "utf8");
    routine = yaml.load(content);
  } catch (err) {
    console.error(`Failed to parse routine.yaml: ${err.message}`);
    process.exit(1);
  }

  const runId = `run_${Date.now()}`;
  const action = routine.action;

  if (!action) {
    console.error(`Routine '${routineName}' has no action block.`);
    process.exit(1);
  }

  console.log(`[DISPATCH] Starting routine: ${routineName} (ID: ${runId})`);

  // 1. Emit Started
  await emitAudit({
    source: "dispatcher",
    tool: "dispatch",
    status: "started",
    metadata: {
      routine: routineName,
      runId,
      action
    }
  });

  try {
    // 2. Execute Action
    console.log(`[EXECUTE] ${action}`);
    execSync(action, { stdio: "inherit", cwd: path.resolve(__dirname, "..") });

    // 3. Emit Completed
    await emitAudit({
      source: "dispatcher",
      tool: "dispatch",
      status: "completed",
      metadata: {
        routine: routineName,
        runId
      }
    });
    console.log(`[DISPATCH] Routine '${routineName}' completed successfully.`);
  } catch (err) {
    // 4. Emit Failed
    await emitAudit({
      source: "dispatcher",
      tool: "dispatch",
      status: "failed",
      metadata: {
        routine: routineName,
        runId,
        error: err.message
      }
    });
    console.error(`[DISPATCH] Routine '${routineName}' failed: ${err.message}`);
    process.exit(1);
  }
}

dispatch().catch(err => {
  console.error(err);
  process.exit(1);
});
