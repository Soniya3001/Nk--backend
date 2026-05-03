import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app    = express();
const PORT   = process.env.PORT || 3000;
const AO_URL = "https://apiconnect.angelone.in";

const API_KEY   = process.env.AO_API_KEY;
const CLIENT_ID = process.env.AO_CLIENT_ID;
const MPIN      = process.env.AO_MPIN;

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

let jwtToken  = null;
let tokenTime = null;
const TOKEN_TTL = 7 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════
// STATIC NSE/BSE SYMBOLS (fixed tokens)
// ═══════════════════════════════════════════════
const SYMBOLS = {
  "RELIANCE":  { token: "2885",     exchange: "NSE" },
  "TCS":       { token: "11536",    exchange: "NSE" },
  "HDFCBANK":  { token: "1333",     exchange: "NSE" },
  "ICICIBANK": { token: "4963",     exchange: "NSE" },
  "INFY":      { token: "1594",     exchange: "NSE" },
  "SBIN":      { token: "3045",     exchange: "NSE" },
  "BAJFINANCE":{ token: "317",      exchange: "NSE" },
  "TATAMOTORS":{ token: "3432",     exchange: "NSE" },
  "AXISBANK":  { token: "5900",     exchange: "NSE" },
  "WIPRO":     { token: "3787",     exchange: "NSE" },
  "ITC":       { token: "1660",     exchange: "NSE" },
  "BHARTIARTL":{ token: "10604",    exchange: "NSE" },
  "HCLTECH":   { token: "7229",     exchange: "NSE" },
  "MARUTI":    { token: "10999",    exchange: "NSE" },
  "SUNPHARMA": { token: "3351",     exchange: "NSE" },
  "TITAN":     { token: "3506",     exchange: "NSE" },
  "KOTAKBANK": { token: "1922",     exchange: "NSE" },
  "HINDUNILVR":{ token: "1394",     exchange: "NSE" },
  "ADANIENT":  { token: "25",       exchange: "NSE" },
  "TATASTEEL": { token: "3499",     exchange: "NSE" },
  "DRREDDY":   { token: "881",      exchange: "NSE" },
  "CIPLA":     { token: "694",      exchange: "NSE" },
  "NTPC":      { token: "11630",    exchange: "NSE" },
  "ONGC":      { token: "2475",     exchange: "NSE" },
  "COALINDIA": { token: "20374",    exchange: "NSE" },
  "TECHM":     { token: "13538",    exchange: "NSE" },
  "ULTRACEMCO":{ token: "11532",    exchange: "NSE" },
  "INDUSINDBK":{ token: "5258",     exchange: "NSE" },
  "BAJAJ-AUTO":{ token: "16669",    exchange: "NSE" },
  "EICHERMOT": { token: "910",      exchange: "NSE" },
  "HEROMOTOCO":{ token: "1348",     exchange: "NSE" },
  "DIVISLAB":  { token: "10940",    exchange: "NSE" },
  "JSWSTEEL":  { token: "11723",    exchange: "NSE" },
  "HINDALCO":  { token: "1363",     exchange: "NSE" },
  "POWERGRID": { token: "14977",    exchange: "NSE" },
  "TATAPOWER": { token: "3426",     exchange: "NSE" },
  "ZOMATO":    { token: "5097",     exchange: "NSE" },
  "ADANIPORTS":{ token: "15083",    exchange: "NSE" },
  "GRASIM":    { token: "1232",     exchange: "NSE" },
  "ASIANPAINT":{ token: "236",      exchange: "NSE" },
  "NESTLEIND": { token: "17963",    exchange: "NSE" },
  "TATACONSUM":{ token: "3231",     exchange: "NSE" },
  "BRITANNIA": { token: "547",      exchange: "NSE" },
  "APOLLOHOSP":{ token: "157",      exchange: "NSE" },
  "BPCL":      { token: "526",      exchange: "NSE" },
  "IRCTC":     { token: "13611",    exchange: "NSE" },
  "DMART":     { token: "9848",     exchange: "NSE" },
  "NIFTY":     { token: "99926000", exchange: "NSE" },
  "NIFTY 50":  { token: "99926000", exchange: "NSE" },
  "BANKNIFTY": { token: "99926009", exchange: "NSE" },
  "SENSEX":    { token: "99919000", exchange: "BSE" },
};

