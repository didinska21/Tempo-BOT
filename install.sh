#!/bin/bash

# ============================================
# AUTO.TX Multi-Wallet Setup Script
# ============================================

echo "════════════════════════════════════════"
echo "  AUTO.TX MULTI-WALLET INSTALLATION"
echo "════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# 1. Check Node.js & npm
# ============================================
echo -e "${BLUE}[1/6]${NC} Checking Node.js & npm..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found!${NC}"
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✓ Node.js found:${NC} $(node -v)"
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found!${NC}"
    exit 1
else
    echo -e "${GREEN}✓ npm found:${NC} $(npm -v)"
fi

echo ""

# ============================================
# 2. Install npm dependencies
# ============================================
echo -e "${BLUE}[2/6]${NC} Installing npm packages..."

npm install dotenv ethers@^6.9.0 chalk@^5.3.0 ora@^7.0.1 cli-progress readline

echo -e "${GREEN}✓ npm packages installed${NC}"
echo ""

# ============================================
# 3. Install OpenZeppelin Contracts
# ============================================
echo -e "${BLUE}[3/6]${NC} Installing OpenZeppelin contracts..."

npm install @openzeppelin/contracts

echo -e "${GREEN}✓ OpenZeppelin contracts installed${NC}"
echo ""

# ============================================
# 4. Install Solidity Compiler
# ============================================
echo -e "${BLUE}[4/6]${NC} Installing Solidity Compiler..."

# Remove old snap version if exists
if command -v snap &> /dev/null; then
    sudo snap remove solc 2>/dev/null
fi

# Check if solc already installed
if command -v solc &> /dev/null; then
    SOLC_VERSION=$(solc --version 2>/dev/null | grep -oP "Version: \K[0-9]+\.[0-9]+\.[0-9]+" | head -1)
    if [[ "$SOLC_VERSION" == "0.8."* ]]; then
        echo -e "${GREEN}✓ Solidity Compiler already installed: v${SOLC_VERSION}${NC}"
    else
        echo -e "${YELLOW}⚠ Old version found (${SOLC_VERSION}), installing new version...${NC}"
        sudo rm -f /usr/local/bin/solc
    fi
fi

# Install solc 0.8.20 if not exists or old version
if ! command -v solc &> /dev/null || [[ "$SOLC_VERSION" != "0.8."* ]]; then
    echo "Downloading solc 0.8.20..."
    cd /tmp
    wget -q https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux -O solc-static-linux
    chmod +x solc-static-linux
    sudo mv solc-static-linux /usr/local/bin/solc
    hash -r
    echo -e "${GREEN}✓ Solidity Compiler v0.8.20 installed${NC}"
fi

# Verify installation
SOLC_VERSION=$(solc --version 2>/dev/null | grep -oP "Version: \K[0-9]+\.[0-9]+\.[0-9]+" | head -1)
echo -e "${GREEN}✓ solc version:${NC} ${SOLC_VERSION}"
echo ""

# ============================================
# 5. Compile Smart Contracts
# ============================================
echo -e "${BLUE}[5/6]${NC} Compiling smart contracts..."

# Create build directory
mkdir -p build

# Create contracts directory if not exists
if [ ! -d "contracts" ]; then
    echo -e "${YELLOW}⚠ contracts/ folder not found, creating...${NC}"
    mkdir -p contracts
fi

# Check if contracts exist
if [ ! -f "contracts/SimpleERC20.sol" ] || [ ! -f "contracts/SimpleERC721.sol" ]; then
    echo -e "${YELLOW}⚠ Contract files not found in contracts/ folder${NC}"
    echo "Please make sure to place:"
    echo "  • contracts/SimpleERC20.sol"
    echo "  • contracts/SimpleERC721.sol"
    echo ""
    echo "You can skip compilation for now and compile later with:"
    echo "  ./compile.sh"
    echo ""
