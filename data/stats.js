// data/stats.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STATS_FILE)) fs.writeFileSync(STATS_FILE, JSON.stringify({}, null, 2));

function _read() {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE,'utf8') || '{}');
  } catch(e) {
    return {};
  }
}
function _write(obj) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
function _todayKey() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function ensureDate(dateKey) {
  const s = _read();
  if (!s[dateKey]) {
    s[dateKey] = { attempts:0, success:0, failed:0, faucet_claims:0, deploys:0 };
    _write(s);
  }
  return s;
}

function inc(stat, delta=1) {
  const s = _read();
  const key = _todayKey();
  if (!s[key]) s[key] = { attempts:0, success:0, failed:0, faucet_claims:0, deploys:0 };
  s[key][stat] = (s[key][stat] || 0) + delta;
  _write(s);
}
function get(dateKey) {
  const s = _read();
  return s[dateKey || _todayKey()] || { attempts:0, success:0, failed:0, faucet_claims:0, deploys:0 };
}
function getAll() { return _read(); }

module.exports = { inc, get, getAll, ensureDate };
