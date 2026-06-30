const body = document.getElementById('watch-body');
const notice = document.getElementById('notice');
const summary = document.getElementById('summary');
const updated = document.getElementById('updated');
const homeBase = document.getElementById('home-base');
const assumptions = document.getElementById('assumptions');

function gbp(n) {
  return `£${Number(n).toFixed(2)}`;
}

function renderRow(item, rank) {
  const p = item.profitAtCurrentBid;
  const stPct = Math.round(item.sellThroughScore * 100);

  return `
    <tr>
      <td class="lot">#${item.lotNumber}</td>
      <td>
        <div class="title">${item.title}</div>
        <span class="sub">${item.weightKg}kg · ship ${item.shippingTier}</span>
      </td>
      <td>
        ${item.location}
        <span class="sub">${item.travelMilesOneWay} mi · fuel ${gbp(item.travelFuelRoundTrip)} RT</span>
      </td>
      <td class="money">${gbp(item.currentBid)}</td>
      <td class="money max-bid">${gbp(item.maxBid)}</td>
      <td>
        <span class="money">${gbp(item.projectedSalePrice)}</span>
        <span class="sub">${item.ebaySold90Days} sold / 90d</span>
      </td>
      <td>
        <span class="sub">JP invoice ×1.5 + fuel</span>
        <span class="money">${gbp(p.buy.total)}</span>
        <span class="sub">eBay 13% + ship ${gbp(item.outboundShipping)}</span>
      </td>
      <td>
        <span class="profit-good">${p.netProfitPct}%</span>
        <span class="sub">${gbp(p.netProfit)} @ current bid</span>
      </td>
      <td>
        ${stPct}%
        <div class="st-bar"><div class="st-fill" style="width:${stPct}%"></div></div>
        <span class="sub">~${item.avgDaysToSell}d to sell</span>
      </td>
      <td><a class="btn-link" href="${item.url}" target="_blank" rel="noopener">View lot</a></td>
    </tr>`;
}

async function load() {
  try {
    const res = await fetch('/api/recommendations');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load');

    homeBase.textContent = `Home: ${data.home.postcode}`;
    updated.textContent = `Updated ${new Date(data.generatedAt).toLocaleString('en-GB')}`;
    summary.textContent = `Showing ${data.recommendations.length} of ${data.qualifiedCount} qualifying lots (${data.totalCandidates} scanned)`;
    notice.innerHTML = `<strong>Phase 1 data:</strong> ${data.dataSource.johnPye} ${data.dataSource.ebay}`;

    assumptions.textContent =
      'Buy cost = hammer × 1.5 (25% + VAT buyer premium) + round-trip collection fuel @ 13p/mi. Sell revenue = eBay price − 13% fees − outbound shipping. Max bid targets ≥ 35% net profit.';

    if (data.recommendations.length === 0) {
      body.innerHTML = '<tr><td colspan="10" class="loading">No lots meet the 35% profit target right now.</td></tr>';
      return;
    }

    body.innerHTML = data.recommendations.map(renderRow).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="10" class="loading">${err.message}</td></tr>`;
  }
}

load();
