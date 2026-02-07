#!/bin/bash

# Quick Compile - No checks, just compile

echo "🔨 Quick Compile..."

# Create directories
mkdir -p build contracts

# Check if contracts exist
if [ ! -f "contracts/SimpleERC20.sol" ] || [ ! -f "contracts/SimpleERC721.sol" ]; then
    echo "⚠️  Contract files not found!"
    echo ""
    echo "Please add these files to contracts/ folder:"
    echo "  • contracts/SimpleERC20.sol"
    echo "  • contracts/SimpleERC721.sol"
    echo ""
    echo "You can get them from the repository or create them manually."
    exit 1
fi

# Compile
solc --optimize --abi --bin --overwrite \
    --base-path . \
    --include-path node_modules \
    contracts/SimpleERC20.sol -o build/ 2>&1

solc --optimize --abi --bin --overwrite \
    --base-path . \
    --include-path node_modules \
    contracts/SimpleERC721.sol -o build/ 2>&1

# Rename
cd build
mv SimpleERC20.abi SimpleERC20.abi.json 2>/dev/null
mv SimpleERC20.bin SimpleERC20.bytecode.txt 2>/dev/null
mv SimpleERC721.abi SimpleERC721.abi.json 2>/dev/null
mv SimpleERC721.bin SimpleERC721.bytecode.txt 2>/dev/null
cd ..

# Check results
if [ -f "build/SimpleERC20.abi.json" ] && [ -f "build/SimpleERC20.bytecode.txt" ]; then
    echo "✅ SimpleERC20 compiled"
else
    echo "❌ SimpleERC20 compilation failed"
fi

if [ -f "build/SimpleERC721.abi.json" ] && [ -f "build/SimpleERC721.bytecode.txt" ]; then
    echo "✅ SimpleERC721 compiled"
else
    echo "❌ SimpleERC721 compilation failed"
fi

echo ""
echo "Done!"
