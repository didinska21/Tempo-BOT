// scripts/compile_all.js (ESM)
import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { fileURLToPath } from 'url';

// ===== path helpers =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const CONTRACTS_DIR = path.join(PROJECT_ROOT, 'contracts');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');

if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// ===== helpers =====
function findSolFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sol'))
    .map(f => path.join(dir, f));
}

function buildSolcInput(files) {
  const sources = {};
  for (const f of files) {
    sources[path.basename(f)] = {
      content: fs.readFileSync(f, 'utf8')
    };
  }
  return {
    language: 'Solidity',
    sources,
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object']
        }
      }
    }
  };
}

// ===== import resolver =====
function importCallback(importPath) {
  try {
    // relative to contracts/
    let candidate = path.join(CONTRACTS_DIR, importPath);
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, 'utf8') };
    }

    // node_modules direct
    candidate = path.join(PROJECT_ROOT, 'node_modules', importPath);
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, 'utf8') };
    }

    // @openzeppelin/*
    if (importPath.startsWith('@')) {
      candidate = path.join(PROJECT_ROOT, 'node_modules', importPath);
      if (fs.existsSync(candidate)) {
        return { contents: fs.readFileSync(candidate, 'utf8') };
      }
    }

    return { error: `File not found: ${importPath}` };
  } catch (e) {
    return { error: e.message };
  }
}

// ===== compile =====
function compile() {
  if (!fs.existsSync(CONTRACTS_DIR)) {
    console.error('❌ contracts/ directory not found');
    process.exit(1);
  }

  const files = findSolFiles(CONTRACTS_DIR);
  if (files.length === 0) {
    console.error('❌ No .sol files found in contracts/');
    process.exit(1);
  }

  console.log('Compiling:', files.map(f => path.basename(f)).join(', '));

  const input = buildSolcInput(files);
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: importCallback })
  );

  if (output.errors) {
    let hasError = false;
    for (const e of output.errors) {
      console.log(`[${e.severity}]`, e.formattedMessage);
      if (e.severity === 'error') hasError = true;
    }
    if (hasError) {
      console.error('❌ Compilation failed');
      process.exit(1);
    }
  }

  for (const source in output.contracts) {
    for (const name in output.contracts[source]) {
      const c = output.contracts[source][name];
      const abiPath = path.join(BUILD_DIR, `${name}.abi.json`);
      const bytePath = path.join(BUILD_DIR, `${name}.bytecode.txt`);

      fs.writeFileSync(abiPath, JSON.stringify(c.abi, null, 2));
      fs.writeFileSync(bytePath, c.evm.bytecode.object);

      console.log('✔ Wrote', path.basename(abiPath), path.basename(bytePath));
    }
  }

  console.log('✅ Compilation complete');
}

compile();
