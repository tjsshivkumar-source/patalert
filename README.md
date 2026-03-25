# PatAlert

AI-powered design patent risk scanner. Upload a product image or describe your design, and PatAlert analyzes it against live USPTO design patent data to flag potential infringement risks before you ship.


### DEMO VIDEO: https://www.youtube.com/watch?v=xKIynnMVOB4


## What it does

1. **Claude Vision** extracts ornamental elements from your product image/description
2. **USPTO API** searches live design patent records for similar filings
3. **Claude Risk Assessment** evaluates infringement risk with element-by-element analysis, risk scoring, and actionable recommendations

Results are displayed in a chat interface with bookmarkable patent links and persistent scan history.

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Claude API** (Anthropic SDK) — vision analysis + risk assessment
- **USPTO Patent API** — live design patent search
- **localStorage** — chat history and saved patents
- **Chakra Petch** — typography

## Run Locally

```bash
npm install
```

Create `.env.local` in the project root:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
USPTO_API_KEY=your_uspto_api_key
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Built at

Anthropic x Imperial College London Hackathon, March 2026.
