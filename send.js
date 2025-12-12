// send.js — clean version (NO NATIVE), menu per-token + send all tokens
// Requires: ethers v6, inquirer
const inquirer = require('inquirer');

const prompt = (inquirer.createPromptModule && inquirer.createPromptModule()) || inquirer.prompt;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

function tlog(...args){ console.log(`[${new Date().toISOString()}]`, ...args); }

async function sendERC20(provider, wallet, ethers, token, to, amountHuman, waitConfirm) {
  const contract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amount = ethers.parseUnits(String(amountHuman), decimals);

  tlog(`Sending ${amountHuman} ${token.symbol} → ${to}`);
  const tx = await contract.transfer(to, amount);
  tlog("TX Sent:", tx.hash);

  let receipt = null;
  if (waitConfirm) {
    tlog("Waiting for confirmation…");
    receipt = await tx.wait(1);
    tlog("Confirmed in block", receipt.blockNumber);
  }

  return { tx, receipt };
}

function printTokenSummary(tx, receipt, walletAddr, to, token, amount, ethers) {
  tlog("TX Hash:", tx.hash);
  console.log(" from:", walletAddr);
  console.log(" to:", to);
  console.log(" token:", token.symbol);
  console.log(" amount:", amount);
  if (receipt) {
    console.log(" block:", receipt.blockNumber);
    console.log(" gasUsed:", String(receipt.gasUsed));
    try {
      const eff = receipt.effectiveGasPrice ?? 0n;
      const fee = BigInt(receipt.gasUsed) * BigInt(eff);
      console.log(' txFee (wei):', String(fee));
      console.log(' txFee (ETH):', ethers.formatEther(fee));
    } catch (e) {}
  }
  console.log('-----------------------------------');
}

async function runSendMenu({ provider, wallet, tokens, ethers }) {

  while (true) {

    const choices = tokens.map((t,i)=> ({
      name: `Send Token: ${t.symbol} — balance: ${t.balanceHuman || 'n/a'}`,
      value: i
    }));

    choices.push({ name: "Send Semua Token", value: "send_all" });
    choices.push({ name: "Back to Main Menu", value: "back" });

    const { menu } = await prompt([{
      type: "list",
      name: "menu",
      message: "Send Address - pilih:",
      choices
    }]);

    if (menu === "back") return;

    // SEND ALL TOKENS
    if (menu === "send_all") {

      const { to } = await prompt([{
        type: "input", name: "to", message: "Masukkan address tujuan:",
        validate: v => ethers.isAddress(v) ? true : "Address tidak valid"
      }]);

      const { amount } = await prompt([{
        type: "input",
        name: "amount",
        message: "Jumlah yang akan dikirim untuk SEMUA token (per token):",
        default: "1",
        validate: v => !isNaN(Number(v)) ? true : "Masukkan angka valid"
      }]);

      const { waitConfirm } = await prompt([{
        type: "confirm", name: "waitConfirm", message: "Tunggu 1 konfirmasi?", default: true
      }]);

      for (const token of tokens) {
        try {
          const res = await sendERC20(provider, wallet, ethers, token, to, amount, waitConfirm);
          printTokenSummary(res.tx, res.receipt, await wallet.getAddress(), to, token, amount, ethers);
        } catch (err) {
          tlog(`Gagal send ${token.symbol}:`, err.message || err);
        }
      }

      continue;
    }

    // SEND SINGLE TOKEN
    const token = tokens[menu];

    const { to } = await prompt([{
      type: "input", name: "to", message: "Masukkan address tujuan:",
      validate: v => ethers.isAddress(v) ? true : "Address tidak valid"
    }]);

    const { amount } = await prompt([{
      type: "input",
      name: "amount",
      message: `Jumlah ${token.symbol} yang akan dikirim:`,
      default: "1",
      validate: v => !isNaN(Number(v)) ? true : "Masukkan angka valid"
    }]);

    const { waitConfirm } = await prompt([{
      type: "confirm", name: "waitConfirm", message: "Tunggu 1 konfirmasi?", default: true
    }]);

    try {
      const res = await sendERC20(provider, wallet, ethers, token, to, amount, waitConfirm);
      printTokenSummary(res.tx, res.receipt, await wallet.getAddress(), to, token, amount, ethers);

    } catch (err) {
      tlog("Error:", err.message || err);
    }

  }
}

module.exports = { runSendMenu };
