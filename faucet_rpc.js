// faucet_rpc.js — CLEAN & STABLE
require('dotenv').config();

const chalk = require('chalk').default;
const ethers = require('ethers');

function now() {
  return new Date().toISOString();
}

module.exports.runInteractive = async function ({ provider, wallet, stats }) {
  if (!process.env.FAUCET_RPC) {
    console.log(chalk.red('FAUCET_RPC belum diset di .env'));
    return;
  }

  const addr = await wallet.getAddress();
  console.log(chalk.yellow(`[${now()}] Claim faucet for ${addr}`));

  try {
    const res = await provider.send(process.env.FAUCET_RPC, [addr]);

    console.log(
      chalk.green(`[${now()}] ✅ Faucet claimed successfully`)
    );

    if (Array.isArray(res)) {
      res.forEach(h => {
        if (process.env.EXPLORER_BASE) {
          console.log(
            chalk.cyan(`TX: ${process.env.EXPLORER_BASE}/tx/${h}`)
          );
        }
      });
    }

    if (stats) stats.inc('faucet_claims', 1);
  } catch (e) {
    console.log(chalk.red('Faucet claim failed:'), e?.message || e);
  }
};
