// main.js — FINAL ESM STABLE VERSION (FIXED)
import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, formatUnits } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';

import { runSendMenu } from './send.js';
import { runDeployMenu } from './deploy.js';
import { runInteractive as runFaucet } from './faucet.js';

// ===== readline helper =====
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a);
  }));
}

async function askNumbered(items, prompt = 'Pilih menu:') {
  items.forEach((it, i) => {
    console.log(chalk.cyan(` ${i + 1}. ${it}`));
  });
  while (true) {
    const a = (await rlQuestion(chalk.yellow(`\n${prompt} `))).trim();
    const n = Number(a);
    if (!Number.isNaN(n) && n >= 1 && n <= items.length) return n - 1;
    console.log(chalk.red('Masukkan nomor valid'));
  }
}

// ===== ERC20 ABI (READ ONLY) =====
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

// ===== tokens =====
function parseTokensEnv() {
  return (process.env.TOKENS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [symbol, address] = s.split(':');
      return { symbol, address };
    });
}

async function loadTokenBalances(provider, address, tokens) {
  for (const t of tokens) {
    t.balance = 'n/a';
    try {
      const c = new Contract(t.address, ERC20_ABI, provider);
      const dec = await c.decimals();
      const bal = await c.balanceOf(address);
      t.balance = formatUnits(bal, dec);
    } catch {
      t.balance = 'err';
    }
  }
}

// ===== UI BOX =====
function line(text = '') {
  return chalk.cyan('│ ') + text.padEnd(43) + chalk.cyan(' │');
}

function renderTop() {
  console.log(chalk.cyan('┌' + '─'.repeat(45) + '┐'));
  console.log(line(chalk.magenta.bold('AUTO.TX by didinska')));
  console.log(chalk.cyan('├' + '─'.repeat(45) + '┤'));
}

// ===== render header =====
async function renderMain({ provider, address, tokens }) {
  console.clear();
  renderTop();

  console.log(line(chalk.yellow('Wallet   : ') + chalk.white(address)));
  if (process.env.EXPLORER_BASE) {
    console.log(line(chalk.yellow('Explorer : ') + chalk.white(process.env.EXPLORER_BASE)));
  }

  console.log(chalk.cyan('├' + '─'.repeat(45) + '┤'));

  const spinner = ora({ text: 'Loading balances...', color: 'cyan' }).start();
  await loadTokenBalances(provider, address, tokens);
  spinner.succeed('Balances loaded');

  tokens.forEach((t, i) => {
    const balColor =
      t.balance === 'err'
        ? chalk.red(t.balance)
        : chalk.green.bold(t.balance);

    console.log(
      line(
        chalk.green(`${i + 1}. ${t.symbol}`) +
        chalk.gray(' | ') +
        balColor
      )
    );
  });

  console.log(chalk.cyan('└' + '─'.repeat(45) + '┘'));
}

// ===== MAIN =====
async function main() {
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    console.log(chalk.red('RPC_URL / PRIVATE_KEY missing in .env'));
    process.exit(1);
  }

  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const address = await wallet.getAddress();

  const tokens = parseTokensEnv();

  while (true) {
    await renderMain({ provider, address, tokens });

    const choice = await askNumbered([
      'Send Address (per token / send all)',
      'Deploy Kontrak (Token / NFT)',
      'Claim Faucet (RPC)',
      'Exit'
    ]);

    if (choice === 3) {
      console.log(chalk.green('\nBye 👋\n'));
      process.exit(0);
    }

    if (choice === 0) {
      await runSendMenu({ provider, wallet, tokens });
    }

    if (choice === 1) {
      await runDeployMenu({ provider, wallet });
    }

    if (choice === 2) {
      await runFaucet();
    }
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal:'), err);
  process.exit(1);
});
