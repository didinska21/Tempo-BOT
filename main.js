// main.js - unified CLI
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const readline = require('readline');

const sendModule = require('./send');
const deployModule = require('./deploy');
const faucetRpc = require('./faucet_rpc');

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

function nowDateStr() { return new Date().toISOString().split('T')[0]; }

async function main() {
  console.clear();
  console.log('===========================================');
  console.log('   auto.tx by didinska');
  console.log('   Simple CLI: Send / Deploy / Faucet (RPC)');
  console.log('===========================================');

  if (!process.env.RPC_URL) {
    console.log('RPC_URL missing in .env — set it and restart.');
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, provider) : null;
  const walletAddress = wallet ? await wallet.getAddress() : 'NoKey';

  console.log('Wallet:', walletAddress);
  if (process.env.EXPLORER_BASE) console.log('Explorer:', process.env.EXPLORER_BASE);
  const tokens = parseTokensEnv();

  await loadTokenBalances(provider, walletAddress, tokens);

  console.log('Loaded tokens:');
  tokens.forEach((t,i) => {
    console.log(`  ${i+1}. ${t.symbol} ${t.address ? (' balance: ' + t.balanceHuman) : ''}`);
  });
  console.log('-------------------------------------------');

  // quick stats placeholder — you may wire this to persistent stats file if needed
  const quickStats = { attempts: 0, success: 0, failed: 0 };
  console.log(` Quick stats (${nowDateStr()}): attempts=${quickStats.attempts} success=${quickStats.success} failed=${quickStats.failed}`);
  console.log('1. Send Address (per token / send all)\n2. Deploy Kontrak (Token / NFT)\n3. Claim Faucet (RPC)\n4. Exit');

  while (true) {
    const sel = await askNumbered(['Send Address (per token / send all)','Deploy Kontrak (Token / NFT)','Claim Faucet (RPC)','Exit'], 'Pilih menu (masukkan nomor):');
    if (sel === 3) { console.log('Bye'); process.exit(0); }

    if (sel === 0) {
      await sendModule.runSendMenu({ provider, wallet, ethers, tokens, quickStats });
      // refresh balances
      await loadTokenBalances(provider, walletAddress, tokens);
    } else if (sel === 1) {
      await deployModule.runDeployMenu({ provider, wallet, ethers });
    } else if (sel === 2) {
      await faucetRpc.runInteractive(); // reuses provider internally
    }

    console.log('\nReturning to main menu...\n');
  }
}

if (require.main === module) main().catch(e=>{ console.error('Fatal:', e && e.stack ? e.stack : e); process.exit(1); });
module.exports = { main };
