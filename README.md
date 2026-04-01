# DeInfluencer — AI-Powered Truth Machine

> Scan YouTube Shorts in real-time, verify influencer trustworthiness,
> deconstruct product claims, and surface company reputation — all powered by Gemini AI.

---

## Architecture

```
┌─────────────────┐       HTTP/JSON       ┌───────────────────────┐
│   index.html    │ ◄───────────────────► │    app.py (Flask)     │
│   (HTML/CSS/JS) │                       │                       │
└─────────────────┘                       │  ┌─────────────────┐  │
                                          │  │  YouTube API v3 │  │
                                          │  └─────────────────┘  │
                                          │  ┌─────────────────┐  │
                                          │  │   Gemini 1.5    │  │
                                          │  │   Flash API     │  │
                                          │  └─────────────────┘  │
                                          └───────────────────────┘
```

---

## Setup

### 1 — Get API Keys

| API | Where to get it |
|-----|-----------------|
| **Gemini API** | https://aistudio.google.com/app/apikey |
| **YouTube Data API v3** | https://console.cloud.google.com → Enable "YouTube Data API v3" → Create credentials → API Key |

---

### 2 — Install dependencies

```bash
# Python 3.11+ recommended
pip install -r requirements.txt
```

---

### 3 — Set environment variables

#### Option A — .env file (recommended)
Create a `.env` file in this folder:
```
GEMINI_API_KEY=AIzaSy...your_gemini_key
YOUTUBE_API_KEY=AIzaSy...your_youtube_key
```
Then load it in the shell before running:
```bash
# Linux / macOS
export $(cat .env | xargs)

# Windows PowerShell
$env:GEMINI_API_KEY="AIzaSy..."
$env:YOUTUBE_API_KEY="AIzaSy..."
```

#### Option B — Export directly
```bash
export GEMINI_API_KEY="AIzaSy..."
export YOUTUBE_API_KEY="AIzaSy..."
```

#### Option C — In-browser (GUI)
Click **GRANT ACCESS** in the banner on the website and enter your keys there.
They are stored in `sessionStorage` only and never sent to a third party.

---

### 4 — Run the server

```bash
python app.py
```

Server starts at **http://localhost:5000**

---

### 5 — Open the website

Open `index.html` in your browser, **or** navigate to `http://localhost:5000`.

---

## Features

| Feature | Description |
|---------|-------------|
| **URL Analyze** | Paste any YouTube Shorts URL for a full deep-scan |
| **Topic Search** | Search by keyword — returns a grid of Shorts with quick trust scores |
| **Live Feed** | Auto-fetches trending product Shorts across popular niches |
| **Trust Score** | 0–100 AI-generated influencer trustworthiness rating |
| **Disclosure Detection** | Detects undisclosed sponsorships and paid promotions |
| **Product Analysis** | Verifies product specs, flags exaggerated claims, rates company reputation |
| **Manipulation Tactics** | Identifies FOMO, fake scarcity, pseudo-science, and 10+ other tactics |
| **Verify At** | Suggests credible sources for independent fact-checking |
| **Demo Mode** | Works without API keys with sample data |

---

## API Endpoints

### `POST /api/analyze`
Deep-analyze a single YouTube Short.
```json
// Request
{ "url": "https://youtube.com/shorts/VIDEO_ID" }

// Response
{
  "influencer": { "trust_score": 45, "trust_level": "SUSPICIOUS", ... },
  "products": [ { "name": "...", "recommendation": "AVOID", ... } ],
  "manipulation_tactics": [ { "tactic": "Fake Scarcity", "severity": "HIGH" } ],
  "verdict": { "trustworthy": false, "label": "DO NOT TRUST ✕", ... },
  "video_meta": { "title": "...", "views": 500000, ... }
}
```

### `POST /api/search`
Search for Shorts by topic with quick trust scoring.
```json
// Request
{ "query": "skincare routine" }
```

### `GET /api/live-feed`
Returns a curated live feed of suspicious / trending product Shorts.

### `GET /api/health`
Health check — returns `{"status": "ok"}`.

---

## Trust Score Legend

| Score | Level | Meaning |
|-------|-------|---------|
| 70–100 | ✅ TRUSTED | Content appears credible and transparent |
| 50–69  | ⚠ NEUTRAL | Mostly okay but verify key claims |
| 30–49  | 🚨 SUSPICIOUS | Red flags detected — proceed with caution |
| 0–29   | ❌ UNTRUSTWORTHY | High probability of misleading content |

---

## Notes

- YouTube Data API v3 has a **daily quota of 10,000 units** (free tier).
  Each search costs ~100 units; each video detail fetch costs ~1 unit.
- Gemini 1.5 Flash is used for its speed and cost-efficiency.
  Upgrade to `gemini-1.5-pro` for more nuanced analysis.
- Analysis is AI-generated and should not be the sole basis for purchase decisions.

---

## File Structure

```
deinfluencer/
├── app.py           ← Flask backend (Python)
├── index.html       ← Frontend (HTML + CSS + JS)
├── requirements.txt ← Python dependencies
└── README.md        ← This file
```
