// send.js — concise logs + spinner + retry (max 3) + summary
// Compatible with ethers v6 and previous project structure.
// No external deps beyond inquirer and ethers.

const inquirer = require('inquirer');
const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

// simple ANSI colors (no dependency)
const COL = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
};

function now() {
  return new Date().toISOString();
}

function short(hash) {
  if (!hash) return '';
  return hash.length > 18 ? hash.slice(0,10) + '...' + hash.slice(-6) : hash;
}

// spinner helper
function startSpinner(text) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r${frames[i % frames.length]} ${text} `);
    i++;
  }, 80);
  return id;
}
function stopSpinner(id, clearLine = true) {
  if (id) clearInterval(id);
  if (clearLine) process.stdout.write('\r\x1b[K');
}

// print concise success/failed line
function printSuccess(txHash, explorerBase, tokenSymbol, amount, to, receipt) {
  const ts = now();
  const h = short(txHash);
  const link = explorerBase ? `${explorerBase}/tx/${txHash}` : '';
  console.log(`${COL.green}[${ts}] ✅ CONFIRMED ${h}${COL.reset}` + (link ? ` ${COL.cyan}${link}${COL.reset}` : ''));
  console.log(`  ${COL.dim}token:${COL.reset} ${tokenSymbol}  ${COL.dim}amount:${COL.reset} ${amount}  ${COL.dim}to:${COL.reset} ${to}`);
  if (receipt) {
    console.log(`  ${COL.dim}block:${COL.reset} ${receipt.blockNumber}  ${COL.dim}gasUsed:${COL.reset} ${String(receipt.gasUsed)}`);
  }
}
function printSent(txHash, explorerBase, tokenSymbol, amount, to) {
  const ts = now();
  const h = short(txHash);
  const link = explorerBase ? `${explorerBase}/tx/${txHash}` : '';
  console.log(`${COL.yellow}[${ts}] ➜ SENT ${h}${COL.reset}` + (link ? ` ${COL.cyan}${link}${COL.reset}` : ''));
  console.log(`  ${COL.dim}token:${COL.reset} ${tokenSymbol}  ${COL.dim}amount:${COL.reset} ${amount}  ${COL.dim}to:${COL.reset} ${to}`);
}
function printFailed(reason, tokenSymbol, amount, to, attempt) {
  const ts = now();
  console.log(`${COL.red}[${ts}] ❌ FAILED (${attempt}) ${COL.reset}`);
  console.log(`  ${COL.dim}${reason}${COL.reset}`);
  console.log(`  ${COL.dim}token:${COL.reset} ${tokenSymbol}  ${COL.dim}amount:${COL.reset} ${amount}  ${COL.dim}to:${COL.reset} ${to}`);
}

// core: send once with retries
async function sendERC20WithRetries(provider, wallet, ethers, token, to, amountHuman, waitConfirm, maxRetries=3) {
  const contract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amountUnits = ethers.parseUnits(String(amountHuman), decimals);

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      // send transaction
      const tx = await contract.transfer(to, amountUnits);
      // printed as SENT concise
      printSent(tx.hash, process.env.EXPLORER_BASE || '', token.symbol, amountHuman, to);

      // wait for 1 confirm if asked, using spinner
      let receipt = null;
      if (waitConfirm) {
        const spinnerId = startSpinner(`waiting confirm ${short(tx.hash)} (attempt ${attempt})`);
        try {
          receipt = await tx.wait(1);
        } finally {
          stopSpinner(spinnerId);
        }
      }
      // success
      return { success: true, txHash: tx.hash, receipt };
    } catch (err) {
      // capture error message
      const msg = (err && err.message) ? err.message : String(err);
      // if last attempt, return failure
      if (attempt >= maxRetries) {
        printFailed(msg, token.symbol, amountHuman, to, attempt);
        return { success: false, error: msg };
      } else {
        // print retry warn and loop
        console.log(`${COL.yellow}[${now()}] ⚠ retrying (${attempt}/${maxRetries}) due to: ${msg}${COL.reset}`);
        // small backoff
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
    }
  }
  // fallback
  return { success: false, error: 'unknown' };
}

// helper to get token balance (raw and human)
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

// main menu runner (exports)
async function runSendMenu({ provider, wallet, tokens, ethers }) {
  const explorerBase = process.env.EXPLORER_BASE || '';

  while (true) {
    // menu choices
    const choices = tokens.map((t,i)=>({
      name: `Send Token: ${t.symbol}` + (t.balanceHuman ? ` — balance: ${t.balanceHuman}` : ''),
      value: i
    }));
    choices.push({ name: 'Send Semua Token', value: 'send_all' });
    choices.push({ name: 'Back to Main Menu', value: 'back' });

    const { menu } = await prompt([{ type:'list', name:'menu', message:'Send Address - pilih:', choices }]);
    if (menu === 'back') return;

    // target selection (for single token or send_all)
    let targetMode = null;
    if (menu === 'send_all') {
      const ans = await prompt([{
        type:'list', name:'destType', message:'Pilih tujuan untuk Send Semua Token:', choices:[
          { name:'Send to Random Address', value:'random' },
          { name:'Send to Manual Address', value:'manual' },
          { name:'Back', value:'back' }
        ]
      }]);
      if (ans.destType === 'back') continue;
      targetMode = ans.destType;
    } else {
      const ans = await prompt([{
        type:'list', name:'destType', message:`Tujuan untuk ${tokens[menu].symbol}:`, choices:[
          { name:'Send to Random Address', value:'random' },
          { name:'Send to Manual Address', value:'manual' },
          { name:'Back', value:'back' }
        ]
      }]);
      if (ans.destType === 'back') continue;
      targetMode = ans.destType;
    }

    let manualTo = null;
    if (targetMode === 'manual') {
      const ans = await prompt([{ type:'input', name:'manualAddress', message:'Masukkan address tujuan:', validate: v => ethers.isAddress(v) ? true : 'Address tidak valid' }]);
      manualTo = ans.manualAddress;
    }

    // common prompts: amount per tx, sendCount, waitConfirm
    const { amount } = await prompt([{ type:'input', name:'amount', message:'Jumlah yang akan dikirim per tx (per token):', default:'1', validate: v => !isNaN(Number(v)) ? true : 'Masukkan angka valid' }]);
    const { sendCount } = await prompt([{ type:'input', name:'sendCount', message:'Jumlah TX yang akan dikirim (0 = sampai balance habis):', default:'1', validate: v=> { const n=Number(v); return (!isNaN(n) && n>=0) ? true : 'Masukkan angka >=0'; } }]);
    const { waitConfirm } = await prompt([{ type:'confirm', name:'waitConfirm', message:'Tunggu 1 konfirmasi tiap tx?', default: String(process.env.WAIT_CONFIRM||'true')==='true' }]);
    const countNum = Number(sendCount);

    // counters
    let totalAttempts = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    // send_all flow
    if (menu === 'send_all') {
      // iterate tokens
      for (const token of tokens) {
        // reset per-token counters
        let sentForToken = 0;
        while (countNum === 0 ? true : sentForToken < countNum) {
          // check balance
          const { bal, dec, human } = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
          if (bal == null || dec == null) { tlog(`Failed reading balance for ${token.symbol}, skipping.`); break; }
          const unitAmount = ethers.parseUnits(String(amount), dec);
          if (BigInt(bal) < BigInt(unitAmount)) {
            tlog(`${COL.yellow}[${now()}] Insufficient ${token.symbol} balance (${human}), skip token.${COL.reset}`);
            break;
          }

          // destination
          const to = (targetMode === 'random') ? ethers.Wallet.createRandom().address : manualTo;

          // send with retries
          totalAttempts++;
          const res = await sendERC20WithRetries(provider, wallet, ethers, token, to, amount, waitConfirm, 3);
          if (res.success) {
            totalSuccess++;
            sentForToken++;
            // print confirmed if receipt exists, otherwise just show sent
            if (res.receipt) printSuccess(res.txHash, explorerBase, token.symbol, amount, to, res.receipt);
            else console.log(`${COL.green}[${now()}] ✅ SENT ${short(res.txHash)}${COL.reset}`);
          } else {
            totalFailed++;
          }

          // break if count specified and reached
          if (!(countNum === 0 ? true : sentForToken < countNum)) break;
          // interval
          const interval = Number(process.env.INTERVAL_MS || 1500);
          await new Promise(r => setTimeout(r, interval));
        } // end while per token
      } // end for tokens

    } else {
      // single token flow
      const token = tokens[menu];
      let sentForToken = 0;
      while (countNum === 0 ? true : sentForToken < countNum) {
        // check balance
        const { bal, dec, human } = await getTokenBalance(provider, token, await wallet.getAddress(), ethers);
        if (bal == null || dec == null) { tlog(`Failed reading balance for ${token.symbol}, abort.`); break; }
        const unitAmount = ethers.parseUnits(String(amount), dec);
        if (BigInt(bal) < BigInt(unitAmount)) {
          tlog(`${COL.yellow}[${now()}] Insufficient ${token.symbol} balance (${human}), stop.${COL.reset}`);
          break;
        }

        const to = (targetMode === 'random') ? ethers.Wallet.createRandom().address : manualTo;
        totalAttempts++;
        const res = await sendERC20WithRetries(provider, wallet, ethers, token, to, amount, waitConfirm, 3);
        if (res.success) {
          totalSuccess++;
          sentForToken++;
          if (res.receipt) printSuccess(res.txHash, explorerBase, token.symbol, amount, to, res.receipt);
          else console.log(`${COL.green}[${now()}] ✅ SENT ${short(res.txHash)}${COL.reset}`);
        } else {
          totalFailed++;
        }

        if (!(countNum === 0 ? true : sentForToken < countNum)) break;
        const interval = Number(process.env.INTERVAL_MS || 1500);
        await new Promise(r => setTimeout(r, interval));
      } // end while
    }

    // summary for this session
    console.log('\n' + COL.bright + '=== SESSION SUMMARY ===' + COL.reset);
    console.log(`Total attempts: ${totalAttempts}`);
    console.log(`${COL.green}Succeeded: ${totalSuccess}${COL.reset}  ${COL.red}Failed: ${totalFailed}${COL.reset}`);
    console.log('========================\n');

  } // end main while
}

module.exports = { runSendMenu };
