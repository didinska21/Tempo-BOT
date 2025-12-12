// send.js — FINAL CLEAN
const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk').default;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

let logCounter = 0;
const MAX_LOG = 5;

function clearSmart() {
  logCounter++;
  if (logCounter >= MAX_LOG) {
    console.clear();
    logCounter = 0;
  }
}

function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a.trim());
  }));
}

async function askInput(msg, def = '') {
  const a = await rlQuestion(`${msg} (${def}): `);
  return a === '' ? def : a;
}

async function askNumbered(items, prompt) {
  items.forEach((it, i) => console.log(`${i + 1}. ${it}`));
  while (true) {
    const n = Number(await rlQuestion(prompt + ' '));
    if (n >= 1 && n <= items.length) return n - 1;
    console.log('Invalid');
  }
}

function progress(cur, total) {
  const w = 30;
  const f = Math.round((cur / total) * w);
  process.stdout.write(`\rProgress |${'█'.repeat(f)}${'-'.repeat(w - f)}| ${cur}/${total}`);
  if (cur === total) process.stdout.write('\n');
}

module.exports.runSendMenu = async function ({ provider, wallet, tokens, stats }) {
  while (true) {
    console.log('');
    tokens.forEach((t, i) =>
      console.log(`${i + 1}. Send ${t.symbol} (balance ${t.balanceHuman})`)
    );
    console.log(`${tokens.length + 1}. Send Semua Token`);
    console.log(`${tokens.length + 2}. Back`);

    const sel = Number(await rlQuestion('Pilih: ')) - 1;
    if (sel === tokens.length + 1) return;

    const tokenList = sel === tokens.length ? tokens : [tokens[sel]];

    const destMode = await askNumbered(
      ['Send to Random Address', 'Send to Manual Address'],
      'Tujuan'
    );

    let toAddr = null;
    if (destMode === 1) {
      toAddr = await askInput('Address tujuan');
      if (!ethers.isAddress(toAddr)) return;
    }

    const amount = await askInput('Jumlah per tx', '1');
    const count = Number(await askInput('Jumlah tx (0 = sampai habis)', '1'));
    const wait = (await askNumbered(['Yes', 'No'], 'Tunggu konfirmasi?')) === 0;

    let done = 0;
    const total = count === 0 ? 9999 : count * tokenList.length;

    for (const token of tokenList) {
      const c = new ethers.Contract(token.address, ERC20_ABI, wallet);
      const dec = await c.decimals();

      while (count === 0 || done < total) {
        const bal = await c.balanceOf(await wallet.getAddress());
        const amt = ethers.parseUnits(amount, dec);
        if (bal < amt) break;

        const to = destMode === 0 ? ethers.Wallet.createRandom().address : toAddr;

        try {
          stats.inc('attempts', 1);
          const tx = await c.transfer(to, amt);
          console.log(chalk.yellow(`➜ ${token.symbol} ${amount} → ${to}`));
          clearSmart();

          if (wait) await tx.wait(1);
          console.log(chalk.green(`✓ ${tx.hash}`));
          clearSmart();

          if (process.env.EXPLORER_BASE)
            console.log(`${process.env.EXPLORER_BASE}/tx/${tx.hash}`);

          stats.inc('success', 1);
        } catch {
          stats.inc('failed', 1);
        }

        done++;
        progress(done, total);
        await new Promise(r => setTimeout(r, 1200));
        if (count !== 0 && done >= total) break;
      }
    }

    console.log('\nSESSION DONE\n');
    await rlQuestion('ENTER untuk kembali...');
    console.clear();
  }
};
