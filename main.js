// main.js - SUPER PREMIUM CLI UI (BOX + COLOR + SPINNER)
require('dotenv').config();
const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk');
const ora = require('ora');

const sendModule = require('./send');
const deployModule = require('./deploy');
const faucet = require('./faucet');

// ================= helpers =================
function rlQuestion(q){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}

async function askNumbered(items, prompt='Pilih (nomor):'){
  items.forEach((it,i)=>{
    console.log(chalk.cyan(`  ${i+1}. ${it}`));
  });
  while(true){
    const a = (await rlQuestion(chalk.yellow(`\n${prompt} `))).trim();
    const n = Number(a);
    if(!Number.isNaN(n) && n>=1 && n<=items.length) return n-1;
    console.log(chalk.red('❌ Masukkan nomor valid.'));
  }
}

// ================= ERC20 ABI =================
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
];

// ================= token helpers =================
function parseTokensEnv() {
  return (process.env.TOKENS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [sym, addr] = s.split(':').map(x => x && x.trim());
      return { symbol: sym, address: addr };
    });
}

async function loadTokenBalances(provider, walletAddress, tokens) {
  for (const t of tokens) {
    t.balanceHuman = 'n/a';
    if (!t.address) continue;
    try {
      const c = new ethers.Contract(t.address, ERC20_ABI, provider);
      const dec = await c.decimals();
      const bal = await c.balanceOf(walletAddress);
      t.balanceHuman = ethers.formatUnits(bal, dec);
    } catch {
      t.balanceHuman = 'err';
    }
  }
}

// ================= UI BOX =================
function boxLine(text = '', width = 43) {
  const pad = width - text.length;
  return chalk.cyan('│ ') + text + ' '.repeat(Math.max(0, pad)) + chalk.cyan(' │');
}

function renderBoxHeader(title) {
  console.log(chalk.cyan('┌' + '─'.repeat(45) + '┐'));
  console.log(
    boxLine(
      chalk.magenta.bold(title),
      43
    )
  );
  console.log(chalk.cyan('├' + '─'.repeat(45) + '┤'));
}

// ================= RENDER MAIN =================
async function renderMainHeader({ provider, walletAddress, tokens }) {
  console.clear();

  renderBoxHeader('AUTO.TX by didinska');

  console.log(
    boxLine(
      chalk.yellow('Wallet : ') + chalk.white(walletAddress),
      43
    )
  );

  if (process.env.EXPLORER_BASE) {
    console.log(
      boxLine(
        chalk.yellow('Explorer: ') + chalk.white(process.env.EXPLORER_BASE),
        43
      )
    );
  }

  console.log(chalk.cyan('├' + '─'.repeat(45) + '┤'));

  const spinner = ora({
    text: 'Loading token balances...',
    spinner: 'dots',
    color: 'cyan'
  }).start();

  await loadTokenBalances(provider, walletAddress, tokens);

  spinner.succeed('Balances loaded');

  tokens.forEach((t,i)=>{
    console.log(
      boxLine(
        chalk.green(`${i+1}. ${t.symbol}`) +
        chalk.gray(' | ') +
        chalk.green.bold(t.balanceHuman),
        43
      )
    );
  });

  console.log(chalk.cyan('└' + '─'.repeat(45) + '┘'));
}

// ================= MAIN =================
async function main() {
  if (!process.env.RPC_URL) {
    console.log(chalk.red('RPC_URL missing in .env'));
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : null;

  const walletAddress = wallet ? await wallet.getAddress() : 'NoKey';
  const tokens = parseTokensEnv();

  while (true) {
    await renderMainHeader({ provider, walletAddress, tokens });

    console.log('\n');
    const sel = await askNumbered(
      [
        'Send Address (per token / send all)',
        'Deploy Kontrak (Token / NFT)',
        'Claim Faucet (RPC)',
        'Exit'
      ],
      'Pilih menu'
    );

    const spinner = ora({ text: 'Processing...', spinner: 'line', color: 'magenta' }).start();

    if (sel === 3) {
      spinner.stop();
      console.log(chalk.green('\n👋 Bye.\n'));
      process.exit(0);
    }

    spinner.stop();

    if (sel === 0) {
      await sendModule.runSendMenu({ provider, wallet, ethers, tokens });
    }

    if (sel === 1) {
      await deployModule.runDeployMenu({ provider, wallet, ethers });
    }

    if (sel === 2) {
      await faucet.runInteractive();
    }

    const backSpinner = ora({ text: 'Returning to main menu...', spinner: 'dots', color: 'cyan' }).start();
    await new Promise(r => setTimeout(r, 800));
    backSpinner.stop();
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(chalk.red('Fatal:'), e && e.stack ? e.stack : e);
    process.exit(1);
  });
}

module.exports = { main };
