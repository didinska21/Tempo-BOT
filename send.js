// send.js - UI premium (round-robin "Send Semua Token") + gas overrides + retries
// Requires: ethers v6, inquirer, chalk (.default), ora (.default), cli-progress
// Expects CommonJS (require). Compatible with main.js premium UI.

const inquirer = require('inquirer');
const chalk = require('chalk').default;
const ora = require('ora').default;
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

// print helpers (clean)
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

// parse gwei helper
function parseGweiToWei(ethers, str) {
  try { return ethers.parseUnits(String(str), 9); } catch (e) { return null; }
}
function formatGwei(ethers, big) { try { return ethers.formatUnits(big, 9); } catch { return String(big); } }

// ask gas overrides (same UX as before)
async function askGasOverrides(provider, ethers) {
  const feeData = await provider.getFeeData();
  const supports1559 = feeData.maxFeePerGas && feeData.maxPriorityFeePerGas;
  const suggested = { maxFeePerGas: feeData.maxFeePerGas ?? null, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? null, gasPrice: feeData.gasPrice ?? null };

  console.log('\nSuggested fee data (from provider):');
  if (supports1559) {
    console.log(`  maxFeePerGas (gwei): ${formatGwei(ethers, suggested.maxFeePerGas)}`);
    console.log(`  maxPriorityFeePerGas (gwei): ${formatGwei(ethers, suggested.maxPriorityFeePerGas)}`);
  } else if (suggested.gasPrice) {
    console.log(`  gasPrice (gwei): ${formatGwei(ethers, suggested.gasPrice)}`);
  } else {
    console.log('  (no fee data available from provider)');
  }
  const { useDefault } = await prompt([{ type:'confirm', name:'useDefault', message:'Use suggested/default fee data?', default:true }]);
  if (useDefault) {
    const overrides = {};
    if (supports1559) {
      if (suggested.maxFeePerGas) overrides.maxFeePerGas = suggested.maxFeePerGas;
      if (suggested.maxPriorityFeePerGas) overrides.maxPriorityFeePerGas = suggested.maxPriorityFeePerGas;
    } else if (suggested.gasPrice) {
      overrides.gasPrice = suggested.gasPrice;
    }
    const { setGasLimit } = await prompt([{ type:'confirm', name:'setGasLimit', message:'Set custom gasLimit? (otherwise use estimate)', default:false }]);
    if (setGasLimit) {
      const { gasLimit } = await prompt([{ type:'input', name:'gasLimit', message:'gasLimit (numeric):', validate: v => !isNaN(Number(v)) && Number(v)>0 ? true : 'Masukkan angka > 0' }]);
      overrides.gasLimit = BigInt(Number(gasLimit));
    }
    return overrides;
  }
  if (supports1559) {
    const res = await prompt([
      { type:'input', name:'maxFee', message:'maxFeePerGas (gwei):', default: formatGwei(ethers, suggested.maxFeePerGas) || '2', validate: v => !isNaN(Number(v)) && Number(v)>0 ? true : 'Masukkan angka gwei > 0' },
      { type:'input', name:'priority', message:'maxPriorityFeePerGas (gwei):', default: formatGwei(ethers, suggested.maxPriorityFeePerGas) || '1', validate: v => !isNaN(Number(v)) && Number(v)>=0 ? true : 'Masukkan angka gwei >= 0' },
      { type:'input', name:'gasLimit', message:'gasLimit (optional):', default: '' }
    ]);
    const overrides = {};
    const m = parseGweiToWei(ethers, res.maxFee);
    const p = parseGweiToWei(ethers, res.priority);
    if (m) overrides.maxFeePerGas = m;
    if (p) overrides.maxPriorityFeePerGas = p;
    if (res.gasLimit && res.gasLimit.trim() !== '') overrides.gasLimit = BigInt(Number(res.gasLimit));
    if (overrides.gasLimit && overrides.maxFeePerGas) {
      try {
        const weiFee = BigInt(overrides.gasLimit) * BigInt(overrides.maxFeePerGas);
        console.log(`Estimated tx fee (wei): ${String(weiFee)} (~ ${ethers.formatEther(weiFee)} ETH)`);
      } catch {}
    }
    return overrides;
  } else {
    const res = await prompt([
      { type:'input', name:'gasPrice', message:'gasPrice (gwei):', default: formatGwei(ethers, suggested.gasPrice) || '2', validate: v => !isNaN(Number(v)) && Number(v)>0 ? true : 'Masukkan angka gwei > 0' },
      { type:'input', name:'gasLimit', message:'gasLimit (optional):', default: '' }
    ]);
    const overrides = {};
    const gp = parseGweiToWei(ethers, res.gasPrice);
    if (gp) overrides.gasPrice = gp;
    if (res.gasLimit && res.gasLimit.trim() !== '') overrides.gasLimit = BigInt(Number(res.gasLimit));
    if (overrides.gasLimit && overrides.gasPrice) {
      try {
        const weiFee = BigInt(overrides.gasLimit) * BigInt(overrides.gasPrice);
        console.log(`Estimated tx fee (wei): ${String(weiFee)} (~ ${ethers.formatEther(weiFee)} ETH)`);
      } catch {}
    }
    return overrides;
  }
}

