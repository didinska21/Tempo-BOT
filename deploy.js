// deploy.js (ESM - beautified)
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { ContractFactory } from 'ethers';

const BUILD = './build';

function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}

async function askNumbered(items, title) {
  console.log(chalk.cyan('\n' + title));
  items.forEach((it, i) => console.log(chalk.cyan(` ${i + 1}. ${it}`)));
  while (true) {
    const n = Number(await rlQuestion('> '));
    if (!isNaN(n) && n >= 1 && n <= items.length) return n - 1;
  }
}

function loadBuild(name) {
  return {
    abi: JSON.parse(fs.readFileSync(path.join(BUILD, `${name}.abi.json`))),
    bytecode: fs.readFileSync(path.join(BUILD, `${name}.bytecode.txt`), 'utf8')
  };
}

export async function runDeployMenu({ provider, wallet }) {
  while (true) {
    console.clear();
    console.log(chalk.magenta.bold('DEPLOY MENU'));
    console.log(chalk.gray('────────────────────────'));

    const sel = await askNumbered(
      ['Deploy ERC20 Token', 'Deploy ERC721 NFT', 'Back'],
      'Pilih:'
    );
    if (sel === 2) return;

    if (sel === 0) {
      const { abi, bytecode } = loadBuild('SimpleERC20');
      const name = await rlQuestion('Token name: ');
      const symbol = await rlQuestion('Token symbol: ');
      const supply = await rlQuestion('Total supply: ');

      const spin = ora('Deploying ERC20...').start();
      const f = new ContractFactory(abi, bytecode, wallet);
      const c = await f.deploy(name, symbol, 18, supply);
      await c.waitForDeployment();
      spin.succeed('ERC20 deployed');

      console.log(chalk.green('Address:'), c.target);
      console.log(chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${c.deploymentTransaction().hash}`));
    }

    if (sel === 1) {
      const { abi, bytecode } = loadBuild('SimpleERC721');
      const name = await rlQuestion('NFT name: ');
      const symbol = await rlQuestion('NFT symbol: ');

      const spin = ora('Deploying ERC721...').start();
      const f = new ContractFactory(abi, bytecode, wallet);
      const c = await f.deploy(name, symbol);
      await c.waitForDeployment();
      spin.succeed('ERC721 deployed');

      console.log(chalk.green('NFT Contract:'), c.target);
      console.log(chalk.gray('Mint dilakukan manual jika diperlukan'));
    }

    await rlQuestion('\nEnter untuk kembali...');
  }
}
