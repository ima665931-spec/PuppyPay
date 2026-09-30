/* PuppyPay home — orders, buy QR, history, withdraw */
async function loadDashboard() {
  if (!localStorage.getItem('puppypay_token')) return;
  try {
    const { ok, data } = await walletApiCall('/dashboard', 'GET');
    if (!ok || !data?.success) return;
    window.__dashboard = data;
    const bal = document.getElementById('balanceAmount');
    if (bal && !balanceHidden) bal.textContent = formatINR(data.balance || 0);
    if (bal && balanceHidden) bal.dataset.real = formatINR(data.balance || 0);
    const pending = document.getElementById('pendingAmount');
    if (pending) pending.textContent = formatINR(data.pendingBalance || 0);
    if (typeof populateUserUI === 'function') populateUserUI();
    if (typeof loadOrders === 'function') loadOrders(false);
  } catch (e) {}
}

let balanceHidden = false;
let buyingOrderId = null;
let proofDataUrl = null;

function closePaySheet() {
  const sheet = document.getElementById('paySheet');
  if (sheet) sheet.classList.remove('show');
  proofDataUrl = null;
}

function showPaymentSheet(payment) {
  const orderId = payment.orderId;
  let sheet = document.getElementById('paySheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'paySheet';
    sheet.className = 'pay-sheet';
    document.body.appendChild(sheet);
  }
  const amt = formatINR(payment.amount);
  sheet.innerHTML = `
    <div class="pay-sheet-backdrop" onclick="closePaySheet()"></div>
    <div class="pay-sheet-panel">
      <div class="pay-sheet-handle"></div>
      <h3>Pay ${amt}</h3>
      <p class="text-sm text-secondary">Scan QR or pay to UPI · ${payment.validMinutes || 10} min</p>
      <div class="pay-qr-wrap">${payment.qrImageUrl ? `<img src="${payment.qrImageUrl}" alt="QR">` : ''}</div>
      <div class="pay-upi">${payment.upiId || ''}</div>
      <div class="field"><label>UTR (12 digit)</label><div class="input-shell"><input id="payUtrInput" inputmode="numeric" maxlength="12" placeholder="Enter UTR"></div></div>
      <div class="field"><label>Payment screenshot</label><input type="file" id="payProofInput" accept="image/*"><img id="payProofPreview" class="pay-proof-preview" alt=""></div>
      <button type="button" class="btn btn-primary btn-block" id="paySubmitBtn" disabled>Submit payment</button>
      <button type="button" class="btn btn-ghost btn-block" onclick="closePaySheet()">Cancel</button>
    </div>`;
  sheet.classList.add('show');
  proofDataUrl = null;
  const updateSubmit = () => {
    const utr = (document.getElementById('payUtrInput')?.value || '').replace(/\D/g, '');
    const btn = document.getElementById('paySubmitBtn');
    if (btn) btn.disabled = !(utr.length === 12 && proofDataUrl);
  };
  document.getElementById('payUtrInput')?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12); updateSubmit(); });
  document.getElementById('payProofInput')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { showToast('Image max 1.5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { proofDataUrl = String(reader.result || ''); const img = document.getElementById('payProofPreview'); if (img) { img.src = proofDataUrl; img.classList.add('show'); } updateSubmit(); };
    reader.readAsDataURL(file);
  });
  document.getElementById('paySubmitBtn')?.addEventListener('click', async () => {
    const utr = (document.getElementById('payUtrInput')?.value || '').replace(/\D/g, '');
    if (utr.length !== 12 || !proofDataUrl) { showToast('UTR (12 digit) + screenshot required', 'error'); return; }
    const btn = document.getElementById('paySubmitBtn'); btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      const { ok, data } = await walletApiCall('/deposit', 'POST', { orderId: orderId, utr: utr, proofImage: proofDataUrl, qrLabel: payment.label || payment.upiId || null, upiId: payment.upiId || null });
      if (ok && data?.success) { showToast('Payment submitted — verifying automatically', 'success'); closePaySheet(); loadDashboard(); }
      else { showToast(data?.message || 'Submit failed', 'error'); btn.disabled = false; btn.textContent = 'Submit payment'; }
    } catch (err) { showToast('Network error', 'error'); btn.disabled = false; btn.textContent = 'Submit payment'; }
  });
}

