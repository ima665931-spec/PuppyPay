/* PuppyPay v2 — API Layer */
const API_BASE = 'https://puppy-pay-backend.vercel.app/api/auth';
const WALLET_API_BASE = 'https://puppy-pay-backend.vercel.app/api/wallet';

let authRedirectInProgress = false;

function isAuthFailure(status, data) {
  // ONLY logout on explicit token failure — not on every 401 (login invalid creds, rate limit, etc.)
  if (data && (data.code === 'TOKEN_FAILED' || data.code === 'NO_TOKEN' || data.code === 'NOT_AUTHORIZED')) {
    return true;
  }
  const message = String((data && (data.message || (data.error && data.error.message))) || '');
  // Real token failures from backend
  if (status === 401 && /token failed|no token|user not found|not authorized, token/i.test(message)) {
    return true;
  }
  return false;
}

function handleAuthFailure(data) {
  localStorage.removeItem('puppypay_token');
  localStorage.removeItem('puppypay_user');
  window.__dashboard = null;
  window.__dashboardHistory = null;
  try { document.documentElement.classList.remove('has-token'); } catch (_) {}
  if (!authRedirectInProgress) {
    authRedirectInProgress = true;
    if (typeof showView === 'function') showView('login');
    if (typeof showToast === 'function') showToast('Session ended. Please log in again.', 'error');
    setTimeout(() => { authRedirectInProgress = false; }, 800);
  }
  return { ...(data || {}), success: false, code: 'TOKEN_FAILED', status: 401 };
}

window.__puppypayHandleAuthFailure = handleAuthFailure;

function maybeLock(status, data) {
  if (!data) return false;
  var code = data.code || '';

  if (code === 'USER_KILLED' || (status === 403 && /not available right now/i.test(String(data.message || '')))) {
    try {
      localStorage.removeItem('puppypay_token');
      localStorage.removeItem('puppypay_user');
    } catch (_) {}
    if (typeof window.__puppypayShowPersonalKill === 'function') {
      window.__puppypayShowPersonalKill();
    } else if (typeof window.__puppypayShowKillOverlay === 'function') {
      window.__puppypayShowKillOverlay();
    }
    return true;
  }

  if (code === 'ACCOUNT_SUSPENDED') {
    try {
      localStorage.removeItem('puppypay_token');
      localStorage.removeItem('puppypay_user');
    } catch (_) {}
    window.__dashboard = null;
    if (typeof showView === 'function') showView('login');
    if (typeof showToast === 'function') {
      showToast(data.message || 'Your account has been suspended. Contact support.', 'error');
    }
    return true;
  }

  if (window.__puppypayHandleApiLock && window.__puppypayHandleApiLock(status, data)) return true;
  return false;
}

async function apiCall(path, body) {
  try {
    const res = await fetchWithTimeout(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 25000);
    let data;
    try { data = await res.json(); } catch (e) { data = { success: false, message: 'Server error' }; }
    maybeLock(res.status, data);
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, data: { success: false, message: 'Network error. Check connection.' } };
  }
}

async function fetchWithTimeout(url, options, ms) {
  ms = ms || 25000;
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, ms) : null;
  try {
    var opts = Object.assign({}, options || {});
    if (ctrl) opts.signal = ctrl.signal;
    return await fetch(url, opts);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function walletApiCall(path, method, body) {
  method = method || 'GET';
  const token = localStorage.getItem('puppypay_token');
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  };
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var res = await fetchWithTimeout(WALLET_API_BASE + path, options, 25000);
      var data;
      try { data = await res.json(); } catch (e) { data = { success: false, message: 'Invalid server response.' }; }
      if (maybeLock(res.status, data)) return { ok: false, data: data };
      // 503 DB busy — do NOT logout, just fail this call
      if (res.status === 503 || (data && data.code === 'DB_UNAVAILABLE')) {
        return { ok: false, data: data };
      }
      if (isAuthFailure(res.status, data)) data = handleAuthFailure(data);
      return { ok: res.ok, data: data };
    } catch (e) {
      if (attempt < 2) await new Promise(function (r) { setTimeout(r, attempt === 0 ? 800 : 2000); });
    }
  }
  return { ok: false, data: { success: false, code: 'NETWORK_ERROR', message: 'Could not reach PuppyPay. Pull to refresh.' } };
}
window.__puppypayWalletApiCall = walletApiCall;

function startCooldown(btn, seconds) {
  btn.disabled = true;
  let secs = seconds;
  const original = btn.textContent;
  btn.textContent = secs + 's';
  const timer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = original;
    } else {
      btn.textContent = secs + 's';
    }
  }, 1000);
}