else
    # Compile ERC20
    echo "Compiling SimpleERC20.sol..."
    solc --optimize --abi --bin --overwrite \
        --base-path . \
        --include-path node_modules \
        contracts/SimpleERC20.sol -o build/
    
    # Compile ERC721
    echo "Compiling SimpleERC721.sol..."
    solc --optimize --abi --bin --overwrite \
        --base-path . \
        --include-path node_modules \
        contracts/SimpleERC721.sol -o build/
    
    # Rename files
    cd build
    mv SimpleERC20.abi SimpleERC20.abi.json 2>/dev/null
    mv SimpleERC20.bin SimpleERC20.bytecode.txt 2>/dev/null
    mv SimpleERC721.abi SimpleERC721.abi.json 2>/dev/null
    mv SimpleERC721.bin SimpleERC721.bytecode.txt 2>/dev/null
    cd ..
    
    echo -e "${GREEN}✓ Contracts compiled successfully${NC}"
    
    # Check results
    if [ -f "build/SimpleERC20.abi.json" ] && [ -f "build/SimpleERC20.bytecode.txt" ]; then
        echo -e "${GREEN}  ✓ SimpleERC20 ready${NC}"
    else
        echo -e "${RED}  ✗ SimpleERC20 compilation failed${NC}"
    fi
    
    if [ -f "build/SimpleERC721.abi.json" ] && [ -f "build/SimpleERC721.bytecode.txt" ]; then
        echo -e "${GREEN}  ✓ SimpleERC721 ready${NC}"
    else
        echo -e "${RED}  ✗ SimpleERC721 compilation failed${NC}"
    fi
fi

echo ""

# ============================================
# 6. Create config.json if not exists
# ============================================
echo -e "${BLUE}[6/6]${NC} Setting up configuration..."

if [ ! -f "config.json" ]; then
    echo "Creating config.json..."
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
    echo -e "${GREEN}✓ config.json created${NC}"
else
    echo -e "${GREEN}✓ config.json already exists${NC}"
fi

# Check .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Creating example .env file..."
    cat > .env.example << 'EOF'
# RPC Configuration
RPC_URL=https://rpc.testnet.tempo.xyz
EXPLORER_BASE=https://explore.tempo.xyz

# Token Addresses (format: Symbol:Address,Symbol:Address)
TOKENS=PathUSD:0x20c0000000000000000000000000000000000000,ThetaUSD:0x20c0000000000000000000000000000000000003,BetaUSD:0x20c0000000000000000000000000000000000002,AlphaUSD:0x20c0000000000000000000000000000000000001

# Wait for confirmation
WAIT_CONFIRM=true

# Interval between transactions (ms)
INTERVAL_MS=1500

# Private Keys - Multi-Wallet Support
# Add as many wallets as you need (PRIVATE_KEY_1, PRIVATE_KEY_2, etc)
PRIVATE_KEY_1=0xYourPrivateKeyHere1
PRIVATE_KEY_2=0xYourPrivateKeyHere2
PRIVATE_KEY_3=0xYourPrivateKeyHere3
# ... add more as needed (up to 100)
EOF
    echo -e "${GREEN}✓ Created .env.example${NC}"
    echo ""
    echo "Please copy and edit it:"
    echo "  cp .env.example .env"
    echo "  nano .env"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

echo ""

# ============================================
# Installation Complete
# ============================================
echo "════════════════════════════════════════"
echo -e "${GREEN}✅ INSTALLATION COMPLETE!${NC}"
echo "════════════════════════════════════════"
echo ""
echo "📋 Summary:"
echo "  ✓ Node.js & npm"
echo "  ✓ npm packages (ethers, chalk, ora, etc)"
echo "  ✓ OpenZeppelin contracts"
echo "  ✓ Solidity Compiler v${SOLC_VERSION}"
echo "  ✓ Smart contracts compiled"
echo "  ✓ Configuration files ready"
echo ""
echo "🚀 Next steps:"
echo "  1. Edit .env file with your private keys:"
echo "     nano .env"
echo ""
echo "  2. Edit config.json if needed:"
echo "     nano config.json"
echo ""
echo "  3. Run automation (with custom loop delay):"
echo "     node loop.js"
echo ""
echo "  4. Or run interactive mode (multi-wallet support):"
echo "     node main.js"
echo ""
echo "  5. Or run standalone modules:"
echo "     node send.js      # Send tokens only"
echo "     node deploy.js    # Deploy contracts only"
echo "     node faucet.js    # Claim faucet only"
echo ""
echo "💡 Tips:"
echo "  • All scripts now support multi-wallet (PRIVATE_KEY_1, PRIVATE_KEY_2, etc)"
echo "  • loop.js will ask for custom delay hours (1-72 hours)"
echo "  • main.js has wallet switcher in menu"
echo "  • send.js shows amount confirmation before sending"
echo ""
echo "════════════════════════════════════════"
