/**
 * One-time script to push Web3 grants into the GrantStack sheet.
 * Run: node push-web3-grants.js
 */

import dotenv from "dotenv";
dotenv.config({ override: true });
import { google } from "googleapis";
import { readFileSync } from "fs";

const WEB3_GRANTS = [
  {
    name: "UNICEF Venture Fund 2026 — Blockchain Ventures",
    organization: "UNICEF Office of Innovation",
    type: "International Org",
    industry: "Tech Hub / Innovation",
    equityFree: "Yes",
    amountUSD: "Up to $100,000",
    deadline: "Rolling — check unicef.org/innovation",
    applyLink: "https://www.unicef.org/innovation/equity-free-funding-blockchain-solutions",
    grantBrief:
      "UNICEF Venture Fund provides up to $100,000 in equity-free funding to early-stage " +
      "startups from emerging markets building blockchain solutions for social good. " +
      "Funding is disbursed in cryptocurrency (ETH, BTC, or USDC) with full technical support.",
    buildhqMatch:
      "BuildHQ operates in Nigeria — an emerging market — and trains developers who build " +
      "real-world applications including Web3 tools. Our community-driven model and social " +
      "impact focus align directly with UNICEF's mandate for tech for good.",
    status: "Not Started",
    notes: "Nigeria is #6 globally in Solana developer share — strong signal for this grant.",
  },
  {
    name: "Ethereum Foundation ESP — Small Grants",
    organization: "Ethereum Foundation (ESP)",
    type: "Foundation",
    industry: "Developer Community",
    equityFree: "Yes",
    amountUSD: "Up to $30,000",
    deadline: "Rolling — esp.ethereum.foundation",
    applyLink: "https://esp.ethereum.foundation/applicants",
    grantBrief:
      "The Ethereum Foundation's Ecosystem Support Program (ESP) funds open-source public " +
      "goods strengthening Ethereum's technical and social foundations. Small Grants (under " +
      "$30K) support community education, developer onboarding, and events in underrepresented regions.",
    buildhqMatch:
      "BuildHQ runs developer training and community events in Nigeria — one of Africa's " +
      "fastest-growing Ethereum ecosystems. ESP explicitly prioritises community education " +
      "and events in Africa; the EF funded ETHiopia and Arabic bootcamps as comparable examples.",
    status: "Not Started",
    notes: "ESP also offers event sponsorships up to $20K — apply for BuildHQ community events.",
  },
  {
    name: "Ethereum Foundation ESP — Project Grants",
    organization: "Ethereum Foundation (ESP)",
    type: "Foundation",
    industry: "Developer Community",
    equityFree: "Yes",
    amountUSD: "$30,000+",
    deadline: "Rolling — esp.ethereum.foundation",
    applyLink: "https://esp.ethereum.foundation/applicants",
    grantBrief:
      "Larger grants (over $30K) from the Ethereum Foundation ESP for projects with " +
      "significant scope — developer tooling, infrastructure, education platforms, or " +
      "research that advances the Ethereum ecosystem globally.",
    buildhqMatch:
      "If BuildHQ builds an Ethereum developer curriculum or open-source training platform, " +
      "this is the right tier. Nigeria added 16,000+ developers to the Ethereum ecosystem " +
      "in 2025 — a platform serving that pipeline would qualify.",
    status: "Not Started",
    notes: "Larger scope needed. Consider applying after shipping a training platform MVP.",
  },
  {
    name: "Solana Foundation Nigeria Grants (SuperteamNG)",
    organization: "Solana Foundation / SuperteamNG",
    type: "Foundation",
    industry: "Developer Community",
    equityFree: "Yes",
    amountUSD: "Up to $10,000 USDC",
    deadline: "Rolling — earn.superteam.fun",
    applyLink: "https://earn.superteam.fun/grants/solana-foundation-nigeria-grants/",
    grantBrief:
      "SuperteamNG distributes Solana Foundation grants specifically for Nigerian developers " +
      "and communities. Grants up to $10K USDC fund developer education, community events, " +
      "and ecosystem projects. SuperteamNG injected over $162,000 into Nigeria's economy in Q1 2026.",
    buildhqMatch:
      "BuildHQ's developer training directly grows the Solana talent pipeline — Nigeria is " +
      "already #1 in Africa and #6 globally by Solana developer share. A BuildHQ cohort " +
      "focused on Solana/Rust development would be a perfect application.",
    status: "Not Started",
    notes: "Also look at Superteam Earn bounties — rolling payouts for BuildHQ community members.",
  },
  {
    name: "Polygon Community Grants Season 2",
    organization: "Polygon Foundation",
    type: "Foundation",
    industry: "Developer Community",
    equityFree: "Yes",
    amountUSD: "35M POL token pool",
    deadline: "Check polygon.technology/village/grants",
    applyLink: "https://polygon.technology/village/grants",
    grantBrief:
      "Polygon is distributing 35 million POL tokens through its Community Grants Season 2 " +
      "programme to developers and organisations building on the Polygon network. Covers " +
      "developer tooling, education, community growth, and DeFi/dApp projects.",
    buildhqMatch:
      "BuildHQ can apply to run Polygon developer workshops and train community members in " +
      "EVM/Polygon development. With 7,000 members, we're one of the largest developer " +
      "communities in Nigeria — exactly the audience Polygon wants to onboard.",
    status: "Not Started",
    notes: "Grants paid in POL tokens. Can be converted to USD or held.",
  },
  {
    name: "Polkadot Treasury Fast-Grants Programme",
    organization: "Polkadot / Web3 Foundation",
    type: "Foundation",
    industry: "Developer Community",
    equityFree: "Yes",
    amountUSD: "Share of $500,000 pool",
    deadline: "Check forum.polkadot.network",
    applyLink: "https://forum.polkadot.network/t/polkadot-fast-grants-programme-final-update-march-31-2026/17423",
    grantBrief:
      "Polkadot Treasury's Fast-Grants Programme launched with a $500K DOT allocation to " +
      "rapidly fund developers and communities building in the Polkadot/Substrate ecosystem. " +
      "Designed for fast approvals with low bureaucracy.",
    buildhqMatch:
      "BuildHQ could run Polkadot/Substrate training as part of its curriculum — Rust-based " +
      "development is in demand in Nigeria's booming Web3 scene. A community education " +
      "proposal would fit the fast-grants mandate well.",
    status: "Not Started",
    notes: "Grants paid in DOT. Fast approval process — lower barrier than standard W3F grants.",
  },
  {
    name: "Sui Foundation Community & Education Grants",
    organization: "Sui Foundation",
    type: "Foundation",
    industry: "Developer Community",
    equityFree: "Yes",
    amountUSD: "TBD (via RFP)",
    deadline: "Rolling RFPs — suifoundation.org",
    applyLink: "https://suifoundation.org/grants",
    grantBrief:
      "The Sui Foundation funds projects through open Requests for Proposals (RFPs) covering " +
      "developer education, community hubs, and ecosystem growth. The Sui Foundation already " +
      "launched SuiHub Lagos — its first African developer hub — signalling strong Africa focus.",
    buildhqMatch:
      "SuiHub Lagos proves the Sui Foundation will fund African developer hubs. BuildHQ's " +
      "model — training, events, community of 7,000 — is exactly what they're looking for " +
      "to expand beyond Lagos into more Nigerian cities.",
    status: "Not Started",
    notes: "SuiHub Lagos precedent is a strong signal. Lead with community size and event track record.",
  },
  {
    name: "Web3 Foundation Africa Community Grants",
    organization: "Web3 Foundation Africa",
    type: "NGO / Non-profit",
    industry: "Tech Hub / Innovation",
    equityFree: "Yes",
    amountUSD: "TBD",
    deadline: "Check web3foundation.africa",
    applyLink: "https://web3foundation.africa/",
    grantBrief:
      "Web3 Foundation Africa is dedicated to building Africa's decentralised future through " +
      "community grants, developer training, and ecosystem support. They have trained thousands " +
      "of developers and supported hundreds of startups across the continent since 2021.",
    buildhqMatch:
      "BuildHQ's mission — training Nigerians in tech, building applications, hosting events " +
      "— is directly aligned with Web3 Foundation Africa's mandate. As an established hub " +
      "with 7,000 members, we are a natural grant candidate and potential delivery partner.",
    status: "Not Started",
    notes: "Also explore becoming a delivery partner for their training programmes.",
  },
  {
    name: "Crypto for Good Fund — Africa Web3 Grants",
    organization: "Crypto for Good Fund",
    type: "Foundation",
    industry: "Social Impact",
    equityFree: "Yes",
    amountUSD: "Up to $100,000",
    deadline: "Check blockchaingrants.org",
    applyLink: "https://blockchaingrants.org/",
    grantBrief:
      "The Crypto for Good Fund provides equity-free grants up to $100,000 to startups and " +
      "organisations using blockchain for social good in Africa and other emerging markets. " +
      "Funds can be received in crypto or fiat.",
    buildhqMatch:
      "BuildHQ uses technology for social good — reducing Nigeria's tech skills gap, creating " +
      "economic opportunities, and building a 7,000-strong developer community. These outcomes " +
      "directly match the Crypto for Good mandate.",
    status: "Not Started",
    notes: "",
  },
];

const SHEET_HEADERS = [
  "Grant Name", "Organization", "Grant Type", "Industry Category",
  "Equity-Free?", "Est. Amount (USD)", "Deadline", "Apply Link",
  "Grant Brief", "BuildHQ Match", "Status", "Notes", "Date Added", "Date Applied",
];

async function run() {
  const creds = JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Get existing grant names to avoid duplicates
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A2:A",
  });
  const existingNames = new Set((existing.data.values ?? []).map((r) => r[0]));

  const newGrants = WEB3_GRANTS.filter((g) => !existingNames.has(g.name));

  if (newGrants.length === 0) {
    console.log("All Web3 grants already in sheet.");
    return;
  }

  const rows = newGrants.map((g) => [
    g.name, g.organization, g.type, g.industry, g.equityFree,
    g.amountUSD, g.deadline, g.applyLink, g.grantBrief,
    g.buildhqMatch, g.status, g.notes,
    new Date().toISOString().split("T")[0], "",
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  console.log(`Added ${newGrants.length} Web3 grants to your GrantStack sheet.`);
  console.log(`Open: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
