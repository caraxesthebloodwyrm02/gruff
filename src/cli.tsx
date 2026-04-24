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
  .action(async (tool, actor) => {
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
  .action(async (payload) => {
    const { sendProportion } = await import('./trust/ingester.js');
    await sendProportion(JSON.parse(payload));
  });

program.parse();
