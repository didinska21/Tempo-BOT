#!/bin/bash

# Quick Install - One Command Setup

echo "🚀 Quick Install Started..."

# Install Node.js if not exists
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install npm packages
npm install

# Install solc if not exists or old version
if ! command -v solc &> /dev/null; then
    cd /tmp
    wget -q https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux
    chmod +x solc-static-linux
    sudo mv solc-static-linux /usr/local/bin/solc
    cd -
fi

# Compile contracts
mkdir -p build
solc --optimize --abi --bin --overwrite --base-path . --include-path node_modules contracts/SimpleERC20.sol -o build/ 2>/dev/null
solc --optimize --abi --bin --overwrite --base-path . --include-path node_modules contracts/SimpleERC721.sol -o build/ 2>/dev/null

cd build
mv SimpleERC20.abi SimpleERC20.abi.json 2>/dev/null
mv SimpleERC20.bin SimpleERC20.bytecode.txt 2>/dev/null
mv SimpleERC721.abi SimpleERC721.abi.json 2>/dev/null
mv SimpleERC721.bin SimpleERC721.bytecode.txt 2>/dev/null
cd ..

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

echo "✅ Installation complete!"
echo ""
echo "Next: Edit .env and run 'node loop.js'"
