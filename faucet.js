// faucet.js (ESM - RPC only, UX premium + countdown)
import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { JsonRpcProvider, Wallet } from 'ethers';

// ===== CONFIG =====
const TOKENS = [
  { symbol: 'PathUSD', amount: '1.000.000' },
  { symbol: 'AlphaUSD', amount: '1.000.000' },
  { symbol: 'BetaUSD', amount: '1.000.000' },
  { symbol: 'ThetaUSD', amount: '1.000.000' }
];

const PRE_CLAIM_ANIM_MS = 4000;  // animasi sebelum klaim
const CLAIM_DELAY_SEC = 15;     // jeda antar klaim
const FINISH_DELAY_SEC = 30;    // jeda sebelum balik menu

// ===== helpers =====
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a);
  }));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function countdown(seconds, label) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(
      chalk.gray(`\r${label} ${chalk.cyan(i + 's')}   `)
    );
    await sleep(1000);
  }
  process.stdout.write('\r'.padEnd(50) + '\r');
}

// ===== MAIN =====
export async function runInteractive() {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const address = await wallet.getAddress();

  console.clear();
  console.log(chalk.magenta.bold('FAUCET CLAIM (RPC)'));
  console.log(chalk.gray('────────────────────────'));
  console.log('Address:', chalk.cyan(address));
  console.log();

  // jumlah claim
  let total;
  while (true) {
    const v = Number((await rlQuestion('Jumlah claim faucet (1 - 100): ')).trim());
    if (!isNaN(v) && v >= 1 && v <= 100) {
      total = v;
      break;
    }
    console.log(chalk.red('Masukkan angka 1 - 100'));
  }

  console.log();

  for (let i = 1; i <= total; i++) {
    // animasi sebelum klaim
    const prep = ora(`Menyiapkan klaim ${i}/${total}...`).start();
    await sleep(PRE_CLAIM_ANIM_MS);
    prep.text = 'Mengirim request faucet...';

    try {
      const txHashes = await provider.send('tempo_fundAddress', [address]);
      prep.succeed('Berhasil claim faucet');

      console.log(chalk.cyan.bold(`\n${i}.`));
      console.log(chalk.green('berhasil claim faucet'));

      if (Array.isArray(txHashes)) {
        txHashes.forEach((tx, idx) => {
          const token = TOKENS[idx];
          if (!token) return;

          console.log(
            chalk.green('√'),
            chalk.white(`${token.amount} ${token.symbol}`),
            chalk.gray(':'),
            chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${tx}`)
          );
        });
      } else {
        console.log(chalk.yellow('Result:'), txHashes);
      }

    } catch (e) {
      prep.fail(`Claim ${i} gagal`);
      console.log(chalk.red(e.message || e));
    }

    // countdown antar klaim
    if (i < total) {
      console.log();
      await countdown(CLAIM_DELAY_SEC, 'Menunggu klaim berikutnya dalam');
      console.log();
    }
  }

  console.log(chalk.gray('────────────────────────'));
  console.log(chalk.green('Semua claim faucet selesai.'));
  console.log();

  await countdown(FINISH_DELAY_SEC, 'Kembali ke main menu dalam');
}
