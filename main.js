// main.js — upgraded UI with animated gradient banner, ASCII box header, quick stats
// Requires: ethers v6, inquirer, dotenv
// Works with existing send.js and deploy.js

require('dotenv').config();
const inquirer = require('inquirer');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

const sendModule = require('./send');
const deployModule = require('./deploy');

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

// paths
const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR); } catch (e) {}
}

// ANSI color helpers for gradient
const ANSI = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  // base color palette - we'll cycle for gradient
  c1: "\x1b[38;5;81m",   // teal
  c2: "\x1b[38;5;123m",  // cyan-magenta
  c3: "\x1b[38;5;201m",  // magenta
  c4: "\x1b[38;5;207m",  // pink
  c5: "\x1b[38;5;220m",  // warm yellow
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m"
};

function now() { return new Date().toISOString(); }

// stats helpers
function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return {};
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}
function saveStats(obj) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }
}
function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
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

// small helpers
function niceNum(v) { try { return Number(v).toLocaleString('en-US'); } catch { return String(v); } }
function shortAddr(a) { if(!a) return ''; return a.length>14 ? a.slice(0,8)+'...'+a.slice(-6) : a; }

// gradient helper: color each char cycling palette
function gradientText(text) {
  const colors = [ANSI.c1, ANSI.c2, ANSI.c3, ANSI.c4, ANSI.c5];
  let out = '';
  for (let i=0;i<text.length;i++) {
    const ch = text[i];
    const col = colors[i % colors.length];
    out += col + ch;
  }
  out += ANSI.reset;
  return out;
}

// animated banner (brief)
async function animatedBanner() {
  const text = 'auto.tx by didinska';
  const frames = [];
  // create 6 frames shifting the gradient
  for (let shift=0; shift<6; shift++) {
    const colors = [ANSI.c1, ANSI.c2, ANSI.c3, ANSI.c4, ANSI.c5];
    let out='';
    for (let i=0;i<text.length;i++) {
      out += colors[(i+shift) % colors.length] + text[i];
    }
    out += ANSI.reset;
    frames.push(out);
  }
  // show frames quickly (non-blocking short)
  for (const f of frames) {
    process.stdout.write('\r' + f);
    await new Promise(r => setTimeout(r, 120));
  }
  process.stdout.write('\r' + ' '.repeat(text.length) + '\r'); // clear
}

// ascii boxed header
function printBoxedHeader(walletAddr, tokens) {
  const title = 'auto.tx CLI';
  const lines = [];
  lines.push('===========================================');
  lines.push(`  ${gradientText('auto.tx by didinska')}`);
  lines.push('  Simple CLI · Token Send & Contract Deploy');
  lines.push('');
  lines.push(`  Wallet: ${walletAddr}`);
  lines.push(`  Explorer: ${process.env.EXPLORER_BASE || '(not set)'}`);
  lines.push('');
  lines.push('  Loaded tokens:');
  tokens.forEach((t,i) => {
    const bal = t.balanceHuman ? niceNum(t.balanceHuman) : 'n/a';
    lines.push(`   ${i+1}. ${t.symbol}  balance: ${bal}`);
  });
  lines.push('===========================================');

  // print with cyan border
  console.log(ANSI.cyan + ANSI.bright);
  for (const l of lines) {
    console.log('  ' + l);
  }
  console.log(ANSI.reset);
}

// load token balances (same logic as before)
async function loadTokenBalances(provider, wallet, tokens) {
  const ABI = ['function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)'];
  const addr = await wallet.getAddress();
  // spinner
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i=0;
  const id = setInterval(()=> {
    process.stdout.write('\r' + frames[i%frames.length] + ' Loading token balances...');
    i++;
  },80);

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
        t.decimals = null; t.balanceRaw = null; t.balanceHuman = 'err';
      }
    }
  } finally {
    clearInterval(id);
    process.stdout.write('\r\x1b[K');
  }
}

// parse tokens from env (same as before)
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

// main
async function main() {
  console.clear();
  const RPC = process.env.RPC_URL;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) {
    console.error(ANSI.red + 'Please set RPC_URL and PRIVATE_KEY in .env' + ANSI.reset);
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const tokens = parseTokensFromEnv();

  // brief animated banner
  await animatedBanner();

  // load balances
  await loadTokenBalances(provider, wallet, tokens);

  // ensure stats file has today
  ensureTodayStats();

  // main loop
  while (true) {
    const walletAddr = await wallet.getAddress();
    console.clear();
    printBoxedHeader(walletAddr, tokens);

    // quick stats today
    const stats = loadStats();
    const today = todayKey();
    const todayStats = stats[today] || { attempts:0, success:0, failed:0 };
    console.log(ANSI.dim + ` Quick stats (${today}): attempts=${todayStats.attempts} success=${todayStats.success} failed=${todayStats.failed}` + ANSI.reset);
    console.log('');

    const { mainMenu } = await prompt([{
      type: 'list',
      name: 'mainMenu',
      message: 'Pilih menu:',
      choices: [
        { name: 'Send Address (per token / send all)', value: 'send' },
        { name: 'Deploy Kontrak (Token / NFT)', value: 'deploy' },
        { name: 'Exit', value: 'exit' }
      ]
    }]);

    if (mainMenu === 'exit') {
      console.log(ANSI.dim + 'Bye 👋' + ANSI.reset);
      process.exit(0);
    } else if (mainMenu === 'send') {
      await sendModule.runSendMenu({ provider, wallet, tokens, ethers, incStat });
      // reload balances after send
      await loadTokenBalances(provider, wallet, tokens);
    } else if (mainMenu === 'deploy') {
      await deployModule.runDeployMenu({ provider, wallet, ethers, incStat });
      await loadTokenBalances(provider, wallet, tokens);
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(err => {
  console.error(ANSI.red + 'Fatal error:' + ANSI.reset, err && err.stack ? err.stack : err);
  process.exit(1);
});
