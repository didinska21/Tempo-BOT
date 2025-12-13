// faucet.js (ESM - RPC only)
import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import { JsonRpcProvider, Wallet } from 'ethers';

export async function runInteractive() {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const address = await wallet.getAddress();

  console.clear();
  console.log(chalk.magenta.bold('FAUCET CLAIM (RPC)'));
  console.log(chalk.gray('────────────────────────'));

  console.log('Address:', chalk.cyan(address));

  const spin = ora('Claiming faucet...').start();
  try {
    const res = await provider.send('tempo_fundAddress', [address]);
    spin.succeed('Faucet success');

    console.log(chalk.green('Result:'), res);
  } catch (e) {
    spin.fail('Faucet failed');
    console.log(chalk.red(e.message));
  }

  await new Promise(r => setTimeout(r, 1500));
}