// send once with retries and incStat
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

// MAIN runSendMenu with round-robin send_all
async function runSendMenu({ provider, wallet, tokens, ethers, incStat }) {
  const safeInc = typeof incStat === 'function' ? incStat : () => {};

  while (true) {
    const choices = tokens.map((t,i)=>({
      name: `Send Token: ${t.symbol}` + (t.balanceHuman ? ` — balance: ${t.balanceHuman}` : ''),
      value: i
    }));
    choices.push({ name: 'Send Semua Token', value: 'send_all' });
    choices.push({ name: 'Back to Main Menu', value: 'back' });

    const { menu } = await prompt([{ type:'list', name:'menu', message:'Send Address - pilih:', choices }]);
    if (menu === 'back') return;

    // choose destination
    let destType;
    if (menu === 'send_all') {
      const ans = await prompt([{ type:'list', name:'destType', message:'Pilih tujuan untuk Send Semua Token:', choices:[
        { name:'Send to Random Address', value:'random' },
        { name:'Send to Manual Address', value:'manual' },
        { name:'Back', value:'back' }
      ] }]);
      if (ans.destType === 'back') continue;
      destType = ans.destType;
    } else {
      const ans = await prompt([{ type:'list', name:'destType', message:`Tujuan untuk ${tokens[menu].symbol}:`, choices:[
        { name:'Send to Random Address', value:'random' },
        { name:'Send to Manual Address', value:'manual' },
        { name:'Back', value:'back' }
      ] }]);
      if (ans.destType === 'back') continue;
      destType = ans.destType;
    }

    let manualTo = null;
    if (destType === 'manual') {
      const ans = await prompt([{ type:'input', name:'manualAddress', message:'Masukkan address tujuan:', validate: v => ethers.isAddress(v) ? true : 'Address tidak valid' }]);
      manualTo = ans.manualAddress;
    }

    // gas overrides once per session
    console.log('\n-- Gas / Fee settings (applies to this send session) --');
    const gasOverrides = await askGasOverrides(provider, ethers);
    console.log('-- End gas settings --\n');

    // common prompts
    const { amount } = await prompt([{ type:'input', name:'amount', message:'Jumlah yang akan dikirim per tx (per token):', default:'1', validate: v => !isNaN(Number(v)) ? true : 'Masukkan angka valid' }]);
    const { sendCount } = await prompt([{ type:'input', name:'sendCount', message:'Jumlah TX yang akan dikirim (0 = sampai balance habis):', default:'1', validate: v=> { const n=Number(v); return (!isNaN(n) && n>=0) ? true : 'Masukkan angka >=0'; } }]);
    const { waitConfirm } = await prompt([{ type:'confirm', name:'waitConfirm', message:'Tunggu 1 konfirmasi tiap tx?', default: String(process.env.WAIT_CONFIRM||'true')==='true' }]);

    const countNum = Number(sendCount);

    // Estimate total work for progress bar (for send_all compute sum of max sends)
    let totalPlanned = 0;
    if (menu === 'send_all') {
      // compute per-token max send if countNum==0
      if (countNum === 0) {
        // sum across tokens floor(balance/amount)
        for (const token of tokens) {
          const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
          if (balInfo.bal && balInfo.dec) {
            const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
            if (BigInt(unitAmount) > 0n) {
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
    if (totalPlanned <= 0) totalPlanned = 1; // avoid zero bar

    const progress = new SingleBar({
      format: 'Progress |' + chalk.cyan('{bar}') + '| {value}/{total} TXs | ETA: {eta_formatted}',
      hideCursor: true
    }, Presets.rect);

    progress.start(totalPlanned, 0);

    // counters
    let attempts = 0, success = 0, failed = 0;

    // helper to advance progress
    function advanceOne() { try { progress.increment(1); } catch (e) {} }

    // --------------------
    // SEND ALL (round-robin)
    // --------------------
    if (menu === 'send_all') {
      // Prepare per-token remaining counts
      const remaining = [];
      if (countNum === 0) {
        // until depleted: compute per-token max sends
        for (const token of tokens) {
          const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
          if (balInfo.bal && balInfo.dec) {
            const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
            const maxN = unitAmount > 0n ? Number(BigInt(balInfo.bal) / BigInt(unitAmount)) : 0;
            remaining.push(Math.max(0, maxN));
          } else {
            remaining.push(0);
          }
        }
      } else {
        // fixed count per token
        for (let i=0;i<tokens.length;i++) remaining.push(countNum);
      }

      // total remaining overall
      let totalRemaining = remaining.reduce((a,b)=>a+b,0);
      // round-robin: iterate while there is any remaining
      while (totalRemaining > 0) {
        for (let idx = 0; idx < tokens.length; idx++) {
          if (remaining[idx] <= 0) continue; // skip if none left for this token

          const token = tokens[idx];

          // check balance just-in-time
          const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
          if (!balInfo.bal) {
            console.log(chalk.yellow(`[${now()}] Failed reading ${token.symbol}, skip.`));
            remaining[idx] = 0;
            totalRemaining = remaining.reduce((a,b)=>a+b,0);
            continue;
          }
          const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
          if (BigInt(balInfo.bal) < BigInt(unitAmount)) {
            console.log(chalk.yellow(`[${now()}] Insufficient ${token.symbol} balance (${balInfo.human}), stop sending this token.`));
            remaining[idx] = 0;
            totalRemaining = remaining.reduce((a,b)=>a+b,0);
            continue;
          }

          // destination - random per-send (keinginan awal: random generate per tx) or manual once earlier
          const to = destType === 'random' ? ethers.Wallet.createRandom().address : manualTo;

          // attempt send
          attempts++; safeInc('attempt');
          const res = await sendERC20WithRetries(provider, wallet, ethers, token, to, amount, waitConfirm, 3, gasOverrides, safeInc);
          advanceOne();
          if (res.success) {
            success++; safeInc('success');
            if (res.receipt) logConfirmed(res.txHash, process.env.EXPLORER_BASE || '', token.symbol, amount, to, res.receipt);
            else console.log(chalk.green(`[${now()}] ✅ SENT ${short(res.txHash)}`));
            remaining[idx] = Math.max(0, remaining[idx] - 1);
          } else {
            failed++; safeInc('failed');
            // on failure after retries, we skip this send (decrement to avoid infinite loop)
            remaining[idx] = Math.max(0, remaining[idx] - 1);
          }

          totalRemaining = remaining.reduce((a,b)=>a+b,0);

          // small pause
          if (totalRemaining <= 0) break;
          await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
        } // end for tokens
      } // end while totalRemaining
    } else {
      // single token flow (unchanged)
      const token = tokens[menu];
      let sentForToken = 0;
      while (countNum === 0 ? true : sentForToken < countNum) {
        const balInfo = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
        if (!balInfo.bal) { console.log(chalk.yellow(`[${now()}] Failed reading ${token.symbol}, abort.`)); break; }
        const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
        if (BigInt(balInfo.bal) < BigInt(unitAmount)) { console.log(chalk.yellow(`[${now()}] Insufficient ${token.symbol} balance (${balInfo.human}), stop.`)); break; }
        const to = destType === 'random' ? ethers.Wallet.createRandom().address : manualTo;

        attempts++; safeInc('attempt');
        const res = await sendERC20WithRetries(provider, wallet, ethers, token, to, amount, waitConfirm, 3, gasOverrides, safeInc);
        advanceOne();
        if (res.success) { success++; safeInc('success'); if (res.receipt) logConfirmed(res.txHash, process.env.EXPLORER_BASE || '', token.symbol, amount, to, res.receipt); else console.log(chalk.green(`[${now()}] ✅ SENT ${short(res.txHash)}`)); sentForToken++; }
        else { failed++; safeInc('failed'); }

        if (!(countNum === 0 ? true : sentForToken < countNum)) break;
        await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
      }
    }

    progress.stop();

    console.log('\n' + chalk.bold('=== SESSION SUMMARY ==='));
    console.log(`Total attempts: ${attempts}`);
    console.log(chalk.green(`Succeeded: ${success}`) + '  ' + chalk.red(`Failed: ${failed}`));
    console.log('========================\n');
  }
}

module.exports = { runSendMenu };
