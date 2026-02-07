// send.js (ESM - FINAL STABLE ROUND-ROBIN FIX)
import 'dotenv/config';
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { Contract, Wallet, isAddress, parseUnits, JsonRpcProvider } from 'ethers';
import { SingleBar, Presets } from 'cli-progress';

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)'
];

// ================= Load Wallets & Tokens =================
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

function parseTokensEnv() {
  return (process.env.TOKENS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [symbol, address] = s.split(':');
      return { symbol, address };
    });
}

// ================= helpers =================
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

// ================= send single tx =================
async function sendOnce({ wallet, token, to, amountHuman, waitConfirm }) {
  const c = new Contract(token.address, ERC20_ABI, wallet);
  const dec = await c.decimals();
  const amount = parseUnits(amountHuman, dec);

  const tx = await c.transfer(to, amount);
  console.log(chalk.yellow(`[${now()}] ➜ SENT ${short(tx.hash)}`));

  if (waitConfirm) {
    const spin = ora('Waiting confirmation...').start();
    const r = await tx.wait(1);
    spin.succeed(`Confirmed in block ${r.blockNumber}`);
    console.log(chalk.green(`✔ Token : ${token.symbol}`));
  }

  console.log(
    chalk.cyan(`TX: ${process.env.EXPLORER_BASE}/tx/${tx.hash}`)
  );
}

// ================= MAIN MENU =================
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
      console.log(chalk.gray('\nRandom address:'), chalk.cyan(to));
    } else {
      const addr = await rlQuestion(chalk.yellow('\nMasukkan address tujuan: '));
      if (!isAddress(addr)) {
        console.log(chalk.red('❌ Address tidak valid'));
        continue;
      }
      to = addr;
      console.log(chalk.green('✓ Address valid'));
    }

    console.log(chalk.cyan('\n═══ KONFIGURASI SEND ═══'));
    
    const amount = (await rlQuestion(chalk.yellow('Jumlah token per TX (default 1): '))).trim() || '1';
    console.log(chalk.gray(`  → Amount per TX: ${chalk.white(amount)}`));
    
    const sendCountInput = (await rlQuestion(chalk.yellow('Jumlah TX yang ingin dikirim (0 = unlimited sampai balance habis): '))).trim() || '1';
    const sendCount = Number(sendCountInput);
    
    if (sendCount === 0) {
      console.log(chalk.gray(`  → Mode: ${chalk.yellow('UNLIMITED')} (sampai balance habis)`));
    } else {
      console.log(chalk.gray(`  → Total TX: ${chalk.white(sendCount)} transaksi`));
      console.log(chalk.gray(`  → Total akan dikirim: ${chalk.white(Number(amount) * sendCount)} token`));
    }
    
    const waitConfirm = (await askNumbered(['Yes', 'No'], 'Tunggu konfirmasi setiap TX?')) === 0;
    
    console.log(chalk.cyan('\n═══ KONFIRMASI ═══'));
    console.log(chalk.white(`Tujuan     : ${to}`));
    console.log(chalk.white(`Amount/TX  : ${amount}`));
    console.log(chalk.white(`Jumlah TX  : ${sendCount === 0 ? 'Unlimited' : sendCount}`));
    console.log(chalk.white(`Wait conf  : ${waitConfirm ? 'Yes' : 'No'}`));
    
    const confirm = await rlQuestion(chalk.yellow('\nLanjutkan? (y/n): '));
    if (confirm.toLowerCase() !== 'y') {
      console.log(chalk.yellow('Dibatalkan.'));
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const isSendAll = sel === tokens.length;
    const isUnlimited = sendCount === 0;

    // ===== PROGRESS BAR (FIXED) =====
    const bar = new SingleBar({
      format: isUnlimited
        ? chalk.cyan('Progress') + ' |{bar}| TX sent: {value}'
        : chalk.cyan('Progress') + ' |{bar}| {value}/{total} TXs',
    }, Presets.rect);

    if (isUnlimited) {
      bar.start(1, 0); // dummy total
    } else {
      bar.start(sendCount, 0);
    }

    // ================= SEND SEMUA TOKEN (ROUND-ROBIN) =================
    if (isSendAll) {
      let totalSent = 0;
      let round = 0;
      let stillHasBalance = true;

      while (isUnlimited || round < sendCount) {
        stillHasBalance = false;

        for (const token of tokens) {
          try {
            const c = new Contract(token.address, ERC20_ABI, wallet);
            const dec = await c.decimals();
            const bal = await c.balanceOf(await wallet.getAddress());
            const need = parseUnits(amount, dec);

            if (bal < need) continue;

            await sendOnce({ wallet, token, to, amountHuman: amount, waitConfirm });

            bar.increment();
            totalSent++;
            stillHasBalance = true;

          } catch (e) {
            console.log(chalk.red(`✖ Failed ${token.symbol}: ${e.message}`));
          }
        }

        if (!stillHasBalance) break;
        round++;
      }

      bar.stop();
      console.log(
        chalk.green(
          `\n[${now()}] Send Semua Token selesai — total TX: ${totalSent}\n`
        )
      );
      await rlQuestion(chalk.gray('Enter untuk kembali ke menu...'));
      continue;
    }

    // ================= SEND SINGLE TOKEN =================
    const token = tokens[sel];
    let sent = 0;

    while (isUnlimited || sent < sendCount) {
      try {
        await sendOnce({ wallet, token, to, amountHuman: amount, waitConfirm });
        sent++;
        bar.increment();
      } catch (e) {
        console.log(chalk.red('TX failed:'), e.message);
        break;
      }
    }

    bar.stop();
    await rlQuestion(chalk.gray('\nEnter untuk kembali ke menu...'));
  }
}

// ================= STANDALONE MODE =================
// Check if running as standalone (not imported as module)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log(chalk.magenta.bold('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.magenta.bold('║     SEND TOKEN - STANDALONE MODE     ║'));
    console.log(chalk.magenta.bold('╚═══════════════════════════════════════╝\n'));

    if (!process.env.RPC_URL) {
      console.log(chalk.red('❌ RPC_URL missing in .env'));
      process.exit(1);
    }

    const provider = new JsonRpcProvider(process.env.RPC_URL);
    const wallets = loadWallets(provider);
    const tokens = parseTokensEnv();

    console.log(chalk.green(`✓ Loaded ${wallets.length} wallet(s)`));
    console.log(chalk.green(`✓ Loaded ${tokens.length} token(s): ${tokens.map(t => t.symbol).join(', ')}\n`));

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

    // Run send menu
    await runSendMenu({ 
      provider, 
      wallet: selectedWallet.wallet, 
      tokens 
    });

    console.log(chalk.green('\nBye 👋\n'));
    process.exit(0);
  })().catch(err => {
    console.error(chalk.red('Fatal error:'), err);
    process.exit(1);
  });
}

