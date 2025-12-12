// main.js - UI premium (gradient banner, chalk colors, ora spinner, quick stats)
// Requires: ethers v6, inquirer, dotenv, chalk, ora, gradient-string, cli-progress
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const ethers = require('ethers');

const chalk = require('chalk');
const gradient = require('gradient-string');
const ora = require('ora');

const sendModule = require('./send');
const deployModule = require('./deploy');

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===== utils: stats =====
function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return {};
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) { return {}; }
}
function saveStats(obj) {
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(obj, null, 2)); } catch (e) {}
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

// ===== token loader =====
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

// ===== load balances with ora spinner =====
async function loadTokenBalances(provider, wallet, tokens) {
  const spinner = ora({ text: 'Loading token balances...', spinner: 'dots' }).start();
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
    spinner.succeed('Balances loaded');
  } catch (e) {
    spinner.fail('Failed loading balances');
  }
}

// ===== pretty header with gradient box =====
function printHeader(walletAddr, tokens) {
  console.clear();
  const title = ' auto.tx by didinska ';
  const grad = gradient(['#4ade80', '#60a5fa', '#c084fc']);
  const top = '╔' + '═'.repeat(47) + '╗';
  const bottom = '╚' + '═'.repeat(47) + '╝';
  console.log(chalk.bold(grad(top)));
  console.log(chalk.bold(grad('║') + grad.center ? '' : '') + ' ' + grad.multiline ? '' : ''); // just spacing fallback
  // print gradient title centered
  const padded = title.padStart(Math.floor((47 + title.length)/2)).padEnd(47);
  console.log(chalk.bold(grad('║')) + ' ' + grad(padded) + ' ' + chalk.bold(grad('║')));
  console.log(chalk.bold(grad(bottom)));
  console.log('');
  console.log(chalk.dim('Wallet:') + ' ' + chalk.green(walletAddr));
  console.log(chalk.dim('Explorer:') + ' ' + chalk.cyan(process.env.EXPLORER_BASE || '(not set)'));
  console.log('');
  console.log(chalk.bold('Loaded tokens:'));
  tokens.forEach((t, i) => {
    const bal = t.balanceHuman && t.balanceHuman !== 'err' ? Number(t.balanceHuman).toLocaleString('en-US') : t.balanceHuman || 'n/a';
    console.log(`  ${chalk.dim(i+1 + '.')} ${chalk.yellow(t.symbol)}  ${chalk.dim('balance:')} ${bal}`);
  });
  console.log(chalk.gray('-------------------------------------------'));
}

// fallback gradient printing (safe)
function printFancyHeader(walletAddr, tokens) {
  console.clear();
  console.log(gradient(['#4ade80', '#60a5fa', '#c084fc']).multiline ? '' : '');
  console.log(gradient(['#4ade80', '#60a5fa', '#c084fc'])('==========================================='));
  console.log(gradient(['#4ade80', '#60a5fa', '#c084fc'])('   auto.tx by didinska'));
  console.log(gradient(['#4ade80', '#60a5fa', '#c084fc'])('==========================================='));
  console.log('');
  console.log(chalk.dim('Wallet:') + ' ' + chalk.green(walletAddr));
  console.log(chalk.dim('Explorer:') + ' ' + chalk.cyan(process.env.EXPLORER_BASE || '(not set)'));
  console.log('');
  console.log(chalk.bold('Loaded tokens:'));
  tokens.forEach((t, i) => {
    const bal = t.balanceHuman && t.balanceHuman !== 'err' ? Number(t.balanceHuman).toLocaleString('en-US') : t.balanceHuman || 'n/a';
    console.log(`  ${chalk.dim(i+1 + '.')} ${chalk.yellow(t.symbol)}  ${chalk.dim('balance:')} ${bal}`);
  });
  console.log(chalk.gray('-------------------------------------------'));
}

// ===== main =====
async function main() {
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    console.error(chalk.red('Please set RPC_URL and PRIVATE_KEY in .env'));
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const tokens = parseTokensFromEnv();

  // animated gradient banner (short)
  process.stdout.write(gradient(['#4ade80', '#60a5fa', '#c084fc'])('Starting auto.tx...'));
  await new Promise(r => setTimeout(r, 600));
  process.stdout.write('\r\x1b[K');

  await loadTokenBalances(provider, wallet, tokens);
  ensureTodayStats();

  // main loop
  while (true) {
    const walletAddr = await wallet.getAddress();
    // try fancier header first, fallback if gradient missing
    try { printFancyHeader(walletAddr, tokens); } catch { printHeader(walletAddr, tokens); }

    // quick stats
    const stats = loadStats();
    const tkey = todayKey();
    const todayStats = stats[tkey] || { attempts: 0, success: 0, failed: 0 };
    console.log(chalk.dim(` Quick stats (${tkey}): attempts=${todayStats.attempts} success=${todayStats.success} failed=${todayStats.failed}`));
    console.log('');

    const { mainMenu } = await prompt([{
      type: 'list',
      name: 'mainMenu',
      message: chalk.bold('Pilih menu:'),
      choices: [
        { name: 'Send Address (per token / send all)', value: 'send' },
        { name: 'Deploy Kontrak (Token / NFT)', value: 'deploy' },
        { name: 'Exit', value: 'exit' }
      ]
    }]);

    if (mainMenu === 'exit') {
      console.log(chalk.dim('Bye 👋'));
      process.exit(0);
    }

    if (mainMenu === 'send') {
      // pass incStat callback to update daily stats
      await sendModule.runSendMenu({ provider, wallet, tokens, ethers, incStat });
      const spin = ora('Refreshing balances...').start();
      try { await loadTokenBalances(provider, wallet, tokens); spin.succeed('Balances refreshed'); } catch(e) { spin.fail('Refresh failed'); }
    } else if (mainMenu === 'deploy') {
      await deployModule.runDeployMenu({ provider, wallet, ethers, incStat });
      const spin = ora('Refreshing balances...').start();
      try { await loadTokenBalances(provider, wallet, tokens); spin.succeed('Balances refreshed'); } catch(e) { spin.fail('Refresh failed'); }
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err && err.stack ? err.stack : err);
  process.exit(1);
});
