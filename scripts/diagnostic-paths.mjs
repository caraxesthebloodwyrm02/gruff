#!/usr/bin/env node
/**
 * Path Diagnostic Tool
 * Detects stale, broken, or diverged paths in the workspace
 * Includes regex-based bug/mismatch detection
 *
 * HOOKS SYSTEM:
 * - Stage 1 (0-30%): Path diagnostics
 * - Stage 2 (30-65%): Bug pattern scan
 * - Stage 3 (65-80%): Format checks & transformations
 * - Stage 4 (80-100%): Report & exit
 */

import { readdirSync, lstatSync, readlinkSync, existsSync, readFileSync, realpathSync } from 'fs';
import { resolve, join, relative } from 'path';

const SCRIPT_FILE = process.argv[1];
let WORKSPACE_ROOT;

const gruffMatch = SCRIPT_FILE.match(/\/home\/irfankabir\/gruff\/workspace/);
const archDataMatch = SCRIPT_FILE.match(/\/mnt\/arch_data\/home\/caraxes/);

if (gruffMatch) {
  WORKSPACE_ROOT = SCRIPT_FILE.substring(0, gruffMatch.index + '/home/irfankabir/gruff/workspace'.length);
} else if (archDataMatch) {
  WORKSPACE_ROOT = SCRIPT_FILE.substring(0, archDataMatch.index + '/home/caraxes'.length);
} else {
  WORKSPACE_ROOT = process.cwd();
}
const CANONICAL_BASE = '/mnt/arch_data/home/caraxes';

const DIRECTORIES = {
  'CascadeProjects': 'hogsmade monorepo',
  'canopy': 'standalone apps',
  'roots': 'infrastructure libs',
  'grove': 'secondary repos',
  'seed': 'templates & archive'
};

const SCRIPTS_DIRS = [
  'scripts',
  'src',
  'schemas',
  'design',
  'planes',
  'racks',
  'bridges'
];

