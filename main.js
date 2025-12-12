// main.js
// Entry point for auto.tx by didinska
// - Ethers v6
// - Loads tokens from .env (TOKENS = "PathUSD:0x...,ThetaUSD:0x...,BetaUSD:0x...,AlphaUSD:0x...")
// - Shows balances (no contract addresses shown)
// - Provides menu: Send Address (per-token / send all), Deploy Kontrak, Exit

require('dotenv').config();
const inquirer = require('inquirer');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

const sendModule = require('./send');
const deployModule = require('./deploy');

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

const BANNER = `
===========================================
   auto.tx by didinska
   Simple CLI: Send / Deploy / Logs tx hash
===========================================
`;

function tlog(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }

function parseTokensFromEnv() {
  // TOKENS format: "PathUSD:0xabc...,ThetaUSD:0xdef...,..."
  const raw = (process.env.TOKENS || '').trim();
  if (!raw) {
    // default tokens (from your project context) if TOKENS not provided
    return [
      { symbol: 'PathUSD', address: '0x20c0000000000000000000000000000000000000' },
      { symbol: 'ThetaUSD', address: '0x20c0000000000000000000000000000000000003' },
      { symbol: 'BetaUSD', address: '0x20c0000000000000000000000000000000000002' },
      { symbol: 'AlphaUSD', address: '0x20c0000000000000000000000000000000000001' }
    ];
  }
  return raw.split(',').map(s => {
    const [sym, addr] = s.split(':').map(x => x && x.trim());
    return { symbol: sym || addr, address: addr || '' };
  }).filter(t => t.address);
}

async function loadTokenBalances(provider, wallet, tokens) {
  const addr = await wallet.getAddress();
  const ABI = ['function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)'];
  for (const t of tokens) {
    try {
      const c = new ethers.Contract(t.address, ABI, provider);
      const dec = await c.decimals();
      const bal = await c.balanceOf(addr);
      t.balanceHuman = ethers.formatUnits(bal, dec);
    } catch (e) {
      t.balanceHuman = 'err';
    }
  }
}

async function main() {
  console.clear();
  console.log(BANNER);

  const RPC = process.env.RPC_URL;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) {
    console.error('Please set RPC_URL and PRIVATE_KEY in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const walletAddr = await wallet.getAddress();
  console.log('Wallet:', walletAddr);

  // parse tokens
  const tokens = parseTokensFromEnv();

  // load token balances (best-effort)
  await loadTokenBalances(provider, wallet, tokens);

  console.log('Loaded tokens:');
  tokens.forEach((t, i) => {
    console.log(`  ${i+1}. ${t.symbol} — balance: ${t.balanceHuman}`);
  });
  console.log('-------------------------------------------');

  // main CLI loop
  while (true) {
    const { mainMenu } = await prompt([{
      type: 'list',
      name: 'mainMenu',
      message: 'Pilih menu:',
      choices: [
        { name: 'Send Address', value: 'send' },
        { name: 'Deploy Kontrak', value: 'deploy' },
        { name: 'Exit', value: 'exit' }
      ]
    }]);

    if (mainMenu === 'exit') {
      console.log('Bye 👋');
      process.exit(0);
    } else if (mainMenu === 'send') {
      await sendModule.runSendMenu({ provider, wallet, tokens, ethers });
      // refresh balances after send
      await loadTokenBalances(provider, wallet, tokens);
      console.log('Updated balances:');
      tokens.forEach((t,i)=> console.log(`  ${i+1}. ${t.symbol} — balance: ${t.balanceHuman}`));
      console.log('-------------------------------------------');
    } else if (mainMenu === 'deploy') {
      await deployModule.runDeployMenu({ provider, wallet, ethers });
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
