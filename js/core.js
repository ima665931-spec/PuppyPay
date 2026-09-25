/* PuppyPay v2 — Core utilities & navigation */

function showToast(msg, type = '') {
  let el = document.querySelector('.view.active .toast') || document.getElementById('globalToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalToast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2800);
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(name + 'View') || document.getElementById(name);
  if (target) {
    target.classList.add('active');
    target.scrollTop = 0;
    const pc = target.querySelector('.page-content');
    if (pc) pc.scrollTop = 0;
  }

  const nav = document.getElementById('bottomNav');
  const fab = document.getElementById('supportFabBtn');
  const mainTabs = ['home', 'team', 'orders', 'mine'];
  if (nav) {
    if (mainTabs.includes(name)) {
      nav.style.display = 'flex';
      nav.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === name);
      });
    } else {
      nav.style.display = 'none';
    }
  }
  if (fab) fab.style.display = name === 'home' ? 'flex' : 'none';

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

let homeRefreshTimer = null;
function startHomeAutoRefresh() {
  stopHomeAutoRefresh();
  homeRefreshTimer = setInterval(() => {
    const home = document.getElementById('homeView');
    if (home && home.classList.contains('active') && typeof loadDashboard === 'function') loadDashboard();
    else stopHomeAutoRefresh();
  }, 30000);
}
function stopHomeAutoRefresh() {
  if (homeRefreshTimer) { clearInterval(homeRefreshTimer); homeRefreshTimer = null; }
}

document.getElementById('bottomNav')?.addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (item && item.dataset.view) showView(item.dataset.view);
});

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.back));
});

document.getElementById('goToLogin')?.addEventListener('click', () => showView('login'));
document.getElementById('goToRegister')?.addEventListener('click', () => showView('register'));
document.getElementById('goToForgot')?.addEventListener('click', () => showView('forgot'));
document.getElementById('backToLogin')?.addEventListener('click', () => showView('login'));

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('puppypay_token');
  localStorage.removeItem('puppypay_user');
  window.__dashboard = null;
  if (typeof stopOrdersAutoRefresh === 'function') stopOrdersAutoRefresh();
  showView('login');
  showToast('Logged out');
});

document.getElementById('menuWithdraw')?.addEventListener('click', () => showView('withdraw'));
document.getElementById('menuSupport')?.addEventListener('click', () => window.open('https://t.me/PuppyPayOfficialSupport', '_blank'));
document.getElementById('supportFabBtn')?.addEventListener('click', () => window.open('https://t.me/PuppyPayOfficialSupport', '_blank'));
document.getElementById('menuDownloadApk')?.addEventListener('click', () => {
  showToast('APK download coming soon', 'success');
});
document.getElementById('avatarBtn')?.addEventListener('click', () => showView('mine'));

function formatINR(n) {
  const num = Number(n) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function getDisplayName(user) {
  const raw = String(user?.name || '').trim();
  if (raw && raw !== 'PuppyPay User') {
    return raw.replace(/[._+\-]+/g, ' ').split(/\s+/).filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  const email = String(user?.email || '').trim();
  if (email.includes('@')) {
    return email.split('@')[0].replace(/[._+\-]+/g, ' ').split(/\s+/).filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'there';
  }
  return 'there';
}

function populateUserUI() {
  try {
    const raw = localStorage.getItem('puppypay_user');
    if (!raw) return;
    const user = JSON.parse(raw);
    const name = getDisplayName(user);
    const greet = document.getElementById('homeGreeting');
    if (greet) greet.innerHTML = `${getGreeting()}, <span>${name}</span>`;
    const pName = document.getElementById('profileName');
    if (pName) pName.textContent = name;
    const pId = document.getElementById('profileId');
    if (pId) pId.textContent = 'ID: ' + (user.appId || '—');
    const refCode = document.getElementById('myReferralCode');
    if (refCode) refCode.textContent = user.referralCode || '—';
    if (typeof applyAvatars === 'function') applyAvatars();
  } catch (e) {}
}

let balanceHidden = false;
document.getElementById('eyeToggle')?.addEventListener('click', () => {
  balanceHidden = !balanceHidden;
  const el = document.getElementById('balanceAmount');
  if (!el) return;
  if (balanceHidden) {
    el.dataset.real = el.textContent;
    el.textContent = '₹ ••••••';
  } else {
    el.textContent = el.dataset.real || '₹ 0.00';
  }
});

(function initCarousel() {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carouselDots');
  if (!track || !dots) return;
  const slides = track.children.length;
  let idx = 0;
  for (let i = 0; i < slides; i++) {
    const d = document.createElement('button');
    d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    d.addEventListener('click', () => go(i));
    dots.appendChild(d);
  }
  function go(i) {
    idx = i;
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.querySelectorAll('.carousel-dot').forEach((d, j) => d.classList.toggle('active', j === idx));
  }
  setInterval(() => go((idx + 1) % slides), 4000);
})();

document.getElementById('copyRefBtn')?.addEventListener('click', () => {
  const code = document.getElementById('myReferralCode')?.textContent;
  if (code && code !== '—') navigator.clipboard?.writeText(code).then(() => showToast('Copied!', 'success'));
});

(function swipeNav() {
  const ORDER = ['home', 'team', 'orders', 'mine'];
  ORDER.forEach(key => {
    const el = document.getElementById(key + 'View');
    if (!el) return;
    let startX = 0, startY = 0, tracking = false;
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const idx = ORDER.indexOf(key);
      if (dx < 0 && ORDER[idx + 1]) showView(ORDER[idx + 1]);
      else if (dx > 0 && ORDER[idx - 1]) showView(ORDER[idx - 1]);
    }, { passive: true });
  });
})();