// ═══════════════════════════════════════════════
// DYNAMIC MCX COMMODITIES (auto-loaded from Angel One)
// ═══════════════════════════════════════════════
// Maps user-friendly name → underlying commodity name in scrip master
const MCX_ALIASES = {
  "GOLD":       "GOLD",
  "GOLDM":      "GOLDM",
  "GOLDMINI":   "GOLDM",
  "GOLDPETAL":  "GOLDPETAL",
  "GOLDGUINEA": "GOLDGUINEA",
  "SILVER":     "SILVER",
  "SILVERM":    "SILVERM",
  "SILVERMIC":  "SILVERMIC",
  "SILVERMINI": "SILVERM",
  "CRUDEOIL":   "CRUDEOIL",
  "CRUDEOILM":  "CRUDEOILM",
  "CRUDE":      "CRUDEOIL",
  "NATURALGAS": "NATURALGAS",
  "NATGAS":     "NATURALGAS",
  "NATGASMINI": "NATGASMINI",
  "COPPER":     "COPPER",
  "COPPERMINI": "COPPERM",
  "ZINC":       "ZINC",
  "ZINCMINI":   "ZINCMINI",
  "ALUMINIUM":  "ALUMINIUM",
  "ALUMINIUMM": "ALUMINIUMM",
  "LEAD":       "LEAD",
  "LEADMINI":   "LEADMINI",
  "NICKEL":     "NICKEL",
  "MENTHAOIL":  "MENTHAOIL",
  "COTTON":     "COTTON",
  "CPO":        "CPO",
};

let MCX_TOKENS = {};       // { "GOLDM": { token: "...", exchange: "MCX", expiry: "..." } }
let scripMasterLoaded = false;
let lastScripFetch = null;
const SCRIP_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

async function loadScripMaster() {
  console.log("📥 Fetching Angel One scrip master...");
  try {
    const r = await fetch(SCRIP_URL);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const all = await r.json();
    console.log("✅ Scrip master loaded. Total instruments: " + all.length);

    // For each MCX alias, find the nearest-expiry FUT contract
    const newMap = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const userKey in MCX_ALIASES) {
      const name = MCX_ALIASES[userKey];
      // Find all FUT contracts for this commodity on MCX
      const candidates = all.filter(function(item) {
        return item.exch_seg === "MCX"
          && item.instrumenttype === "FUTCOM"
          && item.name === name
          && item.expiry;
      });

      if (candidates.length === 0) continue;

      // Pick the contract with nearest future expiry
      const future = candidates
        .map(function(c) {
          return Object.assign({}, c, { _expDate: parseExpiry(c.expiry) });
        })
        .filter(function(c) { return c._expDate && c._expDate >= today; })
        .sort(function(a, b) { return a._expDate - b._expDate; });

      if (future.length > 0) {
        const pick = future[0];
        newMap[userKey] = {
          token: String(pick.token),
          exchange: "MCX",
          symbol: pick.symbol,
          expiry: pick.expiry,
          lotsize: pick.lotsize,
        };
      }
    }

    MCX_TOKENS = newMap;
    scripMasterLoaded = true;
    lastScripFetch = new Date();
    console.log("✅ MCX tokens mapped: " + Object.keys(newMap).length);
    console.log("   Example: GOLDM →", newMap["GOLDM"] || "not found");
  } catch (e) {
    console.error("❌ Scrip master load failed:", e.message);
    // Don't crash - just log and continue with whatever we have
  }
}

