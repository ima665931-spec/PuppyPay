/* PuppyPay v2 — API Layer */
const API_BASE = 'https://puppy-pay-backend.vercel.app/api/auth';
const WALLET_API_BASE = 'https://puppy-pay-backend.vercel.app/api/wallet';

let authRedirectInProgress = false;

function isAuthFailure(status, data) {
  const message = String((data && (data.message || (data.error && data.error.message))) || '');
  return status === 401 ||
    (data && (data.code === 'TOKEN_FAILED' || data.code === 'NOT_AUTHORIZED')) ||
    /not authorized|token failed|unauthorized|session has ended/i.test(message);
}

function handleAuthFailure(data) {
  localStorage.removeItem('puppypay_token');
  localStorage.removeItem('puppypay_user');
  window.__dashboard = null;
  window.__dashboardHistory = null;
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
  if (window.__puppypayHandleApiLock && window.__puppypayHandleApiLock(status, data)) return true;
  return false;
}

async function apiCall(path, body) {
  try {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    let data;
    try { data = await res.json(); } catch (e) { data = { success: false, message: 'Server error' }; }
    maybeLock(res.status, data);
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, data: { success: false, message: 'Network error. Check connection.' } };
  }
}

async function walletApiCall(path, method = 'GET', body) {
  const token = localStorage.getItem('puppypay_token');
  let res;
  try {
    res = await fetch(WALLET_API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    return { ok: false, data: { success: false, code: 'NETWORK_ERROR', message: 'Could not reach PuppyPay.' } };
  }
  let data;
  try { data = await res.json(); } catch (e) { data = { success: false, message: 'Invalid server response.' }; }
  if (maybeLock(res.status, data)) return { ok: false, data };
  if (isAuthFailure(res.status, data)) data = handleAuthFailure(data);
  return { ok: res.ok, data };
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
