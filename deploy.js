// deploy.js — FINAL CLEAN
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

async function askInput(msg, def) {
  const a = await rlQuestion(`${msg} (${def}): `);
  return a || def;
}

async function askNumbered(items, prompt) {
  items.forEach((it, i) => console.log(`${i + 1}. ${it}`));
  return Number(await rlQuestion(prompt + ' ')) - 1;
}

function loadBuild(name) {
  return {
    abi: JSON.parse(fs.readFileSync(`build/${name}.abi.json`)),
    bytecode: fs.readFileSync(`build/${name}.bytecode.txt`, 'utf8')
  };
}

module.exports.runDeployMenu = async function ({ provider, wallet, stats }) {
  while (true) {
    console.log('1. Deploy Token');
    console.log('2. Deploy NFT');
    console.log('3. Back');

    const sel = Number(await rlQuestion('Pilih: '));
    if (sel === 3) return;

    if (sel === 1) {
      const name = await askInput('Token name', 'MyToken');
      const symbol = await askInput('Symbol', 'MTK');
      const dec = Number(await askInput('Decimals', '18'));
      const sup = ethers.parseUnits(await askInput('Supply', '1000000000'), dec);

      const { abi, bytecode } = loadBuild('SimpleERC20');
      const f = new ethers.ContractFactory(abi, bytecode, wallet);
      const c = await f.deploy(name, symbol, dec, sup, await wallet.getAddress());
      await c.deploymentTransaction().wait(1);

      console.log(chalk.green('ERC20 deployed:'), c.target);
      stats.inc('deploys', 1);
    }

    if (sel === 2) {
      const name = await askInput('NFT name', 'MyNFT');
      const symbol = await askInput('Symbol', 'MNFT');
      const max = Number(await askInput('Max supply', '10000'));

      const { abi, bytecode } = loadBuild('SimpleERC721');
      const f = new ethers.ContractFactory(abi, bytecode, wallet);
      const c = await f.deploy(name, symbol, max, await wallet.getAddress());
      await c.deploymentTransaction().wait(1);

      console.log(chalk.green('ERC721 deployed:'), c.target);
      stats.inc('deploys', 1);
    }
  }
};
