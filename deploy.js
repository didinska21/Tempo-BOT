// deploy.js (ethers v6)
// Supports Deploy Token (ERC20) and Deploy NFT (ERC721)
// Submenu: Deploy Manual (input name & symbol) or Deploy Otomatis (random name)
// Token default supply: 1,000,000,000 (decimals 18)
// NFT default initialMintCount: 10,000 (be cautious, minting many in constructor may be expensive)
// Bytecode read from .env TOKEN_BYTECODE/NFT_BYTECODE or build/token_bytecode.txt and build/nft_bytecode.txt
// Optional ABI: build/token_abi.json / build/nft_abi.json
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const EXPLORER_BASE = "https://explore.tempo.xyz";

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

function tlog(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }

function readBytecodeFromEnvOrFile(envKey, filename) {
  const fromEnv = (process.env[envKey] || '').trim();
  if (fromEnv) return fromEnv;
  const filePath = path.join(process.cwd(), 'build', filename);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content;
  }
  return null;
}

function readAbiIfExists(filename) {
  const filePath = path.join(process.cwd(), 'build', filename);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function randomNameSymbol() {
  const name = 'Token-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const sym = Math.random().toString(36).slice(2, 5).toUpperCase();
  return { name, sym };
}

async function deployWithConstructor(provider, wallet, bytecode, abi, constructorArgs, ethers) {
  if (!bytecode || bytecode.length < 10) throw new Error('Bytecode tidak valid / terlalu pendek');

  let usedAbi = abi;
  if (!usedAbi) {
    usedAbi = [
      {
        "inputs": [
          { "internalType": "string", "name": "name_", "type": "string" },
          { "internalType": "string", "name": "symbol_", "type": "string" },
          { "internalType": "uint256", "name": "initialSupply", "type": "uint256" }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
      }
    ];
  }

  const factory = new ethers.ContractFactory(usedAbi, bytecode, wallet);

  tlog('Mempersiapkan deploy kontrak (membuat transaksi deploy)...');
  const deployTx = await factory.getDeployTransaction(...constructorArgs);

  const sent = await wallet.sendTransaction(deployTx);
  tlog('Deploy tx hash:', sent.hash);
  const receipt = await sent.wait(1);
  tlog('Contract deployed at:', receipt.contractAddress || '(no contract address - possibly selfdestruct or CREATE2)');
  tlog('Block:', receipt.blockNumber, 'gasUsed:', String(receipt.gasUsed));

  const gasUsed = receipt.gasUsed ?? 0n;
  const effectiveGasPrice = receipt.effectiveGasPrice ?? deployTx.maxFeePerGas ?? deployTx.gasPrice ?? 0n;
  const txFee = BigInt(gasUsed) * BigInt(effectiveGasPrice || 0n);
  try { tlog('txFee (ETH):', ethers.formatEther(txFee)); } catch (e) { tlog('txFee (wei):', String(txFee)); }

  return { receipt, txHash: sent.hash, contractAddress: receipt.contractAddress };
}

async function runDeployMenu({ provider, wallet, ethers }) {
  while (true) {
    const { action } = await prompt([{
      type: 'list',
      name: 'action',
      message: 'Deploy Kontrak - pilih:',
      choices: [
        { name: 'Deploy Token (ERC20)', value: 'deploy_token' },
        { name: 'Deploy NFT (ERC721)', value: 'deploy_nft' },
        { name: 'Back to Main Menu', value: 'back' }
      ]
    }]);

    if (action === 'back') return;

    if (action === 'deploy_token') {
      const bytecode = readBytecodeFromEnvOrFile('TOKEN_BYTECODE', 'token_bytecode.txt');
      if (!bytecode) {
        console.log('Bytecode token tidak ditemukan. Silakan set TOKEN_BYTECODE di .env atau letakkan file ./build/token_bytecode.txt');
        continue;
      }
      const abi = readAbiIfExists('token_abi.json');

      const { method } = await prompt([{
        type: 'list',
        name: 'method',
        message: 'Deploy Token - pilih mode:',
        choices: [
          { name: 'Deploy Manual (isi nama & symbol)', value: 'manual' },
          { name: 'Deploy Otomatis (nama random)', value: 'auto' },
          { name: 'Back', value: 'back' }
        ]
      }]);
      if (method === 'back') continue;

      let name, symbol;
      if (method === 'manual') {
        const ans = await prompt([
          { type: 'input', name: 'name', message: 'Token name (contoh: MyToken):', validate: v => v && v.trim().length > 0 ? true : 'Isi nama' },
          { type: 'input', name: 'symbol', message: 'Token symbol (contoh: MTK):', validate: v => v && v.trim().length > 0 ? true : 'Isi symbol' }
        ]);
        name = ans.name.trim();
        symbol = ans.symbol.trim();
      } else {
        const rnd = randomNameSymbol();
        name = rnd.name; symbol = rnd.sym;
        console.log('Generated name/symbol:', name, '/', symbol);
      }

      // supply = 1B with 18 decimals
      const supplyHuman = '1000000000'; // 1B
      const decimals = 18;
      const initialSupply = ethers.parseUnits(supplyHuman, decimals);

      tlog(`Deploying token '${name}' (${symbol}) with initialSupply ${supplyHuman} (decimals ${decimals}) ...`);

      try {
        const { receipt, txHash, contractAddress } = await deployWithConstructor(provider, wallet, bytecode, abi, [name, symbol, initialSupply], ethers);
        tlog('DONE:', txHash, 'contract:', contractAddress);
console.log("Explorer TX:", `${EXPLORER_BASE}/tx/${txHash}`);
if (contractAddress) {
  console.log("Explorer Contract:", `${EXPLORER_BASE}/address/${contractAddress}`);
}
      } catch (err) {
        tlog('Error deploy token:', err && err.message ? err.message : err);
      }

    } else if (action === 'deploy_nft') {
      const bytecode = readBytecodeFromEnvOrFile('NFT_BYTECODE', 'nft_bytecode.txt');
      if (!bytecode) {
        console.log('Bytecode NFT tidak ditemukan. Silakan set NFT_BYTECODE di .env atau letakkan file ./build/nft_bytecode.txt');
        continue;
      }
      const abi = readAbiIfExists('nft_abi.json');

      const { method } = await prompt([{
        type: 'list',
        name: 'method',
        message: 'Deploy NFT - pilih mode:',
        choices: [
          { name: 'Deploy Manual (isi nama & symbol)', value: 'manual' },
          { name: 'Deploy Otomatis (nama random)', value: 'auto' },
          { name: 'Back', value: 'back' }
        ]
      }]);
      if (method === 'back') continue;

      let name, symbol;
      if (method === 'manual') {
        const ans = await prompt([
          { type: 'input', name: 'name', message: 'NFT name (contoh: MyNFT):', validate: v => v && v.trim().length > 0 ? true : 'Isi nama' },
          { type: 'input', name: 'symbol', message: 'NFT symbol (contoh: MNFT):', validate: v => v && v.trim().length > 0 ? true : 'Isi symbol' }
        ]);
        name = ans.name.trim(); symbol = ans.symbol.trim();
      } else {
        const rnd = randomNameSymbol(); name = rnd.name; symbol = rnd.sym;
        console.log('Generated name/symbol:', name, '/', symbol);
      }

      // supply NFT default 10k
      const supply = 10000;

      tlog(`Deploying NFT '${name}' (${symbol}) with supply ${supply} ...`);

      try {
        const { receipt, txHash, contractAddress } = await deployWithConstructor(provider, wallet, bytecode, abi, [name, symbol, BigInt(supply)], ethers);
        tlog('DONE:', txHash, 'contract:', contractAddress);
      } catch (err) {
        tlog('Error deploy nft:', err && err.message ? err.message : err);
      }
    }
  }
}

module.exports = { runDeployMenu };
