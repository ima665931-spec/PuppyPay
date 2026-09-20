/* PuppyPay — Dashboard, Orders, Referrals, History, Card, Withdraw */

async function loadDashboard() {
  if (!localStorage.getItem('puppypay_token')) return;
  try {
    const { ok, data } = await walletApiCall('/dashboard', 'GET');
    if (!ok || !data?.success) return;

    window.__dashboard = data;
    const u = data.user || {};

    try {
      const cached = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      cached.balance = u.balance;
      cached.name = (u.name && u.name !== 'PuppyPay User') ? u.name : cached.name;
      cached.appId = u.appId || cached.appId;
      cached.referralCode = u.referralCode || cached.referralCode;
      localStorage.setItem('puppypay_user', JSON.stringify(cached));
    } catch (_) {}

    populateUserUI();

    const bal = document.getElementById('balanceAmount');
    if (bal && !balanceHidden) bal.textContent = formatINR(u.balance);
    else if (bal && balanceHidden) bal.dataset.real = formatINR(u.balance);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('completeOrders', data.stats?.completeOrders ?? 0);
    set('todayBuying', formatINR(data.stats?.todayBuying ?? 0));
    set('todaySold', formatINR(data.stats?.todaySold ?? 0));
    set('todayCompleted', data.stats?.todayCompleted ?? 0);
    set('totalDeposit', formatINR(data.stats?.totalDeposit ?? 0));
    set('totalWithdraw', formatINR(data.stats?.totalWithdraw ?? 0));
    set('totalReferral', formatINR(data.stats?.totalReferral ?? 0));
  } catch (e) {
    console.warn('Dashboard load failed', e);
  }
}

async function loadReferrals() {
  try {
    const { ok, data } = await walletApiCall('/referrals', 'GET');
    if (!ok || !data?.success) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('refCount', data.totalReferrals ?? 0);
    set('refEarnings', formatINR(data.totalEarnings ?? 0));
    if (data.referralCode) {
      const el = document.getElementById('myReferralCode');
      if (el) el.textContent = data.referralCode;
    }
  } catch (e) {}
}

/* ========== ORDERS ========== */
let ordersRefreshTimer = null;
let ordersLoading = false;
let buyingOrderId = null;
let allOrdersCache = [];
let orderFilterMin = '';
let orderFilterMax = '';
let paySheetTimer = null;

function startOrdersAutoRefresh() {
  stopOrdersAutoRefresh();
  loadOrders(false);
  ordersRefreshTimer = setInterval(() => {
    const view = document.getElementById('ordersView');
    if (view && view.classList.contains('active')) loadOrders(true);
    else stopOrdersAutoRefresh();
  }, 2000);
}

function stopOrdersAutoRefresh() {
  if (ordersRefreshTimer) {
    clearInterval(ordersRefreshTimer);
    ordersRefreshTimer = null;
  }
}

function shortOrderId(oid) {
  const s = String(oid || '');
  if (s.length <= 10) return s;
  return s.slice(0, 3) + '…' + s.slice(-4);
}

function renderOrderCard(o, opts) {
  const oid = o.orderId || o.id || '';
  const rate = o.profitRate != null ? (o.profitRate * 100).toFixed(1) : '4.9';
  const reward = o.reward != null ? o.reward : Math.round((Number(o.amount) || 0) * 0.049 * 100) / 100;
  const topClass = opts && opts.isTop ? ' order-card-top' : '';
  return `
    <div class="order-card${topClass}" data-order-id="${oid}">
      <div class="order-card-left">
        <div class="order-amount">${formatINR(o.amount)}</div>
        <div class="order-id-row">ID ${shortOrderId(oid)}</div>
        <div class="order-profit-row">
          <span class="order-profit">+${formatINR(reward)}</span>
          <span class="order-rate">${rate}%</span>
        </div>
      </div>
      <button class="btn btn-primary btn-buy" data-buy="${oid}" ${buyingOrderId === oid ? 'disabled' : ''}>
        ${buyingOrderId === oid ? '...' : 'Buy'}
      </button>
    </div>
  `;
}