async function buyOrder(orderId) {
  if (!orderId || buyingOrderId) return;
  buyingOrderId = orderId;
  const btn = document.querySelector('[data-buy="' + orderId + '"]');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  showToast('Buying order...');
  try {
    const { ok, data } = await walletApiCall('/orders/' + encodeURIComponent(orderId) + '/claim', 'POST');
    if (ok && data?.success) {
      document.querySelectorAll('.order-card[data-order-id="' + orderId + '"]').forEach(el => el.remove());
      const ord = data.order || {}, pay = data.payment || {};
      const amount = pay.amount != null ? pay.amount : ord.amount;
      const upiId = pay.upiId || ord.upiId || '';
      const expiresAt = pay.expiresAt || ord.expiresAt || null;
      const paymentUri = pay.paymentUri || (upiId ? ('upi://pay?pa=' + encodeURIComponent(upiId) + '&pn=PuppyPay&am=' + Number(amount || 0).toFixed(2) + '&cu=INR&tn=' + encodeURIComponent(orderId)) : '');
      const qrImageUrl = pay.qrImageUrl || (paymentUri ? ('https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(paymentUri)) : '');
      if (amount == null || amount === '') showToast('Order secured but amount missing. Try another order.', 'error');
      else if (!upiId) showToast('Payment methods temporarily unavailable. Please try again shortly.', 'error');
      else {
        showPaymentSheet({ orderId: pay.orderId || ord.orderId || orderId, amount: amount, upiId: upiId, label: pay.label || ord.qrLabel || upiId, paymentUri: paymentUri, qrImageUrl: qrImageUrl, expiresAt: expiresAt, validMinutes: pay.validMinutes || 10 });
        showToast('Pay exact amount — 10 min', 'success');
      }
      loadDashboard(); setTimeout(() => loadOrders(true), 400);
    } else {
      const code = data?.code || '';
      if (code === 'ORDER_MISSED' || code === 'ORDER_UNAVAILABLE') {
        showToast(data?.message || 'Order missed! Try another.', 'error');
        document.querySelectorAll('.order-card[data-order-id="' + orderId + '"]').forEach(el => el.remove());
      } else if (code === 'NO_UPI_POOL') {
        showToast('Payment methods temporarily unavailable. Please try again shortly.', 'error');
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
  } finally { buyingOrderId = null; }
}
window.buyOrder = buyOrder; window.claimOrder = buyOrder;
document.getElementById('ordersList')?.addEventListener('click', (e) => { const btn = e.target.closest('[data-buy]'); if (btn) buyOrder(btn.getAttribute('data-buy')); });

async function loadOrders(force) {
  const list = document.getElementById('ordersList');
  if (!list) return;
  if (!force && list.dataset.loaded === '1') return;
  list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
  try {
    const { ok, data } = await walletApiCall('/orders', 'GET');
    if (!ok || !data?.success) { list.innerHTML = '<div class="empty-state"><p>No orders right now</p></div>'; return; }
    const orders = data.orders || [];
    if (!orders.length) { list.innerHTML = '<div class="empty-state"><p>No orders available</p></div>'; list.dataset.loaded = '1'; return; }
    list.innerHTML = orders.map(o => {
      const id = o.orderId || o._id || '';
      const amt = formatINR(o.amount || 0);
      return '<div class="order-card" data-order-id="' + id + '"><div class="order-amt">' + amt + '</div><button type="button" class="btn btn-primary btn-sm" data-buy="' + id + '">Buy</button></div>';
    }).join('');
    list.dataset.loaded = '1';
  } catch (e) { list.innerHTML = '<div class="empty-state"><p>Could not load orders</p></div>'; }
}
window.loadOrders = loadOrders;

async function loadHistory() {
  const list = document.getElementById('historyList'); if (!list) return;
  list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
  try {
    const { ok, data } = await walletApiCall('/history', 'GET');
    if (!ok || !data?.success) { list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>'; return; }
    const deps = (data.history || data.deposits || []).map(h => ({ ...h, _kind: 'deposit' }));
    const wds = (data.withdrawals || []).map(h => ({ ...h, _kind: 'withdraw' }));
    const items = [...deps, ...wds].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (!items.length) { list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>'; return; }
    list.innerHTML = items.map(h => {
      const status = (h.status || '').toLowerCase();
      const isDeposit = h._kind === 'deposit' || h.isReferral || (!h.destination && (h.utr || h.orderId));
      const isPlus = isDeposit;
      const title = isDeposit
        ? (h.isReferral ? 'Referral · ' + (h.utr || 'Bonus') : 'Deposit · ' + (h.orderId || 'Order'))
        : ('Withdraw · ' + (h.destination || 'UPI'));
      const statusLabel = status === 'accepted' || status === 'completed' || status === 'success' ? 'Completed' : status === 'rejected' || status === 'failed' ? 'Failed' : status === 'pending' ? 'Processing' : (status || 'Done');
      const statusCls = (status === 'accepted' || status === 'completed' || status === 'success') ? 'ok' : (status === 'rejected' || status === 'failed') ? 'bad' : 'wait';
      const amt = formatINR(h.amount || h.total || 0);
      return '<div class="history-card ' + (isDeposit ? 'dep' : 'wd') + '"><div class="history-card-top"><div class="history-card-title">' + title + '</div><div class="history-card-amt ' + (isPlus ? 'plus' : 'minus') + '">' + (isPlus ? '+' : '-') + amt + '</div></div><div class="history-card-meta"><span class="history-status ' + statusCls + '">' + statusLabel + '</span>' + (h.utr && !h.isReferral ? '<span class="history-utr">UTR ' + h.utr + '</span>' : '') + '<span class="history-time">' + (h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : '') + '</span></div></div>';
    }).join('');
  } catch (e) { list.innerHTML = '<div class="empty-state"><p>Could not load history</p></div>'; }
}

async function checkEligibility() {
  const note = document.getElementById('eligibilityNote'); if (!note) return;
  try {
    const { ok, data } = await walletApiCall('/eligibility', 'GET');
    note.textContent = ok && data?.success ? (data.message || ('You can withdraw. Min: ₹' + (data.minAmount || 100))) : (data?.message || 'Unable to check eligibility');
  } catch (e) { note.textContent = 'Could not check eligibility'; }
}

document.getElementById('withdrawForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = Number(document.getElementById('withdrawAmount').value);
  const destination = document.getElementById('withdrawDest').value.trim();
  if (!amount || amount < 100) { showToast('Minimum ₹100', 'error'); return; }
  if (!destination) { showToast('Enter UPI / bank details', 'error'); return; }
  const btn = e.target.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Submitting...';
  const { ok, data } = await walletApiCall('/withdraw', 'POST', { amount: amount, destination: destination });
  btn.disabled = false; btn.textContent = 'Request Withdrawal';
  if (ok && data?.success) { showToast('Withdrawal requested!', 'success'); e.target.reset(); setTimeout(() => showView('mine'), 1000); }
  else showToast(data?.message || 'Request failed', 'error');
});

document.getElementById('rechargeBtn')?.addEventListener('click', () => showView('orders'));
document.getElementById('sellBtn')?.addEventListener('click', () => { showView('withdraw'); if (typeof checkEligibility === 'function') checkEligibility(); });

async function loadCard() {
  const form=document.getElementById('cardFormStage'), display=document.getElementById('cardDisplayStage');
  if(!form||!display) return;
  try {
    const {ok,data}=await walletApiCall('/card','GET');
    if(ok&&data?.success&&data.cardData?.name){form.style.display='none';display.style.display='block';
      const c=data.cardData; const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
      set('ppCardNumber',c.cardNumber||'••••');set('ppCardNameDisplay',c.name||'NAME');set('ppCardExpiry',c.expiry||'MM/YY');set('ppCardCvv',c.cvv||'•••');
    } else { form.style.display='block';display.style.display='none'; }
  } catch(e){form.style.display='block';display.style.display='none';}
}
document.getElementById('ppCardForm')?.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const body={name:document.getElementById('ppCardName').value,mobile:document.getElementById('ppCardMobile').value,email:document.getElementById('ppCardEmail').value,address:document.getElementById('ppCardAddress').value};
  const {ok,data}=await walletApiCall('/card','POST',body);
  if(ok&&data?.success){showToast('Card issued','success');loadCard();}else showToast(data?.message||'Failed');
});
