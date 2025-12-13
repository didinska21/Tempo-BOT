// deploy.js — FINAL STABLE (ESM)
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { ContractFactory, Contract } from 'ethers';

const BUILD_DIR = path.join(process.cwd(), 'build');

function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}

async function askNumbered(items, title = 'Pilih:') {
  console.log(chalk.cyan('\n' + title));
  items.forEach((it, i) => console.log(chalk.cyan(` ${i + 1}. ${it}`)));
  while (true) {
    const n = Number(await rlQuestion('> '));
    if (!Number.isNaN(n) && n >= 1 && n <= items.length) return n - 1;
    console.log(chalk.red('Nomor tidak valid'));
  }
}

function loadBuild(name) {
  const abiPath = path.join(BUILD_DIR, `${name}.abi.json`);
  const bytePath = path.join(BUILD_DIR, `${name}.bytecode.txt`);
  if (!fs.existsSync(abiPath) || !fs.existsSync(bytePath)) {
    throw new Error(`Artifact ${name} tidak ditemukan di build/`);
  }
  return {
    abi: JSON.parse(fs.readFileSync(abiPath, 'utf8')),
    bytecode: fs.readFileSync(bytePath, 'utf8').trim()
  };
}

function randomName(prefix) {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${r}`;
}

// ================= DEPLOY MENU =================
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

    // ================= ERC20 =================
    if (sel === 0) {
      const mode = await askNumbered(
        ['Deploy Manual', 'Deploy Random', 'Back'],
        'ERC20 Mode:'
      );
      if (mode === 2) continue;

      const name = mode === 0
        ? await rlQuestion('Token name: ')
        : randomName('Token');

      const symbol = mode === 0
        ? await rlQuestion('Token symbol: ')
        : randomName('T').slice(0, 4);

      const decimals = 18;
      const supplyHuman = 1_000_000n;
      const supplyUnits = supplyHuman * (10n ** 18n);

      const { abi, bytecode } = loadBuild('SimpleERC20');
      const spin = ora('Deploying ERC20...').start();

      try {
        const factory = new ContractFactory(abi, bytecode, wallet);
        const contract = await factory.deploy(
          name,
          symbol,
          decimals,
          supplyUnits.toString()
        );
        await contract.waitForDeployment();
        spin.succeed('ERC20 deployed');

        console.log(chalk.green('Address:'), contract.target);
        console.log(chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`));
      } catch (e) {
        spin.fail('Deploy failed');
        console.log(chalk.red(e.message));
      }

      await rlQuestion('\nEnter untuk kembali...');
    }

    // ================= ERC721 =================
    if (sel === 1) {
      const mode = await askNumbered(
        ['Deploy Manual', 'Deploy Random', 'Back'],
        'ERC721 Mode:'
      );
      if (mode === 2) continue;

      const name = mode === 0
        ? await rlQuestion('NFT name: ')
        : randomName('NFT');

      const symbol = mode === 0
        ? await rlQuestion('NFT symbol: ')
        : randomName('N').slice(0, 4);

      const mintTotal = 100;
      const { abi, bytecode } = loadBuild('SimpleERC721');

      const spin = ora('Deploying ERC721...').start();

      try {
        const factory = new ContractFactory(abi, bytecode, wallet);
        const contract = await factory.deploy(name, symbol);
        await contract.waitForDeployment();
        spin.succeed('ERC721 deployed');

        console.log(chalk.green('NFT Address:'), contract.target);
        console.log(chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`));

        const next = await askNumbered(
          ['Mint sekarang', 'Kembali ke menu'],
          'Selanjutnya:'
        );

        if (next === 0) {
          const nft = new Contract(contract.target, abi, wallet);
          const mintSpin = ora('Minting NFT...').start();

          for (let i = 1; i <= mintTotal; i++) {
            try {
              const tx = await nft.mint(await wallet.getAddress());
              await tx.wait(1);
              mintSpin.text = `Minting NFT ${i}/${mintTotal}`;
            } catch (e) {
              mintSpin.fail(`Mint gagal di ${i}`);
              break;
            }
          }

          mintSpin.succeed(`Mint selesai (${mintTotal}/${mintTotal})`);
        }

      } catch (e) {
        spin.fail('Deploy failed');
        console.log(chalk.red(e.message));
      }

      await rlQuestion('\nEnter untuk kembali...');
    }
  }
}
