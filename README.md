# 🤖 Tempo-BOT Multi-Wallet Automation v2.0

Automated blockchain transaction system untuk Tempo Network dengan support multi-wallet dan auto-loop.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-blue.svg)](https://docs.ethers.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Repository**: [github.com/didinska21/Tempo-BOT](https://github.com/didinska21/Tempo-BOT)  
> **Author**: didinska21

---

## 📋 Features

- ✅ **Multi-Wallet Support** - Kelola unlimited wallets sekaligus (PRIVATE_KEY_1, PRIVATE_KEY_2, dst)
- ✅ **Standalone Mode** - Setiap module bisa dijalankan mandiri (send.js, deploy.js, faucet.js)
- ✅ **Interactive Wallet Switcher** - Ganti wallet langsung dari menu
- ✅ **Custom Loop Delay** - Tentukan sendiri delay loop (1-72 jam)
- ✅ **Amount Confirmation** - Tampil konfirmasi jumlah sebelum send
- ✅ **Round-Robin Execution** - Distribusi merata ke semua wallet
- ✅ **Auto-Loop System** - Otomatis repeat dengan delay custom
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

Copy dan edit file `.env`:

```bash
cp .env.example .env
nano .env
```

Isi konfigurasi:

```env
# RPC Configuration
RPC_URL=https://rpc.testnet.tempo.xyz
EXPLORER_BASE=https://explore.tempo.xyz

# Token Addresses
TOKENS=PathUSD:0x20c0000000000000000000000000000000000000,ThetaUSD:0x20c0000000000000000000000000000000000003,BetaUSD:0x20c0000000000000000000000000000000000002,AlphaUSD:0x20c0000000000000000000000000000000000001

WAIT_CONFIRM=true
INTERVAL_MS=1500

# Private Keys - Multi-Wallet Support
PRIVATE_KEY_1=0xYourPrivateKey1
PRIVATE_KEY_2=0xYourPrivateKey2
PRIVATE_KEY_3=0xYourPrivateKey3
# ... tambahkan sampai 100 wallet
```

### 4. Setup Smart Contracts

Letakkan contract files di folder `contracts/`:

**contracts/SimpleERC20.sol** - ERC20 token contract  
**contracts/SimpleERC721.sol** - ERC721 NFT contract

Contracts sudah disediakan di repository.

### 5. Run Bot

**Option 1: Auto-Loop Mode** (Recommended)
```bash
node loop.js
```
Program akan bertanya delay loop yang diinginkan (1-72 jam).

**Option 2: Interactive Mode**
```bash
node main.js
```
Menu interaktif dengan wallet switcher.

**Option 3: Standalone Modules**
```bash
node send.js      # Hanya send tokens
node deploy.js    # Hanya deploy contracts
node faucet.js    # Hanya claim faucet
```

---

## 🎮 Usage Examples

### Auto-Loop Mode
```bash
$ node loop.js

╔═══════════════════════════════════════════════╗
║   TEMPO-BOT MULTI-WALLET AUTOMATION           ║
╚═══════════════════════════════════════════════╝

⚙️  Konfigurasi Loop Delay
────────────────────────────────────────────────

Berapa jam delay antar cycle loop? (1-72 jam): 6

✓ Loop delay set: 6 jam
  (Setiap cycle akan diulang setiap 6 jam)

✓ Loaded 5 wallet(s)
✓ Loaded 4 token(s): PathUSD, ThetaUSD, BetaUSD, AlphaUSD
✓ Loop delay: 6 jam
```

### Interactive Mode
```bash
$ node main.js

✓ Loaded 5 wallet(s)
✓ Loaded 4 token(s)

┌─────────────────────────────────────────────┐
│ AUTO.TX by didinska                         │
├─────────────────────────────────────────────┤
│ Wallets  : 5 wallet(s) loaded               │
│ Active   : #1 0x1234...5678                 │
│ Explorer : https://explore.tempo.xyz        │
├─────────────────────────────────────────────┤
│ 1. PathUSD | 1000000                        │
│ 2. ThetaUSD | 1000000                       │
│ 3. BetaUSD | 1000000                        │
│ 4. AlphaUSD | 1000000                       │
└─────────────────────────────────────────────┘

Pilih menu:
 1. Send Address (per token / send all)
 2. Deploy Kontrak (Token / NFT)
 3. Claim Faucet (RPC)
 4. ─────────────────────────────
 5. Switch Wallet (Current: #1)
 6. Exit
```

### Standalone Send
```bash
$ node send.js

╔═══════════════════════════════════════╗
║     SEND TOKEN - STANDALONE MODE     ║
╚═══════════════════════════════════════╝

✓ Loaded 5 wallet(s)
✓ Loaded 4 token(s): PathUSD, ThetaUSD, BetaUSD, AlphaUSD

═══ SELECT WALLET ═══
Pilih wallet:
 1. #1 - 0x1234...5678
 2. #2 - 0x5678...9abc
 ...
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

---

## 📊 Execution Flow

### Loop Mode Example: 5 Wallets, 100 Send/Wallet

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
│  ├─ ...
│  └─ Round 100: W1 → W2 → W3 → W4 → W5
│     Total: 500 transactions
│
├─ 3. DEPLOY CONTRACTS (Round-Robin)
│  ├─ Round 1:  W1 → W2 → W3 → W4 → W5
│  ├─ ...
│  └─ Round 10: W1 → W2 → W3 → W4 → W5
│     Total: 50 deployments
│
└─ Wait 6 hours → Repeat Cycle 2
```

---

## 📁 Project Structure

```
Tempo-BOT/
├── loop.js                     # Auto-loop automation (dengan custom delay)
├── main.js                     # Interactive mode (multi-wallet switcher)
├── send.js                     # Send token module (standalone)
├── deploy.js                   # Deploy contract module (standalone)
├── faucet.js                   # Faucet claim module (standalone)
├── stats.js                    # Statistics module
├── config.json                 # Configuration file
├── .env                        # Environment variables
├── .env.example                # Example environment file
├── package.json                # npm dependencies
├── install.sh                  # Full installation script
├── quick-install.sh            # Quick installation script
├── compile.sh                  # Contract compilation script
├── compile_all.js              # Compile all contracts (Node.js)
├── README.md                   # This file
│
├── contracts/                  # Solidity contracts
│   ├── SimpleERC20.sol        # ERC20 token contract
│   └── SimpleERC721.sol       # ERC721 NFT contract
│
└── build/                      # Compiled contracts (auto-generated)
    ├── SimpleERC20.abi.json
    ├── SimpleERC20.bytecode.txt
    ├── SimpleERC721.abi.json
    └── SimpleERC721.bytecode.txt
```

---

## 🛠️ Commands

### NPM Scripts

```bash
# Auto-loop automation (dengan custom delay)
npm start
# atau
npm run loop

# Interactive mode (dengan wallet switcher)
npm run manual

# Standalone modules
npm run send        # Send tokens only
npm run deploy      # Deploy contracts only
npm run faucet      # Claim faucet only

# Compile smart contracts
npm run compile

# Full installation
npm run install-all
```

### Direct Node Commands

```bash
# Auto-loop mode
node loop.js

# Interactive mode
node main.js

# Standalone modules
node send.js
node deploy.js
node faucet.js
```

---

## 🆕 What's New in v2.0

### ✨ Major Features

1. **Standalone Mode** - Setiap module bisa dijalankan mandiri
2. **Custom Loop Delay** - Tentukan sendiri delay loop (1-72 jam)
3. **Interactive Wallet Switcher** - Ganti wallet langsung dari menu
4. **Amount Confirmation** - Tampil konfirmasi sebelum send
5. **Task Configuration Display** - Tampil config di header loop
6. **Better Error Messages** - Error handling lebih informatif

### 🔧 Improvements

- ✅ Multi-wallet support di semua module
- ✅ Better UI/UX dengan konfirmasi
- ✅ Auto-create folders saat install
- ✅ Create .env.example template
- ✅ Improved install scripts
- ✅ Better logging & progress display

---

## 🔧 Advanced Usage

### Multiple Wallets Setup

Tambahkan sebanyak mungkin wallet di `.env`:

```env
PRIVATE_KEY_1=0x...
PRIVATE_KEY_2=0x...
PRIVATE_KEY_3=0x...
# ... sampai PRIVATE_KEY_100
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
- [x] Standalone mode
- [x] Custom loop delay
- [x] Wallet switcher
- [x] Amount confirmation
- [ ] Web dashboard
- [ ] Database logging
- [ ] Telegram notifications
- [ ] Multi-chain support

---

<div align="center">

**Made with ❤️ by [didinska21](https://github.com/didinska21)**

[![GitHub Stars](https://img.shields.io/github/stars/didinska21/Tempo-BOT?style=social)](https://github.com/didinska21/Tempo-BOT)
[![GitHub Forks](https://img.shields.io/github/forks/didinska21/Tempo-BOT?style=social)](https://github.com/didinska21/Tempo-BOT/fork)

**Version 2.0** - Updated with Standalone Mode & Multi-Wallet Enhancements

</div>
