// send.js (updated)
// - No native
// - Per-token: choose Manual or Random destination
// - Ask how many TX (0 = until balance depleted)
// - Wait for confirmation option
// - Prints explorer link for each tx
// Requires: ethers v6, inquirer, dotenv (main.js loads dotenv)
// runSendMenu({ provider, wallet, tokens, ethers })

const inquirer = require('inquirer');

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

function tlog(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }

const EXPLORER_BASE = process.env.EXPLORER_BASE || '';

async function getTokenContract(provider, tokenAddr, walletOrProvider) {
  return new (require('ethers')).Contract(tokenAddr, ERC20_ABI, walletOrProvider);
}

async function getTokenBalance(provider, tokenAddr, address, ethers) {
  try {
    const c = await getTokenContract(provider, tokenAddr, provider);
    const dec = await c.decimals();
    const bal = await c.balanceOf(address);
    return { bal, dec };
  } catch (e) {
    return { bal: null, dec: null };
  }
}

function formatUnitsSafe(ethers, value, decimals) {
  try { return ethers.formatUnits(value, decimals); } catch (e) { return String(value); }
}

function randomAddress(ethers) {
  return ethers.Wallet.createRandom().address;
}

function shortHash(h) {
  if (!h) return '';
  if (h.length > 20) return h.slice(0,10) + '...' + h.slice(-6);
  return h;
}

function printTxSummaryWithExplorer(txResp, receipt, from, to, tokenSymbol, amountHuman, ethers) {
  tlog('TX Hash:', txResp.hash);
  if (EXPLORER_BASE) console.log('Explorer:', `${EXPLORER_BASE}/tx/${txResp.hash}`);
  console.log(' from:', from);
  console.log(' to:', to);
  console.log(' token:', tokenSymbol);
  console.log(' amount:', amountHuman);
  if (receipt) {
    console.log(' block:', receipt.blockNumber);
    console.log(' status:', receipt.status);
    console.log(' gasUsed:', String(receipt.gasUsed));
    try {
      const eff = receipt.effectiveGasPrice ?? 0n;
      const fee = BigInt(receipt.gasUsed) * BigInt(eff);
      console.log(' txFee (wei):', String(fee));
      console.log(' txFee (ETH):', ethers.formatEther(fee));
    } catch {}
  }
  console.log('-----------------------------------');
}

async function sendERC20Once(provider, wallet, ethers, token, to, amountHuman, waitConfirm) {
  const contract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amount = ethers.parseUnits(String(amountHuman), decimals);

  tlog(`Sending ${amountHuman} ${token.symbol} -> ${to} (decimals ${decimals}) ...`);
  const tx = await contract.transfer(to, amount);
  tlog('Sent. hash:', tx.hash);
  let receipt = null;
  if (waitConfirm) {
    tlog('Waiting for 1 confirmation...');
    receipt = await tx.wait(1);
    tlog('Confirmed in block', receipt.blockNumber);
  }
  return { tx, receipt };
}