const BUG_PATTERNS = [
  {
    name: 'hardcoded-workspace-path',
    regex: /(?:\/home\/caraxes|\~\/workspace)\/(?!\.git|gruff)/g,
    severity: 'warning',
    message: 'Hardcoded legacy path ~/workspace detected'
  },
  {
    name: 'hardcoded-arch-data',
    regex: /(?:\/mnt\/arch_data\/home\/caraxes)(?!\/(CascadeProjects|canopy|roots|grove|seed))/g,
    severity: 'info',
    message: 'Hardcoded /mnt/arch_data reference'
  },
  {
    name: 'console-log',
    regex: /console\.(log|debug|info|warn|error)\(/g,
    severity: 'info',
    message: 'Console statement found (dev only)'
  },
  {
    name: 'todo-comment',
    regex: /\/\/\s*TODO|\/\*\s*TODO/g,
    severity: 'info',
    message: 'TODO comment detected'
  },
  {
    name: 'fixme-comment',
    regex: /\/\/\s*FIXME|\/\*\s*FIXME/g,
    severity: 'warning',
    message: 'FIXME comment detected'
  },
  {
    name: 'debug-flag',
    regex: /(?:debug|DEBUG)\s*[=:]\s*(?:true|1|yes)/gi,
    severity: 'warning',
    message: 'Debug flag enabled in source'
  },
  {
    name: 'async-without-await',
    regex: /async\s+(?:function|\([^)]*\)\s*=>)/g,
    severity: 'info',
    message: 'Async function without await pattern'
  },
  {
    name: 'unhandled-rejection',
    regex: /catch\s*\(\s*\)\s*{/g,
    severity: 'warning',
    message: 'Empty catch block (silent failure)'
  },
  {
    name: 'hardcoded-port',
    regex: /(?:port|PORT)\s*[=:]\s*\d{4,5}/g,
    severity: 'info',
    message: 'Hardcoded port number'
  },
  {
    name: 'api-key-placeholder',
    regex: /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi,
    severity: 'critical',
    message: 'Hardcoded API key detected'
  },
  {
    name: 'secret-placeholder',
    regex: /(?:secret|token|password)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    severity: 'critical',
    message: 'Potential hardcoded secret'
  },
  {
    name: 'npm-install-global',
    regex: /npm\s+install\s+-[gG]/g,
    severity: 'warning',
    message: 'Global npm install in script'
  },
  {
    name: 'sudo-usage',
    regex: /sudo\s+/g,
    severity: 'warning',
    message: 'Sudo command detected'
  },
  {
    name: 'broken-symlink-ref',
    regex: /\.\.\/+(?!\.)/g,
    severity: 'info',
    message: 'Relative path reference'
  },
  {
    name: 'missing-error-handling',
    regex: /(?:fetch|await)[^;{}]+;(?!.*catch|.*then.*error)/g,
    severity: 'info',
    message: 'Potential unhandled async error'
  },
  {
    name: 'any-type',
    regex: /:\s*any\b/g,
    severity: 'warning',
    message: 'TypeScript any type used'
  },
  {
    name: 'unsafe-inner-html',
    regex: /innerHTML\s*=/g,
    severity: 'critical',
    message: 'Unsafe innerHTML assignment (XSS risk)'
  },
  {
    name: 'eval-usage',
    regex: /(?<!regex: )\beval\s*\(/g,
    severity: 'critical',
    message: 'eval() usage detected'
  },
  {
    name: 'process-env',
    regex: /process\.env\.[A-Z_]+/g,
    severity: 'info',
    message: 'Process env access'
  },
  {
    name: 'null-coalesce',
    regex: /\?\?\s*null/g,
    severity: 'warning',
    message: 'Nullish coalesce with null'
  }
];

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const FORMAT_SEVERITY = { error: 0, warning: 1, info: 2 };

const SCAN_SELF = ['diagnostic-paths.mjs'];

function checkImportOrder(content, filePath) {
  const results = [];
  const importLines = [];
  const importRegex = /^(?:import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:\{[^}]*\}|\*\s+as\s+\w+|default)\s+from\s+['"]([^'"]+)['"])/gm;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const module = match[1] || match[2];
    importLines.push({ line: match.index, module });
  }

  let prevGroup = '';
  for (let i = 0; i < importLines.length; i++) {
    const curr = importLines[i];
    const currGroup = curr.module.startsWith('.') ? 'relative' : curr.module.startsWith('@') ? 'Scoped' : 'external';

    if (prevGroup && prevGroup !== currGroup) {
      if (prevGroup === 'external' && currGroup === 'relative') {
        results.push({
          file: filePath,
          pattern: 'import-order',
          severity: 'warning',
          message: `Relative import after external: ${curr.module}`,
          line: content.substring(0, curr.line).split('\n').length
        });
      }
    }
    prevGroup = currGroup;
  }

  return results;
}

function extractFunctionMetrics(content, filePath) {
  const results = [];

  const simpleFnRegex = /function\s+(\w+)\s*\(([^)]*)\)/g;
  const arrowFnRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;

  for (const regex of [simpleFnRegex, arrowFnRegex]) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const fnName = match[1] || 'anonymous';
      const params = match[2] || '';
      const paramCount = params ? params.split(',').filter(p => p.trim()).length : 0;
      const hasAsync = match[0].includes('async');

      if (paramCount > 7) {
        results.push({
          file: filePath,
          pattern: 'high-arity',
          severity: 'warning',
          message: `Function ${fnName} has ${paramCount} parameters`,
          columns: paramCount
        });
      }

      if (hasAsync && paramCount > 4) {
        results.push({
          file: filePath,
          pattern: 'async-complex',
          severity: 'info',
          message: `Async function ${fnName} with ${paramCount} params`,
          columns: paramCount
        });
      }
    }
  }

  return results;
}

