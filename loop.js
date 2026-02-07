// auto-loop.js — Multi-Wallet Loop Automation (menggunakan file existing)
import 'dotenv/config';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { JsonRpcProvider, Wallet, Contract, parseUnits } from 'ethers';
import { ContractFactory } from 'ethers';
import path from 'path';

const CONFIG_PATH = './config.json';
const BUILD_DIR = './build';
const sleep = ms => new Promise(r => setTimeout(r, ms * 1000));

// ===== readline helper =====
function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a);
  }));
}

// ===== Ask Loop Delay Hours =====
async function askLoopDelayHours() {
  console.log(chalk.cyan('\n╔═══════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.magenta.bold('   TEMPO-BOT MULTI-WALLET AUTOMATION         ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.yellow('⚙️  Konfigurasi Loop Delay'));
  console.log(chalk.gray('────────────────────────────────────────────────'));
  console.log();
  
  while (true) {
    const input = await rlQuestion(chalk.cyan('Berapa jam delay antar cycle loop? (1-72 jam): '));
    const hours = Number(input.trim());
    
    if (!isNaN(hours) && hours >= 1 && hours <= 72) {
      console.log();
      console.log(chalk.green(`✓ Loop delay set: ${chalk.bold(hours)} jam`));
      console.log(chalk.gray(`  (Setiap cycle akan diulang setiap ${hours} jam)`));
      console.log();
      await sleep(2);
      return hours;
    }
    
    console.log(chalk.red('❌ Masukkan angka antara 1-72 jam'));
    console.log();
  }
}

// ===== Load Config =====
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(chalk.red('config.json tidak ditemukan!'));
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// ===== Load Wallets dari .env =====
function loadWallets(provider) {
  const keys = [];
  
  // Load PRIVATE_KEY_1, PRIVATE_KEY_2, PRIVATE_KEY_3, dst
  for (let i = 1; i <= 100; i++) {
    const key = process.env[`PRIVATE_KEY_${i}`];
    if (key && key.trim().startsWith('0x')) {
      keys.push(key.trim());
    }
  }
  
  console.log(chalk.gray(`\nDetected ${keys.length} private key(s) in .env`));
  
  if (keys.length === 0) {
    console.log(chalk.red('\n❌ Tidak ada private key di .env'));
    console.log(chalk.yellow('\nFormat yang benar:'));
    console.log(chalk.gray('  PRIVATE_KEY_1=0xYourPrivateKey1'));
    console.log(chalk.gray('  PRIVATE_KEY_2=0xYourPrivateKey2'));
    console.log(chalk.gray('  PRIVATE_KEY_3=0xYourPrivateKey3'));
    console.log(chalk.gray('  ... dst'));
    process.exit(1);
  }

  return keys.map((pk, i) => {
    const wallet = new Wallet(pk, provider);
    return { index: i + 1, wallet, pk };
  });
}

// ===== Parse Tokens dari .env =====
function parseTokens() {
  return (process.env.TOKENS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [symbol, address] = s.split(':');
      return { symbol, address };
    });
}

// ===== Load Build untuk Deploy =====
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
    
    throw new Error(`Build files not found. Please compile contracts first.`);
  }
  
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const bytecode = fs.readFileSync(bytecodePath, 'utf8');
  return { abi, bytecode };
}

function rand(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

// ===== ERC20 ABI =====
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)'
];

// ===== Progress Display =====
function logHeader(cycle) {
  console.clear();
  console.log(chalk.magenta.bold('═'.repeat(60)));
  console.log(chalk.magenta.bold(`    AUTO.TX MULTI-WALLET AUTOMATION - Cycle #${cycle}`));
  console.log(chalk.magenta.bold('═'.repeat(60)));
  console.log();
}

function logSection(title) {
  console.log();
  console.log(chalk.cyan('━'.repeat(60)));
  console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.cyan('━'.repeat(60)));
}

async function countdown(seconds, label) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(
      chalk.yellow(`\r⏳ ${label}: ${chalk.cyan.bold(i + 's')}   `)
    );
    await sleep(1);
  }
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

