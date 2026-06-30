# AI Buyer — Project Context

Read this file at the start of every session.

## What this is

**AI Buyer** finds items on **John Pye Auctions** (4 collection sites only) that can be bought and resold on **eBay** for profit. It calculates max bids for **≥35% net profit** after all buy/sell costs.

**GitHub:** https://github.com/johnhall19871-svg/ai-buyer

**Local path:** `C:\Users\user\Desktop\ai-buyer`

### Auction window
Only recommend lots ending within **24 hours** (`AUCTION_ENDING_WITHIN_HOURS=24`).

### Projected final bid
- Surge model based on hours until close (most bidding in last 24h)
- **Calibration factor** learned from stored actual vs projected results (`data/bid-feedback.json`)
- Max bid / profit checks use **projected final bid**, not current bid

### Feedback loop
- Each recommendation run logs predictions to `data/bid-feedback.json`
- After auction: POST `/api/feedback/actual` with actual hammer from John Pye watch list
- Future projections adjust using median actual/projected ratio

---

## Current status

| Phase | Status | Scope |
|-------|--------|-------|
| **Phase 1** | ✅ Complete | Profit engine, 24h filter, proj. final bid, feedback store, watch-list UI |
| **Phase 2** | 🔲 Not started | Live John Pye + eBay sold data, auto-resolve from watch list |
| **Phase 3** | 🔲 Not started | Auto watch list, eBay listing monitor, sold-price feedback |

---

## User requirements

### Business model
Buy at John Pye → collect → sell on eBay. Prefer items that sell within **60 days** (sell-through rate matters).

### Collection sites ONLY
| Site | Postcode |
|------|----------|
| Nottingham | NG7 7EA |
| Chesterfield | S41 9BN |
| Birmingham | B64 5RE |
| Staffordshire (Marchington) | ST14 8LP |

**Home / collection start:** DN22 0QG

### Buy-side costs
- **Fuel:** 13p/mile, **round trip** home → site → home
- **John Pye buyer premium:** 25% + VAT on hammer = **invoice = hammer × 1.5** (e.g. £100 hammer → £150 invoice)

### Sell-side costs
- **eBay fees:** 13% of sale price (before shipping income)
- **Outbound shipping (seller pays):**
  - &lt;5kg → £4.99
  - 5–30kg → £13.61
  - ≥30kg → £49.99
- Weight estimated from item title (Phase 1 heuristic)

### Profit target
**Minimum 35% net profit** on total buy cost → drives **max bid** calculation.

### eBay research
- Sold items last **90 days** for market clearing price
- Sell-through / volume preference (fast movers)

### UI (Phase 1)
Web app, John Pye watch-list style table, **top 25** items with:
- Projected eBay sale price
- Collection + shipping costs
- Max bid
- Link to John Pye lot

### Future (Phase 2+)
- John Pye account → add to watch list
- eBay account → monitor sales, feed back into recommendations
- Track watch-list **sold for** prices after auctions end

---

## Tech stack

- Node.js 18+ / Express / vanilla HTML-CSS-JS
- Port **3003**
- `GET /api/recommendations` → top 25 scored lots

---

## Project layout

```
ai-buyer/
├── CLAUDE.md
├── data/sample-listings.json   ← Phase 1 demo lots (4 sites)
├── server/
│   ├── config.js               ← sites, fees, home
│   ├── geo.js
│   ├── weight.js               ← weight → shipping tier
│   ├── profit.js               ← max bid & net profit
│   ├── ebay.js                 ← sold comps (keyword table Phase 1)
│   ├── johnpye.js              ← listing fetch + scoring
│   └── routes/recommendations.js
└── public/                     ← watch list UI
```

---

## Max bid formula

```
netRevenue = salePrice × (1 - 0.13) - outboundShipping
buyCost = hammer × 1.5 + roundTripFuel
netProfit / buyCost >= 0.35
→ maxHammer = (netRevenue / 1.35 - roundTripFuel) / 1.5
```

---

## Phase 1 limitations (important)

1. **John Pye live scrape blocked** by Cloudflare — using `data/sample-listings.json`. Phase 2: browser extension, manual JSON export, or authenticated session.
2. **eBay sold data** uses keyword comp table — not live sold API. Phase 2: SoldComps / Apify / eBay partner API.
3. **Weight** is title-based estimate — verify before shipping quotes.
4. **John Pye / eBay account integration** not built yet.

---

## Development conventions

- Keep scope minimal; vanilla JS + Express
- Never commit `.env`
- Only commit when user asks
- Read this file first each session

---

## Git

```powershell
cd "C:\Users\user\Desktop\ai-buyer"
git add .
git commit -m "Describe your change"
git push
```

Remote: `https://github.com/johnhall19871-svg/ai-buyer.git` (master)

---

## Related projects

- Jarvis AI Job Finder: `website-builder` repo `jarvis-ai-job-finder`
- Company Metrics Compare: `claude code test` repo `company-metrics-compare`
