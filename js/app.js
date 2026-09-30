/* PuppyPay — App bootstrap */

(async function init() {
  // Premium in-app toast theme
  if (!document.querySelector('script[src*="toast-ui.js"]')) {
    var t = document.createElement('script');
    t.src = 'js/toast-ui.js';
    document.body.appendChild(t);
  }

  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref && /^[A-Z0-9]{4,16}$/i.test(ref)) {
      localStorage.setItem('puppypay_ref', ref.toUpperCase());
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    const stored = localStorage.getItem('puppypay_ref');
    if (stored) {
      const field = document.getElementById('regReferralCode');
      if (field && !field.value) field.value = stored;
    }
    if ((ref || stored) && !localStorage.getItem('puppypay_token')) {
      showView('register');
    }
  } catch (_) {}

  const token = localStorage.getItem('puppypay_token');
  if (token) {
    populateUserUI();
    showView('home');
    try {
      if (typeof loadDashboard === 'function') {
        await loadDashboard();
      } else {
        const { ok, data } = await walletApiCall('/dashboard', 'GET');
        if (ok && data && data.success) {
          /* loaded */
        } else if (data && data.code === 'TOKEN_FAILED') {
          handleAuthFailure(data);
        }
      }
    } catch (e) {}
  } else {
    showView('login');
  }
})();

window.addEventListener('load', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 450);
    }
  }, 900);
});

/* How to Earn guide (Orders) */
(function initHowEarn() {
  function openGuide() {
    if (document.getElementById('howEarnOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'howEarnOverlay';
    ov.className = 'how-earn-overlay';
    ov.innerHTML = `
      <div class="how-earn-sheet" role="dialog" aria-label="How to Earn">
        <h3>How to Earn with PuppyPay</h3>
        <p class="how-earn-sub">Follow these steps to complete orders and earn profit</p>
        <div class="how-earn-step">
          <div class="how-earn-num">1</div>
          <div class="how-earn-step-body">
            <div class="how-earn-step-title">Pick an order</div>
            <div class="how-earn-step-text">Open <b>Orders</b> → choose any available order and tap <b>Buy</b>. First order gets <b>+10%</b> extra profit.</div>
          </div>
        </div>
        <div class="how-earn-step">
          <div class="how-earn-num">2</div>
          <div class="how-earn-step-body">
            <div class="how-earn-step-title">Pay exact amount via UPI</div>
            <div class="how-earn-step-text">Note the exact amount shown. Open any UPI app (GPay, PhonePe, Paytm, etc.) and pay the <b>exact amount</b> to the given UPI ID / QR.</div>
          </div>
        </div>
        <div class="how-earn-step">
          <div class="how-earn-num">3</div>
          <div class="how-earn-step-body">
            <div class="how-earn-step-title">Submit UTR + screenshot</div>
            <div class="how-earn-step-text">Enter the 12-digit UTR and upload payment screenshot. We verify automatically.</div>
          </div>
        </div>
        <div class="how-earn-step">
          <div class="how-earn-num">4</div>
          <div class="how-earn-step-body">
            <div class="how-earn-step-title">Get profit in wallet</div>
            <div class="how-earn-step-text">After verification, order amount + profit is credited to your wallet.</div>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="howEarnClose">Got it</button>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    ov.querySelector('#howEarnClose').onclick = () => {
      ov.classList.remove('show');
      setTimeout(() => ov.remove(), 200);
    };
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.querySelector('#howEarnClose').click(); });
  }
  document.getElementById('howToEarnBtn')?.addEventListener('click', openGuide);
})();