// ===== TASK 1: Claim Faucet (mirip logic faucet.js) =====
async function claimFaucetForWallet(wallet, provider, config) {
  const address = await wallet.getAddress();
  
  try {
    // Animasi persiapan
    await sleep(2);
    
    const txHashes = await provider.send('tempo_fundAddress', [address]);
    
    console.log(chalk.gray(`  └─ Claimed for ${address.slice(0, 10)}...`));
    
    if (Array.isArray(txHashes) && txHashes.length > 0) {
      console.log(chalk.green(`     ✓ ${txHashes.length} token(s) received`));
      
      const tokenNames = ['PathUSD', 'AlphaUSD', 'BetaUSD', 'ThetaUSD'];
      txHashes.forEach((tx, i) => {
        const tokenName = tokenNames[i] || `Token${i+1}`;
        console.log(
          chalk.green('     √'),
          chalk.white(`1.000.000 ${tokenName}`),
          chalk.gray(':'),
          chalk.cyan(`${process.env.EXPLORER_BASE}/tx/${tx}`)
        );
      });
    }
    
    await sleep(config.automation.delays.betweenClaims || 15);
    
  } catch (e) {
    throw new Error(`Faucet claim failed: ${e.message}`);
  }
}

// ===== TASK 2: Send Token (mirip logic send.js) =====
async function sendTokenForWallet(wallet, tokens, config, round) {
  if (!tokens || tokens.length === 0) {
    throw new Error('No tokens configured');
  }
  
  // Round-robin token selection
  const tokenIndex = (round - 1) % tokens.length;
  const token = tokens[tokenIndex];
  
  // Random destination (mirip send.js)
  const to = Wallet.createRandom().address;
  const amountHuman = config.automation.tasks.sendTokens.amountPerTx || '1';
  
  try {
    const contract = new Contract(token.address, ERC20_ABI, wallet);
    const decimals = await contract.decimals();
    const amount = parseUnits(amountHuman, decimals);
    
    // Check balance
    const balance = await contract.balanceOf(await wallet.getAddress());
    if (balance < amount) {
      throw new Error(`Insufficient ${token.symbol} balance`);
    }
    
    const tx = await contract.transfer(to, amount);
    
    const now = new Date().toISOString();
    const short = tx.hash.slice(0, 10) + '...' + tx.hash.slice(-6);
    
    console.log(chalk.gray(`  └─ [${now}] ➜ SENT ${short}`));
    console.log(chalk.gray(`     Amount: ${chalk.white(amountHuman)} ${token.symbol}`));
    console.log(chalk.gray(`     To: ${to.slice(0, 10)}...${to.slice(-8)}`));
    console.log(chalk.cyan(`     TX: ${process.env.EXPLORER_BASE}/tx/${tx.hash}`));
    
    // Optional: wait confirmation jika WAIT_CONFIRM=true
    if (process.env.WAIT_CONFIRM === 'true') {
      const receipt = await tx.wait(1);
      console.log(chalk.green(`     ✔ Confirmed in block ${receipt.blockNumber}`));
    }
    
    await sleep(config.automation.delays.betweenSends || 2);
    
  } catch (e) {
    throw new Error(`Send failed: ${e.message}`);
  }
}

