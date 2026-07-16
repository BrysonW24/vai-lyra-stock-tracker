#!/usr/bin/env node
/**
 * Python launcher for the worker npm scripts. macOS (and many Linux distros) ship
 * `python3` with no bare `python`, so `npm run worker:test` used to die with
 * "python: command not found" on a fresh machine. This picks the best interpreter:
 *
 *   1. $VIRTUAL_ENV/bin/python   (an activated venv always wins)
 *   2. .venv/bin/python          (the repo-local venv, if created)
 *   3. python3 on PATH
 *   4. python on PATH            (Windows / CI images that only expose `python`)
 *
 * Usage: node scripts/py.mjs -m pytest tests
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const isWin = process.platform === 'win32';
const venvBin = (root) => join(root, isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

const candidates = [];
if (process.env.VIRTUAL_ENV) candidates.push(venvBin(process.env.VIRTUAL_ENV));
candidates.push(venvBin(join(process.cwd(), '.venv')));

let python = candidates.find((p) => existsSync(p));
if (!python) {
  for (const name of ['python3', 'python']) {
    const probe = spawnSync(name, ['--version'], { stdio: 'ignore' });
    if (!probe.error) {
      python = name;
      break;
    }
  }
}

if (!python) {
  console.error(
    'No Python interpreter found. Install Python 3.11+ (e.g. `brew install python`) or create the repo venv:\n' +
      '  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'
  );
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
