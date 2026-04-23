#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { Menu } from "./menu/Menu.js";
import { runActors } from "./commands/actors.js";
import { runRoute } from "./commands/route.js";
import { runInit } from "./commands/init.js";
import { runProportion } from "./commands/proportion.js";
import { runInitAutomation } from "./commands/init-automation.js";

const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "actors": {
    const sqlIdx = args.indexOf("--sql");
    const sql = sqlIdx !== -1 ? args[sqlIdx + 1] : undefined;
    runActors(sql);
    break;
  }
  case "route": {
    const tool = args[1];
    const actor = args[2];
    if (!tool || !actor) {
      process.stderr.write("Usage: gruff route <tool> <actor>\n");
      process.exit(1);
    }
    runRoute(tool, actor);
    break;
  }
  case "init": {
    const outIdx = args.indexOf("--out");
    const out = outIdx !== -1 ? args[outIdx + 1] : ".";
    runInit(out).catch((e) => {
      process.stderr.write(`init failed: ${e}\n`);
      process.exit(1);
    });
    break;
  }
  case "proportion": {
    const fileIdx = args.indexOf("--file");
    const file = fileIdx !== -1 ? args[fileIdx + 1] : undefined;
    runProportion(file).catch((e) => {
      process.stderr.write(`proportion failed: ${e}\n`);
      process.exit(1);
    });
    break;
  }
  case "init-automation": {
    runInitAutomation().catch((e) => {
      process.stderr.write(`init-automation failed: ${e}\n`);
      process.exit(1);
    });
    break;
  }
  case "--version":
  case "-v": {
    const pkg = JSON.parse(
      (await import("node:fs")).readFileSync(
        new URL("../package.json", import.meta.url),
        "utf8",
      ),
    );
    process.stdout.write(`gruff ${pkg.version}\n`);
    break;
  }
  case "--help":
  case "-h":
  case undefined: {
    if (cmd === "--help" || cmd === "-h") {
      process.stdout.write(
        [
          "gruff — workspace cockpit + trust-routing overlay",
          "",
          "  gruff                      4-quadrant menu screen (default)",
          "  gruff actors               leaderboard with tier + score",
          "  gruff actors --sql <q>     run a read-only SELECT against trust.sqlite",
          "  gruff route <tool> <actor> resolve scope tier for this actor",
          "  gruff init [--out <dir>]   drop tokens.css, voice.md, gruff.md into dir",
          "  gruff proportion [--file]  validate + POST to gruff-echoes bridge",
          "  gruff init-automation      install systemd user timer (gruff-ingester)",
          "  gruff --version            show version",
          "",
        ].join("\n"),
      );
      break;
    }
    render(<Menu />);
    break;
  }
  default: {
    process.stderr.write(`unknown command: ${cmd}. Try gruff --help\n`);
    process.exit(1);
  }
}
