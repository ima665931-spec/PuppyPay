/* PuppyPay — App bootstrap */

(async function init() {
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
