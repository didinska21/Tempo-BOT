// main.js - unified CLI (v2: re-render header & balances)
require('dotenv').config();
const ethers = require('ethers');
const readline = require('readline');

const sendModule = require('./send');
const deployModule = require('./deploy');
const faucet = require('./faucet');

// ================= helpers =================
function rlQuestion(q){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}

async function askNumbered(items, prompt='Pilih (masukkan nomor):'){
  items.forEach((it,i)=>console.log(`${i+1}. ${it}`));
  while(true){
    const a = (await rlQuestion(prompt+' ')).trim();
    const n = Number(a);
    if(!Number.isNaN(n) && n>=1 && n<=items.length) return n-1;
    console.log('Masukkan nomor valid.');
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

// ================= UI render =================
async function renderMainHeader({ provider, walletAddress, tokens }) {
  console.clear();
  console.log('===========================================');
  console.log('   auto.tx by didinska');
  console.log('   Send / Deploy / Faucet (RPC) CLI');
  console.log('===========================================');

  console.log('Wallet   :', walletAddress);
  if (process.env.EXPLORER_BASE) {
    console.log('Explorer :', process.env.EXPLORER_BASE);
  }

  await loadTokenBalances(provider, walletAddress, tokens);

  console.log('Loaded tokens:');
  tokens.forEach((t,i) => {
    console.log(` ${i+1}. ${t.symbol}  balance: ${t.balanceHuman}`);
  });

  console.log('-------------------------------------------');
}

// ================= MAIN =================
async function main() {
  if (!process.env.RPC_URL) {
    console.log('RPC_URL missing in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = process.env.PRIVATE_KEY
    ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    : null;

  const walletAddress = wallet ? await wallet.getAddress() : 'NoKey';
  const tokens = parseTokensEnv();

  // runtime stats
  const quickStats = { attempts: 0, success: 0, failed: 0 };

  while (true) {
    await renderMainHeader({ provider, walletAddress, tokens });

    console.log('1. Send Address (per token / send all)');
    console.log('2. Deploy Kontrak (Token / NFT)');
    console.log('3. Claim Faucet (RPC)');
    console.log('4. Exit');

    const sel = await askNumbered(
      [
        'Send Address (per token / send all)',
        'Deploy Kontrak (Token / NFT)',
        'Claim Faucet (RPC)',
        'Exit'
      ],
      'Pilih menu:'
    );

    if (sel === 3) {
      console.log('Bye.');
      process.exit(0);
    }

    if (sel === 0) {
      await sendModule.runSendMenu({
        provider,
        wallet,
        ethers,
        tokens,
        quickStats
      });
    }

    if (sel === 1) {
      await deployModule.runDeployMenu({ provider, wallet, ethers });
    }

    if (sel === 2) {
      await faucet.runInteractive();
    }

    // setelah action → loop ulang → header + balance tampil lagi
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error('Fatal:', e && e.stack ? e.stack : e);
    process.exit(1);
  });
}

module.exports = { main };
