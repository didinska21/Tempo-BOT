// deploy.js (ESM - FINAL STABLE)
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ContractFactory } from 'ethers';

// ===== path safe for ESM =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUILD_DIR = path.join(__dirname, 'build');

// ===== readline =====
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a);
  }));
}

async function askNumbered(items, title) {
  console.log(chalk.cyan('\n' + title));
  items.forEach((it, i) => console.log(chalk.cyan(` ${i + 1}. ${it}`)));
  while (true) {
    const n = Number(await rlQuestion('> '));
    if (!isNaN(n) && n >= 1 && n <= items.length) return n - 1;
    console.log(chalk.red('Masukkan nomor valid'));
  }
}

// ===== load build safely =====
function loadBuild(name) {
  const abiPath = path.join(BUILD_DIR, `${name}.abi.json`);
  const bytecodePath = path.join(BUILD_DIR, `${name}.bytecode.txt`);

  if (!fs.existsSync(abiPath) || !fs.existsSync(bytecodePath)) {
    throw new Error(
      `Artifact ${name} tidak ditemukan.\n` +
      `Pastikan file berikut ada:\n` +
      `- ${abiPath}\n` +
      `- ${bytecodePath}\n\n` +
      `Jalankan: node scripts/compile_all.js`
    );
  }

  return {
    abi: JSON.parse(fs.readFileSync(abiPath, 'utf8')),
    bytecode: fs.readFileSync(bytecodePath, 'utf8')
  };
}

// ===== MAIN =====
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

    try {
      // ================= ERC20 =================
      if (sel === 0) {
        const { abi, bytecode } = loadBuild('SimpleERC20');

        const name = await rlQuestion('Token name: ');
        const symbol = await rlQuestion('Token symbol: ');
        const supply = await rlQuestion('Total supply (human): ');

        const spin = ora('Deploying ERC20...').start();
        const factory = new ContractFactory(abi, bytecode, wallet);
        const contract = await factory.deploy(
          name,
          symbol,
          18,
          BigInt(supply) * 10n ** 18n
        );
        await contract.waitForDeployment();
        spin.succeed('ERC20 deployed');

        console.log(chalk.green('Address:'), contract.target);
        console.log(
          chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`)
        );
      }

      // ================= ERC721 =================
      if (sel === 1) {
        const { abi, bytecode } = loadBuild('SimpleERC721');

        const name = await rlQuestion('NFT name: ');
        const symbol = await rlQuestion('NFT symbol: ');

        const spin = ora('Deploying ERC721...').start();
        const factory = new ContractFactory(abi, bytecode, wallet);
        const contract = await factory.deploy(name, symbol);
        await contract.waitForDeployment();
        spin.succeed('ERC721 deployed');

        console.log(chalk.green('NFT Contract:'), contract.target);
        console.log(
          chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`)
        );

        console.log(
          chalk.gray('\nℹ️  Mint NFT dilakukan manual (tidak auto mint)')
        );
      }
    } catch (e) {
      console.log(chalk.red('\nDeploy failed:'));
      console.log(chalk.red(e.message || e));
    }

    await rlQuestion('\nEnter untuk kembali ke menu...');
  }
}
