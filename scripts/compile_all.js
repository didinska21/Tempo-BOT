// scripts/compile_all.js
// Compile contracts in ./contracts using solc-js and resolve @openzeppelin imports from node_modules
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const CONTRACTS_DIR = path.join(process.cwd(), 'contracts');
const BUILD_DIR = path.join(process.cwd(), 'build');
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });

function findSolFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sol'))
    .map(f => path.join(dir, f));
}

function buildSolcInput(files) {
  const sources = {};
  for (const f of files) {
    sources[path.basename(f)] = { content: fs.readFileSync(f, 'utf8') };
  }
  return {
    language: 'Solidity',
    sources,
    settings: {
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] }
      }
    }
  };
}

// Helper: try to load import path from several locations.
// returns { contents: '...' } on success or { error: '...' } on failure
function importCallback(importPath) {
  try {
    // 1) If importPath is relative (starts with ./ or ../) try relative to contracts dir
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const candidate = path.join(CONTRACTS_DIR, importPath);
      if (fs.existsSync(candidate)) {
        return { contents: fs.readFileSync(candidate, 'utf8') };
      }
    }

    // 2) If absolute filename given but exists in contracts dir
    const candidateInContracts = path.join(CONTRACTS_DIR, importPath);
    if (fs.existsSync(candidateInContracts)) {
      return { contents: fs.readFileSync(candidateInContracts, 'utf8') };
    }

    // 3) If importPath refers to node_modules (e.g. @openzeppelin/...)
    // map it to node_modules/<importPath>
    const nmCandidate = path.join(process.cwd(), 'node_modules', importPath);
    if (fs.existsSync(nmCandidate)) {
      return { contents: fs.readFileSync(nmCandidate, 'utf8') };
    }

    // 4) Special handling: sometimes imports like "@openzeppelin/contracts/token/ERC20/ERC20.sol"
    // Ensure we try to read from node_modules/@openzeppelin/contracts/...
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      // construct path under node_modules
      const nmPath = path.join(process.cwd(), 'node_modules', ...parts);
      if (fs.existsSync(nmPath)) {
        return { contents: fs.readFileSync(nmPath, 'utf8') };
      }
      // try adding .sol if missing
      if (fs.existsSync(nmPath + '.sol')) {
        return { contents: fs.readFileSync(nmPath + '.sol', 'utf8') };
      }
    }

    // 5) If not found, try to resolve common patterns by searching node_modules recursively for the file name
    const filename = path.basename(importPath);
    const nmRoot = path.join(process.cwd(), 'node_modules');
    const found = findFileInDir(nmRoot, filename);
    if (found) {
      return { contents: fs.readFileSync(found, 'utf8') };
    }

    return { error: 'File not found: ' + importPath };
  } catch (e) {
    return { error: 'Import callback error: ' + (e && e.message ? e.message : String(e)) };
  }
}

// utility: search filename under dir (limited depth)
function findFileInDir(dir, filename, maxDepth = 5) {
  try {
    const stack = [{ dir, depth: 0 }];
    while (stack.length) {
      const { dir: cur, depth } = stack.pop();
      if (depth > maxDepth) continue;
      const entries = fs.readdirSync(cur, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(cur, e.name);
        if (e.isFile() && e.name === filename) return full;
        if (e.isDirectory()) stack.push({ dir: full, depth: depth + 1 });
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function compile() {
  const files = findSolFiles(CONTRACTS_DIR);
  if (files.length === 0) { console.error('No .sol files in contracts/'); process.exit(1); }

  const input = buildSolcInput(files);
  const inputJSON = JSON.stringify(input);

  console.log('Compiling', files.map(f => path.basename(f)).join(', '));
  const output = JSON.parse(solc.compile(inputJSON, { import: importCallback }));

  if (output.errors && output.errors.length) {
    // print all messages; keep going but abort on errors
    let hasError = false;
    output.errors.forEach(e => {
      const sig = e.severity ? `[${e.severity}]` : '';
      console.log(sig, e.formattedMessage || e.message || e);
      if (e.severity === 'error') hasError = true;
    });
    if (hasError) {
      console.error('Compilation failed due to errors above.');
      process.exit(1);
    }
  }

  // write artifacts
  for (const source in output.contracts) {
    for (const contractName in output.contracts[source]) {
      const c = output.contracts[source][contractName];
      const abi = c.abi;
      const bytecode = c.evm && c.evm.bytecode && c.evm.bytecode.object ? c.evm.bytecode.object : '';
      const abiPath = path.join(BUILD_DIR, `${contractName}.abi.json`);
      const bytePath = path.join(BUILD_DIR, `${contractName}.bytecode.txt`);
      fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2), 'utf8');
      fs.writeFileSync(bytePath, bytecode, 'utf8');
      console.log('Wrote', abiPath, bytePath);
    }
  }

  console.log('Compilation complete.');
}

compile().catch(e => { console.error('Fatal compile error:', e && e.stack ? e.stack : e); process.exit(1); });
