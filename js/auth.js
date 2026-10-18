/* PuppyPay v2 — Auth forms */

function applyAuthSuccess(data) {
  if (!data || !data.token) return;
  localStorage.setItem('puppypay_token', data.token);
  localStorage.setItem('puppypay_user', JSON.stringify(data.user || {}));
  try { document.documentElement.classList.add('has-token'); } catch (_) {}
  if (typeof populateUserUI === 'function') populateUserUI();
  try {
    var bal = document.getElementById('balanceAmount');
    if (bal && data.user && data.user.balance != null) {
      bal.textContent = (typeof formatINR === 'function') ? formatINR(data.user.balance) : ('\u20b9' + Number(data.user.balance));
    }
  } catch (_) {}
}

/** Capture ?ref=CODE from invite link → prefill register + remember */
function captureReferralFromUrl() {
  try {
    var params = new URLSearchParams(window.location.search || '');
    var ref = (params.get('ref') || params.get('referral') || params.get('code') || '').trim().toUpperCase();
    if (!ref && window.location.hash) {
      var h = String(window.location.hash).replace(/^#/, '');
      if (h.indexOf('ref=') >= 0 || h.indexOf('=') >= 0) {
        var hp = new URLSearchParams(h.indexOf('?') >= 0 ? h.split('?')[1] : h);
        ref = (hp.get('ref') || hp.get('referral') || '').trim().toUpperCase();
      }
    }
    if (ref && /^[A-Z0-9]{4,24}$/.test(ref)) {
      localStorage.setItem('puppypay_ref', ref);
    }
    var saved = (localStorage.getItem('puppypay_ref') || '').trim().toUpperCase();
    var input = document.getElementById('regReferralCode');
    if (input && saved && !String(input.value || '').trim()) input.value = saved;
    if (saved && !localStorage.getItem('puppypay_token')) {
      if (typeof showView === 'function') {
        setTimeout(function () { showView('register'); }, 80);
      }
    }
  } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', captureReferralFromUrl);
} else {
  captureReferralFromUrl();
}

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

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mobile = document.getElementById('regMobile').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const otp = document.getElementById('regOtp').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  let referralCode = (document.getElementById('regReferralCode')?.value || '').trim().toUpperCase();
  if (!referralCode) {
    try { referralCode = (localStorage.getItem('puppypay_ref') || '').trim().toUpperCase(); } catch (_) {}
  }

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  const { ok, data } = await apiCall('/register', {
    mobile, email, otp, password, confirmPassword, referralCode: referralCode || undefined
  });

  btn.disabled = false;
  btn.textContent = 'Create Account';

  if (ok && data.success) {
    try { localStorage.removeItem('puppypay_ref'); } catch (_) {}
    applyAuthSuccess(data);
    showToast(data.message || 'Account created!', 'success');
    setTimeout(() => showView('home'), 600);
  } else {
    showToast(data.message || 'Registration failed', 'error');
  }
});

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
