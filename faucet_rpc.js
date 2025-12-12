// faucet_rpc.js — FINAL
require('dotenv').config();
const chalk = require('chalk').default;

module.exports.runInteractive = async function ({ provider, wallet, stats }) {
  console.clear();
  const addr = await wallet.getAddress();
  console.log(`Claim faucet for ${addr}`);

  try {
    const res = await provider.send(process.env.FAUCET_RPC, [addr]);
    console.log(chalk.green('Faucet claimed'));

    if (Array.isArray(res)) {
      res.forEach(h =>
        console.log(`${process.env.EXPLORER_BASE}/tx/${h}`)
      );
    }
    stats.inc('faucet_claims', 1);
  } catch (e) {
    console.log(chalk.red('Faucet failed'), e.message);
  }

  await new Promise(r => setTimeout(r, 1500));
};
