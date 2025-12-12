// send.js - numeric-menu friendly, no gas prompts (testnet), round-robin send_all
const inquirer = require('inquirer');
const chalkReq = require('chalk');
const chalk = chalkReq && chalkReq.default ? chalkReq.default : chalkReq;
const oraReq = require('ora');
const ora = oraReq && oraReq.default ? oraReq.default : oraReq;
const { SingleBar, Presets } = require('cli-progress');
const ethers = require('ethers');

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

function now() { return new Date().toISOString(); }
function short(h) { if (!h) return ''; return h.length > 18 ? h.slice(0,10) + '...' + h.slice(-6) : h; }

function logSent(txHash, explorerBase, tokenSymbol, amount, to) {
  const link = explorerBase ? `${explorerBase}/tx/${txHash}` : '';
  console.log(chalk.yellow(`[${now()}] ➜ SENT ${short(txHash)}`) + (link ? ` ${chalk.cyan(link)}` : ''));
  console.log(`  ${chalk.dim('token:')} ${tokenSymbol}  ${chalk.dim('amount:')} ${amount}  ${chalk.dim('to:')} ${to}`);
}
function logConfirmed(txHash, explorerBase, tokenSymbol, amount, to, receipt) {
  const link = explorerBase ? `${explorerBase}/tx/${txHash}` : '';
  console.log(chalk.green(`[${now()}] ✅ CONFIRMED ${short(txHash)}`) + (link ? ` ${chalk.cyan(link)}` : ''));
  console.log(`  ${chalk.dim('token:')} ${tokenSymbol}  ${chalk.dim('amount:')} ${amount}  ${chalk.dim('to:')} ${to}`);
  if (receipt) console.log(`  ${chalk.dim('block:')} ${receipt.blockNumber}  ${chalk.dim('gasUsed:')} ${String(receipt.gasUsed)}`);
}
function logFailed(reason, tokenSymbol, amount, to, attempt) {
  console.log(chalk.red(`[${now()}] ❌ FAILED (attempt ${attempt})`));
  console.log(`  ${chalk.dim(reason)}`);
  console.log(`  ${chalk.dim('token:')} ${tokenSymbol}  ${chalk.dim('amount:')} ${amount}  ${chalk.dim('to:')} ${to}`);
}

function parseGweiToWei(ethers, str) { try { return ethers.parseUnits(String(str), 9); } catch (e) { return null; } }
function formatGwei(ethers, big) { try { return ethers.formatUnits(big, 9); } catch { return String(big); } }

