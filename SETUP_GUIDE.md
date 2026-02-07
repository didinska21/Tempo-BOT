# 🚀 Setup Guide - Tempo-BOT

Panduan lengkap untuk setup dan troubleshooting Tempo-BOT.

---

## 📋 Quick Setup (5 Steps)

### 1️⃣ Clone Repository
```bash
git clone https://github.com/didinska21/Tempo-BOT.git
cd Tempo-BOT
```

### 2️⃣ Install Dependencies
```bash
chmod +x install.sh
./install.sh
```

Atau quick install:
```bash
chmod +x quick-install.sh
./quick-install.sh
```

### 3️⃣ Setup Contracts
Pastikan folder `contracts/` berisi:
```
contracts/
├── SimpleERC20.sol
└── SimpleERC721.sol
```

### 4️⃣ Compile Contracts
```bash
chmod +x compile.sh
./compile.sh
```

Atau quick compile:
```bash
chmod +x compile-quick.sh
./compile-quick.sh
```

### 5️⃣ Setup Environment
```bash
cp .env.example .env
nano .env
```

Isi dengan private keys Anda:
```env
PRIVATE_KEY_1=0xYourPrivateKey1
PRIVATE_KEY_2=0xYourPrivateKey2
# ... dst
```

---

## 🔧 Manual Setup (Step by Step)

### Step 1: Install Node.js (if not installed)
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v  # Should show v18.x or higher
npm -v   # Should show v9.x or higher
```

### Step 2: Install npm Dependencies
```bash
npm install
```

This will install:
- dotenv (environment variables)
- ethers v6 (blockchain library)
- chalk v5 (terminal colors)
- ora v8 (spinners)
- cli-progress (progress bars)
- @openzeppelin/contracts (smart contracts)

### Step 3: Install Solidity Compiler
```bash
# Download solc 0.8.20
cd /tmp
wget https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux
chmod +x solc-static-linux
sudo mv solc-static-linux /usr/local/bin/solc

# Verify
solc --version
```

### Step 4: Create Folders
```bash
mkdir -p contracts
mkdir -p build
```

### Step 5: Add Contract Files
Place these files in `contracts/` folder:

**contracts/SimpleERC20.sol:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleERC20 is ERC20, Ownable {
    uint8 private _decimals;
    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply) 
        ERC20(name_, symbol_) 
        Ownable(msg.sender) 
    {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
```

**contracts/SimpleERC721.sol:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleERC721 is ERC721, Ownable {
    uint256 public nextId;

    constructor(string memory name_, string memory symbol_) 
        ERC721(name_, symbol_) 
        Ownable(msg.sender) 
    {
        nextId = 1;
    }

    function mint(address to) external onlyOwner returns (uint256) {
        uint256 id = nextId++;
        _safeMint(to, id);
        return id;
    }
}
```

### Step 6: Compile Contracts
```bash
./compile.sh
```

Expected output:
```
✅ Compilation complete!

📋 Required files:
  ✓ SimpleERC20.abi.json
  ✓ SimpleERC20.bytecode.txt
  ✓ SimpleERC721.abi.json
  ✓ SimpleERC721.bytecode.txt
```

### Step 7: Setup Environment
```bash
cp .env.example .env
nano .env
```

Edit with your configuration:
```env
RPC_URL=https://rpc.testnet.tempo.xyz
EXPLORER_BASE=https://explore.tempo.xyz
TOKENS=PathUSD:0x20c0000000000000000000000000000000000000,ThetaUSD:0x20c0000000000000000000000000000000000003
WAIT_CONFIRM=true
INTERVAL_MS=1500

# Add your private keys
PRIVATE_KEY_1=0xYourKey1
PRIVATE_KEY_2=0xYourKey2
PRIVATE_KEY_3=0xYourKey3
```

### Step 8: Test Run
```bash
# Test interactive mode
node main.js

# Test standalone
node send.js
node deploy.js
node faucet.js

# Test auto-loop
node loop.js
```

---

## ❌ Common Errors & Solutions

### Error 1: "No such file or directory, open 'build/SimpleERC20.abi.json'"

**Penyebab:** Contract belum di-compile

**Solusi:**
```bash
# Check if contracts exist
ls contracts/

# Compile contracts
./compile.sh

