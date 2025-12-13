// main.js (ESM - STABLE v3 FIXED)
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { JsonRpcProvider, Wallet, Contract, formatUnits } from 'ethers';

import { runSendMenu } from './send.js';
import { runDeployMenu } from './deploy.js';
import { runInteractive as runFaucet } from './faucet.js';

const BUILD_DIR = path.resolve('./build');

function clear() {
  console.clear();
}

function banner() {
  console.log(chalk.magenta.bold('==========================================='));
  console.log(chalk.magenta.bold('   auto.tx by didinska'));
  console.log(chalk.magenta.bold('   Send / Deploy / Faucet (RPC) CLI'));
  console.log(chalk.magenta.bold('==========================================='));
}

function parseTokensEnv() {
  const raw = process.env.TOKENS || '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [symbol, address] = s.split(':');
      return { symbol, address };
    });
}

async function loadBalances(provider, walletAddress, tokens) {
  const abiPath = path.join(BUILD_DIR, 'SimpleERC20.abi.json');
  if (!fs.existsSync(abiPath)) return;

  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

  const spinner = ora('Loading token balances...').start();

  for (const t of tokens) {
    try {
      const c = new Contract(t.address, abi, provider);
      const dec = await c.decimals();
      const bal = await c.balanceOf(walletAddress);
      t.balanceHuman = formatUnits(bal, dec);
    } catch (e) {
      t.balanceHuman = 'err';
    }
  }

  spinner.succeed('Balances loaded');
}

async function askMenu() {
  console.log('\n1. Send Address (per token / send all)');
  console.log('2. Deploy Kontrak (Token / NFT)');
  console.log('3. Claim Faucet (RPC)');
  console.log('4. Exit');

  process.stdout.write(chalk.yellow('\nPilih menu: '));

  return new Promise(res => {
    process.stdin.once('data', d => res(Number(d.toString().trim())));
  });
}

async function main() {
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    console.log(chalk.red('RPC_URL / PRIVATE_KEY belum di set di .env'));
    process.exit(1);
  }

  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

  while (true) {
    clear();
    banner();

    const walletAddress = await wallet.getAddress();
    console.log(chalk.cyan('Wallet   :'), walletAddress);
    if (process.env.EXPLORER_BASE) {
      console.log(chalk.cyan('Explorer :'), process.env.EXPLORER_BASE);
    }

    const tokens = parseTokensEnv();
    await loadBalances(provider, walletAddress, tokens);

    console.log(chalk.gray('\nLoaded tokens:'));
    tokens.forEach((t, i) => {
      const bal =
        t.balanceHuman === 'err'
          ? chalk.red('err')
          : chalk.green(t.balanceHuman);
      console.log(
        chalk.gray(` ${i + 1}. ${t.symbol}`),
        chalk.white(' balance:'), bal
      );
    });

    console.log(chalk.gray('-------------------------------------------'));

    const choice = await askMenu();

    if (choice === 1) {
      await runSendMenu({ provider, wallet, tokens });
    } else if (choice === 2) {
      await runDeployMenu({ provider, wallet });
    } else if (choice === 3) {
      await runFaucet();
    } else if (choice === 4) {
      console.log('Bye 👋');
      process.exit(0);
    }
  }
}

main().catch(e => {
  console.error(chalk.red('Fatal:'), e?.stack || e);
  process.exit(1);
});
