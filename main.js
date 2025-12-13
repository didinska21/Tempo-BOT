// main.js - unified CLI (FINAL UI PREMIUM)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk').default;
const ora = require('ora');

const sendModule = require('./send');
const deployModule = require('./deploy');
const faucet = require('./faucet');

const BUILD_DIR = path.join(process.cwd(), 'build');
const TOKENS_ENV = process.env.TOKENS || '';

function rlQuestion(q){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim()); }));
}
async function askNumbered(items, prompt='Pilih (nomor):'){
  items.forEach((it,i)=>console.log(chalk.cyan(`${i+1}. ${it}`)));
  while(true){
    const a = await rlQuestion(prompt+' ');
    const n = Number(a);
    if(!Number.isNaN(n) && n>=1 && n<=items.length) return n-1;
    console.log(chalk.red('Masukkan nomor valid.'));
  }
}

function parseTokensEnv() {
  return TOKENS_ENV.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [sym, addr] = s.split(':').map(x=>x && x.trim());
      return { symbol: sym, address: addr };
    });
}

async function loadTokenBalances(provider, walletAddress, tokens) {
  const abiPath = path.join(BUILD_DIR, 'SimpleERC20.abi.json');
  if (!fs.existsSync(abiPath)) return;
  const abi = JSON.parse(fs.readFileSync(abiPath,'utf8'));

  const spin = ora('Loading token balances...').start();
  for (const t of tokens) {
    t.balanceHuman = 'n/a';
    if (!t.address) continue;
    try {
      const c = new ethers.Contract(t.address, abi, provider);
      const dec = await c.decimals();
      const bal = await c.balanceOf(walletAddress);
      t.balanceHuman = ethers.formatUnits(bal, dec);
    } catch {
      t.balanceHuman = 'err';
    }
  }
  spin.succeed('Balances loaded');
}

function banner(){
  console.log(chalk.magenta.bold('==========================================='));
  console.log(chalk.cyan.bold('   auto.tx by didinska'));
  console.log(chalk.gray('   Send / Deploy / Faucet (RPC) CLI'));
  console.log(chalk.magenta.bold('==========================================='));
}

async function main(){
  banner();

  if (!process.env.RPC_URL) {
    console.log(chalk.red('RPC_URL missing in .env'));
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : null;

  const walletAddress = wallet ? await wallet.getAddress() : 'NoKey';
  console.log(chalk.green('Wallet   :'), walletAddress);
  if (process.env.EXPLORER_BASE)
    console.log(chalk.green('Explorer :'), process.env.EXPLORER_BASE);

  const tokens = parseTokensEnv();
  await loadTokenBalances(provider, walletAddress, tokens);

  console.log(chalk.yellow('\nLoaded tokens:'));
  tokens.forEach((t,i)=>{
    console.log(
      chalk.white(` ${i+1}. ${t.symbol}`) +
      chalk.gray(`  balance: ${t.balanceHuman}`)
    );
  });

  console.log(chalk.magenta('-------------------------------------------'));

  while(true){
    const sel = await askNumbered(
      ['Send Address (per token / send all)','Deploy Kontrak (Token / NFT)','Claim Faucet (RPC)','Exit'],
      'Pilih menu:'
    );

    if (sel === 3) {
      console.log(chalk.green('Bye 👋'));
      process.exit(0);
    }

    if (sel === 0) {
      await sendModule.runSendMenu({ provider, wallet, ethers, tokens });
      await loadTokenBalances(provider, walletAddress, tokens);
    } else if (sel === 1) {
      await deployModule.runDeployMenu({ provider, wallet, ethers });
    } else if (sel === 2) {
      await faucet.runInteractive();
    }

    console.log(chalk.gray('\nKembali ke menu utama...\n'));
  }
}

if (require.main === module)
  main().catch(e=>{
    console.error(chalk.red('Fatal:'), e && e.stack ? e.stack : e);
    process.exit(1);
  });
