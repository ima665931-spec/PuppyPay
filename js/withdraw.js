/* PuppyPay — Selling window: swipe-to-sell + real UPI brand icons */
(function () {
  const NAME_KEY = 'puppypay_sell_name';
  const SWIPE_THRESHOLD = 110;

  let sellState = {
    name: '',
    eligible: false,
    maxAmount: 0,
    balance: 0,
    firstOrderDone: false,
    message: '',
    savedUpiIds: [],
    suggestedUpiIds: [],
    submitting: false,
  };

  function detectUpiBrand(upi) {
    const h = String(upi || '').toLowerCase().split('@')[1] || '';
    if (['ybl', 'ibl', 'axl', 'phonepe'].some((x) => h.includes(x))) return 'phonepe';
    if (['okaxis', 'oksbi', 'okhdfcbank', 'okicici', 'okyesbank', 'okindus', 'google'].some((x) => h.includes(x))) return 'gpay';
    if (h.includes('paytm') || h === 'ptys') return 'paytm';
    if (h.includes('apl') || h.includes('amazon')) return 'amazon';
    if (h.includes('upi') || h.includes('axisbank') || h.includes('boi') || h.includes('sbi') || h.includes('pnb') || h.includes('icici')) return 'bhim';
    return 'generic';
  }

  function brandLabel(b) {
    if (b === 'phonepe') return 'PhonePe';
    if (b === 'gpay') return 'Google Pay';
    if (b === 'paytm') return 'Paytm';
    if (b === 'amazon') return 'Amazon Pay';
    if (b === 'bhim') return 'BHIM UPI';
    return 'UPI';
  }

  function brandSvg(b) {
    if (b === 'phonepe') {
      return '<svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="48" height="48" rx="12" fill="#5f259f"/>' +
        '<path d="M16 30V18h5.2c2.9 0 4.7 1.5 4.7 3.9 0 1.7-.9 3-2.4 3.5L27 30h-3.2l-2.9-4.1h-1.7V30H16zm3.2-6.5h1.8c1.2 0 1.9-.6 1.9-1.6s-.7-1.5-1.9-1.5h-1.8v3.1z" fill="#fff"/>' +
        '<circle cx="33.5" cy="24" r="5.2" fill="none" stroke="#fff" stroke-width="2"/>' +
        '<path d="M31.2 24h4.6M33.5 21.7v4.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' +
        '</svg>';
    }
    if (b === 'gpay') {
      return '<svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="48" height="48" rx="12" fill="#fff"/>' +
        '<path d="M24 12c-6.6 0-12 5.4-12 12s5.4 12 12 12c6 0 11-4.4 11.8-10.1H24v-3.8h14.6C37.5 16.3 31.4 12 24 12z" fill="#4285F4"/>' +
        '<path d="M24 36c3.2 0 6.1-1.2 8.3-3.1l-3.9-3c-1.1.7-2.5 1.2-4.4 1.2-3.4 0-6.2-2.3-7.2-5.4H12.6v3.2C14.8 33.3 19.1 36 24 36z" fill="#34A853"/>' +
        '<path d="M16.8 25.7c-.3-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5v-3.2H12.6c-.8 1.6-1.3 3.4-1.3 5.2s.5 3.6 1.3 5.2l4.2-2.2z" fill="#FBBC05"/>' +
        '<path d="M24 17.1c1.8 0 3.4.6 4.6 1.8l3.5-3.5C29.9 13.4 27.2 12 24 12c-4.9 0-9.2 2.7-11.4 6.7l4.2 3.2c1-3.1 3.8-4.8 7.2-4.8z" fill="#EA4335"/>' +
        '</svg>';
    }
    if (b === 'paytm') {
      return '<svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="48" height="48" rx="12" fill="#00baf2"/>' +
        '<text x="24" y="22" text-anchor="middle" fill="#fff" font-size="11" font-weight="800" font-family="Arial,sans-serif">paytm</text>' +
        '<path d="M14 28h20M18 28v6M30 28v6" stroke="#002e6e" stroke-width="2.2" stroke-linecap="round"/>' +
        '</svg>';
    }
    if (b === 'amazon') {
      return '<svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="48" height="48" rx="12" fill="#232f3e"/>' +
        '<path d="M14 28c4 3.2 10 4.8 15.5 4.8 3.2 0 6.4-.6 9.2-1.8" fill="none" stroke="#ff9900" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M35 29.5l2.5 1.2-1.5 2.6" fill="none" stroke="#ff9900" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<text x="24" y="22" text-anchor="middle" fill="#fff" font-size="12" font-weight="700" font-family="Arial,sans-serif">a</text>' +
        '</svg>';
    }
    if (b === 'bhim') {
      return '<svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="48" height="48" rx="12" fill="#fff"/>' +
        '<path d="M12 32L20 14h5l-8 18h-5z" fill="#f97316"/>' +
        '<path d="M22 32L30 14h5l-8 18h-5z" fill="#0ea5e9"/>' +
        '<path d="M16 28h16" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>';
    }
    return '<svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="48" height="48" rx="12" fill="#0f766e"/>' +
      '<rect x="12" y="16" width="24" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2"/>' +
      '<path d="M12 22h24" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="18" cy="28" r="1.5" fill="#5eead4"/>' +
      '</svg>';
  }

  function getStoredName() {
    try {
      const n = localStorage.getItem(NAME_KEY);
      if (n && n.trim().length >= 2) return n.trim();
      const u = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      if (u.name && u.name !== 'PuppyPay User' && u.name.trim().length >= 2) return u.name.trim();
    } catch (_) {}
    return '';
  }

  function setStoredName(name) {
    try {
      localStorage.setItem(NAME_KEY, name);
      const u = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      u.name = name;
      localStorage.setItem('puppypay_user', JSON.stringify(u));
    } catch (_) {}
  }

  function showSellStep(id) {
    document.querySelectorAll('.sell-step').forEach((el) => el.classList.remove('active'));
    const t = document.getElementById(id);
    if (t) t.classList.add('active');
  }

  function ensureSellUI() {
    const view = document.getElementById('withdrawView');
    if (!view) return false;
    const content = view.querySelector('.page-content');
    if (!content) return false;
    if (content.dataset.sellUi === '1') return true;

    content.innerHTML = `
      <div class="sell-step active" id="sellStepWelcome">
        <div class="sell-welcome">
          <h3>Selling Window</h3>
          <p>Enter your full name once. We will use it for all future withdrawals.</p>
          <div class="sell-name-field">
            <label>Full name</label>
            <input type="text" id="sellNameInput" placeholder="As per bank / UPI" autocomplete="name">
          </div>
          <button type="button" class="sell-btn-primary" id="sellContinueBtn">Continue</button>
        </div>
      </div>

      <div class="sell-step" id="sellStepCheck">
        <div class="sell-check">
          <div class="sell-check-spinner"></div>
          <h3>Checking eligibility</h3>
          <p>Verifying first order and wallet balance</p>
        </div>
      </div>

      <div class="sell-step" id="sellStepMain">
        <div class="sell-info-row">
          <div class="sell-info-card" id="sellMaxCard">
            <div class="lbl">Max sellable</div>
            <div class="val" id="sellMaxAmount">₹0</div>
            <div class="sub" id="sellMaxSub">Multiple of ₹100</div>
          </div>
          <div class="sell-info-card" id="sellEligCard">
            <div class="lbl">Status</div>
            <div class="val sm" id="sellEligText">—</div>
            <div class="sub" id="sellEligSub"></div>
          </div>
        </div>

        <div class="sell-section-title">Linked UPI</div>
        <p class="sell-swipe-hint">Swipe card right to sell →</p>
        <div class="sell-upi-list" id="sellUpiList"></div>

        <div class="sell-add-upi">
          <input type="text" id="sellUpiInput" placeholder="Add UPI ID (e.g. name@ybl)" autocomplete="off">
          <button type="button" id="sellAddUpiBtn">Add</button>
        </div>
        <div class="sell-suggest" id="sellSuggest" hidden></div>

        <div id="sellFeedback"></div>
      </div>
    `;
    content.dataset.sellUi = '1';

    const nameEl = document.getElementById('sellNameInput');
    const existing = getStoredName();
    if (nameEl && existing) nameEl.value = existing;

    document.getElementById('sellContinueBtn')?.addEventListener('click', onSellContinue);
    document.getElementById('sellAddUpiBtn')?.addEventListener('click', onAddUpi);
    document.getElementById('sellUpiInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAddUpi();
    });
    document.getElementById('sellUpiInput')?.addEventListener('focus', () => {
      const box = document.getElementById('sellSuggest');
      if (box) { box.hidden = false; renderSuggestions(); }
    });
    document.getElementById('sellUpiInput')?.addEventListener('blur', () => {
      setTimeout(() => {
        const box = document.getElementById('sellSuggest');
        if (box) box.hidden = true;
      }, 180);
    });
    return true;
  }

  async function onSellContinue() {
    const name = (document.getElementById('sellNameInput')?.value || '').trim();
    if (name.length < 2) { showToast('Please enter your full name', 'error'); return; }
    sellState.name = name;
    setStoredName(name);
    showSellStep('sellStepCheck');
    await runEligibilityCheck();
  }

  async function runEligibilityCheck() {
    try {
      const { ok, data } = await walletApiCall('/eligibility', 'GET');
      if (!ok || !data?.success) {
        sellState.eligible = false;
        sellState.message = data?.message || 'Could not check eligibility';
        paintMain();
        showSellStep('sellStepMain');
        return;
      }
      sellState.eligible = !!data.eligible;
      sellState.maxAmount = Number(data.maxAmount) || 0;
      sellState.balance = Number(data.balance) || 0;
      sellState.firstOrderDone = !!data.firstOrderDone;
      sellState.message = data.message || '';
      sellState.savedUpiIds = data.savedUpiIds || [];
      sellState.suggestedUpiIds = data.suggestedUpiIds || [];
      if (data.name && data.name !== 'PuppyPay User' && !sellState.name) {
        sellState.name = data.name;
        setStoredName(data.name);
      }
      paintMain();
      showSellStep('sellStepMain');
    } catch (e) {
      sellState.eligible = false;
      sellState.message = 'Network error while checking eligibility';
      paintMain();
      showSellStep('sellStepMain');
    }
  }

  function paintMain() {
    const maxEl = document.getElementById('sellMaxAmount');
    const maxSub = document.getElementById('sellMaxSub');
    const maxCard = document.getElementById('sellMaxCard');
    const eligText = document.getElementById('sellEligText');
    const eligSub = document.getElementById('sellEligSub');
    const eligCard = document.getElementById('sellEligCard');
    if (maxEl) maxEl.textContent = formatINR(sellState.maxAmount);
    if (maxSub) maxSub.textContent = 'Wallet ' + formatINR(sellState.balance) + ' · ×₹100';
    if (maxCard) {
      maxCard.classList.toggle('ok', sellState.maxAmount >= 100);
      maxCard.classList.toggle('bad', sellState.maxAmount < 100);
    }
    if (eligText) eligText.textContent = sellState.eligible ? 'Eligible' : 'Not eligible';
    if (eligSub) eligSub.textContent = sellState.message || '';
    if (eligCard) {
      eligCard.classList.toggle('ok', sellState.eligible);
      eligCard.classList.toggle('bad', !sellState.eligible);
    }
    renderUpiList();
  }

  function paintMainKeepList() {
    const maxEl = document.getElementById('sellMaxAmount');
    const maxSub = document.getElementById('sellMaxSub');
    const maxCard = document.getElementById('sellMaxCard');
    const eligText = document.getElementById('sellEligText');
    const eligSub = document.getElementById('sellEligSub');
    const eligCard = document.getElementById('sellEligCard');
    if (maxEl) maxEl.textContent = formatINR(sellState.maxAmount);
    if (maxSub) maxSub.textContent = 'Wallet ' + formatINR(sellState.balance) + ' · ×₹100';
    if (maxCard) {
      maxCard.classList.toggle('ok', sellState.maxAmount >= 100);
      maxCard.classList.toggle('bad', sellState.maxAmount < 100);
    }
    if (eligText) eligText.textContent = sellState.eligible ? 'Eligible' : 'Not eligible';
    if (eligSub) eligSub.textContent = sellState.message || '';
    if (eligCard) {
      eligCard.classList.toggle('ok', sellState.eligible);
      eligCard.classList.toggle('bad', !sellState.eligible);
    }
  }

  function renderUpiList() {
    const list = document.getElementById('sellUpiList');
    if (!list) return;
    const ids = sellState.savedUpiIds || [];
    if (!ids.length) {
      list.innerHTML = '<div class="sell-empty">No UPI linked yet. Add one below.</div>';
      return;
    }
    list.innerHTML = ids.map((upi) => {
      const brand = detectUpiBrand(upi);
      return (
        '<div class="sell-upi-wrap" data-upi="' + upi + '">' +
          '<div class="sell-upi-rail"><span>Sell →</span></div>' +
          '<div class="sell-upi-card ' + brand + '" data-card-upi="' + upi + '">' +
            '<div class="sell-upi-logo">' + brandSvg(brand) + '</div>' +
            '<div class="sell-upi-body">' +
              '<div class="sell-upi-id">' + upi + '</div>' +
              '<div class="sell-upi-tag">' + brandLabel(brand) + '</div>' +
            '</div>' +
            '<div class="sell-upi-actions">' +
              '<button type="button" class="sell-upi-del" data-del-upi="' + upi + '" title="Remove">×</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('[data-del-upi]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteUpi(btn.getAttribute('data-del-upi'));
      });
    });
    list.querySelectorAll('.sell-upi-card').forEach((card) => bindSwipe(card));
  }

  function bindSwipe(card) {
    let startX = 0, startY = 0, dx = 0, active = false, locked = false;
    const wrap = card.closest('.sell-upi-wrap');
    const rail = wrap?.querySelector('.sell-upi-rail');

    function onStart(clientX, clientY) {
      if (sellState.submitting || locked) return;
      active = true;
      startX = clientX; startY = clientY; dx = 0;
      card.classList.add('dragging');
      card.classList.remove('spin-back', 'fly-out');
      card.style.transition = 'none';
    }
    function onMove(clientX, clientY) {
      if (!active) return;
      const mx = clientX - startX;
      const my = clientY - startY;
      if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 12) {
        active = false;
        resetCard(card, rail);
        return;
      }
      dx = Math.max(0, mx);
      card.style.transform = 'translateX(' + dx + 'px)';
      if (rail) {
        rail.classList.toggle('show', dx > 24);
        rail.style.opacity = String(Math.min(1, dx / SWIPE_THRESHOLD));
      }
    }
    function onEnd() {
      if (!active) return;
      active = false;
      card.classList.remove('dragging');
      if (dx >= SWIPE_THRESHOLD) {
        locked = true;
        attemptSell(card, wrap, rail);
      } else {
        resetCard(card, rail);
      }
    }

    card.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true });
    card.addEventListener('touchmove', (e) => {
      if (!active) return;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
      if (dx > 8) e.preventDefault();
    }, { passive: false });
    card.addEventListener('touchend', onEnd);
    card.addEventListener('touchcancel', () => { active = false; resetCard(card, rail); });

    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      onStart(e.clientX, e.clientY);
      const move = (ev) => onMove(ev.clientX, ev.clientY);
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        onEnd();
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  function resetCard(card, rail) {
    card.style.transition = 'transform 0.25s ease';
    card.style.transform = 'translateX(0)';
    if (rail) { rail.classList.remove('show'); rail.style.opacity = '0'; }
  }

  function spinBack(card, rail) {
    card.classList.add('spin-back');
    card.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.2, 0.64, 1)';
    card.style.transform = 'translateX(0) rotate(360deg)';
    if (rail) { rail.classList.remove('show'); rail.style.opacity = '0'; }
    setTimeout(() => {
      card.style.transition = 'none';
      card.style.transform = 'translateX(0) rotate(0deg)';
      card.classList.remove('spin-back');
      void card.offsetWidth;
      card.style.transition = '';
    }, 560);
  }

  function flyOut(card, wrap) {
    card.classList.add('fly-out');
    card.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
    card.style.transform = 'translateX(120%)';
    card.style.opacity = '0';
    setTimeout(() => {
      if (wrap && wrap.parentNode) wrap.remove();
      const list = document.getElementById('sellUpiList');
      if (list && !list.querySelector('.sell-upi-wrap')) {
        list.innerHTML = '<div class="sell-empty">No UPI linked yet. Add one below.</div>';
      }
    }, 360);
  }

  async function attemptSell(card, wrap, rail) {
    const upi = card.getAttribute('data-card-upi');
    const fb = document.getElementById('sellFeedback');
    if (fb) fb.innerHTML = '';
    sellState.submitting = true;
    try {
      const { ok, data } = await walletApiCall('/eligibility', 'GET');
      if (!ok || !data?.success || !data.eligible || Number(data.maxAmount) < 100) {
        sellState.eligible = false;
        sellState.message = data?.message || 'Not eligible';
        sellState.maxAmount = Number(data?.maxAmount) || 0;
        sellState.balance = Number(data?.balance) || 0;
        paintMainKeepList();
        spinBack(card, rail);
        if (fb) fb.innerHTML = '<div class="sell-error">' + (sellState.message || 'Eligibility failed — card returned.') + '</div>';
        showToast(sellState.message || 'Not eligible', 'error');
        sellState.submitting = false;
        return;
      }
      sellState.eligible = true;
      sellState.maxAmount = Number(data.maxAmount) || 0;
      sellState.balance = Number(data.balance) || 0;
      const payload = {
        amount: sellState.maxAmount,
        destination: upi,
        name: sellState.name || getStoredName() || undefined,
      };
      const { ok: ok2, data: data2 } = await walletApiCall('/withdraw', 'POST', payload);
      sellState.submitting = false;
      if (ok2 && data2?.success) {
        flyOut(card, wrap);
        sellState.savedUpiIds = (sellState.savedUpiIds || []).filter((x) => x !== upi);
        if (fb) {
          fb.innerHTML = '<div class="sell-success">Request of ' + formatINR(sellState.maxAmount) +
            ' submitted. Amount held until admin reviews.</div>';
        }
        showToast('Sell request submitted', 'success');
        if (typeof loadDashboard === 'function') loadDashboard();
        setTimeout(runEligibilityCheck, 700);
      } else {
        const msg = data2?.message || data2?.error?.message || 'Request failed';
        spinBack(card, rail);
        if (fb) fb.innerHTML = '<div class="sell-error">' + msg + '</div>';
        showToast(msg, 'error');
      }
    } catch (e) {
      sellState.submitting = false;
      spinBack(card, rail);
      showToast('Network error', 'error');
    }
  }

  function renderSuggestions() {
    const box = document.getElementById('sellSuggest');
    if (!box) return;
    const saved = new Set((sellState.savedUpiIds || []).map((x) => x.toLowerCase()));
    const chips = (sellState.suggestedUpiIds || []).filter((u) => !saved.has(String(u).toLowerCase())).slice(0, 6);
    if (!chips.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="sell-suggest-label">Suggestions from your mobile</div>' +
      chips.map((u) => '<button type="button" class="sell-chip" data-suggest="' + u + '">' + u + '</button>').join('');
    box.querySelectorAll('[data-suggest]').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.getElementById('sellUpiInput').value = el.getAttribute('data-suggest');
        onAddUpi();
      });
    });
  }

  async function onAddUpi() {
    const input = document.getElementById('sellUpiInput');
    const upi = (input?.value || '').trim().toLowerCase();
    if (!/^[a-z0-9._\-]{2,256}@[a-z]{2,64}$/.test(upi)) {
      showToast('Enter valid UPI (e.g. name@ybl)', 'error');
      return;
    }
    try {
      const { ok, data } = await walletApiCall('/upi', 'POST', { upiId: upi });
      if (ok && data?.success) {
        sellState.savedUpiIds = data.savedUpiIds || [];
        if (input) input.value = '';
        renderUpiList();
        showToast('UPI linked', 'success');
      } else showToast(data?.message || 'Could not save UPI', 'error');
    } catch (e) { showToast('Network error', 'error'); }
  }

  async function onDeleteUpi(upi) {
    try {
      const { ok, data } = await walletApiCall('/upi', 'DELETE', { upiId: upi });
      if (ok && data?.success) {
        sellState.savedUpiIds = data.savedUpiIds || [];
        renderUpiList();
        showToast('UPI removed', 'success');
      } else showToast(data?.message || 'Could not remove', 'error');
    } catch (e) { showToast('Network error', 'error'); }
  }

  window.openSellingWindow = function openSellingWindow() {
    ensureSellUI();
    const stored = getStoredName();
    if (stored) {
      sellState.name = stored;
      showSellStep('sellStepCheck');
      runEligibilityCheck();
    } else showSellStep('sellStepWelcome');
    showView('withdraw');
  };

  document.getElementById('sellBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openSellingWindow();
  });

  document.addEventListener('click', (e) => {
    const menu = e.target.closest && e.target.closest('#menuWithdraw');
    if (menu) {
      e.preventDefault();
      e.stopPropagation();
      openSellingWindow();
    }
  }, true);

  const obs = new MutationObserver(() => {
    const v = document.getElementById('withdrawView');
    if (v && v.classList.contains('active')) ensureSellUI();
  });
  if (document.getElementById('withdrawView')) {
    obs.observe(document.getElementById('withdrawView'), { attributes: true, attributeFilter: ['class'] });
  }
})();