// ===== TASK 3: Deploy Contract (mirip logic deploy.js) =====
async function deployContractForWallet(wallet, config, round) {
  const contractType = config.automation.tasks.deployContracts.type || 'ERC20';
  
  try {
    if (contractType === 'ERC20') {
      const { abi, bytecode } = loadBuild('SimpleERC20');
      
      const r = rand();
      const name = `TEMP0${r}`;
      const symbol = `TMP${r.slice(0, 4)}`;
      const supply = 1_000_000n;
      
      const factory = new ContractFactory(abi, bytecode, wallet);
      const contract = await factory.deploy(name, symbol, 18, supply);
      await contract.waitForDeployment();
      
      console.log(chalk.gray(`  └─ Deployed ERC20: ${name} (${symbol})`));
      console.log(chalk.green(`     Address: ${contract.target}`));
      console.log(
        chalk.cyan(`     TX: ${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`)
      );
      
    } else if (contractType === 'ERC721') {
      const { abi, bytecode } = loadBuild('SimpleERC721');
      
      const r = rand();
      const name = `NFT TEMP0${r}`;
      const symbol = `NFTTMP${r.slice(0, 4)}`;
      
      const factory = new ContractFactory(abi, bytecode, wallet);
      const contract = await factory.deploy(name, symbol);
      await contract.waitForDeployment();
      
      console.log(chalk.gray(`  └─ Deployed ERC721: ${name} (${symbol})`));
      console.log(chalk.green(`     Address: ${contract.target}`));
      console.log(
        chalk.cyan(`     TX: ${process.env.EXPLORER_BASE}/tx/${contract.deploymentTransaction().hash}`)
      );
    }
    
    await sleep(config.automation.delays.betweenDeploys || 5);
    
  } catch (e) {
    throw new Error(`Deploy failed: ${e.message}`);
  }
}

// ===== Execute Round-Robin Tasks =====
async function executeRoundRobin(wallets, taskName, taskFn, iterations, delayBetween) {
  logSection(`${taskName.toUpperCase()} - Round Robin`);
  
  for (let round = 1; round <= iterations; round++) {
    console.log(chalk.yellow(`\n📍 Round ${round}/${iterations}`));
    
    for (const { index, wallet } of wallets) {
      const addr = await wallet.getAddress();
      const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      
      const spinner = ora(`Wallet ${index} (${shortAddr}) - ${taskName}`).start();
      
      try {
        await taskFn(wallet, round);
        spinner.succeed(`Wallet ${index} - ${taskName} berhasil`);
      } catch (e) {
        spinner.fail(`Wallet ${index} - ${taskName} gagal: ${e.message}`);
      }
      
      // Delay antar wallet
      if (index < wallets.length) {
        await countdown(delayBetween, 'Next wallet');
      }
    }
    
    console.log(chalk.green(`✓ Round ${round} selesai`));
  }
}

// ===== Execute Sequential Tasks =====
async function executeSequential(wallets, taskName, taskFn, delayBetween) {
  logSection(`${taskName.toUpperCase()} - Sequential`);
  
  for (const { index, wallet } of wallets) {
    const addr = await wallet.getAddress();
    const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    
    const spinner = ora(`Wallet ${index} (${shortAddr}) - ${taskName}`).start();
    
    try {
      await taskFn(wallet);
      spinner.succeed(`Wallet ${index} - ${taskName} berhasil`);
    } catch (e) {
      spinner.fail(`Wallet ${index} - ${taskName} gagal: ${e.message}`);
    }
    
    if (index < wallets.length) {
      await countdown(delayBetween, 'Next wallet');
    }
  }
}

