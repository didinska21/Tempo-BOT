// deploy.js
// Numeric menu deploy UI. Expects build artifacts in ./build/
// Usage: node deploy.js  OR from main.js via runDeployMenu export.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ethers = require('ethers');

const chalkReq = require('chalk');
const chalk = chalkReq && chalkReq.default ? chalkReq.default : chalkReq;
let ora;
try { const o = require('ora'); ora = o && o.default ? o.default : o; } catch(e){ ora = null; }

const BUILD_DIR = path.join(process.cwd(), 'build');
const DEPLOYED_FILE = path.join(process.cwd(), 'deployed_contracts.json');

function createRl() { return readline.createInterface({ input: process.stdin, output: process.stdout }); }
function question(q) { const rl = createRl(); return new Promise(res => rl.question(q, a => { rl.close(); res(a); })); }
async function askNumbered(items, promptText='Pilih (nomor):') {
  for (let i=0;i<items.length;i++) console.log(`${String(i+1)}. ${items[i]}`);
  while (true) {
    const a = (await question(promptText+' ')).trim();
    const n = Number(a);
    if (!Number.isNaN(n) && n>=1 && n<=items.length) return n-1;
    console.log('Masukkan angka yang valid');
  }
}
async function askInput(msg, def='') {
  const a = (await question(`${msg}${def? ' ('+def+')':''}: `)).trim();
  return a === '' ? def : a;
}

function loadBuild(name) {
  const abiPath = path.join(BUILD_DIR, `${name}.abi.json`);
  const bytePath = path.join(BUILD_DIR, `${name}.bytecode.txt`);
  if (!fs.existsSync(abiPath) || !fs.existsSync(bytePath)) return null;
  const abi = JSON.parse(fs.readFileSync(abiPath,'utf8'));
  const bytecode = fs.readFileSync(bytePath,'utf8').trim();
  return { abi, bytecode };
}

function saveDeployed(obj) {
  let all = {};
  try { if (fs.existsSync(DEPLOYED_FILE)) all = JSON.parse(fs.readFileSync(DEPLOYED_FILE,'utf8')||'{}'); } catch(e){}
  const key = `${new Date().toISOString()}`;
  all[key] = obj;
  fs.writeFileSync(DEPLOYED_FILE, JSON.stringify(all, null, 2), 'utf8');
}

async function deployContract(provider, wallet, abi, bytecode, constructorArgs=[]) {
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const spinner = ora ? ora('Deploying contract...').start() : null;
  const deployed = await factory.deploy(...constructorArgs);
  if (spinner) spinner.text = 'Waiting for contract to be mined...';
  await deployed.wait(1);
  if (spinner) spinner.succeed('Deployed: ' + deployed.target);
  return deployed;
}