function checkAttributesAndLabels(content, filePath) {
  const results = [];

  const attrRegex = /(?:interface|type|class|enum)\s+(\w+)[^{]*\{/g;
  let match;
  while ((match = attrRegex.exec(content)) !== null) {
    const name = match[1];
    const block = content.substring(match.index, match.index + 500);
    const propMatches = block.match(/(\w+)(?:\??\s*:\s*[^;]+)?;/g) || [];

    if (propMatches.length > 15) {
      results.push({
        file: filePath,
        pattern: 'large-type',
        severity: 'info',
        message: `Type ${name} has ${propMatches.length} properties`,
        rows: propMatches.length
      });
    }

    for (const prop of propMatches.slice(0, 5)) {
      const propName = prop.match(/^(\w+)/)?.[1];
      if (propName && !propName.startsWith('_') && !prop.match(/^\w+:\s*\w+/)) {
        results.push({
          file: filePath,
          pattern: 'untyped-prop',
          severity: 'info',
          message: `Property ${propName} in ${name} lacks type annotation`,
          rows: 1
        });
      }
    }
  }

  const labelRegex = /(?:\/\/\/?\s*)(@\w+)\s+(.*)/g;
  while ((match = labelRegex.exec(content)) !== null) {
    results.push({
      file: filePath,
      pattern: 'doc-label',
      severity: 'info',
      message: `Label: ${match[1]} - ${match[2].substring(0, 40)}`,
      rows: 1
    });
  }

  return results;
}

function checkProperties(content, filePath) {
  const results = [];

  const propChainRegex = /\.(\w+)\s*\.\s*(\w+)/g;
  let match;
  const chains = new Map();

  while ((match = propChainRegex.exec(content)) !== null) {
    const chain = `${match[1]}.${match[2]}`;
    chains.set(chain, (chains.get(chain) || 0) + 1);
  }

  for (const [chain, count] of chains) {
    if (count > 3) {
      results.push({
        file: filePath,
        pattern: 'deep-chain',
        severity: 'warning',
        message: `Property chain "${chain}" used ${count} times`,
        columns: count
      });
    }
  }

  return results;
}

function checkVerboseProperties(content, filePath) {
  const results = [];

  const getterSet = /\.(\w+)\s*=\s*[^=]/g;
  const setters = new Map();
  let match;
  while ((match = getterSet.exec(content)) !== null) {
    const prop = match[1];
    setters.set(prop, (setters.get(prop) || 0) + 1);
  }

  for (const [prop, count] of setters) {
    if (count > 5) {
      results.push({
        file: filePath,
        pattern: 'verbose-prop',
        severity: 'info',
        message: `Property ${prop} has ${count} references`,
        rows: count
      });
    }
  }

  const objLiteralRegex = /\{([^}]+)\}/g;
  while ((match = objLiteralRegex.exec(content)) !== null) {
    const props = match[1].split(',').filter(p => p.includes(':'));
    if (props.length > 10) {
      results.push({
        file: filePath,
        pattern: 'large-object',
        severity: 'info',
        message: `Object literal with ${props.length} properties`,
        rows: props.length
      });
    }
  }

  return results;
}

function checkAnnotations(content, filePath) {
  const results = [];

  const jsdocRegex = /\/\*\*([\s\S]*?)\*\//g;
  let match;
  let docCount = 0;
  while ((match = jsdocRegex.exec(content)) !== null) {
    docCount++;
    const doc = match[1];
    if (doc.includes('@param') && !doc.includes('{@link')) {
      results.push({
        file: filePath,
        pattern: 'incomplete-jsdoc',
        severity: 'info',
        message: `JSDoc missing @link annotation`,
        rows: 1
      });
    }
  }

  if (docCount > 0) {
    results.push({
      file: filePath,
      pattern: 'jsdoc-coverage',
      severity: 'info',
      message: `${docCount} JSDoc blocks found`,
      rows: docCount
    });
  }

  const tscIgnore = /\/\/\s*@ts-ignore/g;
  while ((match = tscIgnore.exec(content)) !== null) {
    results.push({
      file: filePath,
      pattern: 'ts-ignore',
      severity: 'warning',
      message: '@ts-ignore comment found',
      rows: 1
    });
  }

  return results;
}

function checkExports(content, filePath) {
  const results = [];

  const exportDefault = /export\s+default\s+(\w+)/g;
  const namedExports = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
  const reExports = /export\s+\*\s+from/g;

  let match;
  const exports = { default: 0, named: 0, re: 0 };

  while ((match = exportDefault.exec(content)) !== null) exports.default++;
  while ((match = namedExports.exec(content)) !== null) exports.named++;
  while ((match = reExports.exec(content)) !== null) exports.re++;

  if (exports.default > 1) {
    results.push({
      file: filePath,
      pattern: 'multi-default',
      severity: 'warning',
      message: `${exports.default} default exports (only 1 expected)`,
      rows: exports.default
    });
  }

  if (exports.named === 0 && exports.default === 0 && exports.re === 0) {
    results.push({
      file: filePath,
      pattern: 'no-exports',
      severity: 'info',
      message: 'No exports found',
      rows: 0
    });
  }

  return results;
}

function checkErrorHandling(content, filePath) {
  const results = [];

  const tryCatch = /try\s*\{[\s\S]*?\}\s*catch/g;
  const throwStmt = /throw\s+new\s+(\w+Error)/g;
  const promises = /new\s+Promise/g;

  let match;
  const tryCount = (content.match(tryCatch) || []).length;
  const throwCount = (content.match(throwStmt) || []).length;
  const promiseCount = (content.match(promises) || []).length;

  if (promiseCount > 0 && tryCount === 0) {
    results.push({
      file: filePath,
      pattern: 'unhandled-promise',
      severity: 'warning',
      message: `${promiseCount} Promises without try/catch`,
      rows: promiseCount
    });
  }

  if (throwCount > 5) {
    results.push({
      file: filePath,
      pattern: 'high-throw',
      severity: 'info',
      message: `${throwCount} throw statements`,
      rows: throwCount
    });
  }

  const emptyCatch = /catch\s*\(\w*\)\s*\{\s*\}/g;
  if ((content.match(emptyCatch) || []).length > 0) {
    results.push({
      file: filePath,
      pattern: 'empty-catch',
      severity: 'warning',
      message: 'Empty catch block found',
      rows: 1
    });
  }

  return results;
}

function checkAsyncPatterns(content, filePath) {
  const results = [];

  const thenChain = /\.then\s*\(/g;
  const catchChain = /\.catch\s*\(/g;
  const finallyChain = /\.finally\s*\(/g;

  let match;
  const chains = { then: 0, catch: 0, finally: 0 };

  while ((match = thenChain.exec(content)) !== null) chains.then++;
  while ((match = catchChain.exec(content)) !== null) chains.catch++;
  while ((match = finallyChain.exec(content)) !== null) chains.finally++;

  if (chains.then > 3) {
    results.push({
      file: filePath,
      pattern: 'long-promise-chain',
      severity: 'info',
      message: `${chains.then} .then() chains (consider async/await)`,
      rows: chains.then
    });
  }

  if (chains.then > 0 && chains.catch === 0) {
    results.push({
      file: filePath,
      pattern: 'unhandled-promise-chain',
      severity: 'warning',
      message: 'Promise chain without .catch()',
      rows: 1
    });
  }

  const awaitRegex = /await\s+/g;
  const asyncRegex = /async\s+/g;
  const awaitCount = (content.match(awaitRegex) || []).length;
  const asyncCount = (content.match(asyncRegex) || []).length;

  if (asyncCount > 0 && awaitCount === 0) {
    results.push({
      file: filePath,
      pattern: 'unused-async',
      severity: 'info',
      message: `${asyncCount} async functions without await`,
      rows: asyncCount
    });
  }

  return results;
}

function checkConstants(content, filePath) {
  const results = [];

  const magicNumber = /\b\d{2,}\b/g;
  const hardcodedStrings = /['"][^'"]{30,}['"]/g;
  const urlPattern = /https?:\/\/[^\s'"]+/g;

  let match;
  const magicNumbers = new Set();
  const strings = [];
  const urls = [];

  while ((match = magicNumber.exec(content)) !== null) {
    if (parseInt(match[0]) > 31 && parseInt(match[0]) !== 8000) {
      magicNumbers.add(match[0]);
    }
  }
  while ((match = hardcodedStrings.exec(content)) !== null) strings.push(match[0]);
  while ((match = urlPattern.exec(content)) !== null) urls.push(match[0]);

  if (magicNumbers.size > 3) {
    results.push({
      file: filePath,
      pattern: 'magic-numbers',
      severity: 'warning',
      message: `${magicNumbers.size} magic numbers found`,
      columns: magicNumbers.size
    });
  }

  if (strings.length > 2) {
    results.push({
      file: filePath,
      pattern: 'hardcoded-strings',
      severity: 'info',
      message: `${strings.length} long hardcoded strings`,
      rows: strings.length
    });
  }

  if (urls.length > 0) {
    results.push({
      file: filePath,
      pattern: 'external-urls',
      severity: 'info',
      message: `${urls.length} external URLs`,
      rows: urls.length
    });
  }

  return results;
}

function checkSecurityPatterns(content, filePath) {
  const results = [];

  const sqlInjection = /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+/gi;
  const commandInjection = /exec\s*\(|spawn\s*\(/g;
  const evalUsage = /\beval\s*\(/g;
  const newFunction = /new\s+Function\s*\(/g;

  let match;

  if ((match = sqlInjection.exec(content))) {
    results.push({
      file: filePath,
      pattern: 'sql-risk',
      severity: 'critical',
      message: 'Potential SQL injection risk',
      rows: 1
    });
  }

  if ((match = commandInjection.exec(content))) {
    results.push({
      file: filePath,
      pattern: 'command-injection',
      severity: 'critical',
      message: 'Potential command injection risk',
      rows: 1
    });
  }

  if ((match = evalUsage.exec(content))) {
    results.push({
      file: filePath,
      pattern: 'eval-usage',
      severity: 'critical',
      message: 'eval() detected',
      rows: 1
    });
  }

  if ((match = newFunction.exec(content))) {
    results.push({
      file: filePath,
      pattern: 'new-function',
      severity: 'critical',
      message: 'new Function() detected',
      rows: 1
    });
  }

  return results;
}

function checkPerformance(content, filePath) {
  const results = [];

  const loopNested = /for\s*\([^)]*\)\s*\{[\s\S]*for\s*\(/g;
  const arrayMap = /\.map\s*\([\s\S]*?\{[\s\S]{200,}\}\s*\)/g;

  let match;

  if ((content.match(loopNested) || []).length > 1) {
    results.push({
      file: filePath,
      pattern: 'nested-loop',
      severity: 'warning',
      message: 'Nested loops detected (possible performance issue)',
      rows: 1
    });
  }

  if ((content.match(arrayMap) || []).length > 3) {
    results.push({
      file: filePath,
      pattern: 'excessive-map',
      severity: 'info',
      message: `${(content.match(arrayMap) || []).length} .map() calls`,
      rows: (content.match(arrayMap) || []).length
    });
  }

  return results;
}

function checkTestingPatterns(content, filePath) {
  const results = [];

  const describeBlock = /describe\s*\(/g;
  const itBlock = /it\s*\(/g;
  const testBlock = /test\s*\(/g;
  const expectBlock = /expect\s*\(/g;
  const mockFn = /mock(?:Fn|Implementation)?\(/g;

  let match;
  const hasDescribe = (content.match(describeBlock) || []).length;
  const hasIt = (content.match(itBlock) || []).length;
  const hasTest = (content.match(testBlock) || []).length;
  const hasExpect = (content.match(expectBlock) || []).length;
  const hasMock = (content.match(mockFn) || []).length;

  if (hasDescribe > 0) {
    results.push({
      file: filePath,
      pattern: 'test-suite',
      severity: 'info',
      message: `Test suite: ${hasDescribe} describe blocks`,
      rows: hasDescribe
    });
  }

  if (hasIt > 0 || hasTest > 0) {
    results.push({
      file: filePath,
      pattern: 'test-cases',
      severity: 'info',
      message: `${hasIt + hasTest} test cases`,
      rows: hasIt + hasTest
    });
  }

  if (hasDescribe > 0 && hasExpect === 0) {
    results.push({
      file: filePath,
      pattern: 'incomplete-test',
      severity: 'warning',
      message: 'Test without expect() assertions',
      rows: 1
    });
  }

return results;
}

function runFormatChecks() {
  const results = [];
  const allDirs = [...Object.keys(DIRECTORIES), ...SCRIPTS_DIRS];

  for (const dir of allDirs) {
    const fullPath = join(WORKSPACE_ROOT, dir);
    if (!existsSync(fullPath) || !lstatSync(fullPath).isDirectory()) continue;

    try {
      const files = readdirSync(fullPath, { withFileTypes: true });
      for (const file of files) {
        if (SCAN_SELF.includes(file.name)) continue;
        if (!file.name.endsWith('.mjs') && !file.name.endsWith('.js') && !file.name.endsWith('.ts')) continue;

        const filePath = join(fullPath, file.name);
        try {
          const content = readFileSync(filePath, 'utf-8');

          results.push(...checkImportOrder(content, file.name));
          results.push(...extractFunctionMetrics(content, file.name));
          results.push(...checkAttributesAndLabels(content, file.name));
          results.push(...checkProperties(content, file.name));
          results.push(...checkVerboseProperties(content, file.name));
          results.push(...checkAnnotations(content, file.name));
          results.push(...checkExports(content, file.name));
          results.push(...checkErrorHandling(content, file.name));
          results.push(...checkAsyncPatterns(content, file.name));
          results.push(...checkConstants(content, file.name));
          results.push(...checkSecurityPatterns(content, file.name));
          results.push(...checkPerformance(content, file.name));
          results.push(...checkTestingPatterns(content, file.name));
        } catch (e) {
          // Skip
        }
      }
    } catch (e) {
      // Skip
    }
  }

  return results.sort((a, b) => FORMAT_SEVERITY[a.severity] - FORMAT_SEVERITY[b.severity]);
}

function scanForBugs(dir, extension = '.mjs') {
  const results = [];
  const fullPath = join(WORKSPACE_ROOT, dir);

  if (!existsSync(fullPath) || !lstatSync(fullPath).isDirectory()) return results;

  try {
    const files = readdirSync(fullPath, { withFileTypes: true });
    for (const file of files) {
      if (SCAN_SELF.includes(file.name)) continue;
      if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.mjs') || file.name.endsWith('.ts'))) {
        const filePath = join(fullPath, file.name);
        try {
          const content = readFileSync(filePath, 'utf-8');
          for (const pattern of BUG_PATTERNS) {
            let match;
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
            while ((match = regex.exec(content)) !== null) {
              results.push({
                file: file.name,
                pattern: pattern.name,
                severity: pattern.severity,
                message: pattern.message,
                match: match[0].substring(0, 50)
              });
            }
          }
        } catch (e) {
          // Skip inaccessible files
        }
      }
    }
  } catch (e) {
    // Skip inaccessible directories
  }

  return results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function checkSymlink(path) {
  try {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      const target = readlinkSync(path);
      const resolvedPath = resolve(join(path, '..', target));
      return {
        type: 'symlink',
        target,
        valid: existsSync(target) || existsSync(resolved),
        resolved: existsSync(target) ? target : resolvedPath
      };
    }
    return { type: 'directory' };
  } catch (e) {
    return { type: 'error', error: e.message };
  }
}

function checkPathStaleness(dir) {
  const fullPath = join(WORKSPACE_ROOT, dir);
  const results = { path: dir, checks: [] };

  if (!existsSync(fullPath)) {
    results.checks.push({ status: 'missing', message: 'Path does not exist' });
    return results;
  }

  const symlink = checkSymlink(fullPath);
  if (symlink.type === 'symlink') {
    results.checks.push({
      status: symlink.valid ? 'ok' : 'broken',
      type: 'symlink',
      target: symlink.target,
      resolved: symlink.resolved
    });

    if (symlink.valid && symlink.target.startsWith(CANONICAL_BASE)) {
      results.checks.push({
        status: 'ok',
        type: 'canonical',
        message: `Points to canonical: ${symlink.target.replace(CANONICAL_BASE, '$CANONICAL')}`
      });
    } else if (symlink.valid && !symlink.target.startsWith(CANONICAL_BASE)) {
      results.checks.push({
        status: 'warning',
        type: 'external',
        message: `Points outside canonical base: ${symlink.target}`
      });
    }
  } else {
    results.checks.push({
      status: 'diverged',
      type: 'local',
      message: 'Directory exists without symlink - potential divergence'
    });
  }

  return results;
}

console.log(`🔍 Path Diagnostic Report`);
console.log(`Workspace: ${WORKSPACE_ROOT}`);
console.log(`Canonical: ${CANONICAL_BASE}`);
console.log(`---\n`);

const results = [];

for (const [dir, desc] of Object.entries(DIRECTORIES)) {
  const check = checkPathStaleness(dir);
  const status = check.checks[0]?.status || 'unknown';
  const icon = status === 'ok' ? '✅' : status === 'broken' ? '❌' : status === 'diverged' ? '⚠️' : status === 'warning' ? '⚡' : '❓';

  console.log(`${icon} ${dir} (${desc})`);
  for (const c of check.checks) {
    console.log(`   └── ${c.type}: ${c.message || c.target}`);
  }
  results.push({ dir, status, ...check });
}

console.log(`\n---\nSummary: ${results.filter(r => r.status === 'ok').length}/${results.length} paths healthy`);

const args = process.argv.slice(2);
const ciMode = args.includes('--ci') || args.includes('-c');
const scanBugs = args.includes('--bugs') || args.includes('-b');

if (scanBugs) {
  console.log(`\n🐛 Bug Pattern Scan`);
  console.log(`---\n`);

  const allBugs = [];

  for (const dir of Object.keys(DIRECTORIES)) {
    const bugs = scanForBugs(dir);
    allBugs.push(...bugs);
  }

  for (const dir of SCRIPTS_DIRS) {
    const bugs = scanForBugs(dir);
    allBugs.push(...bugs);
  }

  if (allBugs.length === 0) {
    console.log(`✅ No bug patterns detected`);
  } else {
    const bySeverity = { critical: [], warning: [], info: [] };
    for (const bug of allBugs) {
      bySeverity[bug.severity] = bySeverity[bug.severity] || [];
      bySeverity[bug.severity].push(bug);
    }

    const severityIcon = { critical: '🔴', warning: '⚠️', info: 'ℹ️' };
    for (const severity of ['critical', 'warning', 'info']) {
      if (bySeverity[severity]?.length) {
        console.log(`${severityIcon[severity]} ${severity.toUpperCase()} (${bySeverity[severity].length})`);
        for (const bug of bySeverity[severity].slice(0, 10)) {
          console.log(`   ${bug.file}: ${bug.message}`);
        }
        if (bySeverity[severity].length > 10) {
          console.log(`   ... and ${bySeverity[severity].length - 10} more`);
        }
      }
    }
  }
}

const runFormat = args.includes('--format') || args.includes('-f');

if (runFormat) {
  console.log(`\n📝 Format Checks & Structure`);
  console.log(`Stage 3: Import order, function metrics, attributes, properties`);
  console.log(`---\n`);

  const formatResults = runFormatChecks();

  if (formatResults.length === 0) {
    console.log(`✅ All format checks passed`);
  } else {
    const bySeverity = { error: [], warning: [], info: [] };
    for (const r of formatResults) {
      bySeverity[r.severity] = bySeverity[r.severity] || [];
      bySeverity[r.severity].push(r);
    }

    const severityIcon = { error: '🔴', warning: '⚠️', info: 'ℹ️' };
    const metrics = { columns: 0, rows: 0 };

    for (const severity of ['error', 'warning', 'info']) {
      if (bySeverity[severity]?.length) {
        console.log(`${severityIcon[severity]} ${severity.toUpperCase()} (${bySeverity[severity].length})`);
        for (const r of bySeverity[severity].slice(0, 10)) {
          const colRow = r.columns ? `(cols:${r.columns})` : r.rows ? `(rows:${r.rows})` : '';
          console.log(`   ${r.file}: ${r.message} ${colRow}`);
          if (r.columns) metrics.columns += r.columns;
          if (r.rows) metrics.rows += r.rows;
        }
        if (bySeverity[severity].length > 10) {
          console.log(`   ... and ${bySeverity[severity].length - 10} more`);
        }
      }
    }

    console.log(`\n📊 Metrics:`);
    console.log(`   Columns (params/chains): ${metrics.columns}`);
    console.log(`   Rows (properties/labels): ${metrics.rows}`);
  }
}

if (ciMode) {
  console.log(`\n[CI mode: exiting with success]`);
  process.exit(0);
}

process.exit(results.some(r => r.status === 'broken' || r.status === 'diverged') ? 1 : 0);
