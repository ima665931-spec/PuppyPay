/* PuppyPay — Selling window: swipe-to-sell + asset UPI logos */
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
    submitting: false,
  };

  function detectUpiBrand(upi) {
    const h = String(upi || '').toLowerCase().split('@')[1] || '';
    // PhonePe — ybl, ibl, axl are official PhonePe handles
    if (h === 'ybl' || h === 'ibl' || h === 'axl' || h === 'phonepe' || h.includes('phonepe')) return 'phonepe';
    // Google Pay
    if (['okaxis', 'oksbi', 'okhdfcbank', 'okicici', 'okyesbank', 'okindus', 'okkotak', 'google', 'gpay'].some((x) => h === x || h.startsWith(x))) return 'gpay';
    // Paytm
    if (h.includes('paytm') || h === 'pty' || h === 'ptys' || h.startsWith('pt')) return 'paytm';
    // Amazon Pay
    if (h.includes('apl') || h.includes('amazon') || h === 'yapl') return 'amazon';
    // MobiKwik
    if (h === 'mbk' || h.includes('mobikwik') || h.includes('ikwik') || h === 'mk') return 'mobikwik';
    // Freecharge
    if (h.includes('freecharge') || h === 'fchr') return 'freecharge';
    // Navi
    if (h.includes('navi')) return 'navi';
    // BHIM / banks
    if (h.includes('upi') || h.includes('axisbank') || h.includes('boi') || h.includes('sbi') || h.includes('pnb') || h.includes('icici') || h.includes('hdfcbank') || h.includes('yesbank') || h.includes('kotak') || h === 'bhim') return 'bhim';
    return 'generic';
  }

  function brandLabel(b) {
    if (b === 'phonepe') return 'PhonePe';
    if (b === 'gpay') return 'Google Pay';
    if (b === 'paytm') return 'Paytm';
    if (b === 'amazon') return 'Amazon Pay';
    if (b === 'bhim') return 'BHIM UPI';
    if (b === 'mobikwik') return 'MobiKwik';
    if (b === 'freecharge') return 'Freecharge';
    if (b === 'navi') return 'Navi';
    return 'UPI';
  }

  // Reliable inline SVGs when asset missing / broken (esp. PhonePe 747KB bad file)
  const BRAND_SVG = {
    phonepe:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">' +
      '<rect width="44" height="44" rx="12" fill="#5f259f"/>' +
      '<text x="22" y="28" text-anchor="middle" fill="#fff" font-size="15" font-weight="800" font-family="system-ui,sans-serif">Pe</text>' +
      '</svg>',
    gpay:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">' +
      '<rect width="44" height="44" rx="12" fill="#fff"/>' +
      '<text x="22" y="28" text-anchor="middle" fill="#4285F4" font-size="13" font-weight="800" font-family="system-ui,sans-serif">G</text>' +
      '</svg>',
  };

  const UPI_LOGO = {
    phonepe: 'assets/upi-phonepe.png',
    gpay: 'assets/upi-gpay.png',
    paytm: 'assets/upi-paytm.png',
    amazon: 'assets/upi-amazon.png',
    bhim: 'assets/upi-bhim.png',
    mobikwik: 'assets/upi-mobikwik.png',
    freecharge: 'assets/upi-freecharge.png',
    navi: 'assets/upi-navi.png',
    generic: 'assets/upi-default.png',
  };

  function brandLogo(b) {
    // PhonePe asset is oversized/wrong — always use clean purple SVG
    if (b === 'phonepe') {
      return BRAND_SVG.phonepe;
    }
    const src = UPI_LOGO[b] || UPI_LOGO.generic;
    const fallback = BRAND_SVG[b]
      ? "this.onerror=null;this.outerHTML='" + BRAND_SVG[b].replace(/'/g, "\\'") + "'"
      : "this.onerror=null;this.src='assets/upi-default.png'";
    return '<img src="' + src + '" alt="" width="44" height="44" onerror="' + fallback + '">';
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
    if (content.dataset.sellUi === '2') return true;

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

        <div id="sellFeedback"></div>
      </div>
    `;
    content.dataset.sellUi = '2';

    const nameEl = document.getElementById('sellNameInput');
    const existing = getStoredName();
    if (nameEl && existing) nameEl.value = existing;

    document.getElementById('sellContinueBtn')?.addEventListener('click', onSellContinue);
    document.getElementById('sellAddUpiBtn')?.addEventListener('click', onAddUpi);
    document.getElementById('sellUpiInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAddUpi();
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
            '<div class="sell-upi-logo">' + brandLogo(brand) + '</div>' +
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

    function unlock() {
      locked = false;
      sellState.submitting = false;
    }

    function onStart(clientX, clientY) {
      if (sellState.submitting || locked) return;
      active = true;
      startX = clientX; startY = clientY; dx = 0;
      card.classList.add('dragging');
      card.style.transition = 'none';
      card.style.transform = 'translateX(0) rotate(0deg)';
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
      card.style.transform = 'translateX(' + dx + 'px) rotate(0deg)';
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
        attemptSell(card, wrap, rail, unlock);
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
    card.style.transform = 'translateX(0) rotate(0deg)';
    if (rail) { rail.classList.remove('show'); rail.style.opacity = '0'; }
  }

  function spinBack(card, rail, onDone) {
    if (rail) { rail.classList.remove('show'); rail.style.opacity = '0'; }
    var m = (card.style.transform || '').match(/translateX\(([^)]+)\)/);
    var fromX = m ? m[1] : '0px';
    card.style.transition = 'none';
    card.style.transform = 'translateX(' + fromX + ') rotate(0deg)';
    void card.offsetWidth;
    card.style.transition = 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
    card.style.transform = 'translateX(0px) rotate(360deg)';
    setTimeout(function () {
      card.style.transition = 'none';
      card.style.transform = 'translateX(0px) rotate(0deg)';
      void card.offsetWidth;
      card.style.transition = '';
      if (typeof onDone === 'function') onDone();
    }, 720);
  }

  function flyOut(card, wrap) {
    card.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
    card.style.transform = 'translateX(120%) rotate(0deg)';
    card.style.opacity = '0';
    setTimeout(function () {
      if (wrap && wrap.parentNode) wrap.remove();
      var list = document.getElementById('sellUpiList');
      if (list && !list.querySelector('.sell-upi-wrap')) {
        list.innerHTML = '<div class="sell-empty">No UPI linked yet. Add one below.</div>';
      }
    }, 360);
  }

  async function attemptSell(card, wrap, rail, unlock) {
    var upi = card.getAttribute('data-card-upi');
    var fb = document.getElementById('sellFeedback');
    if (fb) fb.innerHTML = '';
    sellState.submitting = true;
    try {
      var res1 = await walletApiCall('/eligibility', 'GET');
      var ok = res1.ok, data = res1.data;
      if (!ok || !data || !data.success || !data.eligible || Number(data.maxAmount) < 100) {
        sellState.eligible = false;
        sellState.message = (data && data.message) || 'Not eligible';
        sellState.maxAmount = Number(data && data.maxAmount) || 0;
        sellState.balance = Number(data && data.balance) || 0;
        paintMainKeepList();
        spinBack(card, rail, unlock);
        if (fb) fb.innerHTML = '<div class="sell-error">' + (sellState.message || 'Eligibility failed — card returned.') + '</div>';
        showToast(sellState.message || 'Not eligible', 'error');
        return;
      }
      sellState.eligible = true;
      sellState.maxAmount = Number(data.maxAmount) || 0;
      sellState.balance = Number(data.balance) || 0;
      var payload = {
        amount: sellState.maxAmount,
        destination: upi,
        name: sellState.name || getStoredName() || undefined,
      };
      var res2 = await walletApiCall('/withdraw', 'POST', payload);
      var ok2 = res2.ok, data2 = res2.data;
      if (ok2 && data2 && data2.success) {
        sellState.submitting = false;
        flyOut(card, wrap);
        sellState.savedUpiIds = (sellState.savedUpiIds || []).filter(function (x) { return x !== upi; });
        if (fb) {
          fb.innerHTML = '<div class="sell-success">Request of ' + formatINR(sellState.maxAmount) +
            ' submitted. Amount held until admin reviews.</div>';
        }
        showToast('Sell request submitted', 'success');
        if (typeof loadDashboard === 'function') loadDashboard();
        setTimeout(runEligibilityCheck, 700);
      } else {
        var msg = (data2 && (data2.message || (data2.error && data2.error.message))) || 'Request failed';
        spinBack(card, rail, unlock);
        if (fb) fb.innerHTML = '<div class="sell-error">' + msg + '</div>';
        showToast(msg, 'error');
      }
    } catch (e) {
      spinBack(card, rail, unlock);
      showToast('Network error', 'error');
    }
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
