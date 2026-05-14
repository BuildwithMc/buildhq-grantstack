/**
 * GrantStack — Automated grant discovery & tracker for BuildHQ
 * Searches, categorizes, and syncs grants to a Google Sheet.
 *
 * Run: node grantstack.js
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
const __gsFilename = fileURLToPath(import.meta.url);
const __gsDir = dirname(__gsFilename);
dotenv.config({ path: join(__gsDir, ".env"), override: true });
import Groq from "groq-sdk";
import { google } from "googleapis";
import { readFileSync } from "fs";

// ─────────────────────────────────────────────
// BuildHQ PROFILE
// ─────────────────────────────────────────────
const BUILDHQ_PROFILE = {
  name: "BuildHQ",
  description:
    "BuildHQ is a startup tech hub based in Nigeria that trains people in tech " +
    "skills and software development, builds applications, and hosts community " +
    "events. We have a community of 7,000 members.",
  country: "Nigeria",
  focusAreas: [
    "tech skills training",
    "developer education",
    "community building",
    "software application development",
    "events hosting",
    "digital inclusion",
  ],
};

// ─────────────────────────────────────────────
// SEEDED GRANT DATABASE
// ─────────────────────────────────────────────
const SEED_GRANTS = [
  {
    name: "Mastercard Foundation EdTech Fellowship 2026",
    organization: "Mastercard Foundation / CcHUB",
    type: "Foundation",
    industry: "EdTech",
    equityFree: "Yes",
    amountUSD: "$60,000",
    deadline: "Check official site",
    applyLink: "https://futureoflearning.cchub.africa/",
    grantBrief:
      "An entrepreneurship acceleration program supporting African EdTech ventures. " +
      "Provides $60,000 equity-free funding, structured curriculum, and market access " +
      "opportunities. Operates in Nigeria, Kenya, Ghana and other African countries.",
    buildhqMatch:
      "BuildHQ's tech skills training and software development programs align directly " +
      "with EdTech and digital skills development — the fellowship's primary focus. " +
      "Our 7,000-member community demonstrates real market demand and social impact.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "African Union IEA 2026 — EdTech & Skills Development",
    organization: "African Union (DESTI)",
    type: "International Org",
    industry: "EdTech",
    equityFree: "Yes",
    amountUSD: "$50,000",
    deadline: "Check official site",
    applyLink:
      "https://opportunitiesforyouth.org/2026/04/02/apply-now-african-union-call-for-submissions-up-to-50000-grants-for-edtech-tvet-ai-and-skills-development/",
    grantBrief:
      "The African Union's Innovating Education in Africa (IEA) call invites innovators " +
      "proposing solutions to Africa's education and skills development challenges — up to " +
      "$50,000 per awardee. Focus on EdTech, TVET, AI, and skills.",
    buildhqMatch:
      "BuildHQ directly addresses Africa's tech skills gap by training community members " +
      "in software development and digital skills. Our TVET-adjacent model in Nigeria " +
      "is a strong fit for this AU mandate.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "iDICE Startup Bridge Programme",
    organization: "Federal Government of Nigeria",
    type: "Government",
    industry: "General Tech Startup",
    equityFree: "Yes",
    amountUSD: "~$7,215 (up to N10M)",
    deadline: "Check startup.gov.ng",
    applyLink: "https://startup.gov.ng/",
    grantBrief:
      "The Nigerian government's initiative supporting early-stage entrepreneurs across all " +
      "36 states. Idea-stage founders can access grants up to N10M (~$7,215). Startups with " +
      "working products may receive equity investment up to $100,000.",
    buildhqMatch:
      "BuildHQ is a Nigerian startup making real-world impact outside traditional Lagos hubs, " +
      "which is iDICE's stated priority. Our training and community work fits the government's " +
      "tech ecosystem development goals.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Tony Elumelu Foundation Entrepreneurship Programme 2026",
    organization: "Tony Elumelu Foundation",
    type: "Foundation",
    industry: "General Tech Startup",
    equityFree: "Yes",
    amountUSD: "$5,000",
    deadline: "Annually — check TEF portal",
    applyLink: "https://www.tonyelumelufoundation.org/",
    grantBrief:
      "$5,000 non-refundable seed capital plus business training and mentorship for African " +
      "entrepreneurs. TEF has invested over $100M across 20,000+ entrepreneurs in all 54 " +
      "African countries.",
    buildhqMatch:
      "BuildHQ is a Nigerian-based business with clear social impact, community reach (7,000 " +
      "members), and a scalable model. TEF backs entrepreneurs changing African communities " +
      "through innovation — that is BuildHQ's mission.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Google for Startups Accelerator Africa",
    organization: "Google",
    type: "Corporate / CSR",
    industry: "Tech Hub / Innovation",
    equityFree: "Yes",
    amountUSD: "Up to $350K (cloud credits)",
    deadline: "Annual — check Google for Startups",
    applyLink: "https://startup.google.com/programs/accelerator/africa/",
    grantBrief:
      "A 3-month hybrid accelerator for Seed to Series A African tech startups. Provides " +
      "equity-free support including up to $350K in Google Cloud credits, technical training, " +
      "and access to Google's global network.",
    buildhqMatch:
      "BuildHQ builds and deploys applications and trains developers — cloud infrastructure is " +
      "central to our operations. Google Cloud credits would directly fund our platform " +
      "development and reduce infrastructure costs.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Google Black Founders Fund — Africa",
    organization: "Google",
    type: "Corporate / CSR",
    industry: "Tech Hub / Innovation",
    equityFree: "Yes",
    amountUSD: "Share of $4M pool",
    deadline: "Annual — check Google for Startups",
    applyLink: "https://startup.google.com/programs/black-founders-fund/africa/",
    grantBrief:
      "Equity-free cash funding from a $4M pool alongside Google Cloud credits, product " +
      "mentorship, and global investor introductions. Specifically targets Black-founded " +
      "tech startups in Africa.",
    buildhqMatch:
      "As a Black-founded Nigerian tech hub, BuildHQ is the exact demographic this fund " +
      "targets. Our application development and skills training business model is tech-first.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Startup Innovation Challenge 2026",
    organization: "Startup Abuja / Transnet Cloud / AWS",
    type: "Challenge / Competition",
    industry: "General Tech Startup",
    equityFree: "Yes",
    amountUSD: "Share of ₦100M + AWS credits",
    deadline: "Check fundsforngos.org",
    applyLink:
      "https://www2.fundsforngos.org/innovation/submissions-open-for-startup-innovation-challenge-2026-nigeria/",
    grantBrief:
      "Nigerian startup competition offering over ₦100M in cash, AWS credits, and mentorship " +
      "for tech innovators. Open to startups, SMEs, and tech entrepreneurs across Nigeria.",
    buildhqMatch:
      "BuildHQ develops applications and runs a community of 7,000 tech learners — a proven " +
      "innovation model. AWS credits would accelerate our platform hosting and scale " +
      "our developer training tools.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Bridge Seed Global Accelerator 2026",
    organization: "Bridge Seed",
    type: "Accelerator",
    industry: "General Tech Startup",
    equityFree: "Yes",
    amountUSD: "£5,000 (~$6,300)",
    deadline: "Check official site",
    applyLink: "https://startupmapafrica.com/funding",
    grantBrief:
      "Offers early-stage African startups £5,000 (~$6,300) in equity-free funding alongside " +
      "structured accelerator support, mentorship, and international exposure.",
    buildhqMatch:
      "BuildHQ is early-stage with real community traction (7,000 members). This accelerator's " +
      "international network would help us attract partners for events and expand beyond Nigeria.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "AEDIB Joint Innovation Facility (JIF) 2026",
    organization: "AEDIB / EU-Funded",
    type: "International Org",
    industry: "Tech Hub / Innovation",
    equityFree: "Yes",
    amountUSD: "€100,000 – €200,000",
    deadline: "Check official site",
    applyLink: "https://federalgrantsinfo.com/african-grants-opportunities/",
    grantBrief:
      "Provides African-led consortia with non-dilutive funding of €100,000 or €200,000 " +
      "plus venture studio support. Focuses on innovation, digital economy, and tech " +
      "ecosystem building in Africa.",
    buildhqMatch:
      "BuildHQ as a tech hub could lead a consortium with partner organizations in Nigeria. " +
      "Our community platform, events, and training programs fit the digital economy mandate.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Shell LiveWIRE Nigeria",
    organization: "Shell Petroleum",
    type: "Corporate / CSR",
    industry: "Skills & Workforce",
    equityFree: "Yes",
    amountUSD: "Up to N10M (~$6,800)",
    deadline: "Annual — check Shell Nigeria",
    applyLink: "https://www.shell.com.ng/sustainability/livewire.html",
    grantBrief:
      "Empowers young Nigerians aged 18-35 with entrepreneurship training and startup " +
      "funding — up to N10M for businesses in technology sectors.",
    buildhqMatch:
      "BuildHQ trains young Nigerians in tech skills — directly aligned with LiveWIRE's " +
      "youth empowerment mandate. Our events and community serve the same audience Shell targets.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Co-creation Hub (CcHUB) Grant Programs",
    organization: "Co-creation Hub Nigeria",
    type: "NGO / Non-profit",
    industry: "Tech Hub / Innovation",
    equityFree: "Yes",
    amountUSD: "₦2M – ₦10M (~$1,300–$6,800)",
    deadline: "Rolling — check CcHUB",
    applyLink: "https://cchub.africa/",
    grantBrief:
      "CcHUB runs grant-heavy programs for civic tech, social impact, and digital inclusion " +
      "startups. Offers ₦2M–₦10M grants, mentorship, and connections to NGOs and " +
      "international donors.",
    buildhqMatch:
      "BuildHQ's community-first model, digital skills training, and events program " +
      "fit CcHUB's social impact mandate. As a fellow tech hub in Nigeria, this is " +
      "also a strong partnership candidate.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "SARA by WEMA Grant",
    organization: "Wema Bank Nigeria",
    type: "Corporate / CSR",
    industry: "General Tech Startup",
    equityFree: "Yes",
    amountUSD: "₦2.5M (~$1,600)",
    deadline: "Annual — check Wema Bank",
    applyLink: "https://wemabank.com/sara/",
    grantBrief:
      "Nigerian grant of up to ₦2.5M (~$1,600) for youth-led businesses. " +
      "Also provides business training and visibility support.",
    buildhqMatch:
      "BuildHQ is a youth-led Nigerian startup with a technology focus — meeting all SARA " +
      "criteria. While the grant is smaller, the Wema Bank relationship adds banking and " +
      "visibility value for our growth.",
    status: "Not Started",
    notes: "",
  },
  {
    name: "Builders of Africa's Future Accelerator 2026",
    organization: "Builders of Africa's Future",
    type: "Accelerator",
    industry: "EdTech",
    equityFree: "Yes",
    amountUSD: "TBD",
    deadline: "Check fundsforngos.org",
    applyLink:
      "https://www2.fundsforngos.org/education/apply-now-builders-of-africas-future-accelerator-program-2026/",
    grantBrief:
      "Accepts applications for EdTech, learning platforms, and community education " +
      "projects. Focused on building Africa's future through education and skills.",
    buildhqMatch:
      "BuildHQ's training programs and community learning events are core EdTech activity. " +
      "Our 7,000-member community of learners and developers demonstrates real scale.",
    status: "Not Started",
    notes: "",
  },
];

// ─────────────────────────────────────────────
// GOOGLE SHEETS HELPERS
// ─────────────────────────────────────────────
// WEB3 GRANT DATABASE
// ─────────────────────────────────────────────
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
    grantBrief: "UNICEF Venture Fund provides up to $100,000 in equity-free funding to early-stage startups from emerging markets building blockchain solutions for social good. Funding is disbursed in cryptocurrency (ETH, BTC, or USDC) with full technical support.",
    buildhqMatch: "BuildHQ operates in Nigeria — an emerging market — and trains developers who build real-world applications including Web3 tools. Our community-driven model and social impact focus align directly with UNICEF's mandate for tech for good.",
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
    grantBrief: "The Ethereum Foundation's Ecosystem Support Program (ESP) funds open-source public goods strengthening Ethereum's technical and social foundations. Small Grants (under $30K) support community education, developer onboarding, and events in underrepresented regions.",
    buildhqMatch: "BuildHQ runs developer training and community events in Nigeria — one of Africa's fastest-growing Ethereum ecosystems. ESP explicitly prioritises community education and events in Africa.",
    status: "Not Started",
    notes: "ESP also offers event sponsorships up to $20K — apply for BuildHQ community events.",
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
    grantBrief: "SuperteamNG distributes Solana Foundation grants specifically for Nigerian developers and communities. Grants up to $10K USDC fund developer education, community events, and ecosystem projects. SuperteamNG injected over $162,000 into Nigeria's economy in Q1 2026.",
    buildhqMatch: "BuildHQ's developer training directly grows the Solana talent pipeline — Nigeria is already #1 in Africa and #6 globally by Solana developer share. A BuildHQ cohort focused on Solana/Rust development would be a perfect application.",
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
    grantBrief: "Polygon is distributing 35 million POL tokens through its Community Grants Season 2 programme to developers and organisations building on the Polygon network. Covers developer tooling, education, community growth, and DApp projects.",
    buildhqMatch: "BuildHQ can apply to run Polygon developer workshops and train community members in EVM/Polygon development. With 7,000 members, we are one of the largest developer communities in Nigeria — exactly the audience Polygon wants to onboard.",
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
    grantBrief: "Polkadot Treasury's Fast-Grants Programme launched with a $500K DOT allocation to rapidly fund developers and communities building in the Polkadot/Substrate ecosystem. Designed for fast approvals with low bureaucracy.",
    buildhqMatch: "BuildHQ could run Polkadot/Substrate training as part of its curriculum — Rust-based development is in demand in Nigeria's booming Web3 scene. A community education proposal fits the fast-grants mandate.",
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
    grantBrief: "The Sui Foundation funds projects through open Requests for Proposals (RFPs) covering developer education, community hubs, and ecosystem growth. The Sui Foundation already launched SuiHub Lagos — its first African developer hub — signalling strong Africa focus.",
    buildhqMatch: "SuiHub Lagos proves the Sui Foundation will fund African developer hubs. BuildHQ's model — training, events, community of 7,000 — is exactly what they're looking for to expand beyond Lagos into more Nigerian cities.",
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
    grantBrief: "Web3 Foundation Africa is dedicated to building Africa's decentralised future through community grants, developer training, and ecosystem support. They have trained thousands of developers and supported hundreds of startups across the continent since 2021.",
    buildhqMatch: "BuildHQ's mission — training Nigerians in tech, building applications, hosting events — is directly aligned with Web3 Foundation Africa's mandate. As an established hub with 7,000 members, we are a natural grant candidate and potential delivery partner.",
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
    grantBrief: "The Crypto for Good Fund provides equity-free grants up to $100,000 to startups and organisations using blockchain for social good in Africa and other emerging markets. Funds can be received in crypto or fiat.",
    buildhqMatch: "BuildHQ uses technology for social good — reducing Nigeria's tech skills gap, creating economic opportunities, and building a 7,000-strong developer community. These outcomes directly match the Crypto for Good mandate.",
    status: "Not Started",
    notes: "",
  },
];

// ─────────────────────────────────────────────
const SHEET_HEADERS = [
  "Grant Name",
  "Organization",
  "Grant Type",
  "Industry Category",
  "Equity-Free?",
  "Est. Amount (USD)",
  "Deadline",
  "Apply Link",
  "Grant Brief",
  "BuildHQ Match",
  "Status",
  "Notes",
  "Date Added",
  "Date Applied",
];

function getGoogleCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  return JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "utf8"));
}

function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: getGoogleCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    console.error(`
┌─────────────────────────────────────────────────────┐
│  SETUP NEEDED — Create your GrantStack Google Sheet  │
├─────────────────────────────────────────────────────┤
│  1. Go to sheets.google.com and create a blank sheet │
│  2. Name it: GrantStack — BuildHQ                    │
│  3. Click Share → add this email as Editor:          │
│     grantstack@grantstack-496320.iam.gserviceaccount.com
│  4. Copy the Sheet ID from the URL:                  │
│     docs.google.com/spreadsheets/d/SHEET_ID/edit     │
│  5. Add to your .env file:                           │
│     GOOGLE_SHEET_ID=paste-your-sheet-id-here         │
│  6. Run: node grantstack.js                          │
└─────────────────────────────────────────────────────┘
`);
    process.exit(1);
  }
  return id;
}

async function setupHeaders(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A1:N1",
  });

  const existing = res.data.values?.[0] ?? [];
  if (JSON.stringify(existing) === JSON.stringify(SHEET_HEADERS)) return;

  // Write headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: { values: [SHEET_HEADERS] },
  });

  // Bold + colour header row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  console.log("Headers set up.");
}

async function getExistingGrantNames(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A2:A",
  });
  return new Set((res.data.values ?? []).map((r) => r[0]));
}

function grantToRow(grant) {
  return [
    grant.name,
    grant.organization,
    grant.type,
    grant.industry,
    grant.equityFree,
    grant.amountUSD,
    grant.deadline,
    grant.applyLink,
    grant.grantBrief,
    grant.buildhqMatch,
    grant.status ?? "Not Started",
    grant.notes ?? "",
    new Date().toISOString().split("T")[0],
    "", // Date Applied — filled manually
  ];
}

async function pushGrantsToSheet(grants, sheets, spreadsheetId) {
  const existing = await getExistingGrantNames(sheets, spreadsheetId);
  const newGrants = grants.filter((g) => !existing.has(g.name));

  if (newGrants.length === 0) {
    console.log("No new grants to add — sheet is up to date.");
    return 0;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: { values: newGrants.map(grantToRow) },
  });

  console.log(`Added ${newGrants.length} new grants.`);
  return newGrants.length;
}

// ─────────────────────────────────────────────
// AI-POWERED GRANT SEARCH (Groq — free tier)
// ─────────────────────────────────────────────
async function searchNewGrantsWithAI() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const year = new Date().getFullYear();
  const existingNames = SEED_GRANTS.map((g) => g.name).join(", ");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "You are GrantStack, a grant research assistant for BuildHQ — a Nigerian tech startup hub that trains people in tech skills, builds software applications, and hosts community events with 7,000 community members. You only respond with valid JSON arrays, no other text.",
      },
      {
        role: "user",
        content: `Find 5 real grant opportunities available in ${year} for BuildHQ that are NOT in this list: ${existingNames}.

Focus on: EdTech grants Africa, tech hub grants Nigeria, developer community grants, digital skills workforce development, government or foundation programs Nigeria or Africa.

Return ONLY a valid JSON array. Each object must have exactly these keys:
name, organization, type, industry, equityFree, amountUSD, deadline, applyLink, grantBrief, buildhqMatch, status, notes.

type must be one of: Government, Corporate / CSR, Foundation, International Org, Accelerator, NGO / Non-profit, Challenge / Competition
industry must be one of: EdTech, Tech Hub / Innovation, Developer Community, Skills & Workforce, Events & Community, General Tech Startup, Social Impact
equityFree: "Yes" or "No"
status: "Not Started"
notes: ""

Return ONLY the JSON array. No markdown fences, no explanation.`,
      },
    ],
  });

  try {
    let text = completion.choices[0].message.content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    const match = text.match(/\[[\s\S]*\]/);
    if (match) text = match[0];
    return JSON.parse(text);
  } catch (err) {
    console.error("Could not parse AI grant results:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export async function runGrantStack() {
  const setupOnly = process.argv.includes("--setup-only");

  console.log("\n=== GrantStack — BuildHQ Grant Tracker ===");
  console.log(`Run date: ${new Date().toDateString()}\n`);

  // 1. Auth
  console.log("[1/4] Connecting to Google Sheets...");
  const spreadsheetId = getSpreadsheetId();
  const auth = getAuthClient();
  const authClient = await auth.getClient();
  const sheetsApi = google.sheets({ version: "v4", auth: authClient });

  await setupHeaders(sheetsApi, spreadsheetId);

  // 2. Push seeded grants (normal + web3 combined)
  console.log("\n[2/4] Syncing seeded grant database...");
  await pushGrantsToSheet([...SEED_GRANTS, ...WEB3_GRANTS], sheetsApi, spreadsheetId);

  // 3. AI search for more grants
  if (!setupOnly) {
    console.log("\n[3/4] Searching for additional grants via AI...");
    const aiGrants = await searchNewGrantsWithAI();
    if (aiGrants.length > 0) {
      await pushGrantsToSheet(aiGrants, sheetsApi, spreadsheetId);
    } else {
      console.log("No additional grants found.");
    }
  } else {
    console.log("\n[3/4] Skipped AI search (--setup-only mode).");
  }

  // 4. Done
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  console.log(`\n[4/4] Done! Open your GrantStack tracker:`);
  console.log(`      ${url}\n`);
  return url;
}

// Run directly if called as main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGrantStack().catch((err) => {
    console.error("GrantStack error:", err.message);
    process.exit(1);
  });
}