// Angel One expiry format is "DDMMMYYYY" e.g. "05MAY2026"
function parseExpiry(s) {
  if (!s || typeof s !== "string") return null;
  const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
  const m = s.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
  if (!m) return null;
  return new Date(parseInt(m[3]), months[m[2]], parseInt(m[1]));
}

// Resolve a symbol (NSE/BSE/MCX). Returns { token, exchange } or null.
function resolveSymbol(sym) {
  const key = sym.toUpperCase().trim();
  if (SYMBOLS[key]) return SYMBOLS[key];
  if (MCX_TOKENS[key]) return MCX_TOKENS[key];
  return null;
}

// Load on startup, then refresh every 12 hours
loadScripMaster();
setInterval(loadScripMaster, 12 * 60 * 60 * 1000);

// ═══════════════════════════════════════════════
// HEADERS for Angel One API
// ═══════════════════════════════════════════════
function getHeaders(jwt) {
  return {
    "Content-Type":     "application/json",
    "Accept":           "application/json",
    "X-UserType":       "USER",
    "X-SourceID":       "WEB",
    "X-ClientLocalIP":  "192.168.1.1",
    "X-ClientPublicIP": "106.193.147.98",
    "X-MACAddress":     "fe80::216e:6507:4b90:3719",
    "X-PrivateKey":     API_KEY,
    "Authorization":    jwt ? "Bearer " + jwt : "",
  };
}

// ═══════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════
app.get("/", function(req, res) {
  res.json({
    status:   "NK Scanner Backend v5.0 - Auto MCX Lookup",
    loggedIn: !!jwtToken,
    tokenAge: tokenTime ? Math.round((Date.now()-tokenTime)/60000) + " mins" : "not logged in",
    scripMasterLoaded: scripMasterLoaded,
    lastScripFetch: lastScripFetch ? lastScripFetch.toISOString() : null,
    mcxSymbolsAvailable: Object.keys(MCX_TOKENS).length,
    nseSymbolsAvailable: Object.keys(SYMBOLS).length,
  });
});

// List all available symbols
app.get("/api/symbols", function(req, res) {
  const nse = Object.keys(SYMBOLS);
  const mcx = Object.keys(MCX_TOKENS).map(function(k) {
    return { name: k, expiry: MCX_TOKENS[k].expiry, contract: MCX_TOKENS[k].symbol };
  });
  res.json({ nse: nse, mcx: mcx });
});

// Force-refresh scrip master (for manual trigger)
app.get("/api/refresh-symbols", async function(req, res) {
  await loadScripMaster();
  res.json({
    success: true,
    mcxLoaded: Object.keys(MCX_TOKENS).length,
    lastScripFetch: lastScripFetch ? lastScripFetch.toISOString() : null,
  });
});