// ===== Main Automation Loop =====
async function runAutomation() {
  // Ask loop delay hours di awal
  const loopDelayHours = await askLoopDelayHours();
  
  const config = loadConfig();
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallets = loadWallets(provider);
  const tokens = parseTokens();
  
  console.log(chalk.green(`\n✓ Loaded ${wallets.length} wallet(s)`));
  console.log(chalk.green(`✓ Loaded ${tokens.length} token(s): ${tokens.map(t => t.symbol).join(', ')}`));
  console.log(chalk.yellow(`✓ Loop delay: ${loopDelayHours} jam`));
  console.log(chalk.gray('Press Ctrl+C to stop automation\n'));
  await sleep(2);
  
  let cycle = 1;
  
  while (true) {
    logHeader(cycle);
    
    const startTime = new Date();
    console.log(chalk.gray(`Started: ${startTime.toLocaleString()}`));
    console.log(chalk.gray(`Wallets: ${wallets.length}`));
    console.log(chalk.gray(`RPC: ${process.env.RPC_URL}`));
    console.log(chalk.gray(`Loop Delay: ${loopDelayHours} jam`));
    
    // Display configuration
    console.log();
    console.log(chalk.cyan('═══ TASK CONFIGURATION ═══'));
    
    if (config.automation.tasks.claimFaucet.enabled) {
      console.log(chalk.green('✓ Claim Faucet: ENABLED'));
    } else {
      console.log(chalk.gray('✗ Claim Faucet: DISABLED'));
    }
    
    if (config.automation.tasks.sendTokens.enabled) {
      console.log(chalk.green('✓ Send Tokens: ENABLED'));
      console.log(chalk.gray(`  └─ Sends per wallet: ${config.automation.tasks.sendTokens.sendsPerWallet}`));
      console.log(chalk.gray(`  └─ Amount per TX: ${config.automation.tasks.sendTokens.amountPerTx} token`));
      console.log(chalk.gray(`  └─ Total per wallet: ${config.automation.tasks.sendTokens.sendsPerWallet * Number(config.automation.tasks.sendTokens.amountPerTx)} token`));
    } else {
      console.log(chalk.gray('✗ Send Tokens: DISABLED'));
    }
    
    if (config.automation.tasks.deployContracts.enabled) {
      console.log(chalk.green('✓ Deploy Contracts: ENABLED'));
      console.log(chalk.gray(`  └─ Deploys per wallet: ${config.automation.tasks.deployContracts.deploysPerWallet}`));
      console.log(chalk.gray(`  └─ Contract type: ${config.automation.tasks.deployContracts.type}`));
    } else {
      console.log(chalk.gray('✗ Deploy Contracts: DISABLED'));
    }
    
    console.log();
    
    // ===== 1. CLAIM FAUCET (Sequential) =====
    if (config.automation.tasks.claimFaucet.enabled) {
      await executeSequential(
        wallets,
        'Claim Faucet',
        async (wallet) => {
          await claimFaucetForWallet(wallet, provider, config);
        },
        config.automation.delays.betweenWallets
      );
    }
    
    // ===== 2. SEND TOKENS (Round-Robin) =====
    if (config.automation.tasks.sendTokens.enabled) {
      const sendsPerWallet = config.automation.tasks.sendTokens.sendsPerWallet;
      
      await executeRoundRobin(
        wallets,
        'Send Token',
        async (wallet, round) => {
          await sendTokenForWallet(wallet, tokens, config, round);
        },
        sendsPerWallet,
        config.automation.delays.betweenWallets
      );
    }
    
    // ===== 3. DEPLOY CONTRACTS (Round-Robin) =====
    if (config.automation.tasks.deployContracts.enabled) {
      const deploysPerWallet = config.automation.tasks.deployContracts.deploysPerWallet;
      
      await executeRoundRobin(
        wallets,
        'Deploy Contract',
        async (wallet, round) => {
          await deployContractForWallet(wallet, config, round);
        },
        deploysPerWallet,
        config.automation.delays.betweenWallets
      );
    }
    
    // ===== Cycle Complete =====
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000 / 60);
    
    logSection('CYCLE COMPLETE');
    console.log(chalk.green(`✓ Cycle #${cycle} selesai`));
    console.log(chalk.gray(`Duration: ${duration} minutes`));
    console.log(chalk.gray(`Ended: ${endTime.toLocaleString()}`));
    console.log();
    
    cycle++;
    
    // ===== Wait Before Next Cycle =====
    const delaySeconds = loopDelayHours * 3600;
    
    console.log(chalk.yellow(`⏰ Waiting ${loopDelayHours} hours before next cycle...`));
    console.log();
    
    // Countdown dengan format jam:menit:detik
    for (let remaining = delaySeconds; remaining > 0; remaining -= 10) {
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;
      
      process.stdout.write(
        chalk.yellow(`\r⏳ Next cycle in: ${chalk.cyan.bold(`${hours}h ${mins}m ${secs}s`)}   `)
      );
      
      await sleep(Math.min(10, remaining));
    }
    
    console.log('\n');
  }
}

// ===== Start =====
runAutomation().catch(err => {
  console.error(chalk.red('\n❌ Fatal error:'), err);
  process.exit(1);
});
