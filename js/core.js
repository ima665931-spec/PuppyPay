/* PuppyPay v2 — Core utilities & navigation */

var __navStack = [];
var __navLock = false;

function showToast(msg, type) {
  type = type || '';
  var el = document.getElementById('ppToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ppToast';
    el.className = 'pp-toast';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div class="pp-toast-inner ' + (type || '') + '">' +
    (type === 'success' ? '<span class="pp-toast-icon">✓</span>' : type === 'error' ? '<span class="pp-toast-icon">!</span>' : '') +
    '<span class="pp-toast-msg">' + String(msg || '') + '</span></div>';
  el.className = 'pp-toast show';
  clearTimeout(el._timer);
  el._timer = setTimeout(function () { el.classList.remove('show'); }, 2800);
}

function showAppModal(opts) {
  opts = opts || {};
  var existing = document.getElementById('ppModal');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'ppModal';
  overlay.className = 'pp-modal-overlay';
  overlay.innerHTML = '<div class="pp-modal">' +
    (opts.title ? '<div class="pp-modal-title">' + opts.title + '</div>' : '') +
    '<div class="pp-modal-body">' + (opts.body || '') + '</div>' +
    '<div class="pp-modal-actions">' +
      (opts.cancelText ? '<button type="button" class="btn btn-secondary pp-modal-cancel">' + opts.cancelText + '</button>' : '') +
      '<button type="button" class="btn btn-primary pp-modal-ok">' + (opts.okText || 'OK') + '</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function () { overlay.classList.add('show'); });
  return new Promise(function (resolve) {
    function close(val) {
      overlay.classList.remove('show');
      setTimeout(function () { overlay.remove(); }, 200);
      resolve(val);
    }
    overlay.querySelector('.pp-modal-ok').addEventListener('click', function () { close(true); });
    var cancel = overlay.querySelector('.pp-modal-cancel');
    if (cancel) cancel.addEventListener('click', function () { close(false); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });
  });
}

function getActiveViewName() {
  var active = document.querySelector('.view.active');
  if (!active || !active.id) return 'home';
  return active.id.replace(/View$/, '');
}

function showView(name, opts) {
  opts = opts || {};
  var from = getActiveViewName();
  var mainTabs = ['home', 'team', 'orders', 'mine'];
  var authTabs = ['login', 'register', 'forgot'];

  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  var target = document.getElementById(name + 'View') || document.getElementById(name);
  if (target) {
    target.classList.add('active');
    target.scrollTop = 0;
    var pc = target.querySelector('.page-content');
    if (pc) pc.scrollTop = 0;
  }

  var nav = document.getElementById('bottomNav');
  var fab = document.getElementById('supportFab');
  if (nav) {
    if (mainTabs.indexOf(name) >= 0) {
      nav.style.display = 'flex';
      nav.querySelectorAll('.nav-item').forEach(function (item) {
        item.classList.toggle('active', item.dataset.view === name);
      });
    } else {
      nav.style.display = 'none';
    }
  }
  if (fab) fab.style.display = name === 'home' ? 'flex' : 'none';

  var stickyInvite = document.getElementById('refStickyInvite');
  if (stickyInvite) stickyInvite.classList.toggle('show', name === 'team');

  // Navigation stack for Android/hardware back
  if (!opts.skipStack && !__navLock) {
    if (mainTabs.indexOf(name) >= 0) {
      __navStack = [name];
    } else if (authTabs.indexOf(name) >= 0) {
      __navStack = [name];
    } else {
      if (__navStack[__navStack.length - 1] !== name) {
        if (__navStack.length === 0) __navStack.push(from && mainTabs.indexOf(from) >= 0 ? from : 'mine');
        __navStack.push(name);
      }
    }
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({ ppView: name, stack: __navStack.slice() }, '', '#' + name);
      }
    } catch (_) {}
  }

  if (name === 'home' && typeof loadDashboard === 'function') loadDashboard();
  if (name === 'team' && typeof loadReferrals === 'function') loadReferrals();
  if (name === 'history') {
    if (typeof loadFilteredHistory === 'function' && window.__historyKind) loadFilteredHistory(window.__historyKind);
    else if (typeof loadHistory === 'function') loadHistory();
  }
  if (name === 'withdraw' && typeof checkEligibility === 'function') checkEligibility();
  if (name === 'bonus' && typeof loadBonusStatus === 'function') loadBonusStatus();
  if (name === 'notifications') {
    if (typeof updateNotifPermissionUI === 'function') updateNotifPermissionUI();
    if (typeof renderNotifications === 'function') renderNotifications();
  }
  if (name === 'mine' && typeof applyAvatars === 'function') applyAvatars();

  if (name === 'home') startHomeAutoRefresh();
  else stopHomeAutoRefresh();

  if (name === 'orders') {
    if (typeof startOrdersAutoRefresh === 'function') startOrdersAutoRefresh();
  } else {
    if (typeof stopOrdersAutoRefresh === 'function') stopOrdersAutoRefresh();
  }
}

