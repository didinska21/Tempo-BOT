// scripts/compile_all.js
// Compile contracts in ./contracts using solc-js and write ABI + bytecode to ./build/<Contract>.abi.json and .bytecode.txt
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const CONTRACTS_DIR = path.join(process.cwd(), 'contracts');
const BUILD_DIR = path.join(process.cwd(), 'build');
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });

function findSolFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.sol')).map(f => path.join(dir,f));
}

// load all sources and build input for solc
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
        '*': { '*': ['abi','evm.bytecode.object'] }
      }
    }
  };
}

async function compile() {
  const files = findSolFiles(CONTRACTS_DIR);
  if (files.length === 0) { console.error('No .sol files in contracts/'); process.exit(1); }
  const input = buildSolcInput(files);
  const inputJSON = JSON.stringify(input);
  const output = JSON.parse(solc.compile(inputJSON));
  if (output.errors) {
    const hasErr = output.errors.some(e => e.severity === 'error');
    output.errors.forEach(e => console.log(e.formattedMessage || e.message));
    if (hasErr) process.exit(1);
  }
  for (const file in output.contracts) {
    for (const contractName in output.contracts[file]) {
      const data = output.contracts[file][contractName];
      const abi = data.abi;
      const bytecode = data.evm.bytecode.object;
      const abiPath = path.join(BUILD_DIR, `${contractName}.abi.json`);
      const bytePath = path.join(BUILD_DIR, `${contractName}.bytecode.txt`);
      fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2), 'utf8');
      fs.writeFileSync(bytePath, bytecode, 'utf8');
      console.log('Wrote', abiPath, bytePath);
    }
  }
}

compile().catch(e => { console.error(e); process.exit(1); });