async function sendERC20WithRetries(provider, wallet, ethers, token, to, amountHuman, waitConfirm, maxRetries = 3, gasOverrides = {}, incStat) {
  const contract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amountUnits = ethers.parseUnits(String(amountHuman), decimals);

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      if (typeof incStat === 'function') incStat('attempt');
      const tx = await contract.transfer(to, amountUnits, gasOverrides);
      logSent(tx.hash, process.env.EXPLORER_BASE || '', token.symbol, amountHuman, to);

      let receipt = null;
      if (waitConfirm) {
        const spinner = ora(`Waiting confirm ${short(tx.hash)} (attempt ${attempt})`).start();
        try { receipt = await tx.wait(1); } finally { spinner.stop(); }
      }

      if (typeof incStat === 'function') incStat('success');
      return { success: true, txHash: tx.hash, receipt };
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      if (attempt >= maxRetries) {
        if (typeof incStat === 'function') incStat('failed');
        logFailed(msg, token.symbol, amountHuman, to, attempt);
        return { success: false, error: msg };
      } else {
        console.log(chalk.yellow(`[${now()}] ⚠ retrying (${attempt}/${maxRetries}) due to: ${msg}`));
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  if (typeof incStat === 'function') incStat('failed');
  return { success: false, error: 'unknown' };
}

async function getTokenBalance(provider, token, address, ethers) {
  try {
    const c = new ethers.Contract(token.address, ERC20_ABI, provider);
    const dec = await c.decimals();
    const bal = await c.balanceOf(address);
    return { bal, dec, human: ethers.formatUnits(bal, dec) };
  } catch (e) {
    return { bal: null, dec: null, human: 'err' };
  }
}

// numeric-menu helper: prints choices and ask numeric input
async function askNumberedChoice(items, question) {
  for (let i=0;i<items.length;i++){
    console.log(`${chalk.dim(String(i+1)+'.')} ${items[i]}`);
  }
  const ans = await inquirer.prompt([{ name:'num', message: question, validate: v => { const n = Number(v); return (!isNaN(n) && n>=1 && n<=items.length) ? true : `Masukkan angka 1..${items.length}` } }]);
  return Number(ans.num)-1;
}

async function runSendMenu({ provider, wallet, tokens, ethers, incStat }) {
  const safeInc = typeof incStat === 'function' ? incStat : () => {};
  const gasOverrides = {}; // No gas prompts on testnet; use provider default

  while (true) {
    const choices = tokens.map((t,i)=> `Send Token: ${t.symbol}` + (t.balanceHuman ? ` — balance: ${t.balanceHuman}` : ''));
    choices.push('Send Semua Token');
    choices.push('Back to Main Menu');

    const menuIdx = await askNumberedChoice(choices, 'Send Address - pilih (masukkan nomor):');
    const menu = (menuIdx < tokens.length) ? menuIdx : (choices[menuIdx] === 'Send Semua Token' ? 'send_all' : 'back');
    if (menu === 'back') return;

    // choose destination (numeric)
    const destChoices = ['Send to Random Address', 'Send to Manual Address', 'Back'];
    const destIdx = await askNumberedChoice(destChoices, 'Pilih tujuan (masukkan nomor):');
    if (destChoices[destIdx] === 'Back') continue;
    const destType = destChoices[destIdx] === 'Send to Random Address' ? 'random' : 'manual';

    let manualTo = null;
    if (destType === 'manual') {
      const ans = await inquirer.prompt([{ name:'manualAddress', message:'Masukkan address tujuan:', validate: v => ethers.isAddress(v) ? true : 'Address tidak valid' }]);
      manualTo = ans.manualAddress;
    }

    // prompts: amount, sendCount, waitConfirm
    const res1 = await inquirer.prompt([
      { name:'amount', message:'Jumlah yang akan dikirim per tx (per token):', default:'1', validate: v => !isNaN(Number(v)) ? true : 'Masukkan angka valid' },
      { name:'sendCount', message:'Jumlah TX yang akan dikirim (0 = sampai balance habis):', default:'1', validate: v => { const n = Number(v); return (!isNaN(n) && n>=0) ? true : 'Masukkan angka >=0' } },
      { type:'confirm', name:'waitConfirm', message:'Tunggu 1 konfirmasi tiap tx?', default: String(process.env.WAIT_CONFIRM||'true')==='true' }
    ]);
    const amount = res1.amount;
    const countNum = Number(res1.sendCount);
    const waitConfirm = !!res1.waitConfirm;

    // Compute total planned (sum of per-token sends for send_all)
    let totalPlanned = 0;
    if (menu === 'send_all') {
      if (countNum === 0) {
        for (const token of tokens) {
          const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
          if (balInfo.bal && balInfo.dec) {
            const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
            if (unitAmount > 0n) {
              const maxN = Number(BigInt(balInfo.bal) / BigInt(unitAmount));
              totalPlanned += Math.max(0, maxN);
            }
          }
        }
      } else {
        totalPlanned = tokens.length * countNum;
      }
    } else {
      const token = tokens[menu];
      if (countNum === 0) {
        const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
        if (balInfo.bal && balInfo.dec) {
          const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
          totalPlanned = Number(BigInt(balInfo.bal) / BigInt(unitAmount));
        } else totalPlanned = 0;
      } else totalPlanned = countNum;
    }
    if (totalPlanned <= 0) totalPlanned = 1;

    const progress = new SingleBar({
      format: 'Progress |' + chalk.cyan('{bar}') + '| {value}/{total} TXs | ETA: {eta_formatted}',
      hideCursor: true
    }, Presets.rect);
    progress.start(totalPlanned, 0);

    let attempts = 0, success = 0, failed = 0;

    function advanceOne(){ try{ progress.increment(1); } catch(e){} }

    // SEND ALL round-robin
    if (menu === 'send_all') {
      const remaining = [];
      if (countNum === 0) {
        for (const token of tokens) {
          const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
          if (balInfo.bal && balInfo.dec) {
            const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
            const maxN = unitAmount > 0n ? Number(BigInt(balInfo.bal) / BigInt(unitAmount)) : 0;
            remaining.push(Math.max(0, maxN));
          } else remaining.push(0);
        }
      } else {
        for (let i=0;i<tokens.length;i++) remaining.push(countNum);
      }

      let totalRemaining = remaining.reduce((a,b)=>a+b,0);
      while (totalRemaining > 0) {
        for (let idx=0; idx<tokens.length; idx++) {
          if (remaining[idx] <= 0) continue;
          const token = tokens[idx];
          const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
          if (!balInfo.bal) { console.log(chalk.yellow(`[${now()}] Failed reading ${token.symbol}, skip.`)); remaining[idx]=0; totalRemaining=remaining.reduce((a,b)=>a+b,0); continue; }
          const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
          if (BigInt(balInfo.bal) < BigInt(unitAmount)) { console.log(chalk.yellow(`[${now()}] Insufficient ${token.symbol} balance (${balInfo.human}), stop sending this token.`)); remaining[idx]=0; totalRemaining=remaining.reduce((a,b)=>a+b,0); continue; }

          const to = destType==='random' ? ethers.Wallet.createRandom().address : manualTo;
          attempts++; if (typeof safeInc === 'function') safeInc('attempt');
          const res = await sendERC20WithRetries(provider, wallet, ethers, token, to, amount, waitConfirm, 3, gasOverrides, safeInc);
          advanceOne();
          if (res.success) { success++; if (typeof safeInc==='function') safeInc('success'); if (res.receipt) logConfirmed(res.txHash, process.env.EXPLORER_BASE || '', token.symbol, amount, to, res.receipt); else console.log(chalk.green(`[${now()}] ✅ SENT ${short(res.txHash)}`)); remaining[idx] = Math.max(0, remaining[idx]-1); }
          else { failed++; if (typeof safeInc==='function') safeInc('failed'); remaining[idx] = Math.max(0, remaining[idx]-1); }

          totalRemaining = remaining.reduce((a,b)=>a+b,0);
          if (totalRemaining <= 0) break;
          await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
        }
      }
    } else {
      // single token
      const token = tokens[menu];
      let sentForToken = 0;
      while (countNum === 0 ? true : sentForToken < countNum) {
        const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
        if (!balInfo.bal) { console.log(chalk.yellow(`[${now()}] Failed reading ${token.symbol}, abort.`)); break; }
        const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
        if (BigInt(balInfo.bal) < BigInt(unitAmount)) { console.log(chalk.yellow(`[${now()}] Insufficient ${token.symbol} balance (${balInfo.human}), stop.`)); break; }
        const to = destType==='random' ? ethers.Wallet.createRandom().address : manualTo;

        attempts++; if (typeof safeInc==='function') safeInc('attempt');
        const res = await sendERC20WithRetries(provider, wallet, ethers, token, to, amount, waitConfirm, 3, gasOverrides, safeInc);
        advanceOne();
        if (res.success) { success++; if (typeof safeInc==='function') safeInc('success'); if (res.receipt) logConfirmed(res.txHash, process.env.EXPLORER_BASE || '', token.symbol, amount, to, res.receipt); else console.log(chalk.green(`[${now()}] ✅ SENT ${short(res.txHash)}`)); sentForToken++; }
        else { failed++; if (typeof safeInc==='function') safeInc('failed'); }

        if (!(countNum === 0 ? true : sentForToken < countNum)) break;
        await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
      }
    }

    progress.stop();
    console.log('\n' + chalk.bold('=== SESSION SUMMARY ==='));
    console.log(`Total attempts: ${attempts}`);
    console.log(chalk.green(`Succeeded: ${success}`) + '  ' + chalk.red(`Failed: ${failed}`));
    console.log('========================\n');
  } // end while
}

module.exports = { runSendMenu };
