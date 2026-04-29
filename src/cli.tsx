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
  .option('--json', 'Output as JSON array')
  .action(async (opts: { json?: boolean }) => {
    const { listActors } = await import('./trust/db.js');
    const actors = listActors();
    if (opts.json) {
      console.log(JSON.stringify(actors, null, 2));
    } else {
      console.table(actors);
    }
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

program
  .command('snapshot')
  .description('Generate a detailed snapshot of all gruff state (events, sessions, tool calls)')
  .option('--output <path>', 'Write JSON to file (omit for terminal-only view)')
  .option('--json', 'Raw JSON to stdout (no formatting)')
  .option('--limit <n>', 'Max recent events per actor', '20')
  .action(async (opts: { output?: string; json?: boolean; limit?: string }) => {
    const { listActors, trustDbPath, getDb, queryRaw } = await import('./trust/db.js');
    const { resolveRoutePolicy } = await import('./trust/scorer.js');
    const { listRoutines, loadRoutine, runRoutine } = await import('./routine-runner.js');
    const { writeFileSync, mkdirSync } = await import('fs');
    const { dirname } = await import('path');

    const evtLimit = parseInt(opts.limit ?? '20', 10);
    const ts = new Date().toISOString();
    const db = getDb();
    const actors = listActors(200);

    // ── Events: global summary + per-actor detail ──
    const totalEvents = (db.prepare('SELECT count(*) as c FROM events').get() as any).c;
    const statusBreakdown = db.prepare('SELECT status, count(*) as count FROM events GROUP BY status ORDER BY count DESC').all() as { status: string; count: number }[];
    const toolBreakdown = db.prepare('SELECT tool, count(*) as count, sum(CASE WHEN status = \'success\' THEN 1 ELSE 0 END) as ok, sum(CASE WHEN status = \'failure\' THEN 1 ELSE 0 END) as fail, round(avg(duration_ms), 1) as avg_ms FROM events GROUP BY tool ORDER BY count DESC').all() as { tool: string; count: number; ok: number; fail: number; avg_ms: number | null }[];
    const sourceBreakdown = db.prepare('SELECT source, count(*) as count FROM events GROUP BY source ORDER BY count DESC').all() as { source: string; count: number }[];
    const recentEvents = db.prepare('SELECT id, ts, source, tool, actor, status, duration_ms, payload_json FROM events ORDER BY ts DESC LIMIT ?').all(50) as any[];

    // Per-actor event timeline (top actors by event count)
    const actorTimelines: Record<string, unknown[]> = {};
    for (const actor of actors.slice(0, 15)) {
      const events = db.prepare('SELECT id, ts, tool, status, duration_ms, payload_json FROM events WHERE actor = ? ORDER BY ts DESC LIMIT ?').all(actor.actor, evtLimit) as any[];
      if (events.length > 0) actorTimelines[actor.actor] = events;
    }

    // ── Sessions ──
    const totalSessions = (db.prepare('SELECT count(*) as c FROM actor_sessions').get() as any).c;
    const activeSessions = db.prepare('SELECT * FROM actor_sessions WHERE active = 1 ORDER BY last_seen DESC').all() as any[];
    const recentClosed = db.prepare('SELECT * FROM actor_sessions WHERE active = 0 ORDER BY closed_at DESC LIMIT 20').all() as any[];

    // ── Routing decisions ──
    const routingDecisions = db.prepare('SELECT * FROM routing_decisions ORDER BY decided_at DESC LIMIT 20').all() as any[];

    // ── Route policy samples ──
    const sampleActors = ['echoes-server', 'grid-server-merit-guard', 'overview-server', 'eligibility-server', 'pulse-server'];
    const routeSamples = sampleActors.map(a => {
      try { return resolveRoutePolicy('record_audit', a); }
      catch { return { actor: a, error: 'not found' }; }
    });

    // ── Routines + dry-runs ──
    const routineNames = listRoutines();
    const routineInventory = routineNames.map(n => {
      const r = loadRoutine(n);
      return { name: r.name, status: r.status, trigger: r.trigger, timeout: r.timeout, dispatches: r.dispatches.length, produces: r.produces };
    });
    const dryRuns: Record<string, unknown> = {};
    for (const n of routineNames) {
      dryRuns[n] = await runRoutine(n, { dryRun: true });
    }

    const master = {
      snapshotVersion: 'gruff-snapshot-v2',
      generatedAt: ts,
      gruffVersion: '1.0.0',
      trustDb: { path: trustDbPath(), actorCount: actors.length, actors },
      events: {
        total: totalEvents,
        statusBreakdown,
        toolBreakdown,
        sourceBreakdown,
        recent: recentEvents,
        actorTimelines,
      },
      sessions: {
        total: totalSessions,
        active: activeSessions,
        recentClosed,
      },
      routingDecisions,
      routeSamples,
      routines: {
        total: routineInventory.length,
        active: routineInventory.filter(r => r.status === 'active').length,
        draft: routineInventory.filter(r => r.status === 'draft').length,
        completed: routineInventory.filter(r => r.status === 'completed').length,
        inventory: routineInventory,
      },
      dryRuns,
    };

    // ── Write to file if requested ──
    if (opts.output) {
      mkdirSync(dirname(opts.output), { recursive: true });
      writeFileSync(opts.output, JSON.stringify(master, null, 2));
    }

    // ── Output ──
    if (opts.json) {
      console.log(JSON.stringify(master, null, 2));
      return;
    }

    // ── Human-readable terminal view ──
    const B = '\x1b[1m', D = '\x1b[2m', R = '\x1b[0m';
    const G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m', RED = '\x1b[31m', M = '\x1b[35m';
    const line = (ch = '─', len = 72) => D + ch.repeat(len) + R;
    const heading = (s: string) => `\n${B}${C}  ${s}${R}\n${line()}`;

    console.log(`\n${B}${M}  GRUFF SNAPSHOT${R}  ${D}${ts}${R}`);
    console.log(line('═'));

    // Trust DB summary
    console.log(heading('TRUST DATABASE'));
    console.log(`  ${D}Path:${R}   ${trustDbPath()}`);
    console.log(`  ${D}Actors:${R} ${actors.length}   ${D}Events:${R} ${totalEvents}   ${D}Sessions:${R} ${totalSessions}`);

    // Actor scoreboard
    console.log(heading('ACTOR SCOREBOARD'));
    console.log(`  ${D}${'Actor'.padEnd(38)} Score  Tier      Events  Err${R}`);
    console.log(`  ${D}${'─'.repeat(38)} ─────  ────────  ──────  ───${R}`);
    for (const a of actors.slice(0, 20)) {
      const tierColor = a.tier === 'school' ? G : a.tier === 'practice' ? Y : RED;
      const errStr = a.err_count > 0 ? `${RED}${String(a.err_count).padStart(3)}${R}` : `${D}  0${R}`;
      console.log(`  ${a.actor.padEnd(38)} ${String(a.score).padStart(5)}  ${tierColor}${a.tier.padEnd(8)}${R}  ${String(a.event_count).padStart(6)}  ${errStr}`);
    }
    if (actors.length > 20) console.log(`  ${D}... and ${actors.length - 20} more${R}`);

    // Status breakdown
    console.log(heading('EVENT STATUS BREAKDOWN'));
    for (const s of statusBreakdown) {
      const pct = ((s.count / totalEvents) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round((s.count / totalEvents) * 40));
      const color = s.status === 'success' ? G : s.status === 'failure' ? RED : s.status === 'blocked' ? Y : D;
      console.log(`  ${s.status.padEnd(18)} ${String(s.count).padStart(5)}  ${D}(${pct}%)${R}  ${color}${bar}${R}`);
    }

    // Tool call breakdown
    console.log(heading('TOOL CALL BREAKDOWN'));
    console.log(`  ${D}${'Tool'.padEnd(32)} Calls   OK  Fail  Avg ms${R}`);
    console.log(`  ${D}${'─'.repeat(32)} ─────  ───  ────  ──────${R}`);
    for (const t of toolBreakdown) {
      const failStr = t.fail > 0 ? `${RED}${String(t.fail).padStart(4)}${R}` : `${D}   0${R}`;
      const avgStr = t.avg_ms != null ? String(t.avg_ms).padStart(6) : `${D}     -${R}`;
      console.log(`  ${t.tool.padEnd(32)} ${String(t.count).padStart(5)}  ${String(t.ok).padStart(3)}  ${failStr}  ${avgStr}`);
    }

    // Source breakdown
    console.log(heading('EVENT SOURCES'));
    for (const s of sourceBreakdown) {
      console.log(`  ${s.source.padEnd(32)} ${String(s.count).padStart(5)}`);
    }

    // Recent events timeline
    console.log(heading('RECENT EVENTS (last 20)'));
    console.log(`  ${D}${'Time'.padEnd(22)} ${'Source'.padEnd(18)} ${'Tool'.padEnd(22)} ${'Actor'.padEnd(20)} Status${R}`);
    console.log(`  ${D}${'─'.repeat(22)} ${'─'.repeat(18)} ${'─'.repeat(22)} ${'─'.repeat(20)} ──────${R}`);
    for (const e of recentEvents.slice(0, 20)) {
      const time = e.ts.replace('T', ' ').replace(/\.\d+Z$/, '');
      const statusColor = e.status === 'success' ? G : e.status === 'failure' ? RED : e.status === 'blocked' ? Y : R;
      console.log(`  ${time.padEnd(22)} ${(e.source || '').padEnd(18)} ${(e.tool || '').padEnd(22)} ${(e.actor || '').padEnd(20)} ${statusColor}${e.status}${R}`);
    }

    // Per-actor timelines (top 5 with most events)
    const topActors = Object.entries(actorTimelines)
      .sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length)
      .slice(0, 5);
    if (topActors.length > 0) {
      console.log(heading('PER-ACTOR EVENT DETAIL (top 5)'));
      for (const [actor, events] of topActors) {
        const evts = events as any[];
        console.log(`\n  ${B}${actor}${R} ${D}(${evts.length} recent)${R}`);
        for (const e of evts.slice(0, 8)) {
          const time = e.ts.replace('T', ' ').replace(/\.\d+Z$/, '');
          const dur = e.duration_ms != null ? ` ${D}${e.duration_ms}ms${R}` : '';
          const statusColor = e.status === 'success' ? G : e.status === 'failure' ? RED : D;
          let payload = '';
          if (e.payload_json) {
            try {
              const p = JSON.parse(e.payload_json);
              const keys = Object.keys(p).filter(k => k !== 'entity_id' && k !== 'server_id' && k !== 'actor');
              if (keys.length > 0) payload = ` ${D}${keys.map(k => `${k}=${typeof p[k] === 'string' ? p[k] : JSON.stringify(p[k])}`).join(', ')}${R}`;
            } catch {}
          }
          console.log(`    ${D}${time}${R}  ${(e.tool || '').padEnd(22)} ${statusColor}${e.status.padEnd(10)}${R}${dur}${payload}`);
        }
        if (evts.length > 8) console.log(`    ${D}... ${evts.length - 8} more${R}`);
      }
    }

    // Sessions
    if (activeSessions.length > 0) {
      console.log(heading('ACTIVE SESSIONS'));
      for (const s of activeSessions) {
        console.log(`  ${G}●${R} ${B}${s.actor}${R}  ${D}sid=${s.session_id}${R}  turns=${s.turn_count}  ok=${s.ok_count}  err=${s.err_count > 0 ? RED + s.err_count + R : '0'}  ${D}since ${s.started_at.replace('T', ' ').replace(/\.\d+Z$/, '')}${R}`);
      }
    }
    if (recentClosed.length > 0) {
      console.log(heading('RECENT CLOSED SESSIONS'));
      for (const s of recentClosed.slice(0, 10)) {
        const reasonColor = s.exit_reason === 'completed' ? G : s.exit_reason === 'timeout' ? Y : RED;
        console.log(`  ${D}○${R} ${s.actor.padEnd(28)} ${reasonColor}${(s.exit_reason || 'unknown').padEnd(12)}${R} turns=${s.turn_count}  ok=${s.ok_count}  err=${s.err_count}  ${D}${(s.closed_at || '').replace('T', ' ').replace(/\.\d+Z$/, '')}${R}`);
      }
    }

    // Routing decisions
    if (routingDecisions.length > 0) {
      console.log(heading('ROUTING DECISIONS'));
      for (const rd of routingDecisions.slice(0, 10)) {
        let notes = '';
        if (rd.notes_json) {
          try {
            const n = JSON.parse(rd.notes_json);
            notes = ` ${D}chain=${n.chain || '-'}  maxTier=${n.maxTier || '-'}  score=${n.score ?? '-'}${R}`;
          } catch {}
        }
        const tierColor = rd.tier === 'school' ? G : rd.tier === 'practice' ? Y : RED;
        console.log(`  ${rd.actor.padEnd(24)} ${(rd.tool || '').padEnd(16)} ${tierColor}${rd.tier.padEnd(10)}${R} ${D}${rd.reason_code}${R}${notes}`);
      }
    }

    // Routines
    console.log(heading('ROUTINES'));
    for (const r of routineInventory) {
      const statusColor = r.status === 'active' ? G : r.status === 'draft' ? Y : D;
      console.log(`  ${r.name.padEnd(24)} ${statusColor}${r.status.padEnd(10)}${R} ${r.dispatches} dispatch${r.dispatches !== 1 ? 'es' : ''}  ${D}[${r.trigger}]${R}`);
    }

    // Dry-run results
    console.log(heading('DRY-RUN RESULTS'));
    for (const [name, dr] of Object.entries(dryRuns)) {
      const d = dr as any;
      const ok = d.status === 'dry-run';
      const dispatches = (d.dispatches || []) as any[];
      console.log(`  ${ok ? G + '✓' : RED + '✗'}${R} ${name.padEnd(24)} ${D}${dispatches.length} dispatch${dispatches.length !== 1 ? 'es' : ''}${R}`);
      for (const step of dispatches) {
        console.log(`    ${D}→ ${step.type}${R}  ${step.name || ''}  ${D}${step.status}${R}`);
      }
    }

    console.log(line('═'));
    const fileNote = opts.output ? ` | file: ${opts.output}` : '';
    console.log(`${D}  gruff-snapshot-v2 | ${actors.length} actors | ${totalEvents} events | ${totalSessions} sessions | ${routineInventory.length} routines${fileNote}${R}\n`);
  });

program.parse(process.argv as any);