function applyOrderFilter(orders) {
  let list = orders.slice();
  const min = Number(orderFilterMin);
  const max = Number(orderFilterMax);
  if (Number.isFinite(min) && min > 0) list = list.filter(o => Number(o.amount) >= min);
  if (Number.isFinite(max) && max > 0) list = list.filter(o => Number(o.amount) <= max);
  list.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
  return list;
}

function paintOrders(orders) {
  const list = document.getElementById('ordersList');
  if (!list) return;

  const filtered = applyOrderFilter(orders);
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state"><p>No orders in this range</p></div>';
    return;
  }

  list.innerHTML = filtered.map((o, i) =>
    renderOrderCard(o, { isTop: i === 0 })
  ).join('');
}

async function loadOrders(silent) {
  if (ordersLoading) return;
  ordersLoading = true;
  const list = document.getElementById('ordersList');
  if (!silent && list && !list.querySelector('.order-card')) {
    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><p>Loading orders...</p></div>';
  }
  try {
    const q = ['renew=1'];
    if (orderFilterMin) q.push('min=' + encodeURIComponent(orderFilterMin));
    if (orderFilterMax) q.push('max=' + encodeURIComponent(orderFilterMax));
    const path = '/orders?' + q.join('&');

    const { ok, data } = await walletApiCall(path, 'GET');
    if (!ok || !data?.success || !data.orders?.length) {
      allOrdersCache = [];
      if (!silent && list) list.innerHTML = '<div class="empty-state"><p>No orders available right now</p></div>';
      return;
    }
    allOrdersCache = data.orders;
    paintOrders(allOrdersCache);
  } catch (e) {
    if (!silent && list) list.innerHTML = '<div class="empty-state"><p>Could not load orders</p></div>';
  } finally {
    ordersLoading = false;
  }
}

function bindOrderFilter() {
  const minIn = document.getElementById('orderFilterMin');
  const maxIn = document.getElementById('orderFilterMax');
  if (!minIn) return;
  const apply = () => {
    orderFilterMin = minIn.value.trim();
    orderFilterMax = (maxIn && maxIn.value.trim()) || '';
    if (allOrdersCache.length) paintOrders(allOrdersCache);
    else loadOrders(false);
  };
  document.getElementById('orderFilterApply')?.addEventListener('click', apply);
  document.getElementById('orderFilterClear')?.addEventListener('click', () => {
    minIn.value = '';
    if (maxIn) maxIn.value = '';
    orderFilterMin = '';
    orderFilterMax = '';
    loadOrders(false);
  });
  [minIn, maxIn].forEach(el => el?.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); }));
}
setTimeout(bindOrderFilter, 0);

function closePaySheet() {
  if (paySheetTimer) { clearInterval(paySheetTimer); paySheetTimer = null; }
  document.getElementById('paySheetOverlay')?.remove();
}

