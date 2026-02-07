// main.js — FINAL ESM STABLE VERSION (FIXED)
import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, formatUnits } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';

import { runSendMenu } from './send.js';
import { runDeployMenu } from './deploy.js';
import { runInteractive as runFaucet } from './faucet.js';

// ===== Load Wallets dari .env =====
function loadWallets(provider) {
  const keys = [];
  
  // Load PRIVATE_KEY_1, PRIVATE_KEY_2, PRIVATE_KEY_3, dst
  for (let i = 1; i <= 100; i++) {
    const key = process.env[`PRIVATE_KEY_${i}`];
    if (key && key.trim().startsWith('0x')) {
      keys.push(key.trim());
    }
  }
  
  if (keys.length === 0) {
    console.log(chalk.red('\n❌ Tidak ada private key di .env'));
    console.log(chalk.yellow('\nFormat yang benar:'));
    console.log(chalk.gray('  PRIVATE_KEY_1=0xYourPrivateKey1'));
    console.log(chalk.gray('  PRIVATE_KEY_2=0xYourPrivateKey2'));
    console.log(chalk.gray('  PRIVATE_KEY_3=0xYourPrivateKey3'));
    console.log(chalk.gray('  ... dst'));
    process.exit(1);
  }

  return keys.map((pk, i) => {
    const wallet = new Wallet(pk, provider);
    return { index: i + 1, wallet, pk, address: wallet.address };
  });
}

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
async function renderMain({ provider, wallets, currentWalletIndex, tokens }) {
  console.clear();
  renderTop();

  const currentWallet = wallets[currentWalletIndex];
  const address = currentWallet.address;

  console.log(line(chalk.yellow('Wallets  : ') + chalk.white(`${wallets.length} wallet(s) loaded`)));
  console.log(line(chalk.yellow('Active   : ') + chalk.green(`#${currentWallet.index} `) + chalk.white(address)));
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
  if (!process.env.RPC_URL) {
    console.log(chalk.red('RPC_URL missing in .env'));
    process.exit(1);
  }

  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallets = loadWallets(provider);
  const tokens = parseTokensEnv();

  console.log(chalk.green(`\n✓ Loaded ${wallets.length} wallet(s)`));
  console.log(chalk.green(`✓ Loaded ${tokens.length} token(s)`));
  console.log(chalk.gray('Press Ctrl+C to exit\n'));
  
  await new Promise(r => setTimeout(r, 1500));

  let currentWalletIndex = 0; // Index wallet yang sedang aktif

  while (true) {
    await renderMain({ provider, wallets, currentWalletIndex, tokens });

    const currentWallet = wallets[currentWalletIndex];

    const menuItems = [
      'Send Address (per token / send all)',
      'Deploy Kontrak (Token / NFT)',
      'Claim Faucet (RPC)',
      '─────────────────────────────',
      `Switch Wallet (Current: #${currentWallet.index})`,
      'Exit'
    ];

    const choice = await askNumbered(menuItems);

    // Exit
    if (choice === 5) {
      console.log(chalk.green('\nBye 👋\n'));
      process.exit(0);
    }

    // Switch Wallet
    if (choice === 4) {
      console.log(chalk.cyan('\n═══ SELECT WALLET ═══'));
      const walletMenu = wallets.map((w, i) => 
        `#${w.index} - ${w.address.slice(0, 10)}...${w.address.slice(-8)}${i === currentWalletIndex ? chalk.green(' (active)') : ''}`
      );
      walletMenu.push('Back');
      
      const walletChoice = await askNumbered(walletMenu, 'Pilih wallet:');
      
      if (walletChoice < wallets.length) {
        currentWalletIndex = walletChoice;
        console.log(chalk.green(`\n✓ Switched to wallet #${wallets[currentWalletIndex].index}`));
        await new Promise(r => setTimeout(r, 1000));
      }
      continue;
    }

    // Send Token
    if (choice === 0) {
      await runSendMenu({ 
        provider, 
        wallet: currentWallet.wallet, 
        tokens 
      });
    }

    // Deploy Contract
    if (choice === 1) {
      await runDeployMenu({ 
        provider, 
        wallet: currentWallet.wallet 
      });
    }

    // Claim Faucet
    if (choice === 2) {
      await runFaucet(currentWallet.wallet, provider);
    }
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal:'), err);
  process.exit(1);
});