// Login with manual TOTP from user
app.get("/api/login", async function(req, res) {
  try {
    var totpCode = (req.query.totp || "").trim();
    if (!totpCode || totpCode.length !== 6) {
      return res.json({ success: false, error: "6 digit TOTP code daalo (Google Authenticator se)" });
    }
    console.log("Login with TOTP:", totpCode);
    var r = await fetch(AO_URL + "/rest/auth/angelbroking/user/v1/loginByPassword", {
      method: "POST",
      headers: getHeaders(null),
      body: JSON.stringify({ clientcode: CLIENT_ID, password: MPIN, totp: totpCode }),
    });
    var d = await r.json();
    console.log("Login response:", JSON.stringify(d));
    if (d.status && d.data && d.data.jwtToken) {
      jwtToken  = d.data.jwtToken;
      tokenTime = Date.now();
      return res.json({ success: true, loggedIn: true, message: "Login successful!" });
    }
    return res.json({ success: false, loggedIn: false, error: d.message || "Login failed", errorcode: d.errorcode });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// Check login status
app.get("/api/status", function(req, res) {
  var tokenAge = tokenTime ? Math.round((Date.now()-tokenTime)/60000) : null;
  var valid    = !!jwtToken && tokenTime && (Date.now()-tokenTime) < TOKEN_TTL;
  res.json({ loggedIn: valid, tokenAge: tokenAge ? tokenAge + " mins" : "N/A" });
});

// Get quote
app.get("/api/quote", async function(req, res) {
  try {
    var sym = (req.query.symbol || "").split(":")[0].toUpperCase().trim();
    if (!sym) return res.status(400).json({ error: "symbol required" });
    var info = resolveSymbol(sym);
    if (!info) return res.status(400).json({ error: "Symbol not supported: " + sym });
    if (!jwtToken || !tokenTime || (Date.now()-tokenTime) > TOKEN_TTL) {
      return res.status(401).json({ error: "LOGIN_REQUIRED" });
    }
    var r = await fetch(AO_URL + "/rest/secure/angelbroking/market/v1/quote/", {
      method: "POST",
      headers: getHeaders(jwtToken),
      body: JSON.stringify({ mode: "FULL", exchangeTokens: { [info.exchange]: [info.token] } }),
    });
    var data = await r.json();
    if (!data.status) {
      if (data.errorcode === "AG8001" || data.errorcode === "AB1010" || data.errorcode === "AB8050") {
        jwtToken = null;
        return res.status(401).json({ error: "LOGIN_REQUIRED" });
      }
      return res.status(400).json({ error: data.message || "Quote failed" });
    }
    var q = data.data && data.data.fetched && data.data.fetched[0];
    if (!q) return res.status(400).json({ error: "No data for " + sym });
    var price = parseFloat(q.ltp || q.close || 0);
    var prev  = parseFloat(q.close || price);
    res.json({
      symbol:         sym,
      name:           sym,
      exchange:       info.exchange,
      contract:       info.symbol || sym,
      expiry:         info.expiry || null,
      close:          price,
      previous_close: prev,
      change:         parseFloat((price-prev).toFixed(2)),
      percent_change: parseFloat(((price-prev)/prev*100).toFixed(2)),
      high:           parseFloat(q.high  || price),
      low:            parseFloat(q.low   || price),
      open:           parseFloat(q.open  || price),
      volume:         parseInt(q.tradeVolume || q.volume || 0),
      fifty_two_week: { high: parseFloat(q.weekHigh52||price*1.3), low: parseFloat(q.weekLow52||price*0.7) },
      datetime:       new Date().toLocaleDateString("en-IN"),
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get history
app.get("/api/history", async function(req, res) {
  try {
    var sym = (req.query.symbol || "").split(":")[0].toUpperCase().trim();
    if (!sym) return res.status(400).json({ error: "symbol required" });
    var info = resolveSymbol(sym);
    if (!info) return res.status(400).json({ error: "Symbol not supported: " + sym });
    if (!jwtToken || !tokenTime || (Date.now()-tokenTime) > TOKEN_TTL) {
      return res.status(401).json({ error: "LOGIN_REQUIRED" });
    }
    var toDate   = new Date();
    var fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 365);
    var fmt = function(d) {
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0") + " 09:15";
    };
    var r = await fetch(AO_URL + "/rest/secure/angelbroking/historical/v1/getCandleData", {
      method: "POST",
      headers: getHeaders(jwtToken),
      body: JSON.stringify({ exchange: info.exchange, symboltoken: info.token, interval: "ONE_DAY", fromdate: fmt(fromDate), todate: fmt(toDate) }),
    });
    var data = await r.json();
    if (!data.status) return res.status(400).json({ error: data.message || "History failed" });
    var values = (data.data || []).map(function(c) {
      return { datetime: c[0]?new Date(c[0]).toISOString().split("T")[0]:"", open:String(c[1]||0), high:String(c[2]||0), low:String(c[3]||0), close:String(c[4]||0), volume:String(c[5]||0) };
    });
    res.json({ values: values });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, function() {
  console.log("NK Scanner Backend v5.0 (Auto MCX Lookup) — port " + PORT);
});
