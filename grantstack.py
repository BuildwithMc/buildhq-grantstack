"""
GrantStack — Automated grant discovery & tracker for BuildHQ
Searches, categorizes, and syncs grants to a Google Sheet.
"""

import os
import json
import datetime
import gspread
from google.oauth2.service_account import Credentials
from anthropic import Anthropic

# ─────────────────────────────────────────────
# BuildHQ PROFILE (edit to reflect your startup)
# ─────────────────────────────────────────────
BUILDHQ_PROFILE = {
    "name": "BuildHQ",
    "description": (
        "BuildHQ is a startup tech hub based in Nigeria that trains people in tech "
        "skills and software development, builds applications, and hosts community "
        "events. We have a community of 7,000 members."
    ),
    "country": "Nigeria",
    "industry_tags": [
        "EdTech", "Tech Hub", "Developer Community", "Skills Training",
        "Software Development", "Community Events", "Social Impact"
    ],
    "stage": "Early-stage startup",
    "team_size": "Small team",
    "community_size": 7000,
    "founded": "Nigeria",
    "focus_areas": [
        "tech skills training",
        "developer education",
        "community building",
        "software application development",
        "events hosting",
        "digital inclusion",
    ],
}

# ─────────────────────────────────────────────
# GRANT CATEGORIES
# ─────────────────────────────────────────────
GRANT_TYPES = [
    "Government", "Corporate / CSR", "Foundation", "International Org",
    "Accelerator", "NGO / Non-profit", "Challenge / Competition"
]

INDUSTRY_CATEGORIES = [
    "EdTech", "Tech Hub / Innovation", "Developer Community",
    "Skills & Workforce", "Events & Community", "General Tech Startup",
    "Social Impact", "Fintech", "Energy & Environment"
]

