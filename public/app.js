const body = document.getElementById('watch-body');
const notice = document.getElementById('notice');
const summary = document.getElementById('summary');
const updated = document.getElementById('updated');
const homeBase = document.getElementById('home-base');
const assumptions = document.getElementById('assumptions');
const feedbackPanel = document.getElementById('feedback-panel');
const feedbackList = document.getElementById('feedback-list');
const calibrationSummary = document.getElementById('calibration-summary');

function gbp(n) {
  return `£${Number(n).toFixed(2)}`;
}

function fuelLabel(item) {
  if (item.fuelAllocation === 'additional') {
    return `£0 · same trip (${item.locationItemsInTrip} lots)`;
  }
  if (item.locationItemsInTrip > 1) {
    return `${gbp(item.travelFuelRoundTrip)} trip · ${gbp(item.tripFuelShare)}/lot (${item.locationItemsInTrip})`;
  }
  return `${gbp(item.travelFuelRoundTrip)} RT`;
}

function renderRow(item) {
  const p = item.profitAtProjectedFinalBid;
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
        <span class="sub">${item.travelMilesOneWay} mi · fuel ${fuelLabel(item)}</span>
      </td>
      <td>
        <span class="ends">${item.timeRemainingLabel}</span>
        <span class="sub">${new Date(item.endsAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
      </td>
      <td class="money">${gbp(item.currentBid)}</td>
      <td class="money proj-bid">${gbp(item.projectedFinalBid)}</td>
      <td class="money max-bid">${gbp(item.maxBid)}</td>
      <td>
        <span class="money">${gbp(item.projectedSalePrice)}</span>
        <span class="sub">${item.ebaySold90Days} sold / 90d</span>
      </td>
      <td>
        <span class="sub">${item.fuelAllocation === 'additional' ? 'JP ×1.5 · no extra fuel' : 'JP ×1.5 + fuel @ proj. bid'}</span>
        <span class="money">${gbp(p.buy.total)}</span>
        <span class="sub">eBay 13% + ship ${gbp(item.outboundShipping)}</span>
      </td>
      <td>
        <span class="profit-good">${p.netProfitPct}%</span>
        <span class="sub">${gbp(p.netProfit)} @ proj. final bid</span>
      </td>
      <td>
        ${stPct}%
        <div class="st-bar"><div class="st-fill" style="width:${stPct}%"></div></div>
        <span class="sub">~${item.avgDaysToSell}d to sell</span>
      </td>
      <td><a class="btn-link" href="${item.url}" target="_blank" rel="noopener">View lot</a></td>
    </tr>`;
}

async function submitActual(listingId, inputEl, msgEl) {
  const val = Number(inputEl.value);
  if (!val || val <= 0) {
    msgEl.textContent = 'Enter a valid hammer price';
    return;
  }

  const res = await fetch('/api/feedback/actual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, actualFinalBid: val }),
  });
  const data = await res.json();
  if (!res.ok) {
    msgEl.textContent = data.error || 'Failed to save';
    return;
  }

  msgEl.textContent = `Saved — error ${data.prediction.errorPct}% vs projection. Calibration updated.`;
  inputEl.disabled = true;
  await loadFeedback();
  await load();
}

function renderFeedbackItem(item) {
  const wrap = document.createElement('div');
  wrap.className = 'feedback-item';
  wrap.innerHTML = `
    <div>
      <strong>Lot #${item.lotNumber}</strong> — ${item.title}
      <span class="sub">Projected ${gbp(item.projectedFinalBid)} · ended ${new Date(item.endsAt).toLocaleString('en-GB')}</span>
    </div>
    <div class="feedback-actions">
      <input type="number" min="0" step="0.01" placeholder="Actual hammer £" aria-label="Actual final bid" />
      <button type="button" class="btn-save">Record actual</button>
      <span class="feedback-msg"></span>
    </div>`;

  const input = wrap.querySelector('input');
  const btn = wrap.querySelector('.btn-save');
  const msg = wrap.querySelector('.feedback-msg');
  btn.addEventListener('click', () => submitActual(item.listingId, input, msg));
  return wrap;
}

async function loadFeedback() {
  const res = await fetch('/api/feedback');
  const data = await res.json();
  if (!res.ok) return;

  const cal = data.calibration;
  calibrationSummary.textContent =
    cal.sampleCount > 0
      ? `Calibration from ${cal.sampleCount} resolved auction(s): avg error ${cal.meanAbsErrorPct}%, adjustment factor ×${cal.factor}`
      : 'No resolved auctions yet — record actual hammer prices below to train projections.';

  feedbackList.innerHTML = '';
  if (data.pendingResolution.length === 0 && data.recentResolved.length === 0) {
    feedbackPanel.classList.add('hidden');
    return;
  }

  feedbackPanel.classList.remove('hidden');

  if (data.pendingResolution.length) {
    const h = document.createElement('p');
    h.className = 'feedback-heading';
    h.textContent = 'Ended — enter actual hammer price from your John Pye watch list:';
    feedbackList.appendChild(h);
    data.pendingResolution.forEach((item) => feedbackList.appendChild(renderFeedbackItem(item)));
  }

  if (data.recentResolved.length) {
    const h = document.createElement('p');
    h.className = 'feedback-heading';
    h.textContent = 'Recently resolved:';
    feedbackList.appendChild(h);
    data.recentResolved.slice(0, 5).forEach((item) => {
      const el = document.createElement('div');
      el.className = 'feedback-resolved';
      el.textContent = `#${item.lotNumber} projected ${gbp(item.projectedFinalBid)} → actual ${gbp(item.actualFinalBid)} (${item.errorPct > 0 ? '+' : ''}${item.errorPct}%)`;
      feedbackList.appendChild(el);
    });
  }
}

async function load() {
  try {
    const res = await fetch('/api/recommendations');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load');

    homeBase.textContent = `Home: ${data.home.postcode}`;
    updated.textContent = `Updated ${new Date(data.generatedAt).toLocaleString('en-GB')}`;
    summary.textContent = `Showing ${data.recommendations.length} of ${data.qualifiedCount} qualifying lots (${data.endingWithin24h} ending within ${data.endingWithinHours}h · ${data.totalCandidates} total scanned)`;
    notice.innerHTML = `<strong>24h window:</strong> Only lots ending within ${data.endingWithinHours} hours are recommended. ${data.dataSource.johnPye} ${data.dataSource.bidProjection}`;

    assumptions.textContent =
      'One collection trip per site — only the first lot at each location includes fuel; add-ons at the same site add £0 fuel. Max bid = 35% net profit at projected hammer.';

    if (data.recommendations.length === 0) {
      body.innerHTML = `<tr><td colspan="12" class="loading">No lots ending within 24h meet the 35% profit target right now.</td></tr>`;
    } else {
      body.innerHTML = data.recommendations.map(renderRow).join('');
    }

    await loadFeedback();
  } catch (err) {
    body.innerHTML = `<tr><td colspan="12" class="loading">${err.message}</td></tr>`;
  }
}

load();
