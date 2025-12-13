# Tempo-BOT — auto.tx by : didinska

Tempo-BOT adalah CLI berbasis Node.js (ESM) untuk jaringan **Tempo Testnet**.
Project ini dibuat untuk kebutuhan send token, deploy smart contract, dan claim faucet secara otomatis melalui RPC.

Repository:
https://github.com/didinska21/Tempo-BOT/

---

## Fitur Utama

### Send Token (ERC20)
- Kirim token per proyek
- Kirim semua token berurutan (token 1, 2, 3, 4)
- Tujuan: random address atau manual address
- Unlimited transaksi sampai balance habis
- Progress bar real-time
- Konfirmasi transaksi
- Link explorer otomatis

### Deploy Smart Contract

#### Deploy ERC20 Token
- Mode Manual
  - Input: name, symbol, supply
  - Decimals otomatis 18
  - Default supply: 1.000.000
- Mode Random
  - Name: TEMP0XXXX
  - Symbol: TMPXXXX
  - Batch deploy (1 sampai 100.000 kontrak)

#### Deploy ERC721 NFT
- Mode Manual dan Random
- Nama random: NFT TEMP0XXXX
- Symbol random: NFTTMPXXXX
- Supply default NFT: 100
- Setelah deploy:
  - Pilih mint sekarang atau kembali
  - Mint progress satu per satu (1/100, 2/100, dst)
  - Spinner aktif agar tidak terlihat stuck

### Claim Faucet (RPC)
- Claim faucet langsung via RPC tempo_fundAddress
- Tanpa browser dan captcha
- Input jumlah claim (1 sampai 100)
- Output hasil per token dan tx hash
- Jeda otomatis:
  - Countdown 15 detik antar claim
  - Countdown 30 detik sebelum kembali ke menu

---

## Struktur Project

```bash
Tempo-BOT/
├── build/
├── contracts/
├── scripts/
├── logs/
├── main.js
├── send.js
├── deploy.js
├── faucet.js
├── package.json
├── .env
└── README.md
```

---

## Requirement
- Node.js v18 atau lebih baru
- npm
- RPC Tempo Testnet

---

## Instalasi

```bash
git clone https://github.com/didinska21/Tempo-BOT.git
cd Tempo-BOT
npm install
```

---

## Konfigurasi Environment

Buat file `.env` di root project:

```env
RPC_URL=https://rpc.testnet.tempo.xyz
PRIVATE_KEY=0xPRIVATE_KEY_KAMU
EXPLORER_BASE=https://explore.tempo.xyz
TOKENS=PathUSD:0x...,ThetaUSD:0x...,BetaUSD:0x...,AlphaUSD:0x...
INTERVAL_MS=1500
```

---

## Compile Contract

```bash
node scripts/compile_all.js
```

---

## Menjalankan Bot

```bash
node main.js
```

---

## Author
didinska  
Telegram: https://t.me/didinska

---

## License
MIT License
