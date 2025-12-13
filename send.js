// send.js (ESM - beautified, stable)
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { Contract, Wallet, isAddress, parseUnits } from 'ethers';
import { SingleBar, Presets } from 'cli-progress';

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)'
];

// ---------- helpers ----------
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}

async function askNumbered(items, title = 'Pilih:') {
  console.log(chalk.cyan('\n' + title));
  items.forEach((it, i) => console.log(chalk.cyan(` ${i + 1}. ${it}`)));
  while (true) {
    const a = (await rlQuestion(chalk.yellow('> '))).trim();
    const n = Number(a);
    if (!Number.isNaN(n) && n >= 1 && n <= items.length) return n - 1;
    console.log(chalk.red('Nomor tidak valid'));
  }
}

function now() {
  return new Date().toISOString();
}

function short(hash) {
  return hash.slice(0, 10) + '...' + hash.slice(-6);
}

// ---------- core ----------
async function sendToken({
  wallet,
  token,
  to,
  amountHuman,
  waitConfirm
}) {
  const c = new Contract(token.address, ERC20_ABI, wallet);
  const dec = await c.decimals();
  const amount = parseUnits(amountHuman, dec);

  const tx = await c.transfer(to, amount);
  console.log(chalk.yellow(`[${now()}] ➜ SENT ${short(tx.hash)}`));

  if (waitConfirm) {
    const spin = ora('Waiting confirmation...').start();
    const r = await tx.wait(1);
    spin.succeed(`Confirmed in block ${r.blockNumber}`);
  }

  console.log(
    chalk.green(`TX:`),
    chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${tx.hash}`)
  );
}

// ---------- menu ----------
export async function runSendMenu({ provider, wallet, tokens }) {
  while (true) {
    console.clear();
    console.log(chalk.magenta.bold('SEND TOKEN MENU'));
    console.log(chalk.gray('────────────────────────────'));

    const menu = tokens.map(t => `Send ${t.symbol}`);
    menu.push('Send Semua Token');
    menu.push('Back');

    const sel = await askNumbered(menu);
    if (sel === menu.length - 1) return;

    const destType = await askNumbered(
      ['Send to Random Address', 'Send to Manual Address'],
      'Tujuan:'
    );

    let to;
    if (destType === 0) {
      to = Wallet.createRandom().address;
      console.log(chalk.gray('Random address:'), chalk.white(to));
    } else {
      const addr = await rlQuestion('Masukkan address tujuan: ');
      if (!isAddress(addr)) {
        console.log(chalk.red('Address tidak valid'));
        continue;
      }
      to = addr;
    }

    const amount = await rlQuestion('Jumlah token per tx (default 1): ') || '1';
    const count = Number(await rlQuestion('Jumlah TX (0 = sampai balance habis): ') || '1');
    const isUnlimited = count === 0;
    const waitConfirm = (await askNumbered(['Yes', 'No'], 'Tunggu konfirmasi?')) === 0;

    const list = sel === tokens.length ? tokens : [tokens[sel]];
    const bar = new SingleBar({
  format: isUnlimited
    ? chalk.cyan('Progress') + ' |{bar}| TX sent: {value}'
    : chalk.cyan('Progress') + ' |{bar}| {value}/{total} TXs'
}, Presets.rect);

if (isUnlimited) {
  bar.start(1, 0); // total dummy, tidak ditampilkan
} else {
  bar.start(count, 0);
  }

    for (const token of list) {
      let sent = 0;
      while (count === 0 || sent < count) {
        try {
          await sendToken({ wallet, token, to, amountHuman: amount, waitConfirm });
          sent++;
          bar.increment();
        } catch (e) {
          console.log(chalk.red('TX failed:'), e.message);
          break;
        }
      }
    }

    bar.stop();
    await rlQuestion(chalk.gray('\nEnter untuk kembali ke menu...'));
  }
}