function goBack() {
  if (__navStack.length > 1) {
    __navStack.pop();
    var prev = __navStack[__navStack.length - 1] || 'home';
    __navLock = true;
    showView(prev, { skipStack: true });
    __navLock = false;
    return true;
  }
  var cur = getActiveViewName();
  var mainTabs = ['home', 'team', 'orders', 'mine'];
  if (mainTabs.indexOf(cur) < 0) {
    showView('mine', { skipStack: true });
    __navStack = ['mine'];
    return true;
  }
  return false;
}

// Android / browser hardware back
window.addEventListener('popstate', function (e) {
  if (goBack()) {
    // stayed in app
  }
});

// Event delegation for ALL back buttons (works for dynamically created views)
document.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('[data-back]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  var dest = btn.getAttribute('data-back') || 'mine';
  showView(dest);
}, true);

let homeRefreshTimer = null;
function startHomeAutoRefresh() {
  stopHomeAutoRefresh();
  homeRefreshTimer = setInterval(function () {
    var home = document.getElementById('homeView');
    if (home && home.classList.contains('active') && typeof loadDashboard === 'function') loadDashboard();
    else stopHomeAutoRefresh();
  }, 30000);
}
function stopHomeAutoRefresh() {
  if (homeRefreshTimer) { clearInterval(homeRefreshTimer); homeRefreshTimer = null; }
}

document.getElementById('bottomNav')?.addEventListener('click', function (e) {
  var item = e.target.closest('.nav-item');
  if (item && item.dataset.view) showView(item.dataset.view);
});

document.getElementById('goToLogin')?.addEventListener('click', function () { showView('login'); });
document.getElementById('goToRegister')?.addEventListener('click', function () { showView('register'); });
document.getElementById('goToForgot')?.addEventListener('click', function () { showView('forgot'); });
document.getElementById('backToLogin')?.addEventListener('click', function () { showView('login'); });

document.getElementById('logoutBtn')?.addEventListener('click', function () {
  localStorage.removeItem('puppypay_token');
  localStorage.removeItem('puppypay_user');
  window.__dashboard = null;
  if (typeof stopOrdersAutoRefresh === 'function') stopOrdersAutoRefresh();
  showView('login');
  showToast('Logged out');
});

document.getElementById('menuWithdraw')?.addEventListener('click', function () { showView('withdraw'); });
document.getElementById('menuSupport')?.addEventListener('click', function () { window.open('https://t.me/PuppyPayOfficialSupport', '_blank'); });
document.getElementById('supportFab')?.addEventListener('click', function () { window.open('https://t.me/PuppyPayOfficialSupport', '_blank'); });
document.getElementById('menuDownloadApk')?.addEventListener('click', function () {
  showToast('APK download coming soon', 'success');
});
document.getElementById('avatarBtn')?.addEventListener('click', function () { showView('mine'); });

