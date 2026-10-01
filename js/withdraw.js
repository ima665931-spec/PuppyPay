/* PuppyPay — Selling window: swipe-to-sell + asset UPI logos */
(function () {
  const NAME_KEY = 'puppypay_sell_name';
  const SWIPE_THRESHOLD = 110;

  let sellState = {
    name: '',
    eligible: false,
    maxAmount: 0,
    minAmount: 100,
    reason: '',
    savedUpiIds: [],
    selectedUpi: '',
    loading: false
  };

  function getStoredName() {
    try { return (localStorage.getItem(NAME_KEY) || '').trim(); } catch (_) { return ''; }
  }
  function setStoredName(n) {
    try { localStorage.setItem(NAME_KEY, (n || '').trim()); } catch (_) {}
  }

  function ensureSellStyles() {
    if (document.getElementById('pp-sell-styles')) return;
    const s = document.createElement('style');
    s.id = 'pp-sell-styles';
    s.textContent = [
      '#withdrawView .page-content{padding:16px 16px 28px;}',
      '.sell-step{display:none;}',
      '.sell-step.active{display:block;}',
      '.sell-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin-bottom:14px;box-shadow:0 4px 14px rgba(15,23,42,.05);}',
      '.sell-title{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 6px;letter-spacing:-.02em;}',
      '.sell-sub{font-size:13px;color:#64748b;line-height:1.45;margin:0 0 14px;}',
      '.sell-field{margin-bottom:12px;}',
      '.sell-field label{display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;}',
      '.sell-field input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:15px;font-family:inherit;box-sizing:border-box;}',
      '.sell-field input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12);}',
      '.sell-btn{display:block;width:100%;padding:13px;border:none;border-radius:12px;background:#2563eb;color:#fff;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;}',
      '.sell-btn:disabled{opacity:.55;cursor:wait;}',
      '.sell-btn-sec{background:#fff;color:#2563eb;border:1.5px solid #bfdbfe;}',
      '.sell-elig{padding:14px;border-radius:12px;margin-bottom:12px;}',
      '.sell-elig.ok{background:#ecfdf5;border:1px solid #a7f3d0;}',
      '.sell-elig.bad{background:#fef2f2;border:1px solid #fecaca;}',
      '.sell-elig-t{font-weight:800;font-size:14px;margin:0 0 4px;}',
      '.sell-elig.ok .sell-elig-t{color:#047857;}',
      '.sell-elig.bad .sell-elig-t{color:#b91c1c;}',
      '.sell-elig-s{font-size:12px;color:#64748b;margin:0;}',
      '.sell-max{font-size:22px;font-weight:800;color:#0f172a;margin:4px 0;}',
      '.sell-upi-list{display:flex;flex-direction:column;gap:10px;margin:12px 0 16px;}',
      '.sell-upi-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;transition:.15s;}',
      '.sell-upi-card.selected{border-color:#2563eb;background:#eff6ff;box-shadow:0 0 0 3px rgba(37,99,235,.12);}',
      '.sell-upi-logo{width:36px;height:36px;border-radius:10px;object-fit:contain;background:#f1f5f9;flex-shrink:0;}',
      '.sell-upi-id{flex:1;min-width:0;font-weight:700;font-size:14px;color:#0f172a;word-break:break-all;}',
      '.sell-upi-actions{display:flex;gap:6px;flex-shrink:0;}',
      '.sell-upi-actions button{border:none;background:#f1f5f9;border-radius:8px;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '.sell-add-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}',
      '.sell-add-row input{flex:1;min-width:140px;padding:11px 12px;border-radius:12px;border:1px solid #e2e8f0;font-size:14px;font-family:inherit;}',
      '.sell-add-row button{padding:0 14px;border:none;border-radius:12px;background:#2563eb;color:#fff;font-weight:700;font-size:13px;height:42px;cursor:pointer;font-family:inherit;}',
      '.sell-swipe-wrap{position:relative;height:56px;border-radius:28px;background:#e2e8f0;overflow:hidden;user-select:none;touch-action:none;margin-top:8px;}',
      '.sell-swipe-track{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#64748b;pointer-events:none;}',
      '.sell-swipe-knob{position:absolute;left:4px;top:4px;width:48px;height:48px;border-radius:24px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,.35);cursor:grab;z-index:2;}',
      '.sell-feedback{margin-top:12px;font-size:13px;color:#64748b;min-height:18px;}',
      '.sell-feedback.ok{color:#047857;font-weight:700;}',
      '.sell-feedback.err{color:#b91c1c;font-weight:700;}',
      '.sell-spinner{width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:ppSpin .7s linear infinite;margin:12px auto;}',
      '@keyframes ppSpin{to{transform:rotate(360deg);}}'
    ].join('');
    document.head.appendChild(s);
  }

  function ensureSellUI() {
    ensureSellStyles();
    const view = document.getElementById('withdrawView');
    if (!view) return;
    const content = view.querySelector('.page-content');
    if (!content) return;
    if (content.querySelector('.sell-step')) return;

    content.innerHTML = `
      <div class="sell-step" id="sellStepWelcome">
        <div class="sell-card">
          <h3 class="sell-title">Welcome to Selling</h3>
          <p class="sell-sub">Enter your name once. We use it for payout verification.</p>
          <div class="sell-field"><label>Full name</label><input type="text" id="sellNameInput" placeholder="Your name" autocomplete="name"></div>
          <button type="button" class="sell-btn" id="sellContinueBtn">Continue</button>
        </div>
      </div>
      <div class="sell-step" id="sellStepCheck">
        <div class="sell-card">
          <h3 class="sell-title">Checking eligibility</h3>
          <div class="sell-spinner"></div>
          <p class="sell-sub" style="text-align:center">Please wait…</p>
        </div>
      </div>
      <div class="sell-step" id="sellStepMain">
        <div class="sell-card" id="sellEligCard">
          <div class="sell-elig" id="sellEligBox">
            <p class="sell-elig-t" id="sellEligText">—</p>
            <p class="sell-elig-s" id="sellEligSub">—</p>
          </div>
          <div id="sellMaxCard">
            <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase">Max sellable</div>
            <div class="sell-max" id="sellMaxAmount">₹0</div>
            <p class="sell-sub" id="sellMaxSub" style="margin:0">Min amount applies</p>
          </div>
        </div>
        <div class="sell-card">
          <h3 class="sell-title" style="font-size:16px">Payout UPI</h3>
          <p class="sell-sub">Add or choose a UPI ID. Swipe to confirm sell.</p>
          <div class="sell-add-row">
            <input type="text" id="sellUpiInput" placeholder="name@upi" autocomplete="off">
            <button type="button" id="sellAddUpiBtn">Add UPI</button>
          </div>
          <div class="sell-upi-list" id="sellUpiList"></div>
          <div class="sell-swipe-wrap" id="sellSwipeWrap">
            <div class="sell-swipe-track">Swipe to sell →</div>
            <div class="sell-swipe-knob" id="sellSwipeKnob">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
            </div>
          </div>
          <div class="sell-feedback" id="sellFeedback"></div>
        </div>
      </div>`;

    document.getElementById('sellContinueBtn')?.addEventListener('click', onContinueName);
    document.getElementById('sellAddUpiBtn')?.addEventListener('click', onAddUpi);
    bindSwipe();
  }

  function showSellStep(id) {
    ensureSellUI();
    ['sellStepWelcome', 'sellStepCheck', 'sellStepMain'].forEach(function (sid) {
      const el = document.getElementById(sid);
      if (el) el.classList.toggle('active', sid === id);
    });
  }

  function onContinueName() {
    const input = document.getElementById('sellNameInput');
    const name = (input && input.value || '').trim();
    if (!name || name.length < 2) {
      showToast('Enter your full name', 'error');
      return;
    }
    sellState.name = name;
    setStoredName(name);
    showSellStep('sellStepCheck');
    runEligibilityCheck();
  }

  async function runEligibilityCheck() {
    try {
      const res = await walletApiCall('/eligibility', 'GET');
      if (!res.ok || !res.data) {
        sellState.eligible = false;
        sellState.reason = (res.data && res.data.message) || 'Could not check eligibility';
        paintMain();
        showSellStep('sellStepMain');
        return;
      }
      const d = res.data;
      sellState.eligible = !!(d.eligible || d.canWithdraw);
      sellState.maxAmount = Number(d.maxAmount != null ? d.maxAmount : d.available != null ? d.available : d.balance || 0);
      sellState.minAmount = Number(d.minAmount != null ? d.minAmount : 100);
      sellState.reason = d.reason || d.message || '';
      sellState.savedUpiIds = d.savedUpiIds || d.upiIds || [];
      if (d.user && d.user.savedUpiIds) sellState.savedUpiIds = d.user.savedUpiIds;
      paintMain();
      showSellStep('sellStepMain');
    } catch (e) {
      sellState.eligible = false;
      sellState.reason = 'Network error';
      paintMain();
      showSellStep('sellStepMain');
    }
  }

  function detectUpiBrand(upi) {
    const u = (upi || '').toLowerCase();
    if (u.includes('@ybl') || u.includes('@ibl') || u.includes('@axl') || u.includes('phonepe')) return { name: 'PhonePe', logo: 'assets/upi/phonepe.png' };
    if (u.includes('@ok') || u.includes('google') || u.includes('@oksbi') || u.includes('@okaxis') || u.includes('@okicici')) return { name: 'Google Pay', logo: 'assets/upi/gpay.png' };
    if (u.includes('@paytm') || u.includes('@ptaxis') || u.includes('@ptyes')) return { name: 'Paytm', logo: 'assets/upi/paytm.png' };
    if (u.includes('@mbk') || u.includes('mobikwik')) return { name: 'MobiKwik', logo: 'assets/upi/mobikwik.png' };
    if (u.includes('@apl') || u.includes('@amazon')) return { name: 'Amazon Pay', logo: 'assets/upi/amazonpay.png' };
    if (u.includes('@upi') || u.includes('@ibl')) return { name: 'UPI', logo: 'assets/upi/upi.png' };
    return { name: 'UPI', logo: 'assets/upi/upi.png' };
  }

  function paintMain() {
    const box = document.getElementById('sellEligBox');
    const text = document.getElementById('sellEligText');
    const sub = document.getElementById('sellEligSub');
    const maxEl = document.getElementById('sellMaxAmount');
    const maxSub = document.getElementById('sellMaxSub');
    if (!box || !text) return;

    if (sellState.eligible) {
      box.className = 'sell-elig ok';
      text.textContent = 'You can sell now';
      sub.textContent = sellState.reason || 'Eligible for payout';
    } else {
      box.className = 'sell-elig bad';
      text.textContent = 'Not eligible yet';
      sub.textContent = sellState.reason || 'Complete more orders or wait for unlock';
    }
    if (maxEl) maxEl.textContent = '₹' + Number(sellState.maxAmount || 0).toLocaleString('en-IN');
    if (maxSub) maxSub.textContent = 'Min ₹' + Number(sellState.minAmount || 100).toLocaleString('en-IN');
    renderUpiList();
  }

  function renderUpiList() {
    const list = document.getElementById('sellUpiList');
    if (!list) return;
    const ids = sellState.savedUpiIds || [];
    if (!ids.length) {
      list.innerHTML = '<div style="font-size:13px;color:#94a3b8;padding:8px 0">No UPI saved yet. Add one above.</div>';
      return;
    }
    list.innerHTML = ids.map(function (upi) {
      const brand = detectUpiBrand(upi);
      const sel = sellState.selectedUpi === upi ? ' selected' : '';
      return '<div class="sell-upi-card' + sel + '" data-upi="' + upi.replace(/"/g, '') + '">' +
        '<img class="sell-upi-logo" src="' + brand.logo + '" alt="" onerror="this.style.display=\'none\'">' +
        '<div class="sell-upi-id">' + upi + '</div>' +
        '<div class="sell-upi-actions">' +
        '<button type="button" data-edit="' + upi.replace(/"/g, '') + '" title="Edit">✏️</button>' +
        '<button type="button" data-del="' + upi.replace(/"/g, '') + '" title="Delete">🗑️</button>' +
        '</div></div>';
    }).join('');

    list.querySelectorAll('.sell-upi-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-edit]') || e.target.closest('[data-del]')) return;
        sellState.selectedUpi = card.getAttribute('data-upi') || '';
        renderUpiList();
      });
    });
    list.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        onDeleteUpi(btn.getAttribute('data-del'));
      });
    });
    list.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        onEditUpi(btn.getAttribute('data-edit'));
      });
    });
  }

  async function onAddUpi() {
    const input = document.getElementById('sellUpiInput');
    const upi = (input && input.value || '').trim();
    if (!upi || !upi.includes('@')) {
      showToast('Enter valid UPI (name@bank)', 'error');
      return;
    }
    try {
      const res = await walletApiCall('/upi', 'POST', { upiId: upi });
      if (res.ok && res.data) {
        sellState.savedUpiIds = res.data.savedUpiIds || sellState.savedUpiIds.concat([upi]);
        if (sellState.savedUpiIds.indexOf(upi) < 0) sellState.savedUpiIds.push(upi);
        sellState.selectedUpi = upi;
        if (input) input.value = '';
        renderUpiList();
        showToast('UPI added', 'success');
      } else {
        showToast((res.data && res.data.message) || 'Failed to add UPI', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  async function onDeleteUpi(upi) {
    if (!upi || !confirm('Remove ' + upi + '?')) return;
    try {
      const res = await walletApiCall('/upi', 'DELETE', { upiId: upi });
      if (res.ok) {
        sellState.savedUpiIds = (res.data && res.data.savedUpiIds) || sellState.savedUpiIds.filter(function (x) { return x !== upi; });
        if (sellState.selectedUpi === upi) sellState.selectedUpi = '';
        renderUpiList();
        showToast('UPI removed', 'success');
      } else showToast((res.data && res.data.message) || 'Failed', 'error');
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  async function onEditUpi(oldUpi) {
    const neu = prompt('Edit UPI ID', oldUpi || '');
    if (neu == null) return;
    const upi = neu.trim();
    if (!upi || !upi.includes('@')) {
      showToast('Enter valid UPI', 'error');
      return;
    }
    if (upi === oldUpi) return;
    try {
      await walletApiCall('/upi', 'DELETE', { upiId: oldUpi });
      const add = await walletApiCall('/upi', 'POST', { upiId: upi });
      if (add.ok) {
        sellState.savedUpiIds = (add.data && add.data.savedUpiIds) || sellState.savedUpiIds.map(function (x) { return x === oldUpi ? upi : x; });
        if (sellState.selectedUpi === oldUpi) sellState.selectedUpi = upi;
        renderUpiList();
        showToast('UPI updated', 'success');
      } else {
        showToast((add.data && add.data.message) || 'Could not update', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  function bindSwipe() {
    const wrap = document.getElementById('sellSwipeWrap');
    const knob = document.getElementById('sellSwipeKnob');
    if (!wrap || !knob || knob._bound) return;
    knob._bound = true;
    let startX = 0, curX = 0, dragging = false;

    function maxX() {
      return Math.max(0, wrap.clientWidth - knob.offsetWidth - 8);
    }
    function setX(x) {
      curX = Math.max(0, Math.min(maxX(), x));
      knob.style.transform = 'translateX(' + curX + 'px)';
    }
    function resetKnob() {
      knob.style.transition = 'transform .25s ease';
      setX(0);
      setTimeout(function () { knob.style.transition = ''; }, 260);
    }

    function onStart(clientX) {
      if (sellState.loading) return;
      dragging = true;
      startX = clientX - curX;
      knob.style.transition = '';
    }
    function onMove(clientX) {
      if (!dragging) return;
      setX(clientX - startX);
    }
    async function onEnd() {
      if (!dragging) return;
      dragging = false;
      if (curX >= SWIPE_THRESHOLD) {
        await submitSell();
      }
      resetKnob();
    }

    knob.addEventListener('touchstart', function (e) { onStart(e.touches[0].clientX); }, { passive: true });
    knob.addEventListener('touchmove', function (e) { onMove(e.touches[0].clientX); }, { passive: true });
    knob.addEventListener('touchend', onEnd);
    knob.addEventListener('mousedown', function (e) { e.preventDefault(); onStart(e.clientX); });
    window.addEventListener('mousemove', function (e) { if (dragging) onMove(e.clientX); });
    window.addEventListener('mouseup', function () { if (dragging) onEnd(); });
  }

  async function submitSell() {
    const fb = document.getElementById('sellFeedback');
    if (!sellState.eligible) {
      if (fb) { fb.className = 'sell-feedback err'; fb.textContent = sellState.reason || 'Not eligible'; }
      showToast(sellState.reason || 'Not eligible to sell', 'error');
      return;
    }
    if (!sellState.selectedUpi) {
      if (fb) { fb.className = 'sell-feedback err'; fb.textContent = 'Select a UPI ID first'; }
      showToast('Select a UPI ID', 'error');
      return;
    }
    const amount = Number(sellState.maxAmount || 0);
    if (amount < Number(sellState.minAmount || 100)) {
      if (fb) { fb.className = 'sell-feedback err'; fb.textContent = 'Amount below minimum'; }
      showToast('Amount below minimum', 'error');
      return;
    }
    sellState.loading = true;
    if (fb) { fb.className = 'sell-feedback'; fb.textContent = 'Submitting…'; }
    try {
      const res = await walletApiCall('/withdraw', 'POST', {
        amount: amount,
        destination: sellState.selectedUpi,
        upiId: sellState.selectedUpi,
        name: sellState.name || getStoredName()
      });
      if (res.ok && res.data && res.data.success !== false) {
        if (fb) {
          fb.className = 'sell-feedback ok';
          fb.innerHTML = 'Sell request of ₹' + amount.toLocaleString('en-IN') +
            ' submitted. Amount is held and will be processed shortly.</div>';
        }
        showToast('Sell request submitted', 'success');
        setTimeout(function () { runEligibilityCheck(); }, 800);
      } else {
        const msg = (res.data && res.data.message) || 'Sell failed';
        if (fb) { fb.className = 'sell-feedback err'; fb.textContent = msg; }
        showToast(msg, 'error');
      }
    } catch (e) {
      if (fb) { fb.className = 'sell-feedback err'; fb.textContent = 'Network error'; }
      showToast('Network error', 'error');
    }
    sellState.loading = false;
  }

  window.openSellingWindow = function openSellingWindow() {
    ensureSellUI();
    const stored = getStoredName();
    if (stored) {
      sellState.name = stored;
      showSellStep('sellStepCheck');
      runEligibilityCheck();
    } else showSellStep('sellStepWelcome');
    if (typeof showView === 'function') showView('withdraw');
  };

  document.getElementById('sellBtn')?.addEventListener('click', function (e) {
    e.preventDefault();
    openSellingWindow();
  });

  document.addEventListener('click', function (e) {
    const menu = e.target.closest && e.target.closest('#menuWithdraw');
    if (menu) {
      e.preventDefault();
      e.stopPropagation();
      openSellingWindow();
    }
  }, true);

  const obs = new MutationObserver(function () {
    const v = document.getElementById('withdrawView');
    if (v && v.classList.contains('active')) ensureSellUI();
  });
  if (document.getElementById('withdrawView')) {
    obs.observe(document.getElementById('withdrawView'), { attributes: true, attributeFilter: ['class'] });
  }

  // If user lands on withdraw via showView only
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      const v = document.getElementById('withdrawView');
      if (v && v.classList.contains('active')) openSellingWindow();
    }, 400);
  });
})();