function showPaymentSheet(payment) {
  closePaySheet();
  const amount = payment.amount;
  const upiId = payment.upiId || '';
  const orderId = payment.orderId || '';
  const qrUrl = payment.qrImageUrl ||
    ('https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' +
      encodeURIComponent(payment.paymentUri || ''));
  const expiresAt = payment.expiresAt ? new Date(payment.expiresAt).getTime() : Date.now() + 600000;

  const overlay = document.createElement('div');
  overlay.className = 'pay-sheet-overlay';
  overlay.id = 'paySheetOverlay';
  overlay.innerHTML = `
    <div class="pay-sheet">
      <h3>Pay exact amount</h3>
      <div class="pay-sub">Order ${shortOrderId(orderId)} · valid 10 min</div>
      <div class="pay-amount">${formatINR(amount)}</div>
      <div class="pay-timer" id="payTimer">10:00 left</div>
      <div class="pay-qr-wrap"><img src="${qrUrl}" alt="UPI QR" width="220" height="220"></div>
      <div class="pay-upi">${upiId}</div>
      <div class="pay-note">Scan QR or pay to UPI above. Amount is fixed.</div>
      <div class="pay-actions">
        <button type="button" class="btn btn-primary btn-block" id="payCopyUpi">Copy UPI ID</button>
        <button type="button" class="btn btn-secondary btn-block" id="payCloseBtn">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const tick = () => {
    const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    const el = document.getElementById('payTimer');
    if (el) el.textContent = left > 0 ? `${m}:${s} left` : 'Expired';
    if (left <= 0) clearInterval(paySheetTimer);
  };
  tick();
  paySheetTimer = setInterval(tick, 1000);

  document.getElementById('payCloseBtn')?.addEventListener('click', closePaySheet);
  document.getElementById('payCopyUpi')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      showToast('UPI copied', 'success');
    } catch (_) {
      showToast(upiId);
    }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePaySheet(); });
}

async function buyOrder(orderId) {
  if (!orderId || buyingOrderId) return;
  buyingOrderId = orderId;
  const btn = document.querySelector(`[data-buy="${orderId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  showToast('Buying order...');
  try {
    const { ok, data } = await walletApiCall(`/orders/${encodeURIComponent(orderId)}/claim`, 'POST');
    if (ok && data?.success) {
      showToast('Order secured! Pay now', 'success');
      document.querySelectorAll(`.order-card[data-order-id="${orderId}"]`).forEach(el => el.remove());
      if (data.payment) showPaymentSheet(data.payment);
      loadDashboard();
      setTimeout(() => loadOrders(true), 400);
    } else {
      const code = data?.code || '';
      if (code === 'ORDER_MISSED' || code === 'ORDER_UNAVAILABLE') {
        showToast(data?.message || 'Order missed! Try another.', 'error');
        document.querySelectorAll(`.order-card[data-order-id="${orderId}"]`).forEach(el => el.remove());
      } else if (code === 'NO_UPI_POOL') {
        showToast(data?.message || 'No UPI in pool. Ask admin to add UPI.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
      } else {
        showToast(data?.message || 'Failed to buy', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
      }
      setTimeout(() => loadOrders(true), 600);
    }
  } catch (e) {
    showToast('Network error', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Buy'; }
  } finally {
    buyingOrderId = null;
  }
}
window.buyOrder = buyOrder;
window.claimOrder = buyOrder;

document.getElementById('ordersList')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-buy]');
  if (btn) buyOrder(btn.getAttribute('data-buy'));
});

async function loadHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
  try {
    const { ok, data } = await walletApiCall('/history', 'GET');
    if (!ok || !data?.success || !data.history?.length) {
      list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>';
      return;
    }
    list.innerHTML = data.history.map(h => {
      const type = (h.type || '').toLowerCase();
      const isPlus = type.includes('deposit') || type.includes('referral') || type.includes('bonus');
      return `
        <div class="history-item">
          <div class="history-icon ${type.includes('withdraw') ? 'withdraw' : type.includes('referral') ? 'referral' : 'deposit'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${type.includes('withdraw')
                ? '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>'
                : '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>'}
            </svg>
          </div>
          <div class="history-details">
            <div class="title">${h.title || h.type || 'Transaction'}</div>
            <div class="time">${h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : ''}</div>
          </div>
          <div class="history-amount ${isPlus ? 'plus' : 'minus'}">
            ${isPlus ? '+' : '-'}${formatINR(h.amount)}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>Could not load history</p></div>';
  }
}

async function checkEligibility() {
  const note = document.getElementById('eligibilityNote');
  if (!note) return;
  try {
    const { ok, data } = await walletApiCall('/eligibility', 'GET');
    if (ok && data?.success) {
      note.textContent = data.message || `You can withdraw. Min: ₹${data.minAmount || 100}`;
    } else {
      note.textContent = data?.message || 'Unable to check eligibility';
    }
  } catch (e) {
    note.textContent = 'Could not check eligibility';
  }
}

document.getElementById('withdrawForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = Number(document.getElementById('withdrawAmount').value);
  const destination = document.getElementById('withdrawDest').value.trim();
  if (!amount || amount < 100) { showToast('Minimum ₹100', 'error'); return; }
  if (!destination) { showToast('Enter UPI / bank details', 'error'); return; }
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  const { ok, data } = await walletApiCall('/withdraw', 'POST', { amount, destination });
  btn.disabled = false;
  btn.textContent = 'Request Withdrawal';
  if (ok && data?.success) {
    showToast('Withdrawal requested!', 'success');
    e.target.reset();
    setTimeout(() => showView('mine'), 1000);
  } else {
    showToast(data?.message || 'Request failed', 'error');
  }
});

const depositModal = document.getElementById('depositModal');
document.getElementById('rechargeBtn')?.addEventListener('click', () => {
  showView('orders');
});
document.getElementById('depositModalClose')?.addEventListener('click', () => {
  depositModal?.classList.remove('open');
});
depositModal?.addEventListener('click', (e) => {
  if (e.target === depositModal) depositModal.classList.remove('open');
});
document.querySelectorAll('.deposit-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('depositAmount').value = btn.dataset.amt;
  });
});
document.getElementById('depositSubmitBtn')?.addEventListener('click', async () => {
  const amount = Number(document.getElementById('depositAmount').value);
  if (!amount || amount < 100) { showToast('Minimum ₹100', 'error'); return; }
  const btn = document.getElementById('depositSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Creating...';
  const { ok, data } = await walletApiCall('/deposit', 'POST', { amount });
  btn.disabled = false;
  btn.textContent = 'Create Request';
  if (ok && data?.success) {
    depositModal?.classList.remove('open');
    showToast('Deposit request created! Admin will verify soon.', 'success');
    loadDashboard();
  } else {
    showToast(data?.message || 'Failed', 'error');
  }
});

document.getElementById('sellBtn')?.addEventListener('click', () => showView('orders'));

async function loadCard() {
  const form = document.getElementById('cardFormStage');
  const display = document.getElementById('cardDisplayStage');
  if (!form || !display) return;
  try {
    const { ok, data } = await walletApiCall('/card', 'GET');
    if (ok && data?.success && data.cardData?.name) {
      form.style.display = 'none';
      display.style.display = 'block';
      renderCard(data.cardData);
    } else {
      form.style.display = 'block';
      display.style.display = 'none';
    }
  } catch (e) {
    form.style.display = 'block';
    display.style.display = 'none';
  }
}

function renderCard(d) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ppCardNameDisplay', (d.name || '').toUpperCase());
  set('ppCardNumber', d.cardNumber || '•••• •••• •••• ••••');
  set('ppCardExpiry', d.expiry || 'MM/YY');
  set('ppCardCvv', d.cvv || '•••');
}

document.getElementById('ppCardForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('ppCardName').value.trim();
  const mobile = document.getElementById('ppCardMobile').value.trim();
  const email = document.getElementById('ppCardEmail').value.trim();
  const address = document.getElementById('ppCardAddress').value.trim();
  if (!name || !mobile || !email || !address) { showToast('All fields required'); return; }
  const { ok, data } = await walletApiCall('/card', 'POST', { name, mobile, email, address });
  if (ok && data?.success) {
    document.getElementById('cardFormStage').style.display = 'none';
    document.getElementById('cardDisplayStage').style.display = 'block';
    renderCard(data.cardData);
    showToast('Card issued!', 'success');
  } else {
    showToast(data?.message || 'Failed', 'error');
  }
});

document.getElementById('ppCardFlip')?.addEventListener('click', function () { this.classList.toggle('flipped'); });

document.getElementById('ppCardReissue')?.addEventListener('click', async () => {
  if (!confirm('Reissue new card number & CVV?')) return;
  const { ok, data } = await walletApiCall('/card', 'GET');
  if (!ok || !data?.cardData) return;
  const d = data.cardData;
  const res = await walletApiCall('/card', 'POST', {
    name: d.name, mobile: d.mobile, email: d.email, address: d.address, issueNew: true
  });
  if (res.ok && res.data?.success) {
    renderCard(res.data.cardData);
    showToast('New card issued', 'success');
  }
});

document.getElementById('ppCardEditDetails')?.addEventListener('click', async () => {
  const { ok, data } = await walletApiCall('/card', 'GET');
  if (ok && data?.cardData) {
    const d = data.cardData;
    document.getElementById('ppCardName').value = d.name || '';
    document.getElementById('ppCardMobile').value = d.mobile || '';
    document.getElementById('ppCardEmail').value = d.email || '';
    document.getElementById('ppCardAddress').value = d.address || '';
  }
  document.getElementById('cardDisplayStage').style.display = 'none';
  document.getElementById('cardFormStage').style.display = 'block';
});
