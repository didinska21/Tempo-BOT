# 🤖 Tempo-BOT Multi-Wallet Automation

Automated blockchain transaction system untuk Tempo Network dengan support multi-wallet dan auto-loop.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-blue.svg)](https://docs.ethers.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Repository**: [github.com/didinska21/Tempo-BOT](https://github.com/didinska21/Tempo-BOT)  
> **Author**: didinska21

---

## 📋 Features

- ✅ **Multi-Wallet Support** - Kelola unlimited wallets sekaligus
- ✅ **Round-Robin Execution** - Distribusi merata ke semua wallet
- ✅ **Auto-Loop System** - Otomatis repeat setiap 12 jam (configurable)
- ✅ **Faucet Claims** - Auto claim token dari RPC Tempo
- ✅ **Token Sending** - Batch kirim token dengan round-robin
- ✅ **Contract Deployment** - Deploy ERC20/ERC721 secara otomatis
- ✅ **Real-time Progress** - Status update langsung dengan spinner & countdown
- ✅ **Error Handling** - Robust error handling untuk stabilitas
- ✅ **Configurable** - Semua setting via `config.json`

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/didinska21/Tempo-BOT.git
cd Tempo-BOT
```

### 2. Install Dependencies

**Metode 1: Automatic (Recommended)**
```bash
chmod +x install.sh
./install.sh
```

**Metode 2: Quick Install**
```bash
chmod +x quick-install.sh
./quick-install.sh
```

**Metode 3: Manual**
```bash
npm install
```

### 3. Setup Environment

Edit file `.env`:

```bash
nano .env
```

Tambahkan konfigurasi:

```env
RPC_URL=https://rpc.testnet.tempo.xyz
EXPLORER_BASE=https://explore.tempo.xyz
TOKENS=PathUSD:0x20c0000000000000000000000000000000000000,ThetaUSD:0x20c0000000000000000000000000000000000003,BetaUSD:0x20c0000000000000000000000000000000000002,AlphaUSD:0x20c0000000000000000000000000000000000001
TOKEN_BYTECODE=
NFT_BYTECODE=
WAIT_CONFIRM=true
INTERVAL_MS=1500

# Private Keys (tambahkan wallet sebanyak yang diinginkan)
PRIVATE_KEY_1=0xYourPrivateKey1
PRIVATE_KEY_2=0xYourPrivateKey2
PRIVATE_KEY_3=0xYourPrivateKey3
# ... dst sampai PRIVATE_KEY_100
```

### 4. Setup Configuration

Edit `config.json` (opsional):

```bash
nano config.json
```

### 5. Run Automation

**Auto-Loop Mode:**
```bash
node loop.js
```

**Manual Mode:**
```bash
node main.js
```

---

## ⚙️ Configuration

### File: `config.json`

```json
{
  "automation": {
    "enabled": true,
    "loopDelayHours": 12,
    "tasks": {
      "claimFaucet": {
        "enabled": true
      },
      "sendTokens": {
        "enabled": true,
        "sendsPerWallet": 100,
        "amountPerTx": "1"
      },
      "deployContracts": {
        "enabled": true,
        "deploysPerWallet": 10,
        "type": "ERC20"
      }
    },
    "delays": {
      "betweenWallets": 3,
      "betweenClaims": 15,
      "betweenSends": 2,
      "betweenDeploys": 5
    }
  }
}
```

### Configuration Options

#### Tasks Settings

| Task | Option | Description | Default |
|------|--------|-------------|---------|
| **claimFaucet** | `enabled` | Aktifkan claim faucet | `true` |
| **sendTokens** | `enabled` | Aktifkan send tokens | `true` |
| | `sendsPerWallet` | Jumlah send per wallet | `100` |
| | `amountPerTx` | Jumlah token per transaksi | `"1"` |
| **deployContracts** | `enabled` | Aktifkan deploy contracts | `true` |
| | `deploysPerWallet` | Jumlah deploy per wallet | `10` |
| | `type` | Tipe contract: `"ERC20"` atau `"ERC721"` | `"ERC20"` |

#### Delays (dalam detik)

| Delay | Description | Default |
|-------|-------------|---------|
| `betweenWallets` | Delay saat ganti wallet | `3s` |
| `betweenClaims` | Delay setelah claim faucet | `15s` |
| `betweenSends` | Delay setelah send token | `2s` |
| `betweenDeploys` | Delay setelah deploy contract | `5s` |

#### Loop Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `loopDelayHours` | Jam tunggu sebelum repeat cycle | `12` |

---

## 📊 Execution Flow

### Contoh: 5 Wallets, 100 Send/Wallet, 10 Deploy/Wallet

```
Cycle 1:
│
├─ 1. CLAIM FAUCET (Sequential)
│  ├─ Wallet 1 claim → wait 3s
│  ├─ Wallet 2 claim → wait 3s
│  ├─ Wallet 3 claim → wait 3s
│  ├─ Wallet 4 claim → wait 3s
│  └─ Wallet 5 claim
│     Total: 5 claims
│
├─ 2. SEND TOKENS (Round-Robin)
│  ├─ Round 1:  W1 → W2 → W3 → W4 → W5
│  ├─ Round 2:  W1 → W2 → W3 → W4 → W5
│  ├─ Round 3:  W1 → W2 → W3 → W4 → W5
│  ├─ ...
│  └─ Round 100: W1 → W2 → W3 → W4 → W5
│     Total: 500 transactions (100 × 5 wallets)
│
├─ 3. DEPLOY CONTRACTS (Round-Robin)
│  ├─ Round 1:  W1 → W2 → W3 → W4 → W5
│  ├─ Round 2:  W1 → W2 → W3 → W4 → W5
│  ├─ ...
│  └─ Round 10: W1 → W2 → W3 → W4 → W5
│     Total: 50 deployments (10 × 5 wallets)
│
└─ Wait 12 hours → Repeat Cycle 2
```

### Token Distribution (Round-Robin)

Setiap wallet akan send token secara bergiliran:
- Round 1: Wallet 1 send PathUSD
- Round 2: Wallet 1 send ThetaUSD
- Round 3: Wallet 1 send BetaUSD
- Round 4: Wallet 1 send AlphaUSD
- Round 5: Wallet 1 send PathUSD (repeat)

---

## 🎨 Output Example

```
════════════════════════════════════════════════════════════
    AUTO.TX MULTI-WALLET AUTOMATION - Cycle #1
════════════════════════════════════════════════════════════

Detected 5 private key(s) in .env
✓ Loaded 5 wallet(s)
✓ Loaded 4 token(s): PathUSD, ThetaUSD, BetaUSD, AlphaUSD

Started: 2026-01-18 22:00:00
Wallets: 5
RPC: https://rpc.testnet.tempo.xyz

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CLAIM FAUCET - Sequential
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Wallet 1 (0x1234...5678) - Claim Faucet berhasil
  └─ Claimed for 0x1234567890...
     ✓ 4 token(s) received
     √ 1.000.000 PathUSD : https://explore.tempo.xyz/tx/0xabc...
     √ 1.000.000 AlphaUSD : https://explore.tempo.xyz/tx/0xdef...
     √ 1.000.000 BetaUSD : https://explore.tempo.xyz/tx/0xghi...
     √ 1.000.000 ThetaUSD : https://explore.tempo.xyz/tx/0xjkl...

⏳ Next wallet: 3s

✓ Wallet 2 (0x5678...9abc) - Claim Faucet berhasil
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SEND TOKEN - Round Robin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Round 1/100

✓ Wallet 1 (0x1234...5678) - Send Token berhasil
  └─ [2026-01-18T22:05:00.000Z] ➜ SENT 0x9876543210...abcdef
     1 PathUSD → 0xabcdef1234...
     TX: https://explore.tempo.xyz/tx/0x9876543210...

⏳ Next wallet: 3s

✓ Wallet 2 (0x5678...9abc) - Send Token berhasil
  └─ [2026-01-18T22:05:05.000Z] ➜ SENT 0x1234567890...fedcba
     1 ThetaUSD → 0x1234567890...
     TX: https://explore.tempo.xyz/tx/0x1234567890...

...

✓ Round 1 selesai

📍 Round 2/100
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DEPLOY CONTRACT - Round Robin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Round 1/10

✓ Wallet 1 (0x1234...5678) - Deploy Contract berhasil
  └─ Deployed ERC20: TEMP0ABC123 (TMPAB12)
     Address: 0xContractAddress123...
     TX: https://explore.tempo.xyz/tx/0xDeployTx...

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CYCLE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Cycle #1 selesai
Duration: 45 minutes
Ended: 2026-01-18 22:45:00

⏰ Waiting 12 hours before next cycle...

⏳ Next cycle in: 11h 59m 50s
```

---

## 📁 Project Structure

```
Tempo-BOT/
├── loop.js                     # Main automation script (auto-loop)
├── main.js                     # Manual interactive mode
├── send.js                     # Send token functions
├── deploy.js                   # Deploy contract functions
├── faucet.js                   # Faucet claim functions
├── config.json                 # Configuration file
├── .env                        # Environment variables
├── package.json                # npm dependencies
├── install.sh                  # Full installation script
├── quick-install.sh            # Quick installation script
├── compile.sh                  # Contract compilation script
├── README.md                   # This file
│
├── contracts/                  # Solidity contracts
│   ├── SimpleERC20.sol        # ERC20 token contract
│   └── SimpleERC721.sol       # ERC721 NFT contract
│
├── build/                      # Compiled contracts
│   ├── SimpleERC20.abi.json
│   ├── SimpleERC20.bytecode.txt
│   ├── SimpleERC721.abi.json
│   └── SimpleERC721.bytecode.txt
│
├── data/                       # Data files (optional)
└── scripts/                    # Additional scripts (optional)
```

---

## 🛠️ Commands

### NPM Scripts

```bash
# Run auto-loop automation
npm start
# atau
npm run loop

# Run manual interactive mode
npm run manual

# Compile smart contracts
npm run compile

# Install all dependencies
npm run install-all
```

### Direct Node Commands

```bash
# Auto-loop mode
node loop.js

# Manual mode
node main.js
```

---

## 🔧 Advanced Usage

### Multiple Wallets Setup

Tambahkan sebanyak mungkin wallet di `.env`:

```env
PRIVATE_KEY_1=0x...
PRIVATE_KEY_2=0x...
PRIVATE_KEY_3=0x...
# ... dst sampai 100
```

### Custom Token Configuration

Edit `TOKENS` di `.env`:

```env
TOKENS=Token1:0xAddress1,Token2:0xAddress2,Token3:0xAddress3
```

### Disable Specific Tasks

Edit `config.json`:

```json
{
  "automation": {
    "tasks": {
      "claimFaucet": {
        "enabled": false  // Disable faucet claim
      },
      "sendTokens": {
        "enabled": true
      },
      "deployContracts": {
        "enabled": false  // Disable deploy
      }
    }
  }
}
```

### Adjust Loop Timing

Edit `config.json`:

```json
{
  "automation": {
    "loopDelayHours": 6  // Loop setiap 6 jam
  }
}
```

---

## 🛡️ Security & Safety

### Important Notes

- ⚠️ **Jangan share private keys** - Simpan `.env` dengan aman
- ⚠️ **Backup wallet** - Simpan private keys di tempat aman
- ⚠️ **Test dulu** - Gunakan testnet sebelum mainnet
- ⚠️ **Gas fees** - Pastikan semua wallet punya native token untuk gas
- ⚠️ **Rate limiting** - Sesuaikan delays jika kena RPC rate limit

### Best Practices

1. **Testing**: Mulai dengan `sendsPerWallet: 10` dan `deploysPerWallet: 2`
2. **Monitoring**: Pantau logs di cycle pertama
3. **Backup**: Simpan `.env` dan `config.json` di tempat aman
4. **Gas Management**: Monitor gas fees di setiap wallet
5. **Error Handling**: Script akan lanjut meskipun ada wallet yang error

---

## 🐛 Troubleshooting

### Error: "No private keys in .env"

**Solusi:**
```bash
# Pastikan format benar di .env
PRIVATE_KEY_1=0xYourKey1
PRIVATE_KEY_2=0xYourKey2
```

### Error: "Contract compilation failed"

**Solusi:**
```bash
# Install Solidity Compiler
wget https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux
chmod +x solc-static-linux
sudo mv solc-static-linux /usr/local/bin/solc

# Install OpenZeppelin
npm install @openzeppelin/contracts

# Compile ulang
./compile.sh
```

### Error: "Insufficient balance"

**Solusi:**
- Pastikan wallet punya token yang cukup
- Pastikan wallet punya native token untuk gas fees
- Cek balance dengan `node main.js` → pilih view balance

### Script Stops Unexpectedly

**Solusi:**
- Cek internet connection
- Cek RPC status
- Naikkan delays di `config.json`
- Run dengan `screen` atau `tmux`:
  ```bash
  screen -S tempo
  node loop.js
  # Tekan Ctrl+A lalu D untuk detach
  ```

---

## 📚 Resources

- **Tempo Network**: [tempo.xyz](https://tempo.xyz)
- **Tempo Testnet Explorer**: [explore.tempo.xyz](https://explore.tempo.xyz)
- **Ethers.js Docs**: [docs.ethers.org](https://docs.ethers.org/)
- **OpenZeppelin**: [openzeppelin.com](https://openzeppelin.com/)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**didinska21**

- GitHub: [@didinska21](https://github.com/didinska21)
- Repository: [Tempo-BOT](https://github.com/didinska21/Tempo-BOT)

---

## ⭐ Support

Jika project ini membantu, jangan lupa kasih **Star** ⭐ di GitHub!

[⭐ Star This Repository](https://github.com/didinska21/Tempo-BOT)

---

## 📧 Contact

Untuk pertanyaan atau bantuan, bisa buka **[Issues](https://github.com/didinska21/Tempo-BOT/issues)** di GitHub.

---

## 🎯 Roadmap

- [x] Multi-wallet support
- [x] Auto-loop system
- [x] Round-robin execution
- [x] Faucet claiming
- [x] Token sending
- [x] Contract deployment
- [ ] Web dashboard
- [ ] Database logging
- [ ] Telegram notifications
- [ ] Multi-chain support

---

<div align="center">

**Made with ❤️ by [didinska21](https://github.com/didinska21)**

[![GitHub Stars](https://img.shields.io/github/stars/didinska21/Tempo-BOT?style=social)](https://github.com/didinska21/Tempo-BOT)
[![GitHub Forks](https://img.shields.io/github/forks/didinska21/Tempo-BOT?style=social)](https://github.com/didinska21/Tempo-BOT/fork)

</div>
