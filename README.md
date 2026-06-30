# AI Buyer

Find profitable **John Pye Auctions** lots to buy and resell on **eBay** — with max bid limits targeting **≥35% net profit** after all fees.

**Home:** DN22 0QG · **Collection sites:** Nottingham, Chesterfield, Birmingham, Staffordshire (Marchington)

## Quick start

```powershell
cd "C:\Users\user\Desktop\ai-buyer"
npm install   # installs Playwright Chromium via postinstall
copy .env.example .env
npm run dev
```

First live scrape can take ~30–90s (then cached 15 min). Tune with `JOHNPYE_MAX_EVENTS_PER_LOCATION` and `JOHNPYE_MAX_PAGES` in `.env`.

Open **http://localhost:3003**

## Phase 1 features

- Top **25 recommended lots** in a John Pye-style watch list table
- **Max bid** calculated for 35% net profit after:
  - John Pye buyer premium (hammer × 1.5)
  - Round-trip collection fuel (13p/mile from DN22 0QG)
  - eBay fees (13% of sale price)
  - Outbound shipping by weight (£4.99 / £13.61 / £49.99)
- **eBay projection** from sold comps (keyword table in Phase 1)
- **Sell-through score** from 90-day sold volume + estimated days to sell
- Direct **View lot** links to John Pye

## Phase 2 (in progress)

- **Live John Pye listings** via Playwright (Cloudflare-aware). Cached 15 min.
- Scans Nottingham, Chesterfield, Birmingham, Marchington events only.
- Set `JOHNPYE_LIVE=0` to fall back to sample data.
- Still TODO: real eBay sold API, watch list import, auto-resolve actual hammer

## Phase 2 planned (remaining)

- Live John Pye listings via account/browser integration
- Real eBay sold listings API
- Watch list sold-price feedback loop
- eBay seller account sales import

## Git workflow

```powershell
git add .
git commit -m "Describe your change"
git push
```
