/**
 * GrantStack Server — API + Frontend for BuildHQ
 * Run: node server.js
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env"), override: true });
import express from "express";
import { google } from "googleapis";
import { readFileSync } from "fs";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Groq from "groq-sdk";
import cron from "node-cron";
import { runGrantStack } from "./grantstack.js";

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// ─────────────────────────────────────────────
// GOOGLE SHEETS AUTH
// Works locally (file path) and on cloud (JSON string in env var)
// ─────────────────────────────────────────────
function getGoogleCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  return JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "utf8"));
}

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getGoogleCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth;
}

async function getSheets() {
  const auth = getSheetsClient();
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function parseDeadlineDate(deadlineStr) {
  if (!deadlineStr) return null;
  const lower = deadlineStr.toLowerCase();
  if (lower.includes("rolling") || lower.includes("check") || lower.includes("annual") || lower.includes("tbd")) return null;
  const d = new Date(deadlineStr);
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = date - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────

// GET /api/grants — all grants from sheet
app.get("/api/grants", async (req, res) => {
  try {
    const sheets = await getSheets();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1:N",
    });

    const rows = result.data.values ?? [];
    if (rows.length < 2) return res.json([]);

    const headers = rows[0];
    const grants = rows.slice(1).map((row) => {
      const grant = {};
      headers.forEach((h, i) => { grant[h] = row[i] ?? ""; });
      const deadline = parseDeadlineDate(grant["Deadline"]);
      grant._deadlineDate = deadline ? deadline.toISOString() : null;
      grant._daysUntil = deadline ? daysUntil(deadline) : null;
      return grant;
    });

    res.json(grants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grants/closing-soon — grants with deadline within 60 days
app.get("/api/grants/closing-soon", async (req, res) => {
  try {
    const sheets = await getSheets();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1:N",
    });

    const rows = result.data.values ?? [];
    if (rows.length < 2) return res.json([]);

    const headers = rows[0];
    const grants = rows.slice(1)
      .map((row) => {
        const grant = {};
        headers.forEach((h, i) => { grant[h] = row[i] ?? ""; });
        const deadline = parseDeadlineDate(grant["Deadline"]);
        grant._deadlineDate = deadline ? deadline.toISOString() : null;
        grant._daysUntil = deadline ? daysUntil(deadline) : null;
        return grant;
      })
      .filter((g) => g._daysUntil !== null && g._daysUntil >= 0 && g._daysUntil <= 60)
      .sort((a, b) => a._daysUntil - b._daysUntil);

    res.json(grants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/submit-url — user submits a grant URL, AI extracts + adds to sheet
app.post("/api/submit-url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  // Social/auth-walled domains that block scraping
  const BLOCKED_DOMAINS = ["x.com", "twitter.com", "linkedin.com", "facebook.com", "instagram.com", "t.co"];
  const urlDomain = new URL(url).hostname.replace("www.", "");
  const isSocialMedia = BLOCKED_DOMAINS.some((d) => urlDomain.includes(d));

  try {
    // 1. Scrape the page (skip for social media, they block it)
    let pageText = "";
    let scrapedOk = false;
    if (!isSocialMedia) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          timeout: 12000,
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style, nav, footer, header, .cookie-banner, .popup").remove();
        // Pull meta description + og tags for extra context
        const metaDesc = $('meta[name="description"]').attr("content") || "";
        const ogTitle = $('meta[property="og:title"]').attr("content") || "";
        const ogDesc = $('meta[property="og:description"]').attr("content") || "";
        const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000);
        pageText = [ogTitle, metaDesc, ogDesc, bodyText].filter(Boolean).join("\n").slice(0, 6000);
        scrapedOk = pageText.length > 100;
      } catch {
        pageText = "";
      }
    }

    // 2. Build context hint from URL for AI knowledge fallback
    const urlHint = isSocialMedia
      ? `This is a social media post at ${url}. The post is from "${urlDomain}" and likely announces a grant or funding opportunity. Use your training knowledge about the organisation or handle mentioned in the URL to fill in all grant details.`
      : scrapedOk
      ? `Page content scraped successfully.`
      : `The page could not be scraped (blocked or JS-rendered). Use your training knowledge about this URL and organisation to fill in all grant details accurately.`;

    // 3. Ask Groq to extract grant details
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `You are GrantStack, a grant research assistant for BuildHQ — a Nigerian tech hub training people in tech skills and software development, hosting community events, 7,000 community members.

Your job: extract ALL grant details from the information below and return a complete JSON object. If page content is missing, use your training knowledge about the organisation, platform, or URL to fill in every field — do NOT leave fields empty.

GRANT URL: ${url}
CONTEXT: ${urlHint}
${pageText ? `\nPAGE CONTENT:\n${pageText}` : ""}

KNOWN CONTEXT ABOUT KEY PLATFORMS (use this if relevant):
- octant.app / octantapp: Octant is a public goods funding platform by the Golem Foundation. They stake 100,000 ETH and distribute staking rewards every 90 days (Epochs) to community-voted projects. Grants range from a few thousand to hundreds of thousands of USD in ETH. Apply at octant.app. Equity-free.
- esp.ethereum.foundation: Ethereum Foundation Ecosystem Support Program — non-dilutive grants for open-source, education, and community projects.
- gitcoin.co: Quadratic funding platform for public goods — community-matched grants.
- superteam.fun / superteamng: Solana Foundation grants for Nigerian/African developers.

Return ONLY a valid JSON object with these EXACT keys (all must be filled in — never empty string for name/organization):
{
  "name": "Full official grant or programme name",
  "organization": "Funding organisation name",
  "type": "Foundation | Government | Corporate / CSR | International Org | Accelerator | NGO / Non-profit | Challenge / Competition",
  "industry": "EdTech | Tech Hub / Innovation | Developer Community | Skills & Workforce | Events & Community | General Tech Startup | Social Impact",
  "equityFree": "Yes or No",
  "amountUSD": "Dollar amount string e.g. '$50,000' or 'Variable per epoch' or 'TBD'",
  "deadline": "Deadline string — if rolling write 'Rolling — check official site'",
  "applyLink": "Best application URL (not the social media post, the actual grant page)",
  "grantBrief": "2-3 sentence description of what the grant offers",
  "buildhqMatch": "2-3 sentences on why BuildHQ specifically qualifies for this grant",
  "status": "Not Started",
  "notes": "Any useful notes about this specific post or opportunity"
}

Return ONLY the JSON object. No markdown fences, no explanation.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You are a grant data extraction assistant. You always return complete, well-filled JSON objects. You never leave name or organization empty — use your training knowledge when page content is unavailable.",
        },
        { role: "user", content: prompt },
      ],
    });

    let text = completion.choices[0].message.content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const grant = JSON.parse(text);

    // 4. Validate — reject if AI couldn't identify the grant
    if (!grant.name || grant.name.trim() === "") {
      return res.status(422).json({
        error: "Could not identify the grant from this link. Try submitting the official grant page URL instead of a social media post.",
      });
    }

    // 5. Check for duplicate
    const sheets = await getSheets();
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A2:A",
    });
    const existingNames = new Set((existing.data.values ?? []).map((r) => r[0]));

    if (existingNames.has(grant.name)) {
      return res.json({ status: "duplicate", message: `"${grant.name}" is already in your sheet.`, grant });
    }

    // 6. Add to sheet
    const row = [
      grant.name, grant.organization, grant.type, grant.industry,
      grant.equityFree, grant.amountUSD, grant.deadline, grant.applyLink,
      grant.grantBrief, grant.buildhqMatch, grant.status ?? "Not Started",
      grant.notes ?? "",
      new Date().toISOString().split("T")[0], "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });

    res.json({ status: "added", message: `"${grant.name}" added to your sheet!`, grant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/refresh — manually trigger a full grant search
app.post("/api/refresh", async (req, res) => {
  res.json({ status: "started", message: "Grant refresh started — check your sheet in ~30 seconds." });
  try {
    await runGrantStack();
    console.log("Manual refresh complete.");
  } catch (err) {
    console.error("Refresh error:", err.message);
  }
});

// GET /api/stats
app.get("/api/stats", async (req, res) => {
  try {
    const sheets = await getSheets();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1:N",
    });
    const rows = (result.data.values ?? []).slice(1);
    const headers = result.data.values?.[0] ?? [];
    const statusIdx = headers.indexOf("Status");
    const deadlineIdx = headers.indexOf("Deadline");

    const total = rows.length;
    const applied = rows.filter((r) => ["Submitted", "Awaiting Response", "Awarded"].includes(r[statusIdx])).length;
    const awarded = rows.filter((r) => r[statusIdx] === "Awarded").length;
    const closingSoon = rows.filter((r) => {
      const d = parseDeadlineDate(r[deadlineIdx]);
      if (!d) return false;
      const days = daysUntil(d);
      return days >= 0 && days <= 60;
    }).length;

    res.json({ total, applied, awarded, closingSoon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// SCHEDULED AUTO-REFRESH — every Monday 9am
// ─────────────────────────────────────────────
cron.schedule("0 9 * * 1", async () => {
  console.log("[GrantStack] Running scheduled weekly refresh...");
  try {
    await runGrantStack();
    console.log("[GrantStack] Scheduled refresh complete.");
  } catch (err) {
    console.error("[GrantStack] Scheduled refresh error:", err.message);
  }
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3747;
app.listen(PORT, () => {
  console.log(`\n GrantStack running at http://localhost:${PORT}`);
  console.log(` Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}\n`);
});
