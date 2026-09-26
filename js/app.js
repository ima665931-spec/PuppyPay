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
      const { ok, data } = await walletApiCall('/dashboard', 'GET');
      if (ok && data?.success) {
      } else if (data?.code === 'TOKEN_FAILED') {
        handleAuthFailure(data);
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
            <div class="how-earn-step-title">Screenshot the payment</div>
            <div class="how-earn-step-text">After successful payment, take a clear <b>screenshot</b> of the transaction success screen.</div>
          </div>
        </div>
        <div class="how-earn-step">
          <div class="how-earn-num">4</div>
          <div class="how-earn-step-body">
            <div class="how-earn-step-title">Copy UTR / Reference</div>
            <div class="how-earn-step-text">Copy the <b>UTR / UPI reference number</b> from the payment confirmation.</div>
          </div>
        </div>
        <div class="how-earn-step">
          <div class="how-earn-num">5</div>
          <div class="how-earn-step-body">
            <div class="how-earn-step-title">Submit proof in app</div>
            <div class="how-earn-step-text">Back in PuppyPay: paste the <b>UTR</b>, upload the <b>transaction screenshot</b>, and submit. Wait for approval — profit is added to your wallet.</div>
          </div>
        </div>
        <div class="how-earn-tip">💡 Tip: Always pay the exact amount. Wrong amount or blurry screenshots can delay approval.</div>
        <button type="button" class="btn btn-primary how-earn-close" id="howEarnClose">Got it</button>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.id === 'howEarnClose') closeGuide();
    });
  }
  function closeGuide() {
    const ov = document.getElementById('howEarnOverlay');
    if (ov) ov.remove();
  }
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('#howEarnBtn');
    if (btn) openGuide();
  });
})();
