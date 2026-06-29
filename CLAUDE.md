# AI Buyer — Project Context

Read this file at the start of every session. It describes what this project is, what's built, and what's planned.

## What this is

**AI Buyer** — a new project for AI-assisted buying. Full requirements are not yet defined.

**GitHub:** https://github.com/johnhall19871-svg/ai-buyer

**Local path:** `C:\Users\user\Desktop\ai-buyer`

---

## Current status

| Phase | Status | Scope |
|-------|--------|-------|
| **Phase 0** | ✅ Complete | Repo, GitHub, CLAUDE.md, basic scaffold |
| **Phase 1** | 🔲 Not started | Define requirements and build first version |

---

## Requirements (to be defined)

Capture and update this section when the user describes their vision:

- What is being bought (products, services, stocks, etc.)
- How AI assists (price comparison, deal alerts, recommendations, negotiation, etc.)
- Data sources (retail APIs, scrapers, user input)
- Target users and workflow
- Tech stack preferences

---

## Tech stack

**TBD** — not chosen yet. Match whatever stack the user picks; don't introduce frameworks unless asked.

---

## Project layout

```
ai-buyer/
├── CLAUDE.md       ← this file (persistent AI context)
├── README.md       ← user-facing docs
├── .gitignore
└── package.json    ← placeholder until stack is chosen
```

Layout will grow as features are added.

---

## Development conventions

- **Keep scope minimal** — match existing patterns; don't over-engineer early.
- **Never commit `.env`** or secrets — use `.env.example` when config is needed.
- **Only commit when the user asks** — they use GitHub for snapshots and revert.
- **Read this file first** each session so the user doesn't re-explain the project.

---

## Git workflow

```powershell
cd "C:\Users\user\Desktop\ai-buyer"
git add .
git commit -m "Describe your change"
git push
```

Remote: `origin` → `https://github.com/johnhall19871-svg/ai-buyer.git` (branch: `master`).

---

## Related projects

| Project | Path | Repo |
|---------|------|------|
| Jarvis AI Job Finder | `C:\Users\user\Desktop\website-builder` | `jarvis-ai-job-finder` |
| Company Metrics Compare | `C:\Users\user\Desktop\claude code test` | `company-metrics-compare` |

Do not mix code or config between projects unless explicitly asked.
