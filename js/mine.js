/* PuppyPay Mine - fixed order: functions first, then migrate, then bind */
(function () {
  const DEFAULT_AVATAR = 'assets/default-avatar.jpg';

  function getAvatarSrc() {
    try {
      const c = localStorage.getItem('puppypay_avatar');
      if (c && c.length > 40 && !c.includes('ellipse%20cx%3D%2264') && !c.includes('ellipse cx="64"')) {
        return c;
      }
      if (c) {
        try { localStorage.removeItem('puppypay_avatar'); } catch (_) {}
      }
    } catch (_) {}
    return DEFAULT_AVATAR;
  }

  function applyAvatars() {
    const src = getAvatarSrc();
    const img = document.getElementById('profileAvatarImg');
    if (img) {
      img.src = src;
      img.onerror = function () {
        this.onerror = null;
        this.src = DEFAULT_AVATAR;
      };
    }
    const home = document.getElementById('homeAvatarImg');
    if (home) {
      home.src = src;
      home.onerror = function () {
        this.onerror = null;
        this.src = DEFAULT_AVATAR;
      };
    }
  }

  function openAvatarPicker() {
    const input = document.getElementById('avatarFileInput');
    if (input) input.click();
  }

  function handleAvatarFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select an image', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image max 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(im.width, im.height);
        ctx.drawImage(im, (im.width - min) / 2, (im.height - min) / 2, min, min, 0, 0, size, size);
        const out = canvas.toDataURL('image/jpeg', 0.85);
        try { localStorage.setItem('puppypay_avatar', out); } catch (_) {}
        applyAvatars();
        showToast('Profile photo updated', 'success');
      };
      im.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  function copyUserId() {
    try {
      const user = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      const id = user.appId || '';
      if (!id) { showToast('No ID found', 'error'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(id)).then(() => showToast('ID copied!', 'success')).catch(() => fallbackCopy(id));
      } else {
        fallbackCopy(id);
      }
    } catch (_) {
      showToast('Could not copy', 'error');
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('ID copied!', 'success');
    } catch (_) {
      showToast(text, 'success');
    }
    document.body.removeChild(ta);
  }

  async function loadFilteredHistory(kind) {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
    try {
      const { ok, data } = await walletApiCall('/history', 'GET');
      if (!ok || !data?.success) {
        list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>';
        return;
      }
      const deps = (data.history || data.deposits || []).map(h => ({ ...h, _kind: 'deposit' }));
      const wds = (data.withdrawals || []).map(h => ({ ...h, _kind: 'withdraw' }));
      let items = [...deps, ...wds].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      if (kind === 'deposit') items = items.filter(h => h._kind === 'deposit');
      if (kind === 'withdraw') items = items.filter(h => h._kind === 'withdraw');
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p>No ' + (kind || '') + ' transactions yet</p></div>';
        return;
      }
      list.innerHTML = items.map(h => {
        const status = (h.status || '').toLowerCase();
        const isDeposit = h._kind === 'deposit';
        const title = isDeposit
          ? (h.isBonus ? 'Bonus · Daily' : h.isReferralTransfer ? 'Referral · Transfer' : h.isReferral ? 'Referral · ' + (h.utr || 'Bonus') : 'Deposit · ' + (h.orderId || 'Order'))
          : ('Withdraw · ' + (h.destination || 'UPI'));
        let statusLabel = 'Processing';
        let statusCls = 'wait';
        if (status === 'accepted' || status === 'completed' || status === 'done' || status === 'success') {
          statusLabel = 'Completed'; statusCls = 'ok';
        } else if (status === 'rejected' || status === 'failed' || status === 'cancelled') {
          statusLabel = 'Failed'; statusCls = 'bad';
        } else if (status === 'pending' || status === 'processing' || !status) {
          statusLabel = 'Processing'; statusCls = 'wait';
        }
        const amt = formatINR(h.amount || h.total || 0);
        return '<div class="history-card ' + (isDeposit ? 'dep' : 'wd') + '"><div class="history-card-top"><div class="history-card-title">' + title + '</div><div class="history-card-amt ' + (isDeposit ? 'plus' : 'minus') + '">' + (isDeposit ? '+' : '-') + amt + '</div></div><div class="history-card-meta"><span class="history-status ' + statusCls + '">' + statusLabel + '</span>' + (h.utr && !h.isReferral ? '<span class="history-utr">UTR ' + h.utr + '</span>' : '') + '<span class="history-time">' + (h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : '') + '</span></div></div>';
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="empty-state"><p>Could not load history</p></div>';
    }
  }

  async function loadBonusStatus() {
    const status = document.getElementById('bonusStatus');
    const btn = document.getElementById('claimBonusBtn');
    if (!status || !btn) return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('puppypay_bonus_day') === today) {
      status.textContent = 'Already claimed today ✓';
      status.style.color = 'var(--success)';
      btn.disabled = true;
      btn.textContent = 'Claimed';
      return;
    }
    status.textContent = 'Ready to claim ₹3';
    status.style.color = 'var(--text-secondary)';
    btn.disabled = false;
    btn.textContent = 'Claim ₹3';
  }

  async function claimDailyBonus() {
    const btn = document.getElementById('claimBonusBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Claiming...'; }
    const today = new Date().toISOString().slice(0, 10);
    try {
      const { ok, data } = await walletApiCall('/bonus/daily', 'POST');
      if (ok && data?.success) {
        localStorage.setItem('puppypay_bonus_day', today);
        showToast(data.message || '₹3 credited!', 'success');
        if (typeof loadDashboard === 'function') loadDashboard();
        loadBonusStatus();
        pushLocalNotification('Daily Bonus', '₹3 credited to your wallet');
        return;
      }
      if (data?.code === 'ALREADY_CLAIMED') {
        localStorage.setItem('puppypay_bonus_day', today);
        showToast(data.message || 'Already claimed today', 'error');
        loadBonusStatus();
        return;
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Claim ₹3'; }
      showToast((data && data.message) || 'Could not claim. Try again.', 'error');
      loadBonusStatus();
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Claim ₹3'; }
      showToast('Network error. Try again.', 'error');
      loadBonusStatus();
    }
  }

  const NOTIF_NEVER_KEY = 'puppypay_notif_never';
  const NOTIF_LIST_KEY = 'puppypay_notifications';

  function getNotifList() {
    try { return JSON.parse(localStorage.getItem(NOTIF_LIST_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveNotifList(list) {
    try { localStorage.setItem(NOTIF_LIST_KEY, JSON.stringify(list.slice(0, 50))); } catch (_) {}
  }

  function renderNotifications() {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    const items = getNotifList();
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><p>No notifications yet</p></div>';
      return;
    }
    list.innerHTML = items.map(n =>
      '<div class="history-card" style="margin-bottom:10px;"><div class="history-card-top"><div class="history-card-title">' +
      (n.title || 'Notification') + '</div><div class="text-xs text-muted">' +
      (n.time ? new Date(n.time).toLocaleString('en-IN') : '') +
      '</div></div><div class="text-sm text-secondary">' + (n.body || '') + '</div></div>'
    ).join('');
  }

  function updateNotifPermissionUI() {
    const box = document.getElementById('notifPermissionBox');
    if (!box) return;
    if (localStorage.getItem(NOTIF_NEVER_KEY) === '1') { box.style.display = 'none'; return; }
    if (!('Notification' in window) || Notification.permission === 'granted' || Notification.permission === 'denied') {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) { showToast('Not supported', 'error'); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        showToast('Notifications enabled!', 'success');
        try { new Notification('PuppyPay', { body: 'You will receive updates & rewards here.' }); } catch (_) {}
      } else if (perm === 'denied') {
        showToast('Permission denied', 'error');
      }
    } catch (_) {
      showToast('Could not request permission', 'error');
    }
    updateNotifPermissionUI();
  }

  function pushLocalNotification(title, body) {
    const list = getNotifList();
    list.unshift({ title, body, time: Date.now() });
    saveNotifList(list);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch (_) {}
    }
    renderNotifications();
  }

  const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  function injectMineUI() {
    const mine = document.getElementById('mineView');
    if (!mine) return false;
    const pageContent = mine.querySelector('.page-content');
    if (!pageContent) return false;

    pageContent.innerHTML = `
      <div class="glass profile-card">
        <div class="profile-avatar-wrap" id="profileAvatarWrap">
          <img id="profileAvatarImg" class="profile-avatar-img" alt="Profile" src="">
          <button type="button" class="avatar-cam-btn" id="avatarEditBtn" aria-label="Change photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <input type="file" id="avatarFileInput" accept="image/*" hidden>
        </div>
        <div class="profile-info">
          <h3 id="profileName">User</h3>
          <div class="profile-id-row">
            <p id="profileId">ID: —</p>
            <button type="button" class="id-copy-btn" id="copyUserIdBtn" title="Copy ID" aria-label="Copy ID">${COPY_ICON}</button>
          </div>
        </div>
      </div>
      <div class="glass menu-list" style="padding:8px;">
        <button type="button" class="menu-item" id="menuDepositHistory">
          <span class="menu-icon" style="background:#ecfdf5;color:#16a34a;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></svg></span>
          Deposit History
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" class="menu-item" id="menuWithdrawHistory">
          <span class="menu-icon" style="background:#fef2f2;color:#dc2626;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></span>
          Withdraw History
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" class="menu-item" id="menuWithdraw">
          <span class="menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></span>
          Withdrawal
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" class="menu-item" id="menuBonus">
          <span class="menu-icon" style="background:#fef3c7;color:#d97706;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span>
          Daily Bonus
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" class="menu-item" id="menuNotifications">
          <span class="menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
          Notifications
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" class="menu-item" id="menuSupport">
          <span class="menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
          Support
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" class="menu-item" id="menuDownloadApk">
          <span class="menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
          Download APK
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" class="menu-item" id="logoutBtn" style="color:var(--danger);">
          <span class="menu-icon" style="background:var(--danger-soft);color:var(--danger);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></span>
          Log out
        </button>
      </div>
    `;

    if (!document.getElementById('bonusView')) {
      const bonus = document.createElement('div');
      bonus.className = 'view';
      bonus.id = 'bonusView';
      bonus.innerHTML = `
        <div class="page-header"><button type="button" class="back-btn" data-back="mine"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button><h2>Daily Bonus</h2></div>
        <div class="page-content">
          <div class="glass bonus-card" style="padding:24px;text-align:center;margin-bottom:16px;">
            <div style="font-size:42px;margin-bottom:8px;">🎁</div>
            <h3 style="font-size:20px;font-weight:800;margin-bottom:6px;">Daily Check-in</h3>
            <p class="text-sm text-secondary" style="margin-bottom:16px;">Claim ₹3 every day</p>
            <div id="bonusStatus" class="text-sm" style="margin-bottom:16px;color:var(--text-muted);">Checking...</div>
            <button type="button" class="btn btn-primary btn-block btn-lg" id="claimBonusBtn">Claim ₹3</button>
          </div>
        </div>`;
      (document.querySelector('.phone') || document.body).appendChild(bonus);
    }

    if (!document.getElementById('notificationsView')) {
      const notif = document.createElement('div');
      notif.className = 'view';
      notif.id = 'notificationsView';
      notif.innerHTML = `
        <div class="page-header"><button type="button" class="back-btn" data-back="mine"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button><h2>Notifications</h2></div>
        <div class="page-content">
          <div id="notifPermissionBox" class="glass" style="padding:14px 16px;margin-bottom:14px;display:none;">
            <p class="text-sm" style="margin-bottom:10px;">Enable notifications to get bonuses & updates on your phone.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="allowNotifBtn">Allow</button>
              <button type="button" class="btn btn-secondary btn-sm" id="laterNotifBtn">Later</button>
              <button type="button" class="btn btn-ghost btn-sm" id="neverNotifBtn">Never ask again</button>
            </div>
          </div>
          <div id="notificationsList" class="empty-state"><p>No notifications yet</p></div>
        </div>`;
      (document.querySelector('.phone') || document.body).appendChild(notif);
    }

    const avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn && !document.getElementById('homeAvatarImg')) {
      avatarBtn.innerHTML = '<img id="homeAvatarImg" class="home-avatar-img" alt="" src="">';
    }

    return true;
  }

  function bindOnce(el, evt, fn) {
    if (!el) return;
    const key = '_pp_' + evt;
    if (el[key]) return;
    el[key] = true;
    el.addEventListener(evt, fn);
  }

  window.applyAvatars = applyAvatars;
  window.openAvatarPicker = openAvatarPicker;
  window.loadFilteredHistory = loadFilteredHistory;
  window.loadBonusStatus = loadBonusStatus;
  window.renderNotifications = renderNotifications;
  window.updateNotifPermissionUI = updateNotifPermissionUI;

  function initMine() {
    injectMineUI();

    bindOnce(document.getElementById('avatarEditBtn'), 'click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openAvatarPicker();
    });
    bindOnce(document.getElementById('profileAvatarWrap'), 'click', function (e) {
      if (e.target.closest && e.target.closest('#avatarEditBtn')) return;
      openAvatarPicker();
    });
    bindOnce(document.getElementById('avatarFileInput'), 'change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) handleAvatarFile(f);
      e.target.value = '';
    });
    bindOnce(document.getElementById('copyUserIdBtn'), 'click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      copyUserId();
    });
    bindOnce(document.getElementById('menuDepositHistory'), 'click', function () {
      window.__historyKind = 'deposit';
      showView('history');
      loadFilteredHistory('deposit');
    });
    bindOnce(document.getElementById('menuWithdrawHistory'), 'click', function () {
      window.__historyKind = 'withdraw';
      showView('history');
      loadFilteredHistory('withdraw');
    });
    bindOnce(document.getElementById('menuWithdraw'), 'click', function () { showView('withdraw'); });
    bindOnce(document.getElementById('menuBonus'), 'click', function () { showView('bonus'); loadBonusStatus(); });
    bindOnce(document.getElementById('menuNotifications'), 'click', function () {
      showView('notifications');
      updateNotifPermissionUI();
      renderNotifications();
    });
    bindOnce(document.getElementById('menuSupport'), 'click', function () {
      window.open('https://t.me/PuppyPayOfficialSupport', '_blank');
    });
    bindOnce(document.getElementById('menuDownloadApk'), 'click', function () {
      if (typeof window.downloadLatestApk === 'function') {
        window.downloadLatestApk();
      } else {
        showToast('Checking for latest APK...', 'success');
        setTimeout(function () {
          if (typeof window.downloadLatestApk === 'function') window.downloadLatestApk();
          else showToast('APK will be available soon', 'error');
        }, 800);
      }
    });
    bindOnce(document.getElementById('logoutBtn'), 'click', function () {
      try {
        localStorage.removeItem('puppypay_token');
        localStorage.removeItem('puppypay_user');
      } catch (_) {}
      if (typeof showView === 'function') showView('login');
      else location.reload();
    });
    bindOnce(document.getElementById('claimBonusBtn'), 'click', claimDailyBonus);
    bindOnce(document.getElementById('allowNotifBtn'), 'click', requestNotifPermission);
    bindOnce(document.getElementById('laterNotifBtn'), 'click', function () {
      const box = document.getElementById('notifPermissionBox');
      if (box) box.style.display = 'none';
    });
    bindOnce(document.getElementById('neverNotifBtn'), 'click', function () {
      localStorage.setItem(NOTIF_NEVER_KEY, '1');
      const box = document.getElementById('notifPermissionBox');
      if (box) box.style.display = 'none';
    });

    applyAvatars();
    if (typeof populateUserUI === 'function') populateUserUI();
    setTimeout(loadBonusStatus, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initMine, 50); });
  } else {
    setTimeout(initMine, 50);
  }

  document.addEventListener('click', function (e) {
    var item = e.target.closest && e.target.closest('.nav-item');
    if (item && item.dataset && item.dataset.view === 'mine') {
      setTimeout(function () {
        applyAvatars();
        if (typeof populateUserUI === 'function') populateUserUI();
      }, 50);
    }
  });
})();
