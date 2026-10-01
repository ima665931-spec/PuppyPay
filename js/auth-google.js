/* PuppyPay — Google Sign-In (login + register) */
(function () {
  var GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
  var clientId = null;
  var gisReady = false;
  var initStarted = false;

  function setBusy(busy) {
    document.querySelectorAll('.google-auth-wrap').forEach(function (w) {
      w.classList.toggle('busy', !!busy);
    });
  }

  async function handleCredentialResponse(response) {
    if (!response || !response.credential) {
      if (typeof showToast === 'function') showToast('Google sign-in cancelled', 'error');
      return;
    }
    setBusy(true);
    try {
      var referralCode = '';
      try {
        referralCode = (document.getElementById('regReferralCode') && document.getElementById('regReferralCode').value) ||
          localStorage.getItem('puppypay_ref') || '';
      } catch (_) {}
      referralCode = String(referralCode || '').trim().toUpperCase();

      var result = await apiCall('/google', {
        idToken: response.credential,
        referralCode: referralCode || undefined,
      });
      var ok = result.ok;
      var data = result.data;

      if (ok && data && data.success) {
        try {
          localStorage.setItem('puppypay_token', data.token);
          localStorage.setItem('puppypay_user', JSON.stringify(data.user));
          document.documentElement.classList.add('has-token');
        } catch (_) {}
        if (typeof populateUserUI === 'function') populateUserUI();
        if (typeof showToast === 'function') {
          showToast(data.message || 'Welcome!', 'success');
        }
        setTimeout(function () {
          if (typeof showView === 'function') showView('home');
        }, 400);
      } else {
        if (data && (data.code === 'USER_KILLED' || data.code === 'APP_DEAD' || data.code === 'ACCOUNT_SUSPENDED')) {
          /* handled by api layer */
        } else if (typeof showToast === 'function') {
          showToast((data && data.message) || 'Google sign-in failed', 'error');
        }
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Network error. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function renderButtons() {
    if (!gisReady || !clientId || typeof google === 'undefined' || !google.accounts || !google.accounts.id) return;

    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    [
      { id: 'googleLoginBtn', text: 'signin_with' },
      { id: 'googleRegisterBtn', text: 'signup_with' },
    ].forEach(function (cfg) {
      var el = document.getElementById(cfg.id);
      if (!el) return;
      el.innerHTML = '';
      var width = 280;
      try {
        var parent = el.closest('.auth-card') || el.parentElement;
        if (parent) width = Math.min(320, Math.max(240, parent.clientWidth - 40));
      } catch (_) {}
      try {
        google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: cfg.text,
          shape: 'pill',
          logo_alignment: 'left',
          width: width,
        });
      } catch (e) {
        el.innerHTML = '<button type="button" class="btn-google">Continue with Google</button>';
        var btn = el.querySelector('button');
        if (btn) btn.onclick = function () { try { google.accounts.id.prompt(); } catch (_) {} };
      }
    });
  }

  function loadGisScript() {
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      gisReady = typeof google !== 'undefined' && !!(google.accounts && google.accounts.id);
      if (gisReady) renderButtons();
      else {
        var check = setInterval(function () {
          if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            clearInterval(check);
            gisReady = true;
            renderButtons();
          }
        }, 100);
        setTimeout(function () { clearInterval(check); }, 8000);
      }
      return;
    }
    var s = document.createElement('script');
    s.src = GOOGLE_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = function () {
      gisReady = true;
      renderButtons();
    };
    document.head.appendChild(s);
  }

  async function initGoogleAuth() {
    if (initStarted) return;
    initStarted = true;
    var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : 'https://puppy-pay-backend.vercel.app/api/auth';
    try {
      var res = await fetch(base + '/google-config');
      var data = await res.json();
      if (!data || !data.enabled || !data.clientId) {
        document.querySelectorAll('.google-auth-wrap').forEach(function (w) {
          w.style.display = 'none';
        });
        return;
      }
      clientId = data.clientId;
      document.querySelectorAll('.google-auth-wrap').forEach(function (w) {
        w.style.display = '';
      });
      loadGisScript();
    } catch (e) {
      document.querySelectorAll('.google-auth-wrap').forEach(function (w) {
        w.style.display = 'none';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initGoogleAuth, 200); });
  } else {
    setTimeout(initGoogleAuth, 200);
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('#goToLogin, #goToRegister, #backToLogin');
    if (t) setTimeout(renderButtons, 350);
  });
})();