async function runSendMenu({ provider, wallet, tokens, ethers }) {
  while (true) {
    // Build menu choices showing balanceHuman if present
    const choices = tokens.map((t,i) => ({
      name: `Send Token: ${t.symbol}` + (t.balanceHuman ? ` — balance: ${t.balanceHuman}` : ''),
      value: i
    }));
    choices.push({ name: 'Send Semua Token', value: 'send_all' });
    choices.push({ name: 'Back to Main Menu', value: 'back' });

    const { menu } = await prompt([{
      type: 'list',
      name: 'menu',
      message: 'Send Address - pilih:',
      choices
    }]);

    if (menu === 'back') return;

    if (menu === 'send_all') {
      // send same amount per token to chosen dest
      const { destType } = await prompt([{
        type: 'list',
        name: 'destType',
        message: 'Pilih tujuan untuk Send Semua Token:',
        choices: [
          { name: 'Send to Random Address', value: 'random' },
          { name: 'Send to Manual Address', value: 'manual' },
          { name: 'Back', value: 'back' }
        ]
      }]);
      if (destType === 'back') continue;

      let to;
      if (destType === 'random') to = randomAddress(ethers);
      else {
        const ans = await prompt([{
          type: 'input', name: 'manualAddress', message: 'Masukkan address tujuan:',
          validate: v => ethers.isAddress(v) ? true : 'Address tidak valid'
        }]);
        to = ans.manualAddress;
      }

      const { amount } = await prompt([{
        type: 'input', name: 'amount', message: 'Jumlah per token yang akan dikirim (per token):', default: '1',
        validate: v => !isNaN(Number(v)) ? true : 'Masukkan angka valid'
      }]);

      const { sendCount } = await prompt([{
        type: 'input', name: 'sendCount', message: 'Jumlah TX yang akan dikirim per token (0 = sampai balance habis):', default: '1',
        validate: v => { const n = Number(v); return (!isNaN(n) && n >= 0) ? true : 'Masukkan angka >= 0'; }
      }]);

      const countNum = Number(sendCount);
      const waitConfirmAns = await prompt([{ type:'confirm', name:'waitConfirm', message:'Tunggu 1 konfirmasi tiap tx?', default: String(process.env.WAIT_CONFIRM||'true')==='true' }]);
      const waitConfirm = waitConfirmAns.waitConfirm;

      // loop tokens and send per token
      for (const token of tokens) {
        let sent = 0;
        while (countNum === 0 ? true : sent < countNum) {
          // check balance
          const { bal, dec } = await getTokenBalance(provider, token.address, await wallet.getAddress(), ethers);
          if (bal == null || dec == null) {
            tlog(`Gagal ambil balance ${token.symbol}, skip.`);
            break;
          }
          // amount in smallest unit
          const unitAmount = ethers.parseUnits(String(amount), dec);
          if (BigInt(bal) < BigInt(unitAmount)) {
            tlog(`Saldo ${token.symbol} tidak cukup (remaining ${formatUnitsSafe(ethers, bal, dec)}), stop sending this token.`);
            break;
          }

          // destination: if random chosen earlier -> same to every iteration? we'll regenerate per tx for "random"
          let dest = to;
          if (destType === 'random') dest = randomAddress(ethers);

          try {
            const { tx, receipt } = await sendERC20Once(provider, wallet, ethers, token, dest, amount, waitConfirm);
            printTxSummaryWithExplorer(tx, receipt, await wallet.getAddress(), dest, token.symbol, amount, ethers);
            sent++;
          } catch (err) {
            tlog(`Error kirim ${token.symbol}:`, err && err.message ? err.message : err);
            // If tx fails, break this token loop to avoid infinite retry
            break;
          }

          // interval between tx
          const interval = Number(process.env.INTERVAL_MS || 1500);
          await new Promise(r => setTimeout(r, interval));
        } // end while per token
      } // end for tokens

      tlog('Send Semua selesai.');
      continue;
    } // end send_all

    // Single token send flow
    const token = tokens[menu];

    // destination submenu
    const { destType } = await prompt([{
      type: 'list',
      name: 'destType',
      message: `Tujuan untuk ${token.symbol}:`,
      choices: [
        { name: 'Send to Random Address', value: 'random' },
        { name: 'Send to Manual Address', value: 'manual' },
        { name: 'Back', value: 'back' }
      ]
    }]);

    if (destType === 'back') continue;

    let to;
    if (destType === 'random') to = randomAddress(ethers);
    else {
      const ans = await prompt([{
        type: 'input',
        name: 'manualAddress',
        message: 'Masukkan address tujuan:',
        validate: v => ethers.isAddress(v) ? true : 'Address tidak valid'
      }]);
      to = ans.manualAddress;
    }

    const { amount } = await prompt([{
      type: 'input', name: 'amount', message: `Jumlah ${token.symbol} yang akan dikirim per tx:`, default: '1',
      validate: v => !isNaN(Number(v)) ? true : 'Masukkan angka valid'
    }]);

    const { sendCount } = await prompt([{
      type: 'input', name: 'sendCount', message: 'Jumlah TX yang akan dikirim (0 = sampai balance habis):', default: '1',
      validate: v => { const n = Number(v); return (!isNaN(n) && n >= 0) ? true : 'Masukkan angka >= 0'; }
    }]);

    const countNum = Number(sendCount);
    const { waitConfirm } = await prompt([{ type:'confirm', name:'waitConfirm', message:'Tunggu 1 konfirmasi tiap tx?', default: String(process.env.WAIT_CONFIRM||'true')==='true' }]);

    let sent = 0;
    while (countNum === 0 ? true : sent < countNum) {
      // check balance
      const { bal, dec } = await getTokenBalance(provider, token.address, await wallet.getAddress(), ethers);
      if (bal == null || dec == null) {
        tlog('Gagal ambil balance token, abort.');
        break;
      }
      const unitAmount = ethers.parseUnits(String(amount), dec);
      if (BigInt(bal) < BigInt(unitAmount)) {
        tlog(`Saldo ${token.symbol} tidak cukup (remaining ${formatUnitsSafe(ethers, bal, dec)}), stop.`);
        break;
      }

      // if destType random, generate new address each iteration
      if (destType === 'random') to = randomAddress(ethers);

      try {
        const { tx, receipt } = await sendERC20Once(provider, wallet, ethers, token, to, amount, waitConfirm);
        printTxSummaryWithExplorer(tx, receipt, await wallet.getAddress(), to, token.symbol, amount, ethers);
        sent++;
      } catch (err) {
        tlog('Error saat mengirim:', err && err.message ? err.message : err);
        break;
      }

      if (!(countNum === 0 ? true : sent < countNum)) break;

      const interval = Number(process.env.INTERVAL_MS || 1500);
      await new Promise(r => setTimeout(r, interval));
    } // end while

    tlog(`Selesai mengirim ${token.symbol}. total sent: ${sent}`);
  } // end main while
}

module.exports = { runSendMenu };
