// faucet.js - FINAL PREMIUM
require('dotenv').config();
const ethers = require('ethers');
const chalk = require('chalk').default;
const ora = require('ora');

async function runInteractive(){
  if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    console.log(chalk.red('RPC_URL / PRIVATE_KEY missing'));
    return;
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const addr = await wallet.getAddress();

  const count = Number(process.env.FAUCET_COUNT||'1');
  const interval = Number(process.env.INTERVAL_MS||'1500');

  console.log(chalk.cyan('Claim Faucet via RPC'));
  console.log('Address:', addr);

  for (let i=0;i<count;i++){
    const spin = ora(`Claiming (${i+1}/${count})`).start();
    try {
      const res = await provider.send('tempo_fundAddress',[addr]);
      spin.succeed('Claimed '+JSON.stringify(res).slice(0,60));
    } catch(e){
      spin.fail(e.message);
    }
    await new Promise(r=>setTimeout(r, interval));
  }
}

module.exports = { runInteractive };
