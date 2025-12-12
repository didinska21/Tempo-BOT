// main.js — upgraded visual UI (colors, spinner, concise)
// Requires: ethers v6, inquirer, dotenv
// Works with existing send.js and deploy.js modules.

require('dotenv').config();
const inquirer = require('inquirer');
const ethers = require('ethers');
const sendModule = require('./send');
const deployModule = require('./deploy');

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

// ANSI colors
const COL = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

function now() { return new Date().toISOString(); }
function pad(s, n=40) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }

// spinner (simple)
function startSpinner(text) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r${frames[i % frames.length]} ${text}`);
    i++;
  }, 80);
  return id;
}
function stopSpinner(id, clear = true) {
  if (id) clearInterval(id);
  if (clear) process.stdout.write('\r\x1b[K');
}

// small helpers
function shortAddr(a) {
  if (!a) return '';
  return a.length > 14 ? a.slice(0,8) + '...' + a.slice(-6) : a;
}
function niceNum(v) {
  try { return Number(v).toLocaleString('en-US'); } catch { return String(v); }
}

// parse tokens from .env (SYMBOL:ADDR,...)
function parseTokensFromEnv() {
  const raw = (process.env.TOKENS || '').trim();
  if (!raw) {
    return [
      { symbol: 'PathUSD', address: '0x20c0000000000000000000000000000000000000' },
      { symbol: 'ThetaUSD', address: '0x20c0000000000000000000000000000000000003' },
      { symbol: 'BetaUSD', address: '0x20c0000000000000000000000000000000000002' },
      { symbol: 'AlphaUSD', address: '0x20c0000000000000000000000000000000000001' }
    ];
  }
  return raw.split(',').map(s => {
    const parts = s.split(':').map(x => x && x.trim());
    return { symbol: parts[0] || parts[1], address: parts[1] || '' };
  }).filter(t => t.address);
}

// load balances with spinner
async function loadTokenBalances(provider, wallet, tokens) {
  const addr = await wallet.getAddress();
  const ABI = ['function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)'];
  const spinner = startSpinner('Loading token balances...');
  try {
    for (const t of tokens) {
      try {
        const c = new ethers.Contract(t.address, ABI, provider);
        const dec = await c.decimals();
        const bal = await c.balanceOf(addr);
        t.decimals = dec;
        t.balanceRaw = bal;
        t.balanceHuman = ethers.formatUnits(bal, dec);
      } catch (e) {
        t.decimals = null;
        t.balanceRaw = null;
        t.balanceHuman = 'err';
      }
    }
  } finally {
    stopSpinner(spinner);
  }
}

// pretty header
function printHeader(walletAddr, tokens) {
  console.clear();
  const BANNER = `
${COL.cyan}${COL.bright}===========================================${COL.reset}
  ${COL.bright}auto.tx by didinska${COL.reset}
  Simple CLI · Send / Deploy · compact logs & explorer links
${COL.cyan}${COL.bright}===========================================${COL.reset}
`;
  console.log(BANNER);
  console.log(`${COL.dim}Wallet:${COL.reset} ${COL.green}${walletAddr}${COL.reset}`);
  console.log(`${COL.dim}Explorer:${COL.reset} ${process.env.EXPLORER_BASE || '(not set)'}\n`);
  console.log(`${COL.bright}Loaded tokens:${COL.reset}`);
  tokens.forEach((t, i) => {
    const bal = (t.balanceHuman && t.balanceHuman !== 'err') ? `${niceNum(t.balanceHuman)}` : t.balanceHuman || 'n/a';
    console.log(`  ${COL.dim}${i+1}. ${COL.reset}${COL.yellow}${t.symbol}${COL.reset}  ${COL.dim}balance:${COL.reset} ${bal}`);
  });
  console.log(`${COL.cyan}-------------------------------------------${COL.reset}`);
}

async function showAbout() {
  console.log('\n' + COL.bright + 'About' + COL.reset);
  console.log('  auto.tx by didinska — simple CLI for token send & contract deploy');
  console.log('  No native-send menu (Tempo testnet behaviour). Only token send & deploy.');
  console.log('');
  await new Promise(r => setTimeout(r, 600));
}

async function main() {
  // check env
  const RPC = process.env.RPC_URL;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) {
    console.error(COL.red + 'Please set RPC_URL and PRIVATE_KEY in .env' + COL.reset);
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  // parse tokens and load balance
  const tokens = parseTokensFromEnv();

  // initial load
  await loadTokenBalances(provider, wallet, tokens);

  // main loop
  while (true) {
    const walletAddr = await wallet.getAddress();
    printHeader(walletAddr, tokens);

    const { mainMenu } = await prompt([{
      type: 'list',
      name: 'mainMenu',
      message: COL.bright + 'Pilih menu:' + COL.reset,
      choices: [
        { name: 'Send Address (per token / send all)', value: 'send' },
        { name: 'Deploy Kontrak (Token / NFT)', value: 'deploy' },
        { name: 'Reload balances', value: 'reload' },
        { name: 'About', value: 'about' },
        { name: 'Exit', value: 'exit' }
      ]
    }]);

    if (mainMenu === 'exit') {
      console.log(COL.dim + 'Bye 👋' + COL.reset);
      process.exit(0);
    } else if (mainMenu === 'send') {
      // call send module
      await sendModule.runSendMenu({ provider, wallet, tokens, ethers });
      // refresh balances after send operations
      const spinner = startSpinner('Refreshing balances...');
      try {
        await loadTokenBalances(provider, wallet, tokens);
      } finally {
        stopSpinner(spinner);
      }
    } else if (mainMenu === 'deploy') {
      await deployModule.runDeployMenu({ provider, wallet, ethers });
      // after deploy maybe token list or balances changed — refresh
      const spinner = startSpinner('Refreshing balances...');
      try {
        await loadTokenBalances(provider, wallet, tokens);
      } finally {
        stopSpinner(spinner);
      }
    } else if (mainMenu === 'reload') {
      const spinner = startSpinner('Reloading balances...');
      try { await loadTokenBalances(provider, wallet, tokens); } finally { stopSpinner(spinner); }
      console.log(COL.green + '[OK]' + COL.reset + ' Balances updated.');
    } else if (mainMenu === 'about') {
      await showAbout();
    }
    // small pause for UX
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(err => {
  console.error(COL.red + 'Fatal error:' + COL.reset, err && err.stack ? err.stack : err);
  process.exit(1);
});
