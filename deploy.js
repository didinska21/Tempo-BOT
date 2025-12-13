// deploy.js — FINAL ESM STABLE
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { ContractFactory } from 'ethers';

const BUILD_DIR = './build';

// ========== helpers ==========
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim()); }));
}

async function askNumbered(items, title = 'Pilih:') {
  console.log(chalk.cyan('\n' + title));
  items.forEach((it, i) => console.log(chalk.cyan(` ${i + 1}. ${it}`)));
  while (true) {
    const n = Number(await rlQuestion('> '));
    if (!isNaN(n) && n >= 1 && n <= items.length) return n - 1;
    console.log(chalk.red('Nomor tidak valid'));
  }
}

function rand(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

function loadBuild(name) {
  const abi = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, `${name}.abi.json`), 'utf8'));
  const bytecode = fs.readFileSync(path.join(BUILD_DIR, `${name}.bytecode.txt`), 'utf8');
  return { abi, bytecode };
}

// ========== MAIN ==========
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
      const { abi, bytecode } = loadBuild('SimpleERC20');

      const mode = await askNumbered(
        ['Deploy Manual', 'Deploy Random', 'Back'],
        'Mode deploy ERC20:'
      );
      if (mode === 2) continue;

      let deployCount = 1;
      if (mode === 1) {
        deployCount = Number(await rlQuestion('Jumlah token random (1–100000): ')) || 1;
        deployCount = Math.min(Math.max(deployCount, 1), 100000);
      }

      for (let i = 1; i <= deployCount; i++) {
        let name, symbol, supply;

        if (mode === 0) {
          name = await rlQuestion('Nama token: ');
          symbol = await rlQuestion('Symbol token: ');
          supply = BigInt(await rlQuestion('Supply (default 1000000): ') || '1000000');
        } else {
          const r = rand();
          name = `TEMP0${r}`;
          symbol = `TMP${r.slice(0, 4)}`;
          supply = 1_000_000n;
        }

        const spinner = ora(`Deploying ERC20 ${name} (${i}/${deployCount})`).start();
        try {
          const factory = new ContractFactory(abi, bytecode, wallet);
          const contract = await factory.deploy(name, symbol, 18, supply);
          await contract.waitForDeployment();

          spinner.succeed(`Deployed ${name}`);
          console.log(chalk.green('Address:'), contract.target);
          console.log(
            chalk.cyan(
              `${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`
            )
          );
        } catch (e) {
          spinner.fail(`Deploy failed: ${e.message}`);
        }
      }

      await rlQuestion('\nEnter untuk kembali...');
    }

    // ================= ERC721 =================
    if (sel === 1) {
      const { abi, bytecode } = loadBuild('SimpleERC721');

      const mode = await askNumbered(
        ['Deploy Manual', 'Deploy Random', 'Back'],
        'Mode deploy ERC721:'
      );
      if (mode === 2) continue;

      let deployCount = 1;
      if (mode === 1) {
        deployCount = Number(await rlQuestion('Jumlah NFT random (1–100000): ')) || 1;
        deployCount = Math.min(Math.max(deployCount, 1), 100000);
      }

      for (let i = 1; i <= deployCount; i++) {
        let name, symbol;

        if (mode === 0) {
          name = await rlQuestion('Nama NFT: ');
          symbol = await rlQuestion('Symbol NFT: ');
        } else {
          const r = rand();
          name = `NFT TEMP0${r}`;
          symbol = `NFTTMP${r.slice(0, 4)}`;
        }

        const spinner = ora(`Deploying NFT ${name} (${i}/${deployCount})`).start();
        try {
          const factory = new ContractFactory(abi, bytecode, wallet);
          const contract = await factory.deploy(name, symbol);
          await contract.waitForDeployment();

          spinner.succeed(`NFT deployed`);
          console.log(chalk.green('Address:'), contract.target);
          console.log(
            chalk.cyan(
              `${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`
            )
          );

          // ===== mint menu =====
          const mintMenu = await askNumbered(
            ['Mint NFT sekarang', 'Lewati'],
            'Mint NFT?'
          );

          if (mintMenu === 0) {
            const totalMint = Number(await rlQuestion('Jumlah mint (default 100): ') || '100');
            const nft = contract.connect(wallet);

            for (let m = 1; m <= totalMint; m++) {
              const spinMint = ora(`Mint ${m}/${totalMint}`).start();
              try {
                const tx = await nft.mint(await wallet.getAddress());
                await tx.wait(1);
                spinMint.succeed(`Mint ${m}/${totalMint} berhasil`);
              } catch (e) {
                spinMint.fail(`Mint gagal`);
              }
            }
          }
        } catch (e) {
          spinner.fail(`Deploy failed: ${e.message}`);
        }
      }

      await rlQuestion('\nEnter untuk kembali...');
    }
  }
}
