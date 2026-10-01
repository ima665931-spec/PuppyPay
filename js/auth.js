/* PuppyPay v2 — Auth forms */

function applyAuthSuccess(data) {
  if (!data || !data.token) return;
  localStorage.setItem('puppypay_token', data.token);
  localStorage.setItem('puppypay_user', JSON.stringify(data.user || {}));
  try { document.documentElement.classList.add('has-token'); } catch (_) {}
  if (typeof populateUserUI === 'function') populateUserUI();
  // Immediately show balance from login response (don't wait for dashboard)
  try {
    var bal = document.getElementById('balanceAmount');
    if (bal && data.user && data.user.balance != null) {
      bal.textContent = (typeof formatINR === 'function') ? formatINR(data.user.balance) : ('\u20b9' + Number(data.user.balance));
    }
  } catch (_) {}
}

// Send OTP (register)
document.getElementById('sendOtpBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('regEmail').value.trim();
  const btn = document.getElementById('sendOtpBtn');
  if (!email) { showToast('Enter your email first'); return; }
  btn.disabled = true;
  btn.textContent = 'Sending...';
  const { ok, data } = await apiCall('/send-otp', { email });
  if (ok && data.success) {
    showToast('OTP sent to ' + email, 'success');
    startCooldown(btn, 30);
  } else {
    showToast(data.message || 'Failed to send OTP', 'error');
    btn.disabled = false;
    btn.textContent = 'SEND OTP';
  }
});

// Register
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mobile = document.getElementById('regMobile').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const otp = document.getElementById('regOtp').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const referralCode = (document.getElementById('regReferralCode')?.value || '').trim().toUpperCase();

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  const { ok, data } = await apiCall('/register', {
    mobile, email, otp, password, confirmPassword, referralCode
  });

  btn.disabled = false;
  btn.textContent = 'Create Account';

  if (ok && data.success) {
    applyAuthSuccess(data);
    showToast(data.message || 'Account created!', 'success');
    setTimeout(() => showView('home'), 600);
  } else {
    showToast(data.message || 'Registration failed', 'error');
  }
});

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginId = document.getElementById('loginId').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  const { ok, data } = await apiCall('/login', { loginId, password });

  btn.disabled = false;
  btn.textContent = 'Log In';

  if (ok && data.success) {
    applyAuthSuccess(data);
    showToast('Welcome back!', 'success');
    setTimeout(() => showView('home'), 400);
  } else {
    if (data && (data.code === 'USER_KILLED' || data.code === 'APP_DEAD')) return;
    showToast(data.message || 'Invalid credentials', 'error');
  }
});

// Forgot OTP
document.getElementById('sendForgotOtpBtn')?.addEventListener('click', async () => {
  const id = document.getElementById('forgotId').value.trim();
  const btn = document.getElementById('sendForgotOtpBtn');
  if (!id) { showToast('Enter mobile or email first'); return; }
  btn.disabled = true;
  btn.textContent = 'Sending...';
  const { ok, data } = await apiCall('/forgot/send-otp', { loginId: id });
  if (ok && data.success) {
    showToast('If account exists, OTP has been sent', 'success');
    startCooldown(btn, 30);
  } else {
    showToast(data.message || 'Failed to send OTP', 'error');
    btn.disabled = false;
    btn.textContent = 'SEND OTP';
  }
});

// Forgot reset
document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginId = document.getElementById('forgotId').value.trim();
  const otp = document.getElementById('forgotOtp').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;

  if (newPassword !== confirmNewPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Resetting...';

  const { ok, data } = await apiCall('/forgot/reset', {
    loginId, otp, newPassword, confirmNewPassword
  });

  btn.disabled = false;
  btn.textContent = 'Reset Password';

  if (ok && data.success) {
    showToast('Password reset! Please log in.', 'success');
    setTimeout(() => showView('login'), 1200);
  } else {
    showToast(data.message || 'Reset failed', 'error');
  }
});

/* ——— Google Sign-In ——— */
(function initGoogleAuth() {
  function ensureGoogleBtn(parentSelector) {
    var parent = document.querySelector(parentSelector);
    if (!parent || parent.querySelector('.google-auth-btn')) return;
    var wrap = document.createElement('div');
    wrap.className = 'google-auth-wrap';
    wrap.style.cssText = 'margin-top:14px;text-align:center;';
    wrap.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin:12px 0;opacity:.7">' +
        '<span style="flex:1;height:1px;background:rgba(255,255,255,.2)"></span>' +
        '<span style="font-size:12px">or</span>' +
        '<span style="flex:1;height:1px;background:rgba(255,255,255,.2)"></span>' +
      '</div>' +
      '<button type="button" class="btn btn-secondary btn-block google-auth-btn" style="display:flex;align-items:center;justify-content:center;gap:10px">' +
        '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.5-.4-3.5z"/></svg>' +
        'Continue with Google' +
      '</button>';
    parent.appendChild(wrap);
    wrap.querySelector('.google-auth-btn').addEventListener('click', onGoogleClick);
  }

  async function onGoogleClick() {
    var clientId = null;
    try {
      var res = await fetch('https://puppy-pay-backend.vercel.app/api/auth/google-config');
      var j = await res.json();
      if (j && j.enabled && j.clientId) clientId = j.clientId;
    } catch (e) {}
    if (!clientId) {
      showToast('Google login not configured yet.', 'error');
      return;
    }
    if (!window.google || !window.google.accounts) {
      await new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async function (resp) {
        if (!resp || !resp.credential) {
          showToast('Google sign-in cancelled', 'error');
          return;
        }
        showToast('Signing in with Google...');
        var { ok, data } = await apiCall('/google', { idToken: resp.credential });
        if (ok && data && data.success) {
          applyAuthSuccess(data);
          showToast(data.message || 'Welcome!', 'success');
          setTimeout(function () { showView('home'); }, 400);
        } else {
          showToast((data && data.message) || 'Google sign-in failed', 'error');
        }
      },
    });
    window.google.accounts.id.prompt();
  }

  function boot() {
    ensureGoogleBtn('#loginView .auth-card');
    ensureGoogleBtn('#registerView .auth-card');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
