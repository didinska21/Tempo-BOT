#!/bin/bash

# ============================================
# Compile Smart Contracts
# ============================================

echo "🔨 Compiling Smart Contracts..."
echo ""

# Check if solc installed
if ! command -v solc &> /dev/null; then
    echo "❌ Solidity Compiler not found!"
    echo "Please run ./install.sh first"
    exit 1
fi

# Check contracts exist
if [ ! -f "contracts/SimpleERC20.sol" ] || [ ! -f "contracts/SimpleERC721.sol" ]; then
    echo "❌ Contract files not found in contracts/ folder"
    exit 1
fi

# Clear old build
echo "📁 Clearing old build files..."
rm -rf build/*
mkdir -p build

# Compile ERC20
echo "📝 Compiling SimpleERC20.sol..."
solc --optimize --abi --bin --overwrite \
    --base-path . \
    --include-path node_modules \
    contracts/SimpleERC20.sol -o build/

if [ $? -ne 0 ]; then
    echo "❌ SimpleERC20 compilation failed"
    exit 1
fi

# Compile ERC721
echo "📝 Compiling SimpleERC721.sol..."
solc --optimize --abi --bin --overwrite \
    --base-path . \
    --include-path node_modules \
    contracts/SimpleERC721.sol -o build/

if [ $? -ne 0 ]; then
    echo "❌ SimpleERC721 compilation failed"
    exit 1
fi

# Rename files
echo "📦 Renaming output files..."
cd build

if [ -f "SimpleERC20.abi" ]; then
    mv SimpleERC20.abi SimpleERC20.abi.json
fi

if [ -f "SimpleERC20.bin" ]; then
    mv SimpleERC20.bin SimpleERC20.bytecode.txt
fi

if [ -f "SimpleERC721.abi" ]; then
    mv SimpleERC721.abi SimpleERC721.abi.json
fi

if [ -f "SimpleERC721.bin" ]; then
    mv SimpleERC721.bin SimpleERC721.bytecode.txt
fi

cd ..

echo ""
echo "✅ Compilation complete!"
echo ""
echo "📋 Required files:"
echo ""

# Check and display required files
if [ -f "build/SimpleERC20.abi.json" ]; then
    echo "  ✓ SimpleERC20.abi.json"
    ls -lh build/SimpleERC20.abi.json | awk '{print "    Size: " $5}'
else
    echo "  ✗ SimpleERC20.abi.json (MISSING)"
fi

if [ -f "build/SimpleERC20.bytecode.txt" ]; then
    echo "  ✓ SimpleERC20.bytecode.txt"
    ls -lh build/SimpleERC20.bytecode.txt | awk '{print "    Size: " $5}'
else
    echo "  ✗ SimpleERC20.bytecode.txt (MISSING)"
fi

if [ -f "build/SimpleERC721.abi.json" ]; then
    echo "  ✓ SimpleERC721.abi.json"
    ls -lh build/SimpleERC721.abi.json | awk '{print "    Size: " $5}'
else
    echo "  ✗ SimpleERC721.abi.json (MISSING)"
fi

if [ -f "build/SimpleERC721.bytecode.txt" ]; then
    echo "  ✓ SimpleERC721.bytecode.txt"
    ls -lh build/SimpleERC721.bytecode.txt | awk '{print "    Size: " $5}'
else
    echo "  ✗ SimpleERC721.bytecode.txt (MISSING)"
fi

echo ""
echo "🚀 Ready to deploy!"
echo "   Run: node loop.js"
