import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app  = express();
const PORT = process.env.PORT || 3000;
const TD   = "https://api.twelvedata.com";

app.use(cors({
  origin: [
    "https://soniya3001.github.io",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  methods: ["GET"],
}));

app.use(express.json());

app.get("/", function(req, res) {
  res.json({ status: "NK Scanner Backend Running!", version: "1.0.0" });
});
app.get("/api/quote", async function(req, res) {
  try {
    var apiKey = process.env.TD_API_KEY;
    var symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ error: "symbol required" });
    var url = TD + "/quote?symbol=" + encodeURIComponent(symbol) + "&apikey=" + apiKey;
    var response = await fetch(url);
    var data     = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/history", async function(req, res) {
  try {
    var apiKey     = process.env.TD_API_KEY;
    var symbol     = req.query.symbol;
    var outputsize = req.query.outputsize || "220";
    if (!symbol) return res.status(400).json({ error: "symbol required" });
    var url = TD + "/time_series?symbol=" + encodeURIComponent(symbol) +
      "&interval=1day&outputsize=" + outputsize + "&order=ASC&apikey=" + apiKey;
    var response = await fetch(url);
    var data     = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, function() {
  console.log("NK Scanner Backend running on port " + PORT);
});
