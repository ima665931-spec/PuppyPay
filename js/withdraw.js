/* PuppyPay — Selling window (withdraw) */
(function () {
  const NAME_KEY = 'puppypay_sell_name';

  let sellState = {
    name: '',
    eligible: false,
    maxAmount: 0,
    balance: 0,
    firstOrderDone: false,
    message: '',
    savedUpiIds: [],
    suggestedUpiIds: [],
    selectedUpi: '',
    submitting: false,
  };

  function detectUpiBrand(upi) {
    const h = String(upi || '').toLowerCase().split('@')[1] || '';
    if (['ybl', 'ibl', 'axl', 'phonepe'].some((x) => h.includes(x))) return 'phonepe';
    if (['okaxis', 'oksbi', 'okhdfcbank', 'okicici', 'okyesbank', 'google'].some((x) => h.includes(x))) return 'gpay';
    if (h.includes('paytm') || h === 'ptys' || h === 'paytm') return 'paytm';
    if (h.includes('upi') || h.includes('apl') || h.includes('axisbank')) return 'bhim';
    return 'generic';
  }

  function brandLabel(b) {
    if (b === 'phonepe') return 'PhonePe';
    if (b === 'gpay') return 'Google Pay';
    if (b === 'paytm') return 'Paytm';
    if (b === 'bhim') return 'BHIM UPI';
    return 'UPI';
  }

  /* Minimal flat SVG marks — no cartoon fill */
  function brandSvg(b) {
    if (b === 'phonepe') {
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 12.5l2 2 4-4"/></svg>';
    }
    if (b === 'gpay') {
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>';
    }
    if (b === 'paytm') {
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h10M12 9v6"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>';
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
    // Suggestions only when focusing the input
    document.getElementById('sellUpiInput')?.addEventListener('focus', () => {
      const box = document.getElementById('sellSuggest');
      if (box) {
        box.hidden = false;
        renderSuggestions();
      }
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
    if (name.length < 2) {
      showToast('Please enter your full name', 'error');
      return;
    }
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

    if (eligText) {
      eligText.textContent = sellState.eligible ? 'Eligible' : 'Not eligible';
    }
    if (eligSub) eligSub.textContent = sellState.message || '';
    if (eligCard) {
      eligCard.classList.toggle('ok', sellState.eligible);
      eligCard.classList.toggle('bad', !sellState.eligible);
    }

    renderUpiList();
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
      const on = sellState.selectedUpi === upi ? ' on' : '';
      return (
        '<div class="sell-upi-card ' + brand + '">' +
          '<div class="sell-upi-logo">' + brandSvg(brand) + '</div>' +
          '<div class="sell-upi-body">' +
            '<div class="sell-upi-id">' + upi + '</div>' +
            '<div class="sell-upi-tag">' + brandLabel(brand) + '</div>' +
          '</div>' +
          '<div class="sell-upi-actions">' +
            '<button type="button" class="sell-toggle' + on + '" data-sell-upi="' + upi + '" aria-label="Sell to this UPI"><span></span></button>' +
            '<button type="button" class="sell-upi-del" data-del-upi="' + upi + '" title="Remove">×</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('[data-sell-upi]').forEach((btn) => {
      btn.addEventListener('click', () => onToggleUpi(btn.getAttribute('data-sell-upi'), btn));
    });
    list.querySelectorAll('[data-del-upi]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteUpi(btn.getAttribute('data-del-upi'));
      });
    });
  }

  function renderSuggestions() {
    const box = document.getElementById('sellSuggest');
    if (!box) return;
    const saved = new Set((sellState.savedUpiIds || []).map((x) => x.toLowerCase()));
    const chips = (sellState.suggestedUpiIds || []).filter((u) => !saved.has(String(u).toLowerCase())).slice(0, 6);
    if (!chips.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = '<div class="sell-suggest-label">Suggestions from your mobile</div>' +
      chips.map((u) =>
        '<button type="button" class="sell-chip" data-suggest="' + u + '">' + u + '</button>'
      ).join('');
    box.querySelectorAll('[data-suggest]').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const upi = el.getAttribute('data-suggest');
        document.getElementById('sellUpiInput').value = upi;
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
      } else {
        showToast(data?.message || 'Could not save UPI', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  async function onDeleteUpi(upi) {
    try {
      const { ok, data } = await walletApiCall('/upi', 'DELETE', { upiId: upi });
      if (ok && data?.success) {
        sellState.savedUpiIds = data.savedUpiIds || [];
        if (sellState.selectedUpi === upi) sellState.selectedUpi = '';
        renderUpiList();
        showToast('UPI removed', 'success');
      } else {
        showToast(data?.message || 'Could not remove', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  async function onToggleUpi(upi, btn) {
    if (sellState.submitting) return;

    if (sellState.selectedUpi === upi) {
      sellState.selectedUpi = '';
      renderUpiList();
      return;
    }

    btn.disabled = true;
    const fb = document.getElementById('sellFeedback');
    if (fb) fb.innerHTML = '';

    try {
      const { ok, data } = await walletApiCall('/eligibility', 'GET');
      if (!ok || !data?.success || !data.eligible) {
        sellState.selectedUpi = '';
        sellState.eligible = false;
        sellState.message = data?.message || 'Not eligible';
        sellState.maxAmount = Number(data?.maxAmount) || 0;
        paintMain();
        if (fb) {
          fb.innerHTML = '<div class="sell-error">' + (sellState.message || 'Eligibility failed.') + '</div>';
        }
        showToast(sellState.message || 'Not eligible', 'error');
        return;
      }

      sellState.eligible = true;
      sellState.maxAmount = Number(data.maxAmount) || 0;
      sellState.balance = Number(data.balance) || 0;
      sellState.selectedUpi = upi;
      paintMain();

      if (sellState.maxAmount < 100) {
        sellState.selectedUpi = '';
        renderUpiList();
        if (fb) fb.innerHTML = '<div class="sell-error">Max sellable amount is below ₹100.</div>';
        return;
      }

      sellState.submitting = true;
      const payload = {
        amount: sellState.maxAmount,
        destination: upi,
        name: sellState.name || getStoredName() || undefined,
      };
      const { ok: ok2, data: data2 } = await walletApiCall('/withdraw', 'POST', payload);
      sellState.submitting = false;

      if (ok2 && data2?.success) {
        if (fb) {
          fb.innerHTML =
            '<div class="sell-success">Request of ' +
            formatINR(sellState.maxAmount) +
            ' submitted. Amount held until admin reviews.</div>';
        }
        showToast('Sell request submitted', 'success');
        sellState.selectedUpi = '';
        if (typeof loadDashboard === 'function') loadDashboard();
        setTimeout(runEligibilityCheck, 600);
      } else {
        sellState.selectedUpi = '';
        renderUpiList();
        const msg = data2?.message || data2?.error?.message || 'Request failed';
        if (fb) fb.innerHTML = '<div class="sell-error">' + msg + '</div>';
        showToast(msg, 'error');
      }
    } catch (e) {
      sellState.submitting = false;
      sellState.selectedUpi = '';
      renderUpiList();
      showToast('Network error', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  window.openSellingWindow = function openSellingWindow() {
    ensureSellUI();
    const stored = getStoredName();
    if (stored) {
      sellState.name = stored;
      showSellStep('sellStepCheck');
      runEligibilityCheck();
    } else {
      showSellStep('sellStepWelcome');
    }
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