function formatINR(n) {
  var num = Number(n) || 0;
  return '\u20b9' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getGreeting() {
  var h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function getDisplayName(user) {
  var raw = String(user && user.name || '').trim();
  if (raw && raw !== 'PuppyPay User') {
    return raw.replace(/[._+\-]+/g, ' ').split(/\s+/).filter(Boolean)
      .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
  }
  var email = String(user && user.email || '').trim();
  if (email.indexOf('@') >= 0) {
    return email.split('@')[0].replace(/[._+\-]+/g, ' ').split(/\s+/).filter(Boolean)
      .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ') || 'there';
  }
  return 'there';
}

function populateUserUI() {
  try {
    var raw = localStorage.getItem('puppypay_user');
    if (!raw) return;
    var user = JSON.parse(raw);
    var name = getDisplayName(user);
    var greet = document.getElementById('homeGreeting');
    if (greet) greet.innerHTML = getGreeting() + ', <span>' + name + '</span>';
    var pName = document.getElementById('profileName');
    if (pName) pName.textContent = name;
    var pId = document.getElementById('profileId');
    if (pId) pId.textContent = 'ID: ' + (user.appId || '\u2014');
    var refCode = document.getElementById('myReferralCode');
    if (refCode) refCode.textContent = user.referralCode || '\u2014';
    if (typeof applyAvatars === 'function') applyAvatars();
  } catch (e) {}
}

var balanceHidden = false;
document.getElementById('eyeToggle')?.addEventListener('click', function () {
  balanceHidden = !balanceHidden;
  var el = document.getElementById('balanceAmount');
  if (!el) return;
  if (balanceHidden) {
    el.dataset.real = el.textContent;
    el.textContent = '\u20b9 \u2022\u2022\u2022\u2022\u2022\u2022';
  } else {
    el.textContent = el.dataset.real || '\u20b9 0.00';
  }
});

(function initCarousel() {
  var track = document.getElementById('carouselTrack');
  var dots = document.getElementById('carouselDots');
  if (!track || !dots) return;
  var slides = track.children.length;
  var idx = 0;
  for (var i = 0; i < slides; i++) {
    var d = document.createElement('button');
    d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    (function (j) { d.addEventListener('click', function () { go(j); }); })(i);
    dots.appendChild(d);
  }
  function go(i) {
    idx = i;
    track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    dots.querySelectorAll('.carousel-dot').forEach(function (d, j) { d.classList.toggle('active', j === idx); });
  }
  setInterval(function () { go((idx + 1) % slides); }, 4000);
})();

document.getElementById('copyRefBtn')?.addEventListener('click', function () {
  var code = document.getElementById('myReferralCode') && document.getElementById('myReferralCode').textContent;
  if (code && code !== '\u2014') navigator.clipboard && navigator.clipboard.writeText(code).then(function () { showToast('Copied!', 'success'); });
});

(function swipeNav() {
  var ORDER = ['home', 'team', 'orders', 'mine'];
  ORDER.forEach(function (key) {
    var el = document.getElementById(key + 'View');
    if (!el) return;
    var startX = 0, startY = 0, tracking = false;
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      var idx = ORDER.indexOf(key);
      if (dx < 0 && ORDER[idx + 1]) showView(ORDER[idx + 1]);
      else if (dx > 0 && ORDER[idx - 1]) showView(ORDER[idx - 1]);
    }, { passive: true });
  });
})();

