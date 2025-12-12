// main.js - full updated file (readline numeric menu, ESM-safe imports, no gas prompts)
// Replace your existing main.js with this file.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer'); // still used by send.js for some prompts
const ethers = require('ethers');
const readline = require('readline');

// ESM-safe requires for CommonJS
const chalkReq = require('chalk');
const chalk = chalkReq && chalkReq.default ? chalkReq.default : chalkReq;

let ora;
try {
  const oraReq = require('ora');
  ora = oraReq && oraReq.default ? oraReq.default : oraReq;
} catch (e) {
  ora = null;
}

let gradient;
try {
  const g = require('gradient-string');
  gradient = g && g.default ? g.default : g;
} catch (e) {
  gradient = null;
}

const sendModule = require('./send');
const deployModule = require('./deploy');

// Data / stats
const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return {};
    const raw = fs.readFileSync(STATS_FILE, 'utf8') || '{}';
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function saveStats(obj) {
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(obj, null, 2), 'utf8'); } catch (e) {}
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function ensureTodayStats() {
  const s = loadStats();
  const k = todayKey();
  if (!s[k]) s[k] = { attempts:0, success:0, failed:0 };
  saveStats(s);
  return s;
}
function incStat(type) {
  const s = loadStats();
  const k = todayKey();
  if (!s[k]) s[k] = { attempts:0, success:0, failed:0 };
  if (type === 'attempt') s[k].attempts++;
  if (type === 'success') s[k].success++;
  if (type === 'failed') s[k].failed++;
  saveStats(s);
}

// parse tokens from .env TOKENS env var (format: SYMBOL:0x... , SYMBOL2:0x..., ...)
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
    const [sym, addr] = s.split(':').map(x => x && x.trim());
    return { symbol: sym || addr, address: addr || '' };
  }).filter(t => t.address);
}

// load token balances (safe)
async function loadTokenBalances(provider, wallet, tokens) {
  const spinner = ora ? ora({ text: 'Loading token balances...', spinner: 'dots' }).start() : null;
  const ABI = ['function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)'];
  try {
    const addr = await wallet.getAddress();
    for (const t of tokens) {
      try {
        const c = new ethers.Contract(t.address, ABI, provider);
        const dec = await c.decimals();
        const bal = await c.balanceOf(addr);
        t.decimals = dec;
        t.balanceRaw = bal;
        t.balanceHuman = ethers.formatUnits(bal, dec);
      } catch (e) {
        t.decimals = null; t.balanceRaw = null; t.balanceHuman = 'err';
      }
    }
    if (spinner) spinner.succeed('Balances loaded');
  } catch (e) {
    if (spinner) spinner.fail('Failed loading balances');
  }
}

// header printing
function printHeader(walletAddr, tokens) {
  console.clear();
  try {
    if (gradient) {
      console.log(gradient(['#4ade80','#60a5fa','#c084fc'])('==========================================='));
      console.log(gradient(['#4ade80','#60a5fa','#c084fc'])('  auto.tx by didinska'));
      console.log(gradient(['#4ade80','#60a5fa','#c084fc'])('==========================================='));
    } else {
      console.log(chalk.cyan('==========================================='));
      console.log(chalk.cyan('  auto.tx by didinska'));
      console.log(chalk.cyan('==========================================='));
    }
  } catch (e) {
    console.log('===========================================');
    console.log('  auto.tx by didinska');
    console.log('===========================================');
  }

  console.log('');
  console.log(chalk.dim('Wallet:') + ' ' + chalk.green(walletAddr));
  console.log(chalk.dim('Explorer:') + ' ' + chalk.cyan(process.env.EXPLORER_BASE || '(not set)'));
  console.log('');
  console.log(chalk.bold('Loaded tokens:'));
  tokens.forEach((t,i) => {
    const bal = (t.balanceHuman && t.balanceHuman !== 'err') ? Number(t.balanceHuman).toLocaleString('en-US') : t.balanceHuman || 'n/a';
    console.log(`  ${chalk.dim(i+1 + '.')} ${chalk.yellow(t.symbol)}  ${chalk.dim('balance:')} ${bal}`);
  });
  console.log(chalk.gray('-------------------------------------------'));
}

// readline numeric menu helper (reliable across envs)
async function askMenuNumber(choices, promptText = 'Pilih menu (masukkan nomor):') {
  for (let i=0;i<choices.length;i++) {
    console.log(`${chalk.dim(String(i+1)+'.')} ${choices[i]}`);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = q => new Promise(res => rl.question(q, ans => res(ans)));

  let idx = -1;
  while (true) {
    const answer = await question(promptText + ' ');
    const n = Number(answer);
    if (!Number.isNaN(n) && n >= 1 && n <= choices.length) { idx = n - 1; break; }
    console.log(chalk.yellow(`Masukkan angka antara 1 dan ${choices.length}`));
  }
  rl.close();
  return idx;
}

// main loop
async function main() {
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    console.error(chalk.red('Please set RPC_URL and PRIVATE_KEY in .env'));
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const tokens = parseTokensFromEnv();

  await loadTokenBalances(provider, wallet, tokens);
  ensureTodayStats();

  while (true) {
    const walletAddr = await wallet.getAddress();
    printHeader(walletAddr, tokens);

    const stats = loadStats();
    const tkey = todayKey();
    const todayStats = stats[tkey] || { attempts:0, success:0, failed:0 };
    console.log(chalk.dim(` Quick stats (${tkey}): attempts=${todayStats.attempts} success=${todayStats.success} failed=${todayStats.failed}`));
    console.log('');

    const mainChoices = ['Send Address (per token / send all)', 'Deploy Kontrak (Token / NFT)', 'Exit'];
    const idx = await askMenuNumber(mainChoices, 'Pilih menu (masukkan nomor):');
    const sel = mainChoices[idx];

    if (sel === 'Exit') {
      console.log(chalk.dim('Bye 👋'));
      process.exit(0);
    } else if (sel === 'Send Address (per token / send all)') {
      await sendModule.runSendMenu({ provider, wallet, tokens, ethers, incStat });
      const spin = ora ? ora('Refreshing balances...').start() : null;
      try { await loadTokenBalances(provider, wallet, tokens); if (spin) spin.succeed('Balances refreshed'); } catch (e) { if (spin) spin.fail('Refresh failed'); }
    } else if (sel === 'Deploy Kontrak (Token / NFT)') {
      // call deploy menu (deploy.js expected to export runDeployMenu)
      if (typeof deployModule.runDeployMenu === 'function') {
        await deployModule.runDeployMenu({ provider, wallet, ethers, incStat });
        const spin = ora ? ora('Refreshing balances...').start() : null;
        try { await loadTokenBalances(provider, wallet, tokens); if (spin) spin.succeed('Balances refreshed'); } catch (e) { if (spin) spin.fail('Refresh failed'); }
      } else {
        console.log(chalk.yellow('Deploy module not implemented.'));
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(err => {
  // final fallback error printing (avoid chalk/oracle crashes)
  try { console.error(chalk.red('Fatal error:'), err && err.stack ? err.stack : err); }
  catch (e) { console.error('Fatal error:', err && err.stack ? err.stack : err); }
  process.exit(1);
});