(function initPullToRefresh() {
  const VIEWS = {
    homeView: () => typeof loadDashboard === 'function' && loadDashboard(),
    teamView: () => typeof loadReferrals === 'function' && loadReferrals(),
    ordersView: () => typeof loadOrders === 'function' && loadOrders(false),
    mineView: () => { if (typeof populateUserUI === 'function') populateUserUI(); if (typeof applyAvatars === 'function') applyAvatars(); },
    historyView: () => {
      if (typeof loadFilteredHistory === 'function' && window.__historyKind) loadFilteredHistory(window.__historyKind);
      else if (typeof loadHistory === 'function') loadHistory();
    },
  };

  Object.keys(VIEWS).forEach(viewId => {
    const view = document.getElementById(viewId);
    if (!view) return;

    let ptr = view.querySelector('.ptr-indicator');
    if (!ptr) {
      ptr = document.createElement('div');
      ptr.className = 'ptr-indicator';
      ptr.innerHTML = '<div class="ptr-spinner"></div>';
      view.insertBefore(ptr, view.firstChild);
    }

    let startY = 0, pulling = false, refreshing = false;

    view.addEventListener('touchstart', (e) => {
      if (refreshing || e.touches.length !== 1) return;
      if (view.scrollTop > 2) return;
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive: true });

    view.addEventListener('touchmove', (e) => {
      if (!pulling || refreshing) return;
      const dy = e.touches[0].clientY - startY;
      if (dy < 0) { ptr.classList.remove('visible', 'ready'); return; }
      const pull = Math.min(dy * 0.4, 72);
      ptr.style.transform = `translate(-50%, ${pull - 40}px)`;
      if (pull > 48) ptr.classList.add('ready');
      else ptr.classList.remove('ready');
      if (pull > 8) ptr.classList.add('visible');
    }, { passive: true });

    view.addEventListener('touchend', async () => {
      if (!pulling || refreshing) return;
      pulling = false;
      const isReady = ptr.classList.contains('ready');
      ptr.classList.remove('ready');
      if (!isReady) {
        ptr.classList.remove('visible');
        ptr.style.transform = '';
        return;
      }
      refreshing = true;
      ptr.classList.add('visible', 'spinning');
      ptr.style.transform = 'translate(-50%, 12px)';
      try {
        await Promise.resolve(VIEWS[viewId]());
        await new Promise(r => setTimeout(r, 450));
      } catch (_) {}
      refreshing = false;
      ptr.classList.remove('visible', 'spinning');
      ptr.style.transform = '';
    }, { passive: true });
  });
})();

/* Auto-load Mine UI styles + script */
(function loadMineExtras() {
  if (!document.querySelector('link[href*="mine-ui.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/mine-ui.css';
    document.head.appendChild(l);
  }
  if (!document.querySelector('script[src*="mine.js"]')) {
    const s = document.createElement('script');
    s.src = 'js/mine.js';
    s.defer = true;
    document.body.appendChild(s);
  }
})();

/* Mine fixes: default avatar from assets + auto notif on open */
(function () {
  function fixAvatars() {
    try {
      var src = null;
      try { src = localStorage.getItem('puppypay_avatar'); } catch (_) {}
      if (!src) src = 'assets/default-avatar.jpg';
      var img = document.getElementById('profileAvatarImg');
      if (img) {
        img.src = src;
        img.onerror = function () {
          this.onerror = null;
          this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Ccircle fill='%231e3a8a' cx='64' cy='64' r='64'/%3E%3Cellipse cx='64' cy='50' rx='45' ry='14' fill='%23fbbf24'/%3E%3Crect x='19' y='46' width='90' height='8' rx='2' fill='%23dc2626'/%3E%3Ccircle fill='%23fde68a' cx='64' cy='78' r='24'/%3E%3C/svg%3E";
        };
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

  function runFixes() {
    fixAvatars();
    autoAskNotif();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(runFixes, 600); });
  } else {
    setTimeout(runFixes, 600);
  }

  document.addEventListener('click', function (e) {
    var item = e.target.closest && e.target.closest('.nav-item');
    if (item && item.dataset && item.dataset.view === 'mine') {
      setTimeout(fixAvatars, 100);
    }
  }, true);
})();

/* Auto-load Referral UI */
(function loadReferralExtras() {
  if (!document.querySelector('link[href*="referral-ui.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/referral-ui.css';
    document.head.appendChild(l);
  }
  if (!document.querySelector('script[src*="referral.js"]')) {
    const s = document.createElement('script');
    s.src = 'js/referral.js';
    s.defer = true;
    document.body.appendChild(s);
  }
})();
