// faucet.js (ESM - RPC only, upgraded)
import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { JsonRpcProvider, Wallet } from 'ethers';

// readline helper
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

  // === INPUT JUMLAH CLAIM ===
  let count;
  while (true) {
    const input = (await rlQuestion('Jumlah faucet yang mau di-claim (1 - 100): ')).trim();
    const n = Number(input);
    if (!Number.isNaN(n) && n >= 1 && n <= 100) {
      count = n;
      break;
    }
    console.log(chalk.red('Masukkan angka antara 1 sampai 100'));
  }

  console.log(chalk.gray(`\nMulai claim ${count}x...\n`));

  let success = 0;
  let failed = 0;

  for (let i = 1; i <= count; i++) {
    const spin = ora(`Claiming faucet ${i}/${count}...`).start();
    try {
      const res = await provider.send('tempo_fundAddress', [address]);
      spin.succeed(`Claim ${i} success`);
      success++;

      console.log(
        chalk.green('✔ Result:'),
        Array.isArray(res) ? res.join(', ').slice(0, 120) : res
      );
    } catch (e) {
      spin.fail(`Claim ${i} failed`);
      console.log(chalk.red(e.message || e));
      failed++;
    }

    // delay kecil biar aman
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(chalk.gray('\n────────────────────────'));
  console.log(chalk.green(`Success: ${success}`), chalk.red(`Failed: ${failed}`));
  console.log(chalk.gray('Faucet session selesai.'));
  console.log();

  await new Promise(r => setTimeout(r, 1500));
    }
