// deploy.js - deploy SimpleERC20 / SimpleERC721 (ethers v6) integrated with stats
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk');

const BUILD_DIR = path.join(process.cwd(), 'build');
const DEPLOYED_FILE = path.join(process.cwd(), 'deployed_contracts.json');

function rlQuestion(q){ const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); return new Promise(res => rl.question(q, a => { rl.close(); res(a); })); }
async function askNumbered(items, prompt='Pilih (nomor):'){ items.forEach((it,i)=>console.log(`${i+1}. ${it}`)); while(true){ const a = (await rlQuestion(prompt+' ')).trim(); const n=Number(a); if(!Number.isNaN(n) && n>=1 && n<=items.length) return n-1; console.log('Masukkan nomor valid.'); } }
async function askInput(msg, def=''){ const a = (await rlQuestion(`${msg}${def? ' ('+def+')':''}: `)).trim(); return a === '' ? def : a; }

function loadBuild(name) {
  const abiPath = path.join(BUILD_DIR, `${name}.abi.json`);
  const bytePath = path.join(BUILD_DIR, `${name}.bytecode.txt`);
  if (!fs.existsSync(abiPath) || !fs.existsSync(bytePath)) return null;
  return { abi: JSON.parse(fs.readFileSync(abiPath,'utf8')), bytecode: fs.readFileSync(bytePath,'utf8').trim() };
}
function saveDeployed(obj) {
  let all = {};
  try { if (fs.existsSync(DEPLOYED_FILE)) all = JSON.parse(fs.readFileSync(DEPLOYED_FILE,'utf8')||'{}'); } catch(e){}
  const key = new Date().toISOString();
  all[key] = obj;
  fs.writeFileSync(DEPLOYED_FILE, JSON.stringify(all, null, 2), 'utf8');
}

async function deployContract(provider, wallet, abi, bytecode, constructorArgs = []) {
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  let address = contract.target || contract.address || (contract.getAddress ? await contract.getAddress() : null);
  let deployTx = contract.deployTransaction || null;
  return { contract, address, deployTx };
}

module.exports.runDeployMenu = async function({ provider, wallet, ethers:ethersPassed, stats } = {}) {
  if (!process.env.RPC_URL) { console.log('RPC_URL missing in .env'); return; }
  const providerLocal = provider || new ethers.JsonRpcProvider(process.env.RPC_URL);
  const walletLocal = wallet || (process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, providerLocal) : null);

  while(true) {
    console.log('\nDeploy Kontrak - pilih:');
    const idx = await askNumbered(['Deploy Token (ERC20)', 'Deploy NFT (ERC721)', 'Back']);
    if (idx === 2) return;

    if (idx === 0) {
      const build = loadBuild('SimpleERC20');
      if (!build) { console.log('Artifact SimpleERC20 not found in build/. Run compile_all.js'); continue; }
      console.log('Deploy Token (ERC20)');
      const mode = await askNumbered(['Deploy Manual (input name/symbol)','Deploy Auto (random name)', 'Back'],'Pilih mode:');
      if (mode === 2) continue;
      let name = 'MyToken', symbol = 'MTK';
      if (mode === 0) {
        name = await askInput('Token name', name);
        symbol = await askInput('Token symbol', symbol);
      } else {
        const r = Math.random().toString(36).slice(2,8).toUpperCase();
        name = `Token${r}`; symbol = `T${r.slice(0,3)}`;
      }
      const decimals = Number(await askInput('Decimals (default 18)', '18')) || 18;
      const supplyHuman = BigInt(await askInput('Total supply (human units)', '1000000000')) || 1000000000n;
      const supplyUnits = supplyHuman * (10n ** BigInt(decimals));
      console.log('Deploying', name, symbol, 'supply', supplyHuman.toString());
      try {
        const { contract, address, deployTx } = await deployContract(providerLocal, walletLocal, build.abi, build.bytecode, [name, symbol, decimals, supplyUnits.toString()]);
        console.log(chalk.green('Deployed at:'), address);
        const txHash = deployTx && deployTx.hash ? deployTx.hash : null;
        if (txHash) console.log('TX:', (process.env.EXPLORER_BASE||'') + '/tx/' + txHash);
        saveDeployed({ type:'ERC20', name, symbol, address, tx: txHash, timestamp: new Date().toISOString() });
        if (stats) stats.inc('deploys', 1);
      } catch(e) {
        console.log('Deploy failed:', e && e.message ? e.message : e);
      }
    } else if (idx === 1) {
      const build = loadBuild('SimpleERC721');
      if (!build) { console.log('Artifact SimpleERC721 not found in build/. Run compile_all.js'); continue; }
      console.log('Deploy NFT (ERC721)');
      const mode = await askNumbered(['Deploy Manual (input name/symbol)','Deploy Auto (random name)','Back'],'Pilih mode:');
      if (mode === 2) continue;
      let name='MyNFT', symbol='MNFT';
      if (mode === 0) { name = await askInput('NFT name', name); symbol = await askInput('NFT symbol', symbol); }
      else { const r = Math.random().toString(36).slice(2,8).toUpperCase(); name=`NFT${r}`; symbol=`N${r.slice(0,3)}`; }
      const mintCount = Number(await askInput('Initial mint count (mint to deployer) (default 100)', '100')) || 100;
      try {
        const { contract, address, deployTx } = await deployContract(providerLocal, walletLocal, build.abi, build.bytecode, [name, symbol]);
        console.log(chalk.green('Deployed at:'), address);
        if (deployTx && deployTx.hash) console.log('TX:', (process.env.EXPLORER_BASE||'') + '/tx/' + deployTx.hash);
        try {
          const c = new ethers.Contract(address, build.abi, walletLocal);
          if (c.mint) {
            console.log('Minting', mintCount, 'to deployer...');
            for (let i=0;i<mintCount;i++) {
              const tx = await c.mint(await walletLocal.getAddress());
              await tx.wait(1);
            }
            console.log('Minting done.');
          } else {
            console.log('Contract has no mint method to auto-mint.');
          }
        } catch(e) {
          console.log('Auto-mint failed:', e && e.message ? e.message : e);
        }
        saveDeployed({ type:'ERC721', name, symbol, address, tx: deployTx && deployTx.hash, minted: mintCount, timestamp: new Date().toISOString() });
        if (stats) stats.inc('deploys', 1);
      } catch(e) {
        console.log('Deploy failed:', e && e.message ? e.message : e);
      }
    }
  }
};
