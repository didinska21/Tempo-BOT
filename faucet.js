// faucet.js (ESM - RPC only, formatted output)
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

// ===== readline helper =====
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a);
  }));
}

export async function runInteractive() {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const address = await wallet.getAddress();

  console.clear();
  console.log(chalk.magenta.bold('FAUCET CLAIM (RPC)'));
  console.log(chalk.gray('────────────────────────'));
  console.log('Address:', chalk.cyan(address));
  console.log();

  // input jumlah claim
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
    const spin = ora(`Claim faucet ${i}/${total}...`).start();

    try {
      const txHashes = await provider.send('tempo_fundAddress', [address]);
      spin.succeed(`Berhasil claim faucet`);

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
      spin.fail(`Claim ${i} gagal`);
      console.log(chalk.red(e.message || e));
    }

    console.log(); // spasi antar batch
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(chalk.gray('────────────────────────'));
  console.log(chalk.green('Faucet selesai.'));
  await new Promise(r => setTimeout(r, 1200));
}
