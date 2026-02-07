#!/bin/bash

# Quick Install - One Command Setup

echo "════════════════════════════════════════"
echo "  🚀 QUICK INSTALL - TEMPO BOT"
echo "════════════════════════════════════════"
echo ""

# Install Node.js if not exists
echo "[1/5] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✓ Node.js $(node -v)"
fi

# Install npm packages
echo ""
echo "[2/5] Installing npm packages..."
npm install

# Install solc if not exists or old version
echo ""
echo "[3/5] Installing Solidity Compiler..."
if ! command -v solc &> /dev/null; then
    cd /tmp
    wget -q https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux
    chmod +x solc-static-linux
    sudo mv solc-static-linux /usr/local/bin/solc
    cd -
    echo "✓ Solidity Compiler v0.8.20 installed"
else
    echo "✓ Solidity Compiler already installed"
fi

# Create directories
echo ""
echo "[4/5] Creating directories..."
mkdir -p build
mkdir -p contracts

# Compile contracts if they exist
echo ""
echo "[5/5] Compiling contracts..."
if [ -f "contracts/SimpleERC20.sol" ] && [ -f "contracts/SimpleERC721.sol" ]; then
    solc --optimize --abi --bin --overwrite --base-path . --include-path node_modules contracts/SimpleERC20.sol -o build/ 2>/dev/null
    solc --optimize --abi --bin --overwrite --base-path . --include-path node_modules contracts/SimpleERC721.sol -o build/ 2>/dev/null
    
    cd build
    mv SimpleERC20.abi SimpleERC20.abi.json 2>/dev/null
    mv SimpleERC20.bin SimpleERC20.bytecode.txt 2>/dev/null
    mv SimpleERC721.abi SimpleERC721.abi.json 2>/dev/null
    mv SimpleERC721.bin SimpleERC721.bytecode.txt 2>/dev/null
    cd ..
    
    echo "✓ Contracts compiled"
else
    echo "⚠ Contract files not found, please add them to contracts/ folder"
fi

# Create config.json if not exists
if [ ! -f "config.json" ]; then
    cat > config.json << 'EOF'
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
EOF
fi

# Create .env.example if not exists
if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
# RPC Configuration
RPC_URL=https://rpc.testnet.tempo.xyz
EXPLORER_BASE=https://explore.tempo.xyz

# Token Addresses
TOKENS=PathUSD:0x20c0000000000000000000000000000000000000,ThetaUSD:0x20c0000000000000000000000000000000000003,BetaUSD:0x20c0000000000000000000000000000000000002,AlphaUSD:0x20c0000000000000000000000000000000000001

WAIT_CONFIRM=true
INTERVAL_MS=1500

# Multi-Wallet Support
PRIVATE_KEY_1=0xYourPrivateKeyHere1
PRIVATE_KEY_2=0xYourPrivateKeyHere2
PRIVATE_KEY_3=0xYourPrivateKeyHere3
EOF
fi

echo ""
echo "════════════════════════════════════════"

echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Copy and edit .env file:"
echo "     cp .env.example .env && nano .env"
echo ""
echo "  2. Run automation or interactive mode:"
echo "     node loop.js     # Auto-loop with custom delay"
echo "     node main.js     # Interactive multi-wallet menu"
echo "     node send.js     # Standalone send tokens"
echo "     node deploy.js   # Standalone deploy contracts"
echo "     node faucet.js   # Standalone faucet claim"
echo ""
echo "💡 All scripts support multi-wallet (PRIVATE_KEY_1, PRIVATE_KEY_2, etc)"
