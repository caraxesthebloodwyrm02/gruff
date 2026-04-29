#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('gruff')
  .description('GRUFF - Local Filesystem Umbrella trust infrastructure')
  .version('1.0.0');

program
  .command('actors')
  .description('List actor profiles and trust scores')
  .action(async () => {
    const { listActors } = await import('./trust/db.js');
    const actors = listActors();
    console.table(actors);
  });

program
  .command('route')
  .description('Route a tool call to the appropriate actor tier')
  .argument('<tool>')
  .argument('<actor>')
  .action(async (tool: string, actor: string) => {
    const { resolveRoutePolicy } = await import('./trust/scorer.js');
    const result = resolveRoutePolicy(tool, actor);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('init')
  .description('Initialize GRUFF trust database')
  .action(async () => {
    const { trustDbPath } = await import('./trust/db.js');
    console.log(`Initialized trust database at ${trustDbPath()}`);
  });

program
  .command('proportion')
  .description('POST gruff-proportion-v1 payload to Echoes bridge')
  .argument('<payload>')
  .action(async (payload: string) => {
    const { sendProportion } = await import('./trust/ingester.js');
    const result = await sendProportion(JSON.parse(payload));
    console.log(`Sent: ${result.status} ${result.statusText}`);
  });

program
  .command('run')
  .description('Execute a routine from racks/routines/')
  .argument('<routine>', 'Routine name (directory under racks/routines/)')
  .option('--dry-run', 'Show dispatch plan without executing')
  .option('--json', 'Output result as JSON')
  .option('--args <json>', 'JSON args for MCP tool dispatches')
  .option('--input <file>', 'Read MCP tool args from JSON file')
  .option('--timeout <ms>', 'Override routine timeout (ms)')
  .action(async (routine: string, opts: { dryRun?: boolean; json?: boolean; args?: string; input?: string; timeout?: string }) => {
    const { runRoutine, formatReport } = await import('./routine-runner.js');
    const { readFileSync } = await import('fs');

    let toolArgs: Record<string, unknown> = {};
    if (opts.input) {
      toolArgs = JSON.parse(readFileSync(opts.input, 'utf-8'));
    }
    if (opts.args) {
      toolArgs = { ...toolArgs, ...JSON.parse(opts.args) };
    }

    const report = await runRoutine(routine, {
      dryRun: opts.dryRun,
      json: opts.json,
      args: toolArgs,
      timeoutMs: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
    });

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatReport(report));
    }

    process.exitCode = report.status === 'pass' || report.status === 'dry-run' ? 0 : 1;
  });

program
  .command('routines')
  .description('List available routines')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const { listRoutines, loadRoutine } = await import('./routine-runner.js');
    const names = listRoutines();
    if (opts.json) {
      const routines = names.map((n) => {
        const r = loadRoutine(n);
        return { name: r.name, status: r.status, trigger: r.trigger, dispatches: r.dispatches.length };
      });
      console.log(JSON.stringify(routines, null, 2));
    } else {
      for (const n of names) {
        const r = loadRoutine(n);
        const d = r.dispatches.length;
        const pad = n.padEnd(24);
        console.log(`  ${pad} ${r.status.padEnd(10)} ${d} dispatch${d !== 1 ? 'es' : ''}  [${r.trigger}]`);
      }
    }
  });

program.parse(process.argv as any);
