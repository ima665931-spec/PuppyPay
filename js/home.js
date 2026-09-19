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

function startOrdersAutoRefresh() {
  stopOrdersAutoRefresh();
  // first load immediate
  loadOrders(false);
  // every 2.5–3.5s random-ish feel
  ordersRefreshTimer = setInterval(() => {
    const view = document.getElementById('ordersView');
    if (view && view.classList.contains('active')) loadOrders(true);
    else stopOrdersAutoRefresh();
  }, 3000);
}

function stopOrdersAutoRefresh() {
  if (ordersRefreshTimer) {
    clearInterval(ordersRefreshTimer);
    ordersRefreshTimer = null;
  }
}

function renderOrderCard(o) {
  const oid = o.orderId || o.id || '';
  const reward = o.reward != null ? o.reward : Math.round((Number(o.amount) || 0) * 0.055 * 100) / 100;
  const rate = o.profitRate != null ? (o.profitRate * 100).toFixed(1) : '5.5';
  return `
    <div class="order-card" data-order-id="${oid}">
      <div class="order-card-main">
        <div class="order-amount">${formatINR(o.amount)}</div>
        <div class="order-meta">
          <span class="order-id">${oid}</span>
          <span class="order-dot">·</span>
          <span>Reward ${formatINR(reward)}</span>
          <span class="order-dot">·</span>
          <span>${rate}%</span>
        </div>
        <div class="order-channel">${o.channel || 'UPI Transfer'}</div>
      </div>
      <button class="btn btn-primary btn-buy" data-buy="${oid}" ${buyingOrderId === oid ? 'disabled' : ''}>
        ${buyingOrderId === oid ? '...' : 'Buy'}
      </button>
    </div>
  `;
}

async function loadOrders(silent) {
  const list = document.getElementById('ordersList');
  if (!list || ordersLoading) return;
  ordersLoading = true;
  if (!silent) {
    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><p>Loading orders...</p></div>';
  }
  try {
    const { ok, data } = await walletApiCall('/orders', 'GET');
    if (!ok || !data?.success || !data.orders?.length) {
      if (!silent || !list.querySelector('.order-card')) {
        list.innerHTML = '<div class="empty-state"><p>No orders available right now</p><p class="text-xs text-muted" style="margin-top:8px">Refreshing automatically...</p></div>';
      }
      return;
    }
    // keep scroll position roughly stable on silent refresh
    const prevScroll = list.scrollTop;
    list.innerHTML = data.orders.map(renderOrderCard).join('');
    if (silent) list.scrollTop = prevScroll;
  } catch (e) {
    if (!silent) list.innerHTML = '<div class="empty-state"><p>Could not load orders</p></div>';
  } finally {
    ordersLoading = false;
  }
}

async function buyOrder(orderId) {
  if (!orderId || buyingOrderId) return;
  buyingOrderId = orderId;

  // disable this card's button
  const btn = document.querySelector(`[data-buy="${orderId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '...';
  }

  showToast('Buying order...');
  try {
    const { ok, data } = await walletApiCall(`/orders/${encodeURIComponent(orderId)}/claim`, 'POST');
    if (ok && data?.success) {
      showToast('Order secured! 🎉', 'success');
      // remove card instantly
      document.querySelector(`.order-card[data-order-id="${orderId}"]`)?.remove();
      loadDashboard();
      // soft refresh list
      setTimeout(() => loadOrders(true), 400);
    } else {
      const code = data?.code || '';
      if (code === 'ORDER_MISSED' || code === 'ORDER_UNAVAILABLE') {
        showToast(data?.message || 'Order missed! Try another.', 'error');
        // remove that card — it's gone
        document.querySelector(`.order-card[data-order-id="${orderId}"]`)?.remove();
      } else {
        showToast(data?.message || 'Failed to buy', 'error');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Buy';
        }
      }
      setTimeout(() => loadOrders(true), 600);
    }
  } catch (e) {
    showToast('Network error', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Buy';
    }
  } finally {
    buyingOrderId = null;
  }
}
window.buyOrder = buyOrder;
window.claimOrder = buyOrder; // alias

// Event delegation for Buy buttons
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
  if (depositModal) {
    depositModal.classList.add('open');
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositAmount').focus();
  }
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
  if (!amount || amount < 100) {
    showToast('Minimum ₹100', 'error');
    return;
  }
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

document.getElementById('sellBtn')?.addEventListener('click', () => {
  showView('orders');
});

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
  if (!name || !mobile || !email || !address) {
    showToast('All fields required');
    return;
  }
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

document.getElementById('ppCardFlip')?.addEventListener('click', function () {
  this.classList.toggle('flipped');
});

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
