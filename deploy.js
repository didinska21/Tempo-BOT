// deploy.js - FINAL PREMIUM
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk').default;
const ora = require('ora');

const BUILD_DIR = path.join(process.cwd(), 'build');

function rlQuestion(q){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim()); }));
}
async function askNumbered(items, prompt){
  items.forEach((it,i)=>console.log(chalk.cyan(`${i+1}. ${it}`)));
  while(true){
    const n = Number(await rlQuestion(prompt+' '));
    if(n>=1 && n<=items.length) return n-1;
    console.log(chalk.red('Nomor tidak valid'));
  }
}
async function askInput(msg, def=''){
  const a = await rlQuestion(`${msg}${def?` (${def})`:''}: `);
  return a===''?def:a;
}

function loadBuild(name){
  const abi = JSON.parse(fs.readFileSync(path.join(BUILD_DIR,`${name}.abi.json`)));
  const bytecode = fs.readFileSync(path.join(BUILD_DIR,`${name}.bytecode.txt`),'utf8');
  return { abi, bytecode };
}

module.exports.runDeployMenu = async function({ provider, wallet }){
  while(true){
    const sel = await askNumbered(
      ['Deploy Token (ERC20)','Deploy NFT (ERC721)','Back'],
      'Deploy menu'
    );
    if (sel === 2) return;

    if (sel === 0) {
      const { abi, bytecode } = loadBuild('SimpleERC20');
      const name = await askInput('Token name','MyToken');
      const symbol = await askInput('Symbol','MTK');
      const decimals = Number(await askInput('Decimals','18'));
      const supply = BigInt(await askInput('Total supply','1000000000'));
      const units = supply * 10n**BigInt(decimals);

      const spin = ora('Deploying ERC20...').start();
      const f = new ethers.ContractFactory(abi, bytecode, wallet);
      const c = await f.deploy(name, symbol, decimals, units.toString());
      await c.waitForDeployment();
      spin.succeed('ERC20 Deployed');

      console.log(chalk.green('Address:'), c.target);
      console.log(process.env.EXPLORER_BASE+'/tx/'+c.deploymentTransaction().hash);
    }

    if (sel === 1) {
      const { abi, bytecode } = loadBuild('SimpleERC721');
      const name = await askInput('NFT name','MyNFT');
      const symbol = await askInput('Symbol','MNFT');
      const mintCount = Number(await askInput('Initial mint count','100'));

      const spin = ora('Deploying ERC721...').start();
      const f = new ethers.ContractFactory(abi, bytecode, wallet);
      const c = await f.deploy(name, symbol);
      await c.waitForDeployment();
      spin.succeed('NFT DEPLOYED');

      console.log(chalk.green('Contract:'), c.target);
      console.log(process.env.EXPLORER_BASE+'/tx/'+c.deploymentTransaction().hash);

      console.log(chalk.yellow('\nInitial Mint Phase'));
      const nft = new ethers.Contract(c.target, abi, wallet);
      for (let i=0;i<mintCount;i++){
        const tx = await nft.mint(await wallet.getAddress());
        await tx.wait(1);
      }
      console.log(chalk.green('Minting completed'));
    }
  }
};