async function runDeployMenu({ provider, wallet, ethers, incStat } = {}) {
  // provider & wallet optional if run standalone
  if (!provider || !wallet) {
    if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
      console.log(chalk.red('RPC_URL and PRIVATE_KEY must be set in .env to deploy.'));
      return;
    }
    provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  }

  while (true) {
    console.log('\nDeploy Kontrak - pilih:');
    const idx = await askNumbered(['Deploy Token (ERC20)','Deploy NFT (ERC721)','Back']);
    if (idx === 2) return;
    if (idx === 0) {
      // ERC20
      const build = loadBuild('SimpleERC20');
      if (!build) { console.log(chalk.yellow('Build artifact SimpleERC20 not found. Run scripts/compile_all.js first.')); continue; }
      console.log(chalk.cyan('Deploy Token (ERC20)'));
      const modeIdx = await askNumbered(['Deploy Manual (input name/symbol)','Deploy Auto (random name)','Back'],'Pilih mode:');
      if (modeIdx === 2) continue;

      let name, symbol, totalSupply;
      if (modeIdx === 0) {
        name = await askInput('Token name', 'MyToken');
        symbol = await askInput('Token symbol', 'MTK');
      } else {
        // auto random
        const r = Math.random().toString(36).slice(2,8).toUpperCase();
        name = `Token${r}`; symbol = `T${r.slice(0,3)}`;
        console.log('Auto name:', name, symbol);
      }
      const decimalsStr = await askInput('Decimals (default 18)', '18');
      const decimals = Number(decimalsStr) || 18;
      const defaultSupply = '1000000000'; // 1B
      const supplyInput = await askInput('Total supply (human units)', defaultSupply);
      const supplyHuman = BigInt(supplyInput || defaultSupply);
      // convert to units = supply * 10**decimals
      const supplyUnits = supplyHuman * (10n ** BigInt(decimals));

      console.log(chalk.gray(`Deploying ${name} (${symbol}) supply ${supplyHuman} decimals ${decimals} -> units ${supplyUnits}`));

      try {
        const deployed = await deployContract(provider, wallet, build.abi, build.bytecode, [name, symbol, decimals, supplyUnits.toString()]);
        console.log(chalk.green('Deployed at:'), deployed.target || deployed.address);
        const txHash = deployed.deployTransaction && deployed.deployTransaction.hash ? deployed.deployTransaction.hash : null;
        if (txHash) console.log('TX:', (process.env.EXPLORER_BASE||'') + '/tx/' + txHash);
        saveDeployed({ type:'ERC20', name, symbol, address: deployed.target || deployed.address, tx: txHash, timestamp: new Date().toISOString() });
      } catch (e) {
        console.log(chalk.red('Deploy failed:'), e && e.message ? e.message : e);
      }

    } else if (idx === 1) {
      // ERC721
      const build = loadBuild('SimpleERC721');
      if (!build) { console.log(chalk.yellow('Build artifact SimpleERC721 not found. Run scripts/compile_all.js first.')); continue; }
      console.log(chalk.cyan('Deploy NFT (ERC721)'));
      const modeIdx = await askNumbered(['Deploy Manual (input name/symbol)','Deploy Auto (random name)','Back'],'Pilih mode:');
      if (modeIdx === 2) continue;

      let name, symbol;
      if (modeIdx === 0) {
        name = await askInput('NFT name', 'MyNFT');
        symbol = await askInput('NFT symbol', 'MNFT');
      } else {
        const r = Math.random().toString(36).slice(2,8).toUpperCase();
        name = `NFT${r}`; symbol = `N${r.slice(0,3)}`;
        console.log('Auto name:', name, symbol);
      }

      const defaultSupply = '10000';
      const supplyInput = await askInput('Initial mint count (will mint to deployer) (default 10000)', defaultSupply);
      const mintCount = Number(supplyInput || defaultSupply) || 10000;

      try {
        // For NFT we deploy then optionally mint N tokens to deployer if contract exposes mint
        const deployed = await deployContract(provider, wallet, build.abi, build.bytecode, [name, symbol]);
        console.log(chalk.green('Deployed at:'), deployed.target || deployed.address);
        const txHash = deployed.deployTransaction && deployed.deployTransaction.hash ? deployed.deployTransaction.hash : null;
        if (txHash) console.log('TX:', (process.env.EXPLORER_BASE||'') + '/tx/' + txHash);

        // try minting sequentially if contract has mint function (safe)
        const c = new ethers.Contract(deployed.target || deployed.address, build.abi, wallet);
        if (typeof c.mint === 'function') {
          console.log(chalk.gray(`Minting ${mintCount} tokens to deployer...`));
          for (let i=0;i<mintCount;i++) {
            const tx = await c.mint(await wallet.getAddress());
            await tx.wait(1);
          }
          console.log(chalk.green('Minting done.'));
        } else {
          console.log(chalk.yellow('Contract has no mint method to auto-mint. You can mint later manually.'));
        }

        saveDeployed({ type:'ERC721', name, symbol, address: deployed.target || deployed.address, tx: txHash, timestamp: new Date().toISOString(), minted: mintCount });
      } catch (e) {
        console.log(chalk.red('Deploy failed:'), e && e.message ? e.message : e);
      }
    }
  }
}

// export for main.js use
module.exports = { runDeployMenu };
