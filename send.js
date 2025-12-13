// send.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const { SingleBar, Presets } = require('cli-progress');

function rlQuestion(q){ const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout }); return new Promise(res => rl.question(q, a => { rl.close(); res(a); })); }
async function askNumbered(items, prompt='Pilih (nomor):'){ items.forEach((it,i)=>console.log(`${i+1}. ${it}`)); while(true){ const a = (await rlQuestion(prompt+' ')).trim(); const n=Number(a); if(!Number.isNaN(n) && n>=1 && n<=items.length) return n-1; console.log('Masukkan nomor valid.'); } }
async function askInput(msg, def=''){ const a = (await rlQuestion(`${msg}${def? ' ('+def+')':''}: `)).trim(); return a === '' ? def : a; }

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

function now(){ return new Date().toISOString(); }
function short(h){ if(!h) return ''; return h.length>18 ? h.slice(0,10)+'...'+h.slice(-6):h; }

async function getTokenBalance(provider, token, address) {
  try {
    const c = new ethers.Contract(token.address, ERC20_ABI, provider);
    const dec = await c.decimals();
    const bal = await c.balanceOf(address);
    return { bal, dec, human: ethers.formatUnits(bal, dec) };
  } catch(e) {
    return { bal: null, dec: null, human: 'err' };
  }
}

async function sendERC20WithRetries(wallet, token, to, amountHuman, waitConfirm, maxRetries=3, gasOverrides={}) {
  const contract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amountUnits = ethers.parseUnits(String(amountHuman), decimals);
  let attempt = 0;
  while(attempt < maxRetries) {
    attempt++;
    try {
      const tx = await contract.transfer(to, amountUnits, gasOverrides);
      console.log(`[${now()}] ➜ SENT ${short(tx.hash)}  token:${token.symbol} amount:${amountHuman} to:${to}`);
      if (waitConfirm) {
        const r = await tx.wait(1);
        console.log(`[${now()}] ✅ CONFIRMED ${short(tx.hash)} block:${r.blockNumber} gasUsed:${String(r.gasUsed)}`);
      }
      return { success:true, txHash: tx.hash };
    } catch(e) {
      const msg = e && e.message ? e.message : String(e);
      console.log(`[${now()}] ⚠ Error attempt ${attempt}: ${msg}`);
      if (attempt >= maxRetries) return { success:false, error: msg };
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return { success:false, error:'unknown' };
}

async function runSendMenu({ provider, wallet, ethers:ethersLib, tokens, quickStats } = {}) {
  const walletAddress = wallet ? await wallet.getAddress() : null;
  while(true) {
    // build choices
    const choices = tokens.map((t,i)=> `${i+1}. Send Token: ${t.symbol} — balance: ${t.balanceHuman}`);
    choices.push(`${choices.length+1}. Send Semua Token`);
    choices.push(`${choices.length+2}. Back to Main Menu`);
    choices.forEach((c)=>console.log(c));
    const selIdx = Number(await askInput('Pilih menu (masukkan nomor):','')) - 1;
    if (isNaN(selIdx) || selIdx < 0 || selIdx >= choices.length) { console.log('Pilihan tidak valid'); continue; }
    const isBack = selIdx === (choices.length-1);
    if (isBack) return;
    const isSendAll = selIdx === (choices.length-2);
    let destType;
    if (isSendAll) {
      const d = await askNumbered(['Send to Random Address','Send to Manual Address','Back'],'Tujuan untuk Send Semua Token:');
      if (d === 2) continue;
      destType = d===0 ? 'random' : 'manual';
    } else {
      const d = await askNumbered(['Send to Random Address','Send to Manual Address','Back'], `Tujuan untuk ${tokens[selIdx].symbol}:`);
      if (d === 2) continue;
      destType = d===0 ? 'random' : 'manual';
    }
    let manualTo = null;
    if (destType === 'manual') {
      manualTo = await askInput('Masukkan address tujuan:','');
      if (!ethers.isAddress(manualTo)) { console.log('Address tidak valid'); continue; }
    }
    const amount = await askInput('Jumlah yang akan dikirim per tx (per token)', '1');
    const sendCount = Number(await askInput('Jumlah TX yang akan dikirim (0 = sampai balance habis)', '1'));
    const waitConfirm = (await askNumbered(['Yes','No'],'Tunggu 1 konfirmasi tiap tx?')) === 0;

    // estimate total planned
    let totalPlanned = 0;
    if (isSendAll) {
      for (const token of tokens) totalPlanned += (sendCount===0 ? 1 : sendCount);
    } else totalPlanned = (sendCount===0 ? 1 : sendCount);
    if (totalPlanned <= 0) totalPlanned = 1;
    const progress = new SingleBar({ format: 'Progress |{bar}| {value}/{total} TXs' }, Presets.rect);
    progress.start(totalPlanned, 0);

    // loop send
    let attempts=0, success=0, failed=0;
    if (isSendAll) {
      for (const token of tokens) {
        let sentForToken = 0;
        while(sendCount===0 ? true : sentForToken < sendCount) {
          const balInfo = await getTokenBalance(provider, token, walletAddress);
          if (!balInfo.bal) { console.log(`[${now()}] Failed reading ${token.symbol}, skip.`); break; }
          const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
          if (BigInt(balInfo.bal) < BigInt(unitAmount)) { console.log(`[${now()}] Insufficient ${token.symbol} balance (${balInfo.human}), skip token.`); break; }
          const to = destType==='random' ? ethers.Wallet.createRandom().address : manualTo;
          attempts++;
          const res = await sendERC20WithRetries(wallet, token, to, amount, waitConfirm, 3, {});
          progress.increment();
          if (res.success) { success++; if (res.txHash) console.log(`[${now()}] TX: ${process.env.EXPLORER_BASE || ''}/tx/${res.txHash}`); sentForToken++; }
          else { failed++; }
          if (sendCount!==0 && sentForToken >= sendCount) break;
          await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
        }
      }
    } else {
      const token = tokens[selIdx];
      let sentForToken = 0;
      while(sendCount===0 ? true : sentForToken < sendCount) {
        const balInfo = await getTokenBalance(provider, token, walletAddress);
        if (!balInfo.bal) { console.log(`[${now()}] Failed reading ${token.symbol}, abort.`); break; }
        const unitAmount = ethers.parseUnits(String(amount), balInfo.dec);
        if (BigInt(balInfo.bal) < BigInt(unitAmount)) { console.log(`[${now()}] Insufficient ${token.symbol} balance (${balInfo.human}), stop.`); break; }
        const to = destType==='random' ? ethers.Wallet.createRandom().address : manualTo;
        attempts++;
        const res = await sendERC20WithRetries(wallet, token, to, amount, waitConfirm, 3, {});
        progress.increment();
        if (res.success) { success++; if (res.txHash) console.log(`[${now()}] TX: ${process.env.EXPLORER_BASE || ''}/tx/${res.txHash}`); sentForToken++; }
        else { failed++; }
        if (sendCount!==0 && sentForToken >= sendCount) break;
        await new Promise(r => setTimeout(r, Number(process.env.INTERVAL_MS || 1500)));
      }
    }
    progress.stop();
    console.log('\n=== SESSION SUMMARY ===');
    console.log(`Total attempts: ${attempts}`);
    console.log(`Succeeded: ${success}  Failed: ${failed}`);
    console.log('========================\n');
    // update quick stats
    if (quickStats) { quickStats.attempts += attempts; quickStats.success += success; quickStats.failed += failed; }
  }
}

module.exports = { runSendMenu };
