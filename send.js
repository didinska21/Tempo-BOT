// send.js — FULL CLEAN & STABLE
require('dotenv').config();

const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk').default;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

// ---------- helpers ----------
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

async function askInput(msg, def = '') {
  const a = await rlQuestion(`${msg}${def ? ` (${def})` : ''}: `);
  return a === '' ? def : a;
}

function now() {
  return new Date().toISOString();
}

function shortHash(h) {
  return h ? h.slice(0, 10) + '...' + h.slice(-6) : '';
}

// ---------- progress bar (manual & safe) ----------
function renderProgress(current, total) {
  const width = 30;
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '-'.repeat(width - filled);
  process.stdout.write(`\rProgress |${bar}| ${current}/${total} TXs`);
  if (current >= total) process.stdout.write('\n');
}

// ---------- balance ----------
async function getTokenBalance(provider, token, address) {
  try {
    const c = new ethers.Contract(token.address, ERC20_ABI, provider);
    const dec = await c.decimals();
    const bal = await c.balanceOf(address);
    return { bal, dec, human: ethers.formatUnits(bal, dec) };
  } catch {
    return { bal: null, dec: null, human: 'err' };
  }
}

// ---------- send with retry ----------
async function sendERC20WithRetry(wallet, token, to, amountHuman, waitConfirm, stats) {
  const c = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const dec = await c.decimals();
  const amountUnits = ethers.parseUnits(String(amountHuman), dec);

  if (stats) stats.inc('attempts', 1);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tx = await c.transfer(to, amountUnits);
      console.log(
        chalk.yellow(`[${now()}] ➜ SENT ${shortHash(tx.hash)}  ${token.symbol} ${amountHuman} → ${to}`)
      );

      if (waitConfirm) {
        const r = await tx.wait(1);
        console.log(
          chalk.green(`[${now()}] ✅ CONFIRMED block:${r.blockNumber}`)
        );
      }

      if (process.env.EXPLORER_BASE) {
        console.log(
          chalk.cyan(`TX: ${process.env.EXPLORER_BASE}/tx/${tx.hash}`)
        );
      }

      if (stats) stats.inc('success', 1);
      return true;
    } catch (e) {
      console.log(
        chalk.red(`[${now()}] ❌ Error attempt ${attempt}: ${e?.message || e}`)
      );
      if (attempt === 3) {
        if (stats) stats.inc('failed', 1);
        return false;
      }
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  return false;
}

// ---------- MAIN SEND MENU ----------
module.exports.runSendMenu = async function ({ provider, wallet, tokens, stats }) {
  const walletAddr = await wallet.getAddress();

  while (true) {
    console.log('');
    tokens.forEach((t, i) => {
      console.log(`${i + 1}. Send Token: ${t.symbol} — balance: ${t.balanceHuman}`);
    });
    console.log(`${tokens.length + 1}. Send Semua Token`);
    console.log(`${tokens.length + 2}. Back`);

    const sel = Number(await askInput('Pilih menu', '')) - 1;
    if (isNaN(sel) || sel < 0 || sel > tokens.length + 1) {
      console.log(chalk.red('Pilihan tidak valid'));
      continue;
    }
    if (sel === tokens.length + 1) return;

    const sendAll = sel === tokens.length;

    const destTypeIdx = await askNumbered(
      ['Send to Random Address', 'Send to Manual Address', 'Back'],
      'Tujuan:'
    );
    if (destTypeIdx === 2) continue;

    let manualTo = null;
    if (destTypeIdx === 1) {
      manualTo = await askInput('Masukkan address tujuan');
      if (!ethers.isAddress(manualTo)) {
        console.log(chalk.red('Address tidak valid'));
        continue;
      }
    }

    const amount = await askInput('Jumlah yang akan dikirim per tx (per token)', '1');
    const sendCount = Number(await askInput('Jumlah TX yang akan dikirim (0 = sampai balance habis)', '1'));
    const waitConfirm =
      (await askNumbered(['Yes', 'No'], 'Tunggu 1 konfirmasi tiap tx?')) === 0;

    let totalPlanned = sendAll ? tokens.length * (sendCount || 1) : (sendCount || 1);
    if (totalPlanned <= 0) totalPlanned = 1;

    let done = 0;
    let success = 0;
    let failed = 0;

    if (sendAll) {
      for (const token of tokens) {
        let sent = 0;
        while (sendCount === 0 || sent < sendCount) {
          const balInfo = await getTokenBalance(provider, token, walletAddr);
          if (!balInfo.bal) break;

          const unit = ethers.parseUnits(String(amount), balInfo.dec);
          if (balInfo.bal < unit) break;

          const to =
            destTypeIdx === 0 ? ethers.Wallet.createRandom().address : manualTo;

          const ok = await sendERC20WithRetry(wallet, token, to, amount, waitConfirm, stats);
          done++;
          renderProgress(done, totalPlanned);

          if (ok) {
            success++;
            sent++;
          } else {
            failed++;
          }

          if (sendCount !== 0 && sent >= sendCount) break;
          await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
        }
      }
    } else {
      const token = tokens[sel];
      let sent = 0;
      while (sendCount === 0 || sent < sendCount) {
        const balInfo = await getTokenBalance(provider, token, walletAddr);
        if (!balInfo.bal) break;

        const unit = ethers.parseUnits(String(amount), balInfo.dec);
        if (balInfo.bal < unit) break;

        const to =
          destTypeIdx === 0 ? ethers.Wallet.createRandom().address : manualTo;

        const ok = await sendERC20WithRetry(wallet, token, to, amount, waitConfirm, stats);
        done++;
        renderProgress(done, totalPlanned);

        if (ok) {
          success++;
          sent++;
        } else {
          failed++;
        }

        if (sendCount !== 0 && sent >= sendCount) break;
        await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
      }
    }

    console.log('\n=== SESSION SUMMARY ===');
    console.log(`Total TX attempted: ${done}`);
    console.log(chalk.green(`Succeeded: ${success}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log('========================\n');
  }
};
