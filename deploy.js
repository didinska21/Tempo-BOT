// deploy.js — FINAL ESM STABLE
import 'dotenv/config';
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';

const BUILD_DIR = './build';

// ========== Load Wallets ==========
function loadWallets(provider) {
  const keys = [];
  for (let i = 1; i <= 100; i++) {
    const key = process.env[`PRIVATE_KEY_${i}`];
    if (key && key.trim().startsWith('0x')) {
      keys.push(key.trim());
    }
  }
  
  if (keys.length === 0) {
    console.log(chalk.red('\n❌ Tidak ada private key di .env'));
    console.log(chalk.yellow('\nFormat yang benar:'));
    console.log(chalk.gray('  PRIVATE_KEY_1=0xYourPrivateKey1'));
    console.log(chalk.gray('  PRIVATE_KEY_2=0xYourPrivateKey2'));
    console.log(chalk.gray('  ... dst'));
    process.exit(1);
  }

  return keys.map((pk, i) => {
    const wallet = new Wallet(pk, provider);
    return { index: i + 1, wallet, pk, address: wallet.address };
  });
}

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
  const abiPath = path.join(BUILD_DIR, `${name}.abi.json`);
  const bytecodePath = path.join(BUILD_DIR, `${name}.bytecode.txt`);
  
  // Check if build files exist
  if (!fs.existsSync(abiPath) || !fs.existsSync(bytecodePath)) {
    console.log(chalk.red(`\n❌ Build files not found for ${name}`));
    console.log(chalk.yellow('\nPlease compile contracts first:'));
    console.log(chalk.gray('  ./compile.sh'));
    console.log(chalk.gray('  # or'));
    console.log(chalk.gray('  npm run compile'));
    console.log();
    console.log(chalk.yellow('Or run full installation:'));
    console.log(chalk.gray('  ./install.sh'));
    console.log();
    
    throw new Error(`Build files not found. Please compile contracts first.`);
  }
  
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const bytecode = fs.readFileSync(bytecodePath, 'utf8');
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

// ================= STANDALONE MODE =================
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log(chalk.magenta.bold('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.magenta.bold('║    DEPLOY CONTRACT - STANDALONE      ║'));
    console.log(chalk.magenta.bold('╚═══════════════════════════════════════╝\n'));

    if (!process.env.RPC_URL) {
      console.log(chalk.red('❌ RPC_URL missing in .env'));
      process.exit(1);
    }

    const provider = new JsonRpcProvider(process.env.RPC_URL);
    const wallets = loadWallets(provider);

    console.log(chalk.green(`✓ Loaded ${wallets.length} wallet(s)\n`));

    // Select wallet
    console.log(chalk.cyan('═══ SELECT WALLET ═══'));
    const walletMenu = wallets.map(w => 
      `#${w.index} - ${w.address.slice(0, 10)}...${w.address.slice(-8)}`
    );
    
    const walletChoice = await askNumbered(walletMenu, 'Pilih wallet:');
    const selectedWallet = wallets[walletChoice];

    console.log(chalk.green(`\n✓ Using wallet #${selectedWallet.index}`));
    console.log(chalk.gray(`  ${selectedWallet.address}\n`));

    await new Promise(r => setTimeout(r, 1000));

    // Run deploy menu
    await runDeployMenu({ 
      provider, 
      wallet: selectedWallet.wallet 
    });

    console.log(chalk.green('\nBye 👋\n'));
    process.exit(0);
  })().catch(err => {
    console.error(chalk.red('Fatal error:'), err);
    process.exit(1);
  });
}

