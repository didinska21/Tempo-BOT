// main.js - unified CLI with premium ASCII pastel banner + daily stats
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk');

const sendModule = require('./send');
const deployModule = require('./deploy');
const faucetRpc = require('./faucet_rpc');
const stats = require('./data/stats');

const BUILD_DIR = path.join(process.cwd(), 'build');
const TOKENS_ENV = process.env.TOKENS || '';

function rlQuestion(q){ const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); return new Promise(res => rl.question(q, a => { rl.close(); res(a); })); }
async function askNumbered(items, prompt='Pilih (masukkan nomor):'){ items.forEach((it,i)=>console.log(`${i+1}. ${it}`)); while(true){ const a = (await rlQuestion(prompt+' ')).trim(); const n=Number(a); if(!Number.isNaN(n) && n>=1 && n<=items.length) return n-1; console.log('Masukkan nomor valid.'); } }

function parseTokensEnv() {
  return TOKENS_ENV.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [sym, addr] = s.split(':').map(x=>x && x.trim());
    return { symbol: sym, address: addr };
  });
}

async function loadTokenBalances(provider, walletAddress, tokens) {
  const abiPath = path.join(BUILD_DIR, 'SimpleERC20.abi.json');
  let abi = null;
  if (fs.existsSync(abiPath)) abi = JSON.parse(fs.readFileSync(abiPath,'utf8'));
  for (const t of tokens) {
    t.balanceHuman = 'n/a';
    if (!t.address || !abi) continue;
    try {
      const c = new ethers.Contract(t.address, abi, provider);
      const dec = await c.decimals();
      const bal = await c.balanceOf(walletAddress);
      t.balanceHuman = ethers.formatUnits(bal, dec);
    } catch (e) {
      t.balanceHuman = 'err';
    }
  }
}

function pastelGradientAscii(textLines) {
  // pastel color cycle (soft)
  const colors = ['#ffd7da','#ffe8b3','#d7f7d2','#d7f0ff','#ecd7ff','#ffd6ea'];
  // map hex -> chalk hex
  return textLines.map((line, idx) => {
    // color by line index
    const color = colors[idx % colors.length];
    return chalk.hex(color)(line);
  }).join('\n');
}

function bannerLines() {
  // simple ASCII art, no box style
  return [
    "    _            _        _   _____    __  ",
    "   / \\   _ __ __| | ___  / | |_   _|__|  \\ ",
    "  / _ \\ | '__/ _` |/ _ \\ | |   | |/ _ \\ |)",
    " / ___ \\| | | (_| |  __/ | |   | |  __/  / ",
    "/_/   \\_\\_|  \\__,_|\\___| |_|   |_|\\___|_/  ",
    "",
    "            auto.tx by didinska",
    "     Send / Deploy / Faucet (RPC) - Premium UI"
  ];
}

function showBanner() {
  const lines = bannerLines();
  console.log(pastelGradientAscii(lines));
  console.log('');
}

function nowDateStr() { return new Date().toISOString().split('T')[0]; }

async function main() {
  console.clear();
  showBanner();

  if (!process.env.RPC_URL) {
    console.log(chalk.red('RPC_URL missing in .env — set it and restart.'));
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, provider) : null;
  const walletAddress = wallet ? await wallet.getAddress() : 'NoKey';

  console.log(chalk.bold('Wallet:'), walletAddress);
  if (process.env.EXPLORER_BASE) console.log(chalk.bold('Explorer:'), process.env.EXPLORER_BASE);
  const tokens = parseTokensEnv();

  await loadTokenBalances(provider, walletAddress, tokens);

  console.log(chalk.gray('Loaded tokens:'));
  tokens.forEach((t,i) => {
    console.log(`  ${i+1}. ${chalk.cyan(t.symbol)} ${t.address ? (' balance: ' + chalk.yellow(t.balanceHuman)) : ''}`);
  });
  console.log('-------------------------------------------');

  const todayStats = stats.get();
  console.log(chalk.magenta(` Quick stats (${nowDateStr()}): attempts=${todayStats.attempts} success=${todayStats.success} failed=${todayStats.failed} faucet_claims=${todayStats.faucet_claims} deploys=${todayStats.deploys}`));
  console.log('1. Send Address (per token / send all)');
  console.log('2. Deploy Kontrak (Token / NFT)');
  console.log('3. Claim Faucet (RPC)');
  console.log('4. Exit');

  while (true) {
    const sel = await askNumbered(['Send Address (per token / send all)','Deploy Kontrak (Token / NFT)','Claim Faucet (RPC)','Exit'], 'Pilih menu (masukkan nomor):');
    if (sel === 3) { console.log('Bye'); process.exit(0); }

    try {
      if (sel === 0) {
        await sendModule.runSendMenu({ provider, wallet, ethers, tokens, stats });
        await loadTokenBalances(provider, walletAddress, tokens);
      } else if (sel === 1) {
        await deployModule.runDeployMenu({ provider, wallet, ethers, stats });
      } else if (sel === 2) {
        await faucetRpc.runInteractive({ provider, wallet, ethers, stats });
      }
    } catch (e) {
      console.error(chalk.red('Fatal error:'), e && e.stack ? e.stack : e);
    }

    console.log('\nReturning to main menu...\n');
  }
}

if (require.main === module) main().catch(e=>{ console.error('Fatal:', e && e.stack ? e.stack : e); process.exit(1); });
module.exports = { main };
