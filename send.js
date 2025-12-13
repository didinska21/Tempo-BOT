// send.js - FINAL PREMIUM
require('dotenv').config();
const ethers = require('ethers');
const chalk = require('chalk').default;
const ora = require('ora');
const { SingleBar, Presets } = require('cli-progress');
const readline = require('readline');

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
  return a === '' ? def : a;
}

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

async function getTokenBalance(provider, token, address){
  const c = new ethers.Contract(token.address, ERC20_ABI, provider);
  const dec = await c.decimals();
  const bal = await c.balanceOf(address);
  return { bal, dec, human: ethers.formatUnits(bal, dec) };
}

module.exports.runSendMenu = async function({ provider, wallet, tokens }){
  const walletAddress = await wallet.getAddress();

  while(true){
    console.log(chalk.yellow('\nSend Menu:'));
    tokens.forEach((t,i)=>
      console.log(`${i+1}. ${t.symbol}  balance: ${t.balanceHuman}`)
    );
    console.log(`${tokens.length+1}. Send Semua Token`);
    console.log(`${tokens.length+2}. Back`);

    const sel = Number(await askInput('Pilih menu')) - 1;
    if (sel === tokens.length+1) return;
    if (sel < 0 || sel > tokens.length+1) continue;

    const isAll = sel === tokens.length;
    const destIdx = await askNumbered(
      ['Send to Random Address','Send to Manual Address','Back'],
      'Tujuan'
    );
    if (destIdx === 2) continue;

    let toManual = null;
    if (destIdx === 1) {
      toManual = await askInput('Address tujuan');
      if (!ethers.isAddress(toManual)) {
        console.log(chalk.red('Address tidak valid'));
        continue;
      }
    }

    const amount = await askInput('Jumlah token per tx','1');
    const count = Number(await askInput('Jumlah TX (0 = sampai balance habis)','1'));
    const waitConfirm = (await askNumbered(['Yes','No'],'Tunggu konfirmasi?')) === 0;

    const list = isAll ? tokens : [tokens[sel]];

    let estimated = 0;
    if (count === 0) {
      for (const t of list) {
        const b = await getTokenBalance(provider, t, walletAddress);
        const per = ethers.parseUnits(amount, b.dec);
        const est = Number(b.bal / per);
        console.log(chalk.yellow(`[INFO] ${t.symbol}: ~${est} tx`));
        estimated += est;
      }
    } else {
      estimated = count * list.length;
    }
    if (estimated <= 0) estimated = 1;

    const bar = new SingleBar({
      format: chalk.cyan('Progress')+' |{bar}| {value}/{total} TX'
    }, Presets.shades_classic);
    bar.start(estimated, 0);

    for (const t of list) {
      const c = new ethers.Contract(t.address, ERC20_ABI, wallet);
      const dec = await c.decimals();
      const unit = ethers.parseUnits(amount, dec);

      let sent = 0;
      while(count===0 || sent < count){
        const bal = await c.balanceOf(walletAddress);
        if (bal < unit) break;

        const to = destIdx===0 ? ethers.Wallet.createRandom().address : toManual;
        const spin = ora(`Sending ${t.symbol} → ${to}`).start();

        try {
          const tx = await c.transfer(to, unit);
          spin.text = 'Waiting confirmation...';
          if (waitConfirm) await tx.wait(1);
          spin.succeed(`TX ${tx.hash}`);
          if (process.env.EXPLORER_BASE)
            console.log(process.env.EXPLORER_BASE+'/tx/'+tx.hash);
        } catch(e){
          spin.fail(`Failed: ${e.message}`);
        }

        sent++;
        bar.increment();
        await new Promise(r=>setTimeout(r, Number(process.env.INTERVAL_MS||1500)));
      }
    }

    bar.stop();
    console.log(chalk.green('\nSend session finished.\n'));
  }
};
