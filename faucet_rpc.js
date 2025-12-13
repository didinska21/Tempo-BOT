// faucet_rpc.js (tempo_fundAddress caller)
require('dotenv').config();
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function now(){ return new Date().toISOString(); }
async function rlQuestion(q){ const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout }); return new Promise(res => rl.question(q, a => { rl.close(); res(a); })); }

async function runInteractive() {
  if (!process.env.RPC_URL) { console.log('Set RPC_URL in .env'); return; }
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, provider) : null;

  const menu = ['Claim to Self (PRIVATE_KEY in .env)','Claim to Manual Address','Claim from addresses file (.txt/.csv)','Back'];
  menu.forEach((m,i)=>console.log(`${i+1}. ${m}`));
  const selIdx = Number(await rlQuestion('Pilih menu (nomor): ')) - 1;
  if (selIdx < 0 || selIdx >= menu.length) { console.log('Invalid'); return; }
  if (selIdx === 3) return;

  let addresses = [];
  if (selIdx === 0) {
    if (!wallet) { console.log('PRIVATE_KEY missing'); return; }
    addresses = [await wallet.getAddress()];
  } else if (selIdx === 1) {
    const manual = (await rlQuestion('Masukkan address tujuan: ')).trim();
    if (!ethers.isAddress(manual)) { console.log('Address invalid'); return; }
    addresses = [manual];
  } else if (selIdx === 2) {
    const filePath = (await rlQuestion('Path file (one address per line): ')).trim() || './addresses.txt';
    try { const txt = fs.readFileSync(filePath,'utf8'); addresses = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); } catch(e){ console.log('Read file failed'); return; }
  }

  const perAddressCount = Math.max(1, Number((await rlQuestion('Jumlah claim per address (1): ')).trim() || '1'));
  const interval = Number((await rlQuestion('Jeda antar klaim (ms) (default 1500): ')).trim() || process.env.INTERVAL_MS || 1500);
  const maxRetries = Math.max(1, Number((await rlQuestion('Max retries per claim (default 3): ')).trim() || '3'));

  console.log(`Will claim ${perAddressCount}x per address for ${addresses.length} address(es). Interval ${interval}ms.`);

  const sessionLog = { timestamp: now(), rpc: process.env.RPC_URL, entries: [] };
  let totalAttempts=0, totalSuccess=0, totalFailed=0;

  for (const addr of addresses) {
    for (let i=0;i<perAddressCount;i++) {
      totalAttempts++;
      process.stdout.write(`[${now()}] Claiming ${addr} (${i+1}/${perAddressCount}) ... `);
      let attempt=0, ok=false, lastRes=null;
      while(attempt < maxRetries && !ok) {
        attempt++;
        try {
          const res = await provider.send('tempo_fundAddress', [addr]);
          ok = true;
          totalSuccess++;
          console.log(`OK. result: ${JSON.stringify(res).slice(0,200)}`);
          sessionLog.entries.push({ timestamp: now(), address: addr, success: true, attempt, result: res });
        } catch(e) {
          lastRes = e && e.message ? e.message : String(e);
          console.log(`Error attempt ${attempt}: ${lastRes}`);
          if (attempt >= maxRetries) { totalFailed++; sessionLog.entries.push({ timestamp: now(), address: addr, success:false, attempt, error: lastRes }); }
          else await new Promise(r=>setTimeout(r, 1000*attempt));
        }
      }
      await new Promise(r=>setTimeout(r, interval));
    }
  }

  sessionLog.summary = { attempts: totalAttempts, success: totalSuccess, failed: totalFailed };
  const fileName = path.join(LOG_DIR, `faucet_rpc_log_${(new Date()).toISOString().replace(/[:.]/g,'-')}.json`);
  fs.writeFileSync(fileName, JSON.stringify(sessionLog, null, 2), 'utf8');
  console.log('Session finished:', sessionLog.summary);
  console.log('Log saved to', fileName);
}

module.exports = { runInteractive };
if (require.main === module) runInteractive().catch(e=>{ console.error('Fatal:', e && e.stack ? e.stack : e); process.exit(1); });
