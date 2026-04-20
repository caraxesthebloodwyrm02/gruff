/**
 * Read-Only Exploration Routine
 *
 * A safe, read-only exploration utility for workspace analysis.
 * Performs file discovery, pattern matching, and content inspection
 * without any mutations or side effects.
 *
 * Usage:
 *   npx tsx exploration-routine.ts --pattern "*.ts" --search "AnticipationSignal"
 *   npx tsx exploration-routine.ts --mode deep --target ./src
 */

import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

// ── Configuration Types ─────────────────────────────────────────────────────────

export interface ExplorationConfig {
  /** Root directory to explore */
  rootDir: string;
  /** File pattern to match (glob-like) */
  pattern?: string;
  /** Search term to find in files */
  search?: string;
  /** Exploration depth: shallow (files only) or deep (content inspection) */
  mode: "shallow" | "deep";
  /** Paths to exclude */
  exclude?: string[];
  /** Maximum results to return */
  limit?: number;
}

export interface ExplorationResult {
  /** Result identifier */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** Configuration used */
  config: ExplorationConfig;
  /** Files found */
  files: FileResult[];
  /** Search matches (if search term provided) */
  matches?: SearchMatch[];
  /** Statistics */
  stats: ExplorationStats;
}

export interface FileResult {
  /** Relative path from root */
  path: string;
  /** Full absolute path */
  fullPath: string;
  /** File size in bytes */
  size: number;
  /** File type */
  type: "file" | "directory";
  /** Last modified timestamp */
  modified: string;
  /** Content preview (if deep mode) */
  preview?: string;
  /** Line count (if deep mode and text file) */
  lineCount?: number;
}

export interface SearchMatch {
  /** File path where match was found */
  path: string;
  /** Line number */
  line: number;
  /** Line content */
  content: string;
  /** Match context (lines before/after) */
  context?: string[];
}

export interface ExplorationStats {
  /** Total files explored */
  totalFiles: number;
  /** Total directories explored */
  totalDirs: number;
  /** Total bytes read */
  totalBytes: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Files matching pattern */
  patternMatches: number;
  /** Search matches found */
  searchMatches: number;
}

// ── Exploration Engine ─────────────────────────────────────────────────────────

class ExplorationRoutine {
  private config: ExplorationConfig;
  private startTime: number;
  private stats: ExplorationStats;
  private loggedNodeModulesTraversal: boolean;

  constructor(config: ExplorationConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.loggedNodeModulesTraversal = false;
    this.stats = {
      totalFiles: 0,
      totalDirs: 0,
      totalBytes: 0,
      durationMs: 0,
      patternMatches: 0,
      searchMatches: 0,
    };
  }

  /**
   * Execute the exploration and return results.
   */
  explore(): ExplorationResult {
    const root = path.resolve(this.config.rootDir);
    const files = this.scanDirectory(root);
    const matches = this.config.search ? this.searchFiles(files) : undefined;

    this.stats.durationMs = Date.now() - this.startTime;

    return {
      id: `exploration-${Date.now()}`,
      timestamp: new Date().toISOString(),
      config: this.config,
      files,
      matches,
      stats: this.stats,
    };
  }

  /**
   * Recursively scan a directory for files matching the pattern.
   */
  private scanDirectory(dir: string, relativePath: string = ""): FileResult[] {
    const results: FileResult[] = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const relPath = path.join(relativePath, entry);
      const stats = statSync(fullPath);

      // Check exclusion
      if (this.config.exclude?.some(ex => relPath.includes(ex))) {
        continue;
      }

      if (stats.isDirectory()) {
        this.stats.totalDirs++;
        if (!this.loggedNodeModulesTraversal && relPath.includes("node_modules")) {
          this.loggedNodeModulesTraversal = true;
        }
        results.push(...this.scanDirectory(fullPath, relPath));
      } else {
        this.stats.totalFiles++;
        this.stats.totalBytes += stats.size;

        // Pattern matching
        const matchesPattern = this.matchesPattern(relPath);
        if (relPath.includes("node_modules") && matchesPattern) {
        }
        if (matchesPattern) {
          this.stats.patternMatches++;

          const fileResult: FileResult = {
            path: relPath,
            fullPath,
            size: stats.size,
            type: "file",
            modified: stats.mtime.toISOString(),
          };

          // Deep mode: read content
          if (this.config.mode === "deep") {
            try {
              const content = readFileSync(fullPath, "utf-8");
              fileResult.lineCount = content.split("\n").length;
              fileResult.preview = content.slice(0, 500);
            } catch {
              // Binary file or permission issue
              fileResult.preview = "[binary or unreadable]";
            }
          }

          results.push(fileResult);
        }
      }
    }

