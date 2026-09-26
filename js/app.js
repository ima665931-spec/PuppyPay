/* PuppyPay app bootstrap */
(function () {
  // Premium in-app toast theme
  if (!document.querySelector('script[src*="toast-ui.js"]')) {
    var t = document.createElement('script');
    t.src = 'js/toast-ui.js';
    document.body.appendChild(t);
  }

  // Hide splash after short delay
  function hideSplash() {
    var splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(function () {
        if (splash.parentNode) splash.style.display = 'none';
      }, 450);
    }
  }

  function boot() {
    hideSplash();
    try {
      var token = localStorage.getItem('puppypay_token');
      if (token) {
        if (typeof showView === 'function') showView('home');
        if (typeof populateUserUI === 'function') populateUserUI();
        if (typeof loadDashboard === 'function') loadDashboard();
      } else {
        if (typeof showView === 'function') showView('login');
      }
    } catch (e) {
      if (typeof showView === 'function') showView('login');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(boot, 400);
    });
  } else {
    setTimeout(boot, 400);
  }
})();
