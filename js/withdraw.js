/* PuppyPay — Selling window (withdraw) */
(function () {
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
    if (['okaxis', 'oksbi', 'okhdfcbank', 'okicici', 'google'].some((x) => h.includes(x))) return 'gpay';
    if (h.includes('paytm') || h === 'ptys') return 'paytm';
    return 'generic';
  }

  function brandLabel(b) {
    if (b === 'phonepe') return 'PhonePe';
    if (b === 'gpay') return 'Google Pay';
    if (b === 'paytm') return 'Paytm';
    return 'UPI';
  }

  function brandInitials(b) {
    if (b === 'phonepe') return 'Pe';
    if (b === 'gpay') return 'G';
    if (b === 'paytm') return 'Pay';
    return 'UPI';
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
          <div class="sell-welcome-icon">💰</div>
          <h3>Welcome to PuppyPay Selling</h3>
          <p>Sell your wallet balance securely. Enter your name to continue.</p>
          <div class="sell-name-field">
            <label>Your name</label>
            <input type="text" id="sellNameInput" placeholder="Enter full name" autocomplete="name">
          </div>
          <button type="button" class="sell-btn-primary" id="sellContinueBtn">Continue</button>
        </div>
      </div>

      <div class="sell-step" id="sellStepCheck">
        <div class="sell-check">
          <div class="sell-check-spinner"></div>
          <h3>Checking withdrawal eligibility</h3>
          <p>Verifying first order & wallet balance…</p>
        </div>
      </div>

      <div class="sell-step" id="sellStepMain">
        <div class="sell-info-card" id="sellMaxCard">
          <div class="lbl">Max selling amount</div>
          <div class="val" id="sellMaxAmount">₹0</div>
          <div class="sub" id="sellMaxSub">Multiple of ₹100</div>
        </div>
        <div class="sell-info-card" id="sellEligCard">
          <div class="lbl">Eligibility</div>
          <div class="val" id="sellEligText" style="font-size:16px">—</div>
          <div class="sub" id="sellEligSub"></div>
        </div>

        <div class="sell-section-title">Your UPI IDs</div>
        <div class="sell-upi-list" id="sellUpiList"></div>

        <div class="sell-add-upi">
          <input type="text" id="sellUpiInput" placeholder="name@ybl" autocomplete="off">
          <button type="button" id="sellAddUpiBtn">Add</button>
        </div>
        <div class="sell-suggest" id="sellSuggest"></div>

        <div id="sellFeedback"></div>
      </div>
    `;
    content.dataset.sellUi = '1';

    // Prefill name
    try {
      const u = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      const nameEl = document.getElementById('sellNameInput');
      if (nameEl && u.name && u.name !== 'PuppyPay User') nameEl.value = u.name;
    } catch (_) {}

    document.getElementById('sellContinueBtn')?.addEventListener('click', onSellContinue);
    document.getElementById('sellAddUpiBtn')?.addEventListener('click', onAddUpi);
    document.getElementById('sellUpiInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAddUpi();
    });
    return true;
  }

  async function onSellContinue() {
    const name = (document.getElementById('sellNameInput')?.value || '').trim();
    if (name.length < 2) {
      showToast('Please enter your name', 'error');
      return;
    }
    sellState.name = name;
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
      if (data.name && !sellState.name) sellState.name = data.name;
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
    if (maxSub) maxSub.textContent = 'Wallet ' + formatINR(sellState.balance) + ' · multiple of ₹100';
    if (maxCard) {
      maxCard.classList.toggle('ok', sellState.maxAmount >= 100);
      maxCard.classList.toggle('bad', sellState.maxAmount < 100);
    }

    if (eligText) {
      eligText.textContent = sellState.eligible ? 'Eligible to sell' : 'Not eligible yet';
    }
    if (eligSub) eligSub.textContent = sellState.message || '';
    if (eligCard) {
      eligCard.classList.toggle('ok', sellState.eligible);
      eligCard.classList.toggle('bad', !sellState.eligible);
    }

    renderUpiList();
    renderSuggestions();
  }

  function renderUpiList() {
    const list = document.getElementById('sellUpiList');
    if (!list) return;
    const ids = sellState.savedUpiIds || [];
    if (!ids.length) {
      list.innerHTML = '<div class="sell-info-card" style="margin:0"><div class="sub" style="margin:0">No UPI added yet. Add one below or tap a suggestion.</div></div>';
      return;
    }
    list.innerHTML = ids.map((upi) => {
      const brand = detectUpiBrand(upi);
      const on = sellState.selectedUpi === upi ? ' on' : '';
      return (
        '<div class="sell-upi-card ' + brand + '">' +
          '<div class="sell-upi-logo">' + brandInitials(brand) + '</div>' +
          '<div class="sell-upi-body">' +
            '<div class="sell-upi-id">' + upi + '</div>' +
            '<div class="sell-upi-tag">' + brandLabel(brand) + '</div>' +
          '</div>' +
          '<div class="sell-toggle-wrap">' +
            '<button type="button" class="sell-toggle' + on + '" data-sell-upi="' + upi + '" aria-label="Toggle sell">' +
              '<span></span>' +
            '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('[data-sell-upi]').forEach((btn) => {
      btn.addEventListener('click', () => onToggleUpi(btn.getAttribute('data-sell-upi'), btn));
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
    box.innerHTML = chips.map((u) =>
      '<button type="button" class="sell-chip" data-suggest="' + u + '">' + u + '</button>'
    ).join('');
    box.querySelectorAll('[data-suggest]').forEach((el) => {
      el.addEventListener('click', () => {
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
        renderSuggestions();
        showToast('UPI saved', 'success');
      } else {
        showToast(data?.message || 'Could not save UPI', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  async function onToggleUpi(upi, btn) {
    if (sellState.submitting) return;

    // Turn off if already selected
    if (sellState.selectedUpi === upi) {
      sellState.selectedUpi = '';
      renderUpiList();
      return;
    }

    // Re-check eligibility before enabling
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
          fb.innerHTML = '<div class="sell-error">' + (sellState.message || 'Eligibility failed — toggle turned off.') + '</div>';
        }
        showToast(sellState.message || 'Not eligible', 'error');
        return;
      }

      sellState.eligible = true;
      sellState.maxAmount = Number(data.maxAmount) || 0;
      sellState.balance = Number(data.balance) || 0;
      sellState.selectedUpi = upi;
      paintMain();

      // Submit sell for max amount
      if (sellState.maxAmount < 100) {
        sellState.selectedUpi = '';
        renderUpiList();
        if (fb) fb.innerHTML = '<div class="sell-error">Max sellable amount is below ₹100.</div>';
        return;
      }

      sellState.submitting = true;
      const { ok: ok2, data: data2 } = await walletApiCall('/withdraw', 'POST', {
        amount: sellState.maxAmount,
        destination: upi,
      });
      sellState.submitting = false;

      if (ok2 && data2?.success) {
        if (fb) {
          fb.innerHTML =
            '<div class="sell-success">Sell request of ' +
            formatINR(sellState.maxAmount) +
            ' submitted. Amount held until admin reviews.</div>';
        }
        showToast('Sell request submitted!', 'success');
        sellState.selectedUpi = '';
        if (typeof loadDashboard === 'function') loadDashboard();
        // Refresh eligibility after deduct
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
    showSellStep('sellStepWelcome');
    showView('withdraw');
  };

  // Hook Sell button + menu withdraw
  document.getElementById('sellBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openSellingWindow();
  });

  // When navigating to withdraw via menu
  const origShow = window.showView;
  // Don't wrap showView — use event on menu
  document.addEventListener('click', (e) => {
    const menu = e.target.closest && e.target.closest('#menuWithdraw');
    if (menu) {
      e.preventDefault();
      e.stopPropagation();
      openSellingWindow();
    }
  }, true);

  // Ensure UI ready when withdraw view shown
  const obs = new MutationObserver(() => {
    const v = document.getElementById('withdrawView');
    if (v && v.classList.contains('active')) ensureSellUI();
  });
  if (document.getElementById('withdrawView')) {
    obs.observe(document.getElementById('withdrawView'), { attributes: true, attributeFilter: ['class'] });
  }
})();
