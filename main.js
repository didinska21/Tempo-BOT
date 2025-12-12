// main.js — auto.tx by didinska (FINAL)
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ethers = require('ethers');

const chalk = require('chalk').default;
const figlet = require('figlet');
const gradient = require('gradient-string');

const sendModule = require('./send');
const deployModule = require('./deploy');
const faucetModule = require('./faucet_rpc');
const stats = require('./data/stats');

// ---------- helpers ----------
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a.trim());
  }));
}

async function askNumbered(items, prompt = 'Pilih menu:') {
  items.forEach((it, i) => console.log(`${i + 1}. ${it}`));
  while (true) {
    const n = Number(await rlQuestion(prompt + ' '));
    if (!Number.isNaN(n) && n >= 1 && n <= items.length) return n - 1;
    console.log(chalk.red('Nomor tidak valid.'));
  }
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ---------- banner ----------
function showBanner() {
  console.clear();
  const banner = figlet.textSync('S E I S M I C', { font: 'ANSI Shadow' });
  console.log(gradient.pastel.multiline(banner));
  console.log(chalk.gray.bold('owner : t.me/didinska\n'));
}

// ---------- token loader ----------
function parseTokens() {
  return (process.env.TOKENS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [symbol, address] = s.split(':');
      return { symbol, address };
    });
}

async function loadBalances(provider, walletAddr, tokens) {
  const abiPath = path.join(process.cwd(), 'build', 'SimpleERC20.abi.json');
  if (!fs.existsSync(abiPath)) return;
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

  for (const t of tokens) {
    try {
      const c = new ethers.Contract(t.address, abi, provider);
      const dec = await c.decimals();
      const bal = await c.balanceOf(walletAddr);
      t.balanceHuman = ethers.formatUnits(bal, dec);
    } catch {
      t.balanceHuman = 'err';
    }
  }
}

// ---------- MAIN ----------
async function main() {
  showBanner();

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const walletAddr = await wallet.getAddress();

  const tokens = parseTokens();
  await loadBalances(provider, walletAddr, tokens);

  console.log(chalk.bold('Wallet:'), walletAddr);
  console.log(chalk.bold('Explorer:'), process.env.EXPLORER_BASE);
  console.log('Loaded tokens:');
  tokens.forEach((t, i) =>
    console.log(`  ${i + 1}. ${t.symbol}  balance: ${t.balanceHuman}`)
  );

  console.log('-------------------------------------------');
  const s = stats.get();
  console.log(
    chalk.magenta(
      `Quick stats (${today()}): attempts=${s.attempts} success=${s.success} failed=${s.failed}`
    )
  );

  while (true) {
    console.log('');
    const sel = await askNumbered([
      'Send Address (per token / send all)',
      'Deploy Kontrak (Token / NFT)',
      'Claim Faucet (RPC)',
      'Exit'
    ]);

    console.clear();

    if (sel === 0) await sendModule.runSendMenu({ provider, wallet, tokens, stats });
    else if (sel === 1) await deployModule.runDeployMenu({ provider, wallet, stats });
    else if (sel === 2) await faucetModule.runInteractive({ provider, wallet, stats });
    else process.exit(0);

    showBanner();
    await loadBalances(provider, walletAddr, tokens);
  }
}

main().catch(console.error);
