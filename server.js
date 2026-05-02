import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { totp } from "otplib";

const app    = express();
const PORT   = process.env.PORT || 3000;
const AO_URL = "https://apiconnect.angelone.in";

const API_KEY     = process.env.AO_API_KEY;
const CLIENT_ID   = process.env.AO_CLIENT_ID;
const MPIN        = process.env.AO_MPIN;
const TOTP_SECRET = process.env.AO_TOTP_SECRET;

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

let jwtToken  = null;
let tokenTime = null;
const TOKEN_TTL = 8 * 60 * 60 * 1000;

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
  "BAJAJFINSV":{ token: "16675",    exchange: "NSE" },
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

const AO_HEADERS = function(jwt) {
  return {
    "Content-Type":        "application/json",
    "Accept":              "application/json",
    "X-UserType":          "USER",
    "X-SourceID":          "WEB",
    "X-ClientLocalIP":     "192.168.1.1",
    "X-ClientPublicIP":    "106.193.147.98",
    "X-MACAddress":        "fe80::216e:6507:4b90:3719",
    "X-PrivateKey":        API_KEY,
    "Authorization":       jwt ? "Bearer " + jwt : "",
  };
};

async function login() {
  try {
    if (!API_KEY || !CLIENT_ID || !MPIN || !TOTP_SECRET) {
      console.error("Missing env vars!");
      return false;
    }
    // Try current TOTP
    var totpCode = totp.generate(TOTP_SECRET);
    console.log("TOTP generated:", totpCode, "| Secret length:", TOTP_SECRET.length);
    var body = JSON.stringify({ clientcode: CLIENT_ID, password: MPIN, totp: totpCode });
    var r = await fetch(AO_URL + "/rest/auth/angelbroking/user/v1/loginByPassword", {
      method: "POST",
      headers: {
        "Content-Type":     "application/json",
        "Accept":           "application/json",
        "X-UserType":       "USER",
        "X-SourceID":       "WEB",
        "X-ClientLocalIP":  "192.168.1.1",
        "X-ClientPublicIP": "106.193.147.98",
        "X-MACAddress":     "fe80::216e:6507:4b90:3719",
        "X-PrivateKey":     API_KEY,
      },
      body: body,
    });
    var d = await r.json();
    console.log("Login response:", JSON.stringify(d));
    if (d.status && d.data && d.data.jwtToken) {
      jwtToken  = d.data.jwtToken;
      tokenTime = Date.now();
      console.log("Login SUCCESS!");
      return true;
    }
    console.error("Login failed:", d.message, d.errorcode);
    return false;
  } catch(e) {
    console.error("Login error:", e.message);
    return false;
  }
}

// Debug endpoint - check what TOTP is being generated
app.get("/api/debug", function(req, res) {
  try {
    var code = totp.generate(TOTP_SECRET);
    var remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    res.json({
      totp_code:       code,
      totp_secret_len: TOTP_SECRET ? TOTP_SECRET.length : 0,
      client_id:       CLIENT_ID,
      api_key_set:     !!API_KEY,
      mpin_set:        !!MPIN,
      totp_secret_set: !!TOTP_SECRET,
      token_valid:     !!jwtToken,
      seconds_remaining: remaining,
    });
  } catch(e) {
    res.json({ error: e.message });
  }
});

async function ensureToken() {
  if (!jwtToken || !tokenTime || (Date.now() - tokenTime) > TOKEN_TTL) {
    return await login();
  }
  return true;
}

app.get("/", function(req, res) {
  res.json({
    status:    "NK Scanner Backend v3.0 - Angel One",
    loggedIn:  !!jwtToken,
    tokenAge:  tokenTime ? Math.round((Date.now()-tokenTime)/60000) + " mins" : "not logged in",
  });
});

app.get("/api/login", async function(req, res) {
  var ok = await login();
  res.json({ success: ok, loggedIn: !!jwtToken });
});

app.get("/api/quote", async function(req, res) {
  try {
    var sym  = (req.query.symbol || "").split(":")[0].toUpperCase().trim();
    if (!sym) return res.status(400).json({ error: "symbol required" });
    var info = SYMBOLS[sym];
    if (!info) return res.status(400).json({ error: "Symbol not supported: " + sym });
    var ok = await ensureToken();
    if (!ok) return res.status(401).json({ error: "Angel One login failed. Check Railway variables." });
    var r = await fetch(AO_URL + "/rest/secure/angelbroking/market/v1/quote/", {
      method: "POST",
      headers: AO_HEADERS(jwtToken),
      body: JSON.stringify({ mode: "FULL", exchangeTokens: { [info.exchange]: [info.token] } }),
    });
    var data = await r.json();
    if (!data.status) {
      if (data.errorcode === "AG8001" || data.errorcode === "AB1010") {
        jwtToken = null;
        await login();
        return res.redirect(req.originalUrl);
      }
      return res.status(400).json({ error: data.message || "Quote failed" });
    }
    var q = data.data && data.data.fetched && data.data.fetched[0];
    if (!q) return res.status(400).json({ error: "No data for " + sym });
    var price = parseFloat(q.ltp || q.close || 0);
    var prev  = parseFloat(q.close || price);
    res.json({
      symbol:          sym,
      name:            sym,
      exchange:        info.exchange,
      close:           price,
      previous_close:  prev,
      change:          parseFloat((price - prev).toFixed(2)),
      percent_change:  parseFloat(((price - prev) / prev * 100).toFixed(2)),
      high:            parseFloat(q.high  || price),
      low:             parseFloat(q.low   || price),
      open:            parseFloat(q.open  || price),
      volume:          parseInt(q.tradeVolume || q.volume || 0),
      fifty_two_week:  { high: parseFloat(q.weekHigh52 || price*1.3), low: parseFloat(q.weekLow52 || price*0.7) },
      datetime:        new Date().toLocaleDateString("en-IN"),
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/history", async function(req, res) {
  try {
    var sym  = (req.query.symbol || "").split(":")[0].toUpperCase().trim();
    if (!sym) return res.status(400).json({ error: "symbol required" });
    var info = SYMBOLS[sym];
    if (!info) return res.status(400).json({ error: "Symbol not supported: " + sym });
    var ok = await ensureToken();
    if (!ok) return res.status(401).json({ error: "Angel One login failed." });
    var toDate   = new Date();
    var fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 365);
    var fmt = function(d) {
      return d.getFullYear() + "-" +
        String(d.getMonth()+1).padStart(2,"0") + "-" +
        String(d.getDate()).padStart(2,"0") + " 09:15";
    };
    var r = await fetch(AO_URL + "/rest/secure/angelbroking/historical/v1/getCandleData", {
      method: "POST",
      headers: AO_HEADERS(jwtToken),
      body: JSON.stringify({
        exchange:    info.exchange,
        symboltoken: info.token,
        interval:    "ONE_DAY",
        fromdate:    fmt(fromDate),
        todate:      fmt(toDate),
      }),
    });
    var data = await r.json();
    if (!data.status) return res.status(400).json({ error: data.message || "History failed" });
    var values = (data.data || []).map(function(c) {
      return {
        datetime: c[0] ? new Date(c[0]).toISOString().split("T")[0] : "",
        open:     String(c[1] || 0),
        high:     String(c[2] || 0),
        low:      String(c[3] || 0),
        close:    String(c[4] || 0),
        volume:   String(c[5] || 0),
      };
    });
    res.json({ values: values });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Try login on startup but don't crash if it fails
login().then(function(ok) {
  if (!ok) console.log("Startup login failed — will retry on first request");
});
  console.log("NK Scanner Backend v3.0 Angel One — port " + PORT);
});
