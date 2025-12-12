// main.js — auto.tx by didinska (FINAL)
// Premium UI: FIGLET + GRADIENT PASTEL + Daily Stats
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ethers = require('ethers');

// chalk v5 (CommonJS)
const chalk = require('chalk').default;
const figlet = require('figlet');
const gradient = require('gradient-string');

// modules
const sendModule = require('./send');
const deployModule = require('./deploy');
const faucetModule = require('./faucet_rpc');
const stats = require('./data/stats');

// ---------------- helpers ----------------
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a.trim());
  }));
}

async function askNumbered(items, prompt = 'Pilih (nomor):') {
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

// ---------------- banner ----------------
function showBanner() {
  console.clear();

  const banner = figlet.textSync('Auto TX', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });

  console.log(gradient.pastel.multiline(banner));
  console.log(chalk.gray.bold('owner : t.me/didinska\n'));
}

// ---------------- tokens ----------------
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
    t.balanceHuman = 'n/a';
    if (!t.address) continue;
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

// ---------------- MAIN ----------------
async function main() {
  showBanner();

  if (!process.env.RPC_URL) {
    console.log(chalk.red('RPC_URL belum diset di .env'));
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : null;

  const walletAddr = wallet ? await wallet.getAddress() : 'NO_PRIVATE_KEY';

  console.log(chalk.bold('Wallet:'), walletAddr);
  if (process.env.EXPLORER_BASE) {
    console.log(chalk.bold('Explorer:'), process.env.EXPLORER_BASE);
  }

  const tokens = parseTokens();
  await loadBalances(provider, walletAddr, tokens);

  console.log(chalk.gray('Loaded tokens:'));
  tokens.forEach((t, i) => {
    console.log(
      `  ${i + 1}. ${chalk.cyan(t.symbol)}  balance: ${chalk.yellow(t.balanceHuman)}`
    );
  });

  console.log('-------------------------------------------');

  const s = stats.get();
  console.log(
    chalk.magenta(
      ` Quick stats (${today()}): attempts=${s.attempts} success=${s.success} failed=${s.failed} faucet=${s.faucet_claims} deploys=${s.deploys}`
    )
  );

  while (true) {
    console.log('');
    const menu = [
      'Send Address (per token / send all)',
      'Deploy Kontrak (Token / NFT)',
      'Claim Faucet (RPC)',
      'Exit'
    ];

    const sel = await askNumbered(menu, 'Pilih menu:');

    try {
      if (sel === 0) {
        await sendModule.runSendMenu({ provider, wallet, ethers, tokens, stats });
      } else if (sel === 1) {
        await deployModule.runDeployMenu({ provider, wallet, ethers, stats });
      } else if (sel === 2) {
        await faucetModule.runInteractive({ provider, wallet, ethers, stats });
      } else {
        console.log(chalk.green('Bye 👋'));
        process.exit(0);
      }
    } catch (e) {
      console.error(chalk.red('Fatal error:'), e?.message || e);
    }

    await loadBalances(provider, walletAddr, tokens);
    const ns = stats.get();
    console.log(
      chalk.magenta(
        ` Updated stats (${today()}): attempts=${ns.attempts} success=${ns.success} failed=${ns.failed}`
      )
    );
  }
}

// ---------------- run ----------------
if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red('Fatal:'), e?.stack || e);
    process.exit(1);
  });
}

module.exports = { main };