(function initPullToRefresh() {
  var VIEWS = {
    homeView: function () { return typeof loadDashboard === 'function' && loadDashboard(); },
    teamView: function () { return typeof loadReferrals === 'function' && loadReferrals(); },
    ordersView: function () { return typeof loadOrders === 'function' && loadOrders(false); },
    mineView: function () { if (typeof populateUserUI === 'function') populateUserUI(); if (typeof applyAvatars === 'function') applyAvatars(); },
    historyView: function () {
      if (typeof loadFilteredHistory === 'function' && window.__historyKind) loadFilteredHistory(window.__historyKind);
      else if (typeof loadHistory === 'function') loadHistory();
    },
  };

  function scrollTopOf(view) {
    var pc = view.querySelector('.page-content');
    var a = view.scrollTop || 0;
    var b = pc ? (pc.scrollTop || 0) : 0;
    return Math.max(a, b);
  }

  Object.keys(VIEWS).forEach(function (viewId) {
    var view = document.getElementById(viewId);
    if (!view) return;
    if (getComputedStyle(view).position === 'static') view.style.position = 'relative';
    var ptr = view.querySelector('.ptr-indicator');
    if (!ptr) {
      ptr = document.createElement('div');
      ptr.className = 'ptr-indicator';
      ptr.innerHTML = '<div class="ptr-spinner"></div>';
      view.insertBefore(ptr, view.firstChild);
    }
    var startY = 0, pulling = false, refreshing = false;
    view.addEventListener('touchstart', function (e) {
      if (refreshing || e.touches.length !== 1) return;
      if (scrollTopOf(view) > 2) return;
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive: true });
    view.addEventListener('touchmove', function (e) {
      if (!pulling || refreshing) return;
      if (scrollTopOf(view) > 2) {
        pulling = false; ptr.classList.remove('visible', 'ready'); ptr.style.transform = ''; return;
      }
      var dy = e.touches[0].clientY - startY;
      if (dy < 0) { ptr.classList.remove('visible', 'ready'); ptr.style.transform = ''; return; }
      var pull = Math.min(dy * 0.45, 80);
      ptr.style.transform = 'translate(-50%, ' + (pull - 40) + 'px)';
      if (pull > 50) ptr.classList.add('ready'); else ptr.classList.remove('ready');
      if (pull > 10) ptr.classList.add('visible');
    }, { passive: true });
    view.addEventListener('touchend', async function () {
      if (!pulling || refreshing) return;
      pulling = false;
      var isReady = ptr.classList.contains('ready');
      ptr.classList.remove('ready');
      if (!isReady) { ptr.classList.remove('visible'); ptr.style.transform = ''; return; }
      refreshing = true;
      ptr.classList.add('visible', 'spinning');
      ptr.style.transform = 'translate(-50%, 12px)';
      try {
        await Promise.resolve(VIEWS[viewId]());
        await new Promise(function (r) { setTimeout(r, 400); });
      } catch (_) {}
      refreshing = false;
      ptr.classList.remove('visible', 'spinning');
      ptr.style.transform = '';
    }, { passive: true });
  });
})();

(function loadMineExtras() {
  if (!document.querySelector('link[href*="mine-ui.css"]')) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/mine-ui.css';
    document.head.appendChild(l);
  }
  if (!document.querySelector('script[src*="mine.js"]')) {
    var s = document.createElement('script');
    s.src = 'js/mine.js';
    s.defer = true;
    document.body.appendChild(s);
  }
})();

(function () {
  function fixAvatars() {
    try {
      var src = null;
      try { src = localStorage.getItem('puppypay_avatar'); } catch (_) {}
      if (!src) src = 'assets/default-avatar.jpg';
      var img = document.getElementById('profileAvatarImg');
      if (img) {
        img.src = src;
        img.onerror = function () { this.onerror = null; this.src = 'assets/default-avatar.jpg'; };
      }
      var home = document.getElementById('homeAvatarImg');
      if (home) {
        home.src = src;
        home.onerror = function () { this.onerror = null; };
      }
    } catch (_) {}
  }
  function autoAskNotif() {
    try {
      if (localStorage.getItem('puppypay_notif_never') === '1') return;
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'default') return;
      if (sessionStorage.getItem('puppypay_notif_asked') === '1') return;
      sessionStorage.setItem('puppypay_notif_asked', '1');
      setTimeout(function () {
        if (Notification.permission !== 'default') return;
        Notification.requestPermission().then(function (perm) {
          if (perm === 'granted') {
            try { new Notification('PuppyPay', { body: 'Notifications enabled. You will get bonuses & updates.' }); } catch (_) {}
            if (typeof showToast === 'function') showToast('Notifications enabled!', 'success');
          }
          if (typeof updateNotifPermissionUI === 'function') updateNotifPermissionUI();
        }).catch(function () {});
      }, 1500);
    } catch (_) {}
  }
  function runFixes() { fixAvatars(); autoAskNotif(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(runFixes, 600); });
  else setTimeout(runFixes, 600);
  document.addEventListener('click', function (e) {
    var item = e.target.closest && e.target.closest('.nav-item');
    if (item && item.dataset && item.dataset.view === 'mine') setTimeout(fixAvatars, 100);
  }, true);
})();