# ─────────────────────────────────────────────
# SEEDED GRANT DATABASE (from current research)
# ─────────────────────────────────────────────
SEED_GRANTS = [
    {
        "name": "Mastercard Foundation EdTech Fellowship 2026",
        "organization": "Mastercard Foundation / CcHUB",
        "type": "Foundation",
        "industry": "EdTech",
        "equity_free": True,
        "amount_usd": 60000,
        "deadline": "Check official site",
        "apply_link": "https://futureoflearning.cchub.africa/",
        "grant_brief": (
            "An entrepreneurship acceleration program supporting African EdTech ventures. "
            "Provides $60,000 equity-free funding, structured curriculum, and market access "
            "opportunities. Operates in Nigeria, Kenya, Ghana and other African countries."
        ),
        "buildhq_match": (
            "BuildHQ's tech skills training and software development programs align directly "
            "with EdTech and digital skills development — the fellowship's primary focus. "
            "Our 7,000-member community demonstrates real market demand and social impact."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "African Union IEA 2026 — EdTech & Skills Development",
        "organization": "African Union (DESTI)",
        "type": "International Org",
        "industry": "EdTech",
        "equity_free": True,
        "amount_usd": 50000,
        "deadline": "Check official site",
        "apply_link": "https://opportunitiesforyouth.org/2026/04/02/apply-now-african-union-call-for-submissions-up-to-50000-grants-for-edtech-tvet-ai-and-skills-development/",
        "grant_brief": (
            "The African Union's Innovating Education in Africa (IEA) call for submissions "
            "invites innovators proposing solutions to Africa's education and skills development "
            "challenges — up to $50,000 per awardee. Focus on EdTech, TVET, AI, and skills."
        ),
        "buildhq_match": (
            "BuildHQ directly addresses Africa's tech skills gap by training community members "
            "in software development and digital skills. Our TVET-adjacent model in Nigeria "
            "is a strong fit for this AU mandate."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "iDICE Startup Bridge Programme",
        "organization": "Federal Government of Nigeria",
        "type": "Government",
        "industry": "General Tech Startup",
        "equity_free": True,
        "amount_usd": 7215,
        "deadline": "Check startup.gov.ng",
        "apply_link": "https://startup.gov.ng/",
        "grant_brief": (
            "The Nigerian government's initiative supporting early-stage entrepreneurs across "
            "all 36 states. Idea-stage founders can access grants of up to N10M (~$7,215). "
            "Startups with working products may receive equity investment up to $100,000."
        ),
        "buildhq_match": (
            "BuildHQ is a Nigerian startup making real-world impact outside traditional Lagos hubs, "
            "which is the iDICE programme's stated priority. Our training and community work fits "
            "the government's tech ecosystem development goals."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Tony Elumelu Foundation Entrepreneurship Programme 2026",
        "organization": "Tony Elumelu Foundation",
        "type": "Foundation",
        "industry": "General Tech Startup",
        "equity_free": True,
        "amount_usd": 5000,
        "deadline": "Annually — check TEF portal",
        "apply_link": "https://www.tonyelumelufoundation.org/",
        "grant_brief": (
            "$5,000 non-refundable seed capital plus business training and mentorship for African "
            "entrepreneurs. TEF has invested over $100M across 20,000+ entrepreneurs in all 54 "
            "African countries."
        ),
        "buildhq_match": (
            "BuildHQ is a Nigerian-based business with clear social impact, community reach (7,000 "
            "members), and a scalable model. TEF backs entrepreneurs changing African communities "
            "through innovation — that is BuildHQ's mission."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Google for Startups Accelerator Africa",
        "organization": "Google",
        "type": "Corporate / CSR",
        "industry": "Tech Hub / Innovation",
        "equity_free": True,
        "amount_usd": 350000,
        "deadline": "Annual — check Google for Startups",
        "apply_link": "https://startup.google.com/programs/accelerator/africa/",
        "grant_brief": (
            "A 3-month hybrid accelerator for Seed to Series A African tech startups. Provides "
            "equity-free support including up to $350K in Google Cloud credits, technical training, "
            "and access to Google's global network."
        ),
        "buildhq_match": (
            "BuildHQ builds and deploys applications and trains developers — cloud infrastructure is "
            "central to our operations. Google Cloud credits would directly fund our platform "
            "development and reduce infrastructure costs."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Google Black Founders Fund — Africa",
        "organization": "Google",
        "type": "Corporate / CSR",
        "industry": "Tech Hub / Innovation",
        "equity_free": True,
        "amount_usd": 0,
        "deadline": "Annual — check Google for Startups",
        "apply_link": "https://startup.google.com/programs/black-founders-fund/africa/",
        "grant_brief": (
            "Equity-free cash funding from a $4M pool alongside Google Cloud credits, product "
            "mentorship, and global investor introductions. Specifically targets Black-founded "
            "tech startups in Africa."
        ),
        "buildhq_match": (
            "As a Black-founded Nigerian tech hub, BuildHQ is the exact demographic this fund "
            "targets. Our application development and skills training business model is tech-first."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Startup Innovation Challenge 2026",
        "organization": "Startup Abuja / Transnet Cloud / AWS",
        "type": "Challenge / Competition",
        "industry": "General Tech Startup",
        "equity_free": True,
        "amount_usd": 65000,
        "deadline": "Check fundsforngos.org",
        "apply_link": "https://www2.fundsforngos.org/innovation/submissions-open-for-startup-innovation-challenge-2026-nigeria/",
        "grant_brief": (
            "Nigerian startup competition offering over ₦100M in cash, AWS credits, and mentorship "
            "for tech innovators. Open to startups, SMEs, and tech entrepreneurs across Nigeria."
        ),
        "buildhq_match": (
            "BuildHQ develops applications and runs a community of 7,000 tech learners — a proven "
            "innovation model. AWS credits would accelerate our platform hosting and scale "
            "our developer training tools."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Bridge Seed Global Accelerator 2026",
        "organization": "Bridge Seed",
        "type": "Accelerator",
        "industry": "General Tech Startup",
        "equity_free": True,
        "amount_usd": 6300,
        "deadline": "Check official site",
        "apply_link": "https://startupmapafrica.com/funding",
        "grant_brief": (
            "Offers early-stage African startups £5,000 (~$6,300) in equity-free funding alongside "
            "structured accelerator support, mentorship, and international exposure."
        ),
        "buildhq_match": (
            "BuildHQ is early-stage with real community traction (7,000 members). This accelerator's "
            "international network would help us attract partners for our events and expand "
            "beyond Nigeria."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "AEDIB Joint Innovation Facility (JIF) 2026",
        "organization": "AEDIB / EU-Funded",
        "type": "International Org",
        "industry": "Tech Hub / Innovation",
        "equity_free": True,
        "amount_usd": 110000,
        "deadline": "Check official site",
        "apply_link": "https://federalgrantsinfo.com/african-grants-opportunities/",
        "grant_brief": (
            "Provides African-led consortia with non-dilutive funding of €100,000 or €200,000 "
            "plus venture studio support. Focuses on innovation, digital economy, and tech "
            "ecosystem building in Africa."
        ),
        "buildhq_match": (
            "BuildHQ as a tech hub could lead a consortium with partner organizations in Nigeria. "
            "Our community platform, events, and training programs fit the digital economy mandate."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Shell LiveWIRE Nigeria",
        "organization": "Shell Petroleum",
        "type": "Corporate / CSR",
        "industry": "Skills & Workforce",
        "equity_free": True,
        "amount_usd": 6800,
        "deadline": "Annual — check Shell Nigeria",
        "apply_link": "https://www.shell.com.ng/sustainability/livewire.html",
        "grant_brief": (
            "Empowers young Nigerians aged 18-35 with entrepreneurship training and startup "
            "funding — up to N10M for businesses in technology sectors."
        ),
        "buildhq_match": (
            "BuildHQ trains young Nigerians in tech skills — directly aligned with LiveWIRE's "
            "youth empowerment mandate. Our application development work and community events "
            "serve the same audience Shell targets."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Co-creation Hub (CcHUB) Grant Programs",
        "organization": "Co-creation Hub Nigeria",
        "type": "NGO / Non-profit",
        "industry": "Tech Hub / Innovation",
        "equity_free": True,
        "amount_usd": 6800,
        "deadline": "Rolling — check CcHUB",
        "apply_link": "https://cchub.africa/",
        "grant_brief": (
            "CcHUB runs grant-heavy programs (₦2M–₦10M) for civic tech, social impact, and "
            "digital inclusion startups. Also offers mentorship and connections to NGOs and "
            "international donors."
        ),
        "buildhq_match": (
            "BuildHQ's community-first model, digital skills training, and events program "
            "fit CcHUB's social impact mandate. As a fellow tech hub in Nigeria, this is "
            "also a strong partnership candidate."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "SARA by WEMA Grant",
        "organization": "Wema Bank Nigeria",
        "type": "Corporate / CSR",
        "industry": "General Tech Startup",
        "equity_free": True,
        "amount_usd": 1600,
        "deadline": "Annual — check Wema Bank",
        "apply_link": "https://wemabank.com/sara/",
        "grant_brief": (
            "Nigerian grant of up to ₦2.5M (~$1,600) for youth-led businesses. "
            "Also provides business training and visibility support."
        ),
        "buildhq_match": (
            "BuildHQ is a youth-led Nigerian startup with a technology focus — meeting all SARA "
            "criteria. While the grant is smaller, the business visibility and Wema Bank "
            "relationship are valuable for our growth."
        ),
        "status": "Not Started",
        "notes": "",
    },
    {
        "name": "Builders of Africa's Future Accelerator 2026",
        "organization": "Builders of Africa's Future",
        "type": "Accelerator",
        "industry": "EdTech",
        "equity_free": True,
        "amount_usd": 0,
        "deadline": "Check fundsforngos.org",
        "apply_link": "https://www2.fundsforngos.org/education/apply-now-builders-of-africas-future-accelerator-program-2026/",
        "grant_brief": (
            "Accepts applications for EdTech, learning platforms, and community education "
            "projects. Focused on building Africa's future through education and skills."
        ),
        "buildhq_match": (
            "BuildHQ's training programs and community learning events are core EdTech activity. "
            "Our 7,000-member community of learners and developers demonstrates scale."
        ),
        "status": "Not Started",
        "notes": "",
    },
]

# ─────────────────────────────────────────────
# GOOGLE SHEETS SETUP
# ─────────────────────────────────────────────
SCOPES = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]

SHEET_HEADERS = [
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
]

STATUS_OPTIONS = [
    "Not Started", "Researching", "In Progress", "Submitted",
    "Awaiting Response", "Awarded", "Rejected", "Not Applicable"
]


def get_sheets_client():
    creds = Credentials.from_service_account_file(
        os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"], scopes=SCOPES
    )
    return gspread.authorize(creds)


def get_or_create_spreadsheet(client, name="GrantStack — BuildHQ"):
    try:
        return client.open(name)
    except gspread.SpreadsheetNotFound:
        sh = client.create(name)
        # Share with your personal Google account so you can open it
        sh.share(os.environ["GOOGLE_ACCOUNT_EMAIL"], perm_type="user", role="writer")
        print(f"Created new spreadsheet: {sh.url}")
        return sh


def setup_sheet_headers(worksheet):
    existing = worksheet.row_values(1)
    if existing != SHEET_HEADERS:
        worksheet.clear()
        worksheet.append_row(SHEET_HEADERS)
        # Bold + freeze header row
        worksheet.format("A1:N1", {
            "textFormat": {"bold": True},
            "backgroundColor": {"red": 0.12, "green": 0.12, "blue": 0.12},
            "textFormat": {"foregroundColor": {"red": 1, "green": 1, "blue": 1}, "bold": True},
        })
        worksheet.freeze(rows=1)
    print("Sheet headers ready.")


def get_existing_grant_names(worksheet):
    col_values = worksheet.col_values(1)
    return set(col_values[1:])  # skip header


def grant_to_row(grant):
    return [
        grant["name"],
        grant["organization"],
        grant["type"],
        grant["industry"],
        "Yes" if grant["equity_free"] else "No",
        f"${grant['amount_usd']:,}" if grant["amount_usd"] > 0 else "Non-monetary / TBD",
        grant["deadline"],
        grant["apply_link"],
        grant["grant_brief"],
        grant["buildhq_match"],
        grant.get("status", "Not Started"),
        grant.get("notes", ""),
        datetime.date.today().isoformat(),
        "",  # Date Applied — filled manually
    ]


def push_grants_to_sheet(grants, worksheet):
    existing = get_existing_grant_names(worksheet)
    new_grants = [g for g in grants if g["name"] not in existing]

    if not new_grants:
        print("No new grants to add — sheet is up to date.")
        return 0

    rows = [grant_to_row(g) for g in new_grants]
    worksheet.append_rows(rows)
    print(f"Added {len(new_grants)} new grants to the sheet.")
    return len(new_grants)


# ─────────────────────────────────────────────
# AI-POWERED GRANT SEARCH (uses Claude API)
# ─────────────────────────────────────────────
def search_new_grants_with_ai():
    """Ask Claude to search for fresh grants and return structured JSON."""
    client = Anthropic()

    system = """You are GrantStack, a grant research assistant for BuildHQ — a Nigerian tech
startup hub that trains people in tech skills, builds software applications, and hosts
community events. Community size: 7,000 members.

When asked to find grants, return ONLY a valid JSON array of grant objects. Each object must have:
name, organization, type, industry, equity_free (boolean), amount_usd (integer, 0 if unknown),
deadline, apply_link, grant_brief (2-3 sentences), buildhq_match (2-3 sentences explaining fit),
status (always "Not Started"), notes (always "").

Grant types: Government, Corporate / CSR, Foundation, International Org, Accelerator, NGO / Non-profit, Challenge / Competition
Industry categories: EdTech, Tech Hub / Innovation, Developer Community, Skills & Workforce, Events & Community, General Tech Startup, Social Impact"""

    prompt = f"""Search for 5 additional grant opportunities in {datetime.date.today().year}
that BuildHQ has NOT already found. Focus on:
- International tech hub grants
- Developer community grants
- Digital skills / workforce development grants
- Any new government or foundation programs in Nigeria or Africa

Return ONLY a JSON array, no other text."""

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except (json.JSONDecodeError, IndexError) as e:
        print(f"Could not parse AI grant results: {e}")
        return []


# ─────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────
def run_grantstack(include_ai_search=True):
    print("\n=== GrantStack — BuildHQ Grant Tracker ===")
    print(f"Run date: {datetime.date.today()}")

    # 1. Connect to Google Sheets
    print("\n[1/4] Connecting to Google Sheets...")
    gc = get_sheets_client()
    sh = get_or_create_spreadsheet(gc)

    ws = sh.sheet1
    ws.update_title("Grants")
    setup_sheet_headers(ws)

    # 2. Push seeded grants
    print("\n[2/4] Syncing seeded grant database...")
    added = push_grants_to_sheet(SEED_GRANTS, ws)

    # 3. Search for new grants via AI
    if include_ai_search:
        print("\n[3/4] Searching for additional grants via AI...")
        ai_grants = search_new_grants_with_ai()
        if ai_grants:
            ai_added = push_grants_to_sheet(ai_grants, ws)
            print(f"AI search added {ai_added} new grants.")
        else:
            print("No additional grants found by AI search.")
    else:
        print("\n[3/4] Skipping AI search (include_ai_search=False).")

    # 4. Summary
    all_grants = ws.get_all_records()
    print(f"\n[4/4] Done. Sheet now has {len(all_grants)} total grants.")
    print(f"Open your sheet: {sh.url}\n")

    return sh.url


if __name__ == "__main__":
    sheet_url = run_grantstack(include_ai_search=True)
    print(f"GrantStack complete. Your tracker: {sheet_url}")
