/* PuppyPay Mine — restored functional menus */
(function () {
  const DEFAULT_AVATAR = 'assets/default-avatar.jpg';
  function getAvatarSrc() {
    try {
      const c = localStorage.getItem('puppypay_avatar');
      if (c && c.length > 40) return c;
    } catch (_) {}
    return DEFAULT_AVATAR;
  }
  function applyAvatars() {
    const src = getAvatarSrc();
    ['profileAvatarImg', 'homeAvatarImg'].forEach(function (id) {
      const img = document.getElementById(id);
      if (img) { img.src = src; img.onerror = function () { this.onerror = null; this.src = DEFAULT_AVATAR; }; }
    });
  }
  window.applyAvatars = applyAvatars;

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
          ? (h.isBonus ? 'Bonus · Daily' : h.isReferralTransfer ? 'Referral · Transfer' : 'Deposit · ' + (h.orderId || 'Order'))
          : ('Withdraw · ' + (h.destination || 'UPI'));
        let statusLabel = 'Processing', statusCls = 'wait';
        if (status === 'accepted' || status === 'completed' || status === 'done' || status === 'success') {
          statusLabel = 'Completed'; statusCls = 'ok';
        } else if (status === 'rejected' || status === 'failed' || status === 'cancelled') {
          statusLabel = 'Failed'; statusCls = 'bad';
        }
        const amt = formatINR(h.amount || h.total || 0);
        return '<div class="history-card ' + (isDeposit ? 'dep' : 'wd') + '"><div class="history-card-top"><div class="history-card-title">' + title + '</div><div class="history-card-amt ' + (isDeposit ? 'plus' : 'minus') + '">' + (isDeposit ? '+' : '-') + amt + '</div></div><div class="history-card-meta"><span class="history-status ' + statusCls + '">' + statusLabel + '</span><span class="history-time">' + (h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : '') + '</span></div></div>';
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="empty-state"><p>Could not load history</p></div>';
    }
  }
  window.loadFilteredHistory = loadFilteredHistory;
  window.loadHistory = function () { loadFilteredHistory(); };

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
    btn.disabled = false;
    btn.textContent = 'Claim ₹3';
  }
  window.loadBonusStatus = loadBonusStatus;

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
        return;
      }
      if (data?.code === 'ALREADY_CLAIMED') {
        localStorage.setItem('puppypay_bonus_day', today);
        showToast(data.message || 'Already claimed today', 'error');
        loadBonusStatus();
        return;
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Claim ₹3'; }
      showToast((data && data.message) || 'Could not claim', 'error');
      loadBonusStatus();
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Claim ₹3'; }
      showToast('Network error', 'error');
    }
  }

  function injectMineUI() {
    const mine = document.getElementById('mineView');
    if (!mine) return false;
    const pageContent = mine.querySelector('.page-content');
    if (!pageContent) return false;
    pageContent.innerHTML = `
      <div class="glass profile-card">
        <div class="profile-avatar-wrap" id="profileAvatarWrap">
          <img id="profileAvatarImg" class="profile-avatar-img" alt="Profile" src="">
        </div>
        <div class="profile-info">
          <h3 id="profileName">User</h3>
          <p id="profileId">ID: —</p>
        </div>
      </div>
      <div class="glass menu-list" style="padding:8px;">
        <button type="button" class="menu-item" id="menuDepositHistory">Deposit History</button>
        <button type="button" class="menu-item" id="menuWithdrawHistory">Withdraw History</button>
        <button type="button" class="menu-item" id="menuWithdraw">Withdraw</button>
        <button type="button" class="menu-item" id="menuBonus">Daily Bonus</button>
        <button type="button" class="menu-item" id="menuNotifications">Notifications</button>
        <button type="button" class="menu-item" id="menuSupport">Support</button>
        <button type="button" class="menu-item" id="logoutBtn" style="color:var(--danger);">Log out</button>
      </div>`;
    if (!document.getElementById('bonusView')) {
      const bonus = document.createElement('div');
      bonus.className = 'view';
      bonus.id = 'bonusView';
      bonus.innerHTML = `<div class="page-header"><button type="button" class="back-btn" data-back="mine">←</button><h2>Daily Bonus</h2></div>
        <div class="page-content"><div class="glass" style="padding:24px;text-align:center;">
          <h3>Daily Check-in</h3><p>Claim ₹3 every day</p>
          <div id="bonusStatus">Checking...</div>
          <button type="button" class="btn btn-primary btn-block" id="claimBonusBtn">Claim ₹3</button>
        </div></div>`;
      (document.querySelector('.phone') || document.body).appendChild(bonus);
    }
    if (!document.getElementById('notificationsView')) {
      const notif = document.createElement('div');
      notif.className = 'view';
      notif.id = 'notificationsView';
      notif.innerHTML = `<div class="page-header"><button type="button" class="back-btn" data-back="mine">←</button><h2>Notifications</h2></div>
        <div class="page-content"><div id="notificationsList" class="empty-state"><p>No notifications yet</p></div></div>`;
      (document.querySelector('.phone') || document.body).appendChild(notif);
    }
    return true;
  }

  function bindOnce(el, evt, fn) {
    if (!el || el._ppBound) return;
    el._ppBound = true;
    el.addEventListener(evt, fn);
  }

  function initMine() {
    injectMineUI();
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
      if (typeof renderNotifications === 'function') renderNotifications();
    });
    bindOnce(document.getElementById('menuSupport'), 'click', function () {
      window.open('https://t.me/PuppyPayOfficialSupport', '_blank');
    });
    bindOnce(document.getElementById('logoutBtn'), 'click', function () {
      try { localStorage.removeItem('puppypay_token'); localStorage.removeItem('puppypay_user'); } catch (_) {}
      showView('login');
    });
    bindOnce(document.getElementById('claimBonusBtn'), 'click', claimDailyBonus);
    applyAvatars();
    if (typeof populateUserUI === 'function') populateUserUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initMine, 50); });
  } else {
    setTimeout(initMine, 50);
  }
})();
