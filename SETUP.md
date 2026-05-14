# GrantStack — Setup Guide for BuildHQ

## What This Does
GrantStack automatically:
1. Finds grants matching BuildHQ's profile (tech hub, EdTech, Nigeria, community)
2. Categorizes each grant by type, industry, and equity-free status
3. Writes a brief on each grant + explains why BuildHQ matches it
4. Pushes everything into a Google Sheet in your Drive
5. Lets you track your application status directly in the sheet

**Runtime: Node.js (already installed on your machine)**

---

## Step 1 — Google Service Account (one-time, ~5 minutes)

This gives GrantStack permission to create and write to your Google Sheet.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project — name it `GrantStack`
3. In the left menu go to **APIs & Services → Library**
4. Search and enable: **Google Sheets API** and **Google Drive API**
5. Go to **APIs & Services → Credentials → Create Credentials → Service Account**
6. Name it `grantstack-bot`, click **Create and Continue**, skip roles, click **Done**
7. Click the service account → **Keys → Add Key → Create new key → JSON**
8. Save the downloaded `.json` file (e.g. to `C:\Users\mmeri\Downloads\grantstack-key.json`)

---

## Step 2 — Create Your .env File

In the `grantstack` folder, copy the example:

```powershell
cd C:\BUILDWITHMC\BUILDS\LMS\grantstack
Copy-Item .env.example .env
```

Then open `.env` in any text editor and fill in:

```
GOOGLE_SERVICE_ACCOUNT_JSON=C:\Users\mmeri\Downloads\grantstack-key.json
GOOGLE_ACCOUNT_EMAIL=your-gmail@gmail.com
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> Get your Anthropic API key at [console.anthropic.com](https://console.anthropic.com/)

---

## Step 3 — Run GrantStack

```powershell
cd C:\BUILDWITHMC\BUILDS\LMS\grantstack
node grantstack.js
```

GrantStack will:
- Create a Google Sheet called **"GrantStack — BuildHQ"** in your Drive
- Share it with your Gmail automatically
- Add 13 pre-researched grants (categorized + matched to BuildHQ)
- Use AI to discover 5 more fresh grants
- Print the direct link to your sheet

---

## Your Google Sheet Columns

| Column | Description |
|--------|-------------|
| Grant Name | Full name of the grant |
| Organization | The funder/grantor |
| Grant Type | Government / Foundation / Corporate / etc. |
| Industry Category | EdTech / Tech Hub / Skills & Workforce / etc. |
| Equity-Free? | Yes / No |
| Est. Amount (USD) | Known or estimated grant value |
| Deadline | Application deadline |
| Apply Link | Direct link to the application page |
| Grant Brief | 2–3 sentence summary of the grant |
| BuildHQ Match | Why BuildHQ fits this grant's criteria |
| **Status** | **Update this as you apply** |
| Notes | Your personal notes |
| Date Added | Auto-filled by GrantStack |
| Date Applied | Fill in when you submit |

### Status Workflow
`Not Started` → `Researching` → `In Progress` → `Submitted` → `Awaiting Response` → `Awarded` / `Rejected`

---

## Run Again to Refresh (find new grants)

```powershell
node grantstack.js
```

Re-running is safe — it only adds NEW grants, never duplicates or overwrites your status/notes.

---

## Set Up Weekly Auto-Refresh (Windows Task Scheduler)

1. Open **Task Scheduler** (search it in Start Menu)
2. Click **Create Basic Task**
3. Name: `GrantStack Weekly`
4. Trigger: **Weekly** → pick Monday, 9:00 AM
5. Action: **Start a Program**
   - Program/script: `node`
   - Arguments: `C:\BUILDWITHMC\BUILDS\LMS\grantstack\grantstack.js`
6. Click **Finish**

GrantStack will now silently update your Google Sheet every Monday with newly discovered grants.

---

## Pre-Loaded Grants (13 total)

| Grant | Amount | Category |
|-------|--------|----------|
| Mastercard Foundation EdTech Fellowship 2026 | $60,000 | EdTech |
| African Union IEA 2026 | $50,000 | EdTech |
| AEDIB Joint Innovation Facility 2026 | €100–200K | International |
| Google for Startups Accelerator Africa | $350K cloud | Corporate |
| Google Black Founders Fund Africa | Share of $4M | Corporate |
| Startup Innovation Challenge 2026 | ₦100M + AWS | Competition |
| iDICE Startup Bridge Programme | ~$7,215 | Government |
| Tony Elumelu Foundation 2026 | $5,000 | Foundation |
| Bridge Seed Global Accelerator 2026 | £5,000 | Accelerator |
| Shell LiveWIRE Nigeria | ~$6,800 | Corporate |
| CcHUB Grant Programs | ~$6,800 | NGO |
| Builders of Africa's Future Accelerator | TBD | Accelerator |
| SARA by WEMA Grant | ~$1,600 | Corporate |