# Verify build files
ls build/
```

### Error 2: "solc: command not found"

**Penyebab:** Solidity compiler belum terinstall

**Solusi:**
```bash
# Install solc
cd /tmp
wget https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux
chmod +x solc-static-linux
sudo mv solc-static-linux /usr/local/bin/solc

# Verify
solc --version
```

### Error 3: "No private keys in .env"

**Penyebab:** File .env tidak ada atau format salah

**Solusi:**
```bash
# Check .env exists
ls -la .env

# Check format
cat .env

# Should have:
# PRIVATE_KEY_1=0x...
# PRIVATE_KEY_2=0x...
```

### Error 4: "Cannot find module 'ethers'"

**Penyebab:** npm dependencies belum terinstall

**Solusi:**
```bash
# Install all dependencies
npm install

# Verify
npm list
```

### Error 5: "Error: invalid private key"

**Penyebab:** Format private key salah

**Solusi:**
```bash
# Private key harus format:
PRIVATE_KEY_1=0x1234567890abcdef...  (64 characters setelah 0x)

# Jangan pakai quotes:
# ❌ PRIVATE_KEY_1="0x..."
# ✅ PRIVATE_KEY_1=0x...
```

### Error 6: Contract compilation failed

**Penyebab:** OpenZeppelin contracts belum terinstall atau versi salah

**Solusi:**
```bash
# Install OpenZeppelin
npm install @openzeppelin/contracts

# Try compile again
./compile.sh
```

---

## 🔍 Verification Checklist

Before running the bot, verify:

- [ ] Node.js >= 18.0.0 installed (`node -v`)
- [ ] npm >= 9.0.0 installed (`npm -v`)
- [ ] All npm packages installed (`npm list`)
- [ ] Solidity compiler installed (`solc --version`)
- [ ] Contracts exist in `contracts/` folder
- [ ] Contracts compiled successfully (check `build/` folder)
- [ ] `.env` file exists with private keys
- [ ] `config.json` exists
- [ ] RPC_URL is correct in `.env`

---

## 📁 Expected File Structure

```
Tempo-BOT/
├── contracts/
│   ├── SimpleERC20.sol          ✅ Must exist
│   └── SimpleERC721.sol         ✅ Must exist
├── build/
│   ├── SimpleERC20.abi.json     ✅ Auto-generated by compile
│   ├── SimpleERC20.bytecode.txt ✅ Auto-generated by compile
│   ├── SimpleERC721.abi.json    ✅ Auto-generated by compile
│   └── SimpleERC721.bytecode.txt ✅ Auto-generated by compile
├── node_modules/                 ✅ Auto-generated by npm install
├── .env                          ✅ Must create from .env.example
├── .env.example                  ✅ Template
├── config.json                   ✅ Configuration
├── package.json                  ✅ Dependencies list
├── loop.js                       ✅ Main scripts
├── main.js                       ✅ Main scripts
├── send.js                       ✅ Main scripts
├── deploy.js                     ✅ Main scripts
├── faucet.js                     ✅ Main scripts
├── install.sh                    ✅ Installation script
├── compile.sh                    ✅ Compilation script
└── README.md                     ✅ Documentation
```

---

## 🚀 Quick Fix Commands

```bash
# Reset and reinstall everything
rm -rf node_modules build
npm install
./install.sh

# Recompile contracts only
rm -rf build
./compile.sh

# Check what's missing
ls contracts/  # Should show .sol files
ls build/      # Should show .abi.json and .bytecode.txt files
cat .env       # Should show PRIVATE_KEY_1, etc
```

---

## 🆘 Still Having Issues?

1. **Check logs** - Error messages usually tell you what's wrong
2. **Verify paths** - Make sure you're in the right directory
3. **Check permissions** - Scripts need execute permission (`chmod +x`)
4. **Clean install** - Try removing everything and start fresh
5. **Open issue** - Report on GitHub with full error message

---

## 💡 Tips

- Always run scripts from project root directory
- Use `chmod +x` to make scripts executable
- Check `.env` file doesn't have quotes around values
- Keep private keys secure and never commit to git
- Test with small amounts first

---

**Need help?** Open an issue: [github.com/didinska21/Tempo-BOT/issues](https://github.com/didinska21/Tempo-BOT/issues)
