// deploy.js — FULL CLEAN & STABLE
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk').default;
const ethers = require('ethers');

function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => {
    rl.close();
    res(a.trim());
  }));
}

async function askNumbered(items, prompt = 'Pilih (nomor):') {
  items.forEach((it, i) => console.log(`${i + 1}. ${it}`));
  while (true) {
    const n = Number(await rlQuestion(prompt + ' '));
    if (!Number.isNaN(n) && n >= 1 && n <= items.length) return n - 1;
    console.log(chalk.red('Nomor tidak valid.'));
  }
}

async function askInput(msg, def = '') {
  const a = await rlQuestion(`${msg}${def ? ` (${def})` : ''}: `);
  return a === '' ? def : a;
}

function now() {
  return new Date().toISOString();
}

function loadBuild(name) {
  const abi = JSON.parse(fs.readFileSync(path.join('build', `${name}.abi.json`)));
  const bytecode = fs.readFileSync(path.join('build', `${name}.bytecode.txt`), 'utf8');
  return { abi, bytecode };
}

// ---------------- MAIN MENU ----------------
module.exports.runDeployMenu = async function ({ provider, wallet, ethers, stats }) {
  while (true) {
    console.log('\nDeploy Kontrak - pilih:');
    const sel = await askNumbered(
      ['Deploy Token (ERC20)', 'Deploy NFT (ERC721)', 'Back'],
      'Pilih'
    );

    if (sel === 2) return;

    if (sel === 0) {
      await deployERC20(provider, wallet, stats);
    } else {
      await deployERC721(provider, wallet, stats);
    }
  }
};

// ---------------- ERC20 ----------------
async function deployERC20(provider, wallet, stats) {
  console.log('\nDeploy Token (ERC20)');
  const mode = await askNumbered(
    ['Deploy Manual (input name/symbol)', 'Deploy Auto (random name)', 'Back'],
    'Pilih mode'
  );
  if (mode === 2) return;

  let name, symbol;
  if (mode === 0) {
    name = await askInput('Token name', 'MyToken');
    symbol = await askInput('Token symbol', 'MTK');
  } else {
    const rnd = Math.floor(Math.random() * 10000);
    name = `TOKEN${rnd}`;
    symbol = `T${rnd}`;
  }

  const decimals = Number(await askInput('Decimals', '18'));
  const supplyHuman = await askInput('Total supply (human units)', '1000000000');
  const supplyUnits = ethers.parseUnits(supplyHuman, decimals);

  const { abi, bytecode } = loadBuild('SimpleERC20');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  console.log(
    chalk.yellow(
      `[${now()}] Deploying ${name} (${symbol}) supply ${supplyHuman}`
    )
  );

  try {
    const contract = await factory.deploy(
      name,
      symbol,
      decimals,
      supplyUnits,
      await wallet.getAddress()
    );

    console.log(chalk.gray('Waiting confirmation...'));
    const receipt = await contract.deploymentTransaction().wait(1);

    console.log(
      chalk.green(`[${now()}] ✅ ERC20 DEPLOYED`),
      contract.target
    );

    if (process.env.EXPLORER_BASE) {
      console.log(
        chalk.cyan(`Explorer: ${process.env.EXPLORER_BASE}/address/${contract.target}`)
      );
    }

    if (stats) stats.inc('deploys', 1);
  } catch (e) {
    console.log(chalk.red('Deploy failed:'), e?.message || e);
  }
}

// ---------------- ERC721 ----------------
async function deployERC721(provider, wallet, stats) {
  console.log('\nDeploy NFT (ERC721)');
  const mode = await askNumbered(
    ['Deploy Manual (input name/symbol)', 'Deploy Auto (random name)', 'Back'],
    'Pilih mode'
  );
  if (mode === 2) return;

  let name, symbol;
  if (mode === 0) {
    name = await askInput('NFT name', 'MyNFT');
    symbol = await askInput('NFT symbol', 'MNFT');
  } else {
    const rnd = Math.floor(Math.random() * 10000);
    name = `NFT${rnd}`;
    symbol = `N${rnd}`;
  }

  const maxSupply = Number(await askInput('Max supply', '10000'));

  const { abi, bytecode } = loadBuild('SimpleERC721');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  console.log(
    chalk.yellow(
      `[${now()}] Deploying NFT ${name} (${symbol}) maxSupply ${maxSupply}`
    )
  );

  try {
    const contract = await factory.deploy(
      name,
      symbol,
      maxSupply,
      await wallet.getAddress()
    );

    console.log(chalk.gray('Waiting confirmation...'));
    const receipt = await contract.deploymentTransaction().wait(1);

    console.log(
      chalk.green(`[${now()}] ✅ ERC721 DEPLOYED`),
      contract.target
    );

    if (process.env.EXPLORER_BASE) {
      console.log(
        chalk.cyan(`Explorer: ${process.env.EXPLORER_BASE}/address/${contract.target}`)
      );
    }

    if (stats) stats.inc('deploys', 1);
  } catch (e) {
    console.log(chalk.red('Deploy failed:'), e?.message || e);
  }
}
