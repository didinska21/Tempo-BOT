// auto-loop.js — Multi-Wallet Loop Automation (menggunakan file existing)
import 'dotenv/config';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { JsonRpcProvider, Wallet, Contract, parseUnits } from 'ethers';
import { ContractFactory } from 'ethers';
import path from 'path';

const CONFIG_PATH = './config.json';
const BUILD_DIR = './build';
const sleep = ms => new Promise(r => setTimeout(r, ms * 1000));

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
  const pkEnv = process.env.PRIVATE_KEY || '';
  const keys = pkEnv.split('\n')
    .map(k => k.trim())
    .filter(k => k && k.startsWith('0x'));

  if (keys.length === 0) {
    console.log(chalk.red('Tidak ada private key di .env'));
    console.log(chalk.yellow('Tambahkan private key di PRIVATE_KEY (satu per baris)'));
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
  const abi = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, `${name}.abi.json`), 'utf8'));
  const bytecode = fs.readFileSync(path.join(BUILD_DIR, `${name}.bytecode.txt`), 'utf8');
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
    console.log(
      chalk.gray(`     ${amountHuman} ${token.symbol} → ${to.slice(0, 10)}...`)
    );
    console.log(
      chalk.cyan(`     TX: ${process.env.EXPLORER_BASE}/tx/${tx.hash}`)
    );
    
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
  const config = loadConfig();
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const wallets = loadWallets(provider);
  const tokens = parseTokens();
  
  console.log(chalk.green(`\n✓ Loaded ${wallets.length} wallet(s)`));
  console.log(chalk.green(`✓ Loaded ${tokens.length} token(s): ${tokens.map(t => t.symbol).join(', ')}`));
  console.log(chalk.gray('Press Ctrl+C to stop automation\n'));
  await sleep(2);
  
  let cycle = 1;
  
  while (true) {
    logHeader(cycle);
    
    const startTime = new Date();
    console.log(chalk.gray(`Started: ${startTime.toLocaleString()}`));
    console.log(chalk.gray(`Wallets: ${wallets.length}`));
    console.log(chalk.gray(`RPC: ${process.env.RPC_URL}`));
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
    const delayHours = config.automation.loopDelayHours;
    const delaySeconds = delayHours * 3600;
    
    console.log(chalk.yellow(`⏰ Waiting ${delayHours} hours before next cycle...`));
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