(function loadReferralExtras() {
  if (!document.querySelector('link[href*="referral-ui.css"]')) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/referral-ui.css';
    document.head.appendChild(l);
  }
  if (!document.querySelector('script[src*="referral.js"]')) {
    var s = document.createElement('script');
    s.src = 'js/referral.js';
    s.defer = true;
    document.body.appendChild(s);
  }
})();

(function loadOrderCommission() {
  if (!document.querySelector('script[src*="order-commission.js"]')) {
    var s = document.createElement('script');
    s.src = 'js/order-commission.js';
    s.defer = true;
    document.body.appendChild(s);
  }
})();

(function fixSupportFab() {
  function apply() {
    var fab = document.getElementById('supportFab');
    if (!fab) return;
    if (!fab.dataset.tgIcon) {
      fab.dataset.tgIcon = '1';
      fab.innerHTML = '<img src="assets/telegram.png" alt="Telegram" width="40" height="40" onerror="this.onerror=null;this.src=\'assets/telegram-icon.png\'">';
      fab.setAttribute('aria-label', 'Telegram Support');
    }
    var home = document.getElementById('homeView');
    fab.style.display = (home && home.classList.contains('active')) ? 'flex' : 'none';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 50); });
  else setTimeout(apply, 50);
})();

/* Professional toast + modal styles */
(function injectToastStyles() {
  if (document.getElementById('pp-toast-css')) return;
  var s = document.createElement('style');
  s.id = 'pp-toast-css';
  s.textContent = '.pp-toast{position:fixed;left:50%;bottom:100px;transform:translateX(-50%) translateY(20px);z-index:99999;opacity:0;pointer-events:none;transition:all .28s cubic-bezier(.22,1,.36,1);width:min(340px,calc(100vw - 32px))}' +
    '.pp-toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}' +
    '.pp-toast-inner{display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:16px;background:rgba(15,23,42,.94);color:#fff;font-size:14px;font-weight:600;box-shadow:0 12px 40px rgba(15,23,42,.35);backdrop-filter:blur(12px)}' +
    '.pp-toast-inner.success{background:linear-gradient(135deg,#059669,#10b981)}' +
    '.pp-toast-inner.error{background:linear-gradient(135deg,#dc2626,#ef4444)}' +
    '.pp-toast-icon{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}' +
    '.pp-modal-overlay{position:fixed;inset:0;z-index:99998;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .2s}' +
    '.pp-modal-overlay.show{opacity:1}' +
    '.pp-modal{background:#fff;border-radius:20px;padding:24px;width:min(340px,100%);box-shadow:0 24px 60px rgba(15,23,42,.3);transform:scale(.94);transition:transform .2s}' +
    '.pp-modal-overlay.show .pp-modal{transform:scale(1)}' +
    '.pp-modal-title{font-size:18px;font-weight:800;margin-bottom:8px;color:#0f172a}' +
    '.pp-modal-body{font-size:14px;color:#64748b;line-height:1.5;margin-bottom:20px}' +
    '.pp-modal-actions{display:flex;gap:10px}' +
    '.pp-modal-actions .btn{flex:1}';
  document.head.appendChild(s);
})();

window.showToast = showToast;
window.showAppModal = showAppModal;
window.showView = showView;
window.goBack = goBack;