    return results;
  }

  /**
   * Check if a file path matches the configured pattern.
   */
  private matchesPattern(filePath: string): boolean {
    if (!this.config.pattern) return true;

    try {
      // Convert glob to proper regex with anchoring
      let patternRegex: string;
      if (this.config.pattern.startsWith("*")) {
        // Handle patterns like "*.ts" - match at end only
        patternRegex = "^" + this.config.pattern
          .replace(/\*/g, "[^/\\\\]*")
          .replace(/\?/g, "[^/\\\\]") + "$";
      } else {
        // Handle other patterns
        patternRegex = "^" + this.config.pattern
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".") + "$";
      }
      
      const regex = new RegExp(patternRegex);
      return regex.test(filePath);
    } catch (error) {
      // Fall back to simple string matching for invalid patterns
      return filePath.includes(this.config.pattern.replace(/\*/g, "").replace(/\?/g, ""));
    }
  }

  /**
   * Search files for the configured search term.
   */
  private searchFiles(files: FileResult[]): SearchMatch[] {
    if (!this.config.search) return [];

    const matches: SearchMatch[] = [];
    const limit = this.config.limit ?? 100;

    for (const file of files) {
      if (matches.length >= limit) break;

      try {
        const content = readFileSync(file.fullPath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(this.config.search!)) {
            this.stats.searchMatches++;
            matches.push({
              path: file.path,
              line: i + 1,
              content: lines[i],
              context: [
                lines[Math.max(0, i - 1)],
                lines[i],
                lines[Math.min(lines.length - 1, i + 1)],
              ],
            });
            if (matches.length === limit) {
            }
            if (matches.length > limit) {
            }
            // Enforce limit after each match
            if (matches.length >= limit) break;
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return matches;
  }
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────────

function parseArgs(): ExplorationConfig {
  const args = process.argv.slice(2);
  const config: ExplorationConfig = {
    rootDir: process.cwd(),
    mode: "shallow",
    exclude: ["node_modules", ".git", ".DS_Store", ".env"],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--root":
      case "-r":
        if (!nextArg) {
          throw new Error(`Missing value for ${arg}`);
        }
        config.rootDir = args[++i];
        break;
      case "--pattern":
      case "-p":
        if (!nextArg) {
          throw new Error(`Missing value for ${arg}`);
        }
        config.pattern = args[++i];
        break;
      case "--search":
      case "-s":
        if (!nextArg) {
          throw new Error(`Missing value for ${arg}`);
        }
        config.search = args[++i];
        break;
      case "--mode":
      case "-m":
        if (!nextArg) {
          throw new Error(`Missing value for ${arg}`);
        }
        config.mode = args[++i] as "shallow" | "deep";
        break;
      case "--exclude":
      case "-e":
        config.exclude = nextArg
          ? args[++i].split(",").map(ex => ex.trim()).filter(Boolean)
          : [];
        break;
      case "--limit":
      case "-l":
        if (!nextArg) {
          throw new Error(`Missing value for ${arg}`);
        }
        config.limit = parseInt(args[++i], 10);
        break;
    }
  }

  return config;
}

// ── Main Execution ─────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const config = parseArgs();
    const routine = new ExplorationRoutine(config);
    const result = routine.explore();

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      usage: {
        "--root/-r": "Root directory to explore (default: current directory)",
        "--pattern/-p": "File pattern to match (glob-like)",
        "--search/-s": "Search term to find in files",
        "--mode/-m": "Exploration mode: shallow or deep",
        "--exclude/-e": "Comma-separated paths to exclude",
        "--limit/-l": "Maximum results to return"
      }
    }, null, 2));
    process.exit(1);
  }
}

