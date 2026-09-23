/* PuppyPay — Mine section */
const DEFAULT_AVATAR = 'assets/default-avatar.jpg';

function getAvatarSrc() {
  try {
    const custom = localStorage.getItem('puppypay_avatar');
    if (custom) return custom;
  } catch (_) {}
  return DEFAULT_AVATAR;
}

function applyAvatars() {
  const src = getAvatarSrc();
  const img = document.getElementById('profileAvatarImg');
  if (img) { img.src = src; img.onerror = function() { this.onerror=null; this.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle fill="#dbeafe" cx="64" cy="64" r="64"/><text x="64" y="78" text-anchor="middle" font-size="48">👤</text></svg>'); }; }
  const home = document.getElementById('homeAvatarImg');
  if (home) { home.src = src; home.onerror = function() { this.style.display='none'; }; }
}

function openAvatarPicker() {
  document.getElementById('avatarFileInput')?.click();
}

function handleAvatarFile(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Please select an image', 'error'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('Image max 2MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      const out = canvas.toDataURL('image/jpeg', 0.82);
      try { localStorage.setItem('puppypay_avatar', out); } catch (_) {}
      applyAvatars();
      showToast('Profile photo updated', 'success');
    };
    img.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}

function copyUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
    const id = user.appId || '';
    if (!id) { showToast('No ID found', 'error'); return; }
    navigator.clipboard?.writeText(String(id)).then(() => showToast('ID copied!', 'success')).catch(() => showToast(String(id), 'success'));
  } catch (_) { showToast('Could not copy', 'error'); }
}

async function loadFilteredHistory(kind) {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
  try {
    const { ok, data } = await walletApiCall('/history', 'GET');
    if (!ok || !data?.success) { list.innerHTML = '<div class="empty-state"><p>No transactions yet</p></div>'; return; }
    const deps = (data.history || data.deposits || []).map(h => ({ ...h, _kind: 'deposit' }));
    const wds = (data.withdrawals || []).map(h => ({ ...h, _kind: 'withdraw' }));
    let items = [...deps, ...wds].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (kind === 'deposit') items = items.filter(h => h._kind === 'deposit');
    if (kind === 'withdraw') items = items.filter(h => h._kind === 'withdraw');
    if (!items.length) { list.innerHTML = '<div class="empty-state"><p>No ' + (kind || '') + ' transactions yet</p></div>'; return; }
    list.innerHTML = items.map(h => {
      const status = (h.status || '').toLowerCase();
      const isDeposit = h._kind === 'deposit';
      const title = isDeposit ? (h.isReferral ? 'Referral · ' + (h.utr || 'Bonus') : 'Deposit · ' + (h.orderId || 'Order')) : ('Withdraw · ' + (h.destination || 'UPI'));
      const statusLabel = status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : status === 'pending' ? 'Pending' : (status || 'Done');
      const statusCls = status === 'accepted' ? 'ok' : status === 'rejected' ? 'bad' : 'wait';
      const amt = formatINR(h.amount || h.total || 0);
      return '<div class="history-card ' + (isDeposit ? 'dep' : 'wd') + '"><div class="history-card-top"><div class="history-card-title">' + title + '</div><div class="history-card-amt ' + (isDeposit ? 'plus' : 'minus') + '">' + (isDeposit ? '+' : '-') + amt + '</div></div><div class="history-card-meta"><span class="history-status ' + statusCls + '">' + statusLabel + '</span>' + (h.utr && !h.isReferral ? '<span class="history-utr">UTR ' + h.utr + '</span>' : '') + '<span class="history-time">' + (h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : '') + '</span></div></div>';
    }).join('');
  } catch (e) { list.innerHTML = '<div class="empty-state"><p>Could not load history</p></div>'; }
}

window.__historyKind = null;

async function loadBonusStatus() {
  const status = document.getElementById('bonusStatus');
  const btn = document.getElementById('claimBonusBtn');
  if (!status || !btn) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('puppypay_bonus_day') === today) {
    status.textContent = 'Already claimed today ✓';
    status.style.color = 'var(--success)';
    btn.disabled = true; btn.textContent = 'Claimed';
    return;
  }
  status.textContent = 'Ready to claim ₹3';
  status.style.color = 'var(--text-secondary)';
  btn.disabled = false; btn.textContent = 'Claim ₹3';
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
      if (typeof pushLocalNotification === 'function') pushLocalNotification('Daily Bonus', '₹3 credited to your wallet');
      return;
    }
    if (data?.code === 'ALREADY_CLAIMED') {
      localStorage.setItem('puppypay_bonus_day', today);
      showToast(data.message || 'Already claimed today', 'error');
      loadBonusStatus();
      return;
    }
    localStorage.setItem('puppypay_bonus_day', today);
    showToast('Bonus request sent', 'success');
    loadBonusStatus();
  } catch (e) {
    localStorage.setItem('puppypay_bonus_day', today);
    showToast('Bonus claimed (pending server)', 'success');
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
  if (!items.length) { list.innerHTML = '<div class="empty-state"><p>No notifications yet</p></div>'; return; }
  list.innerHTML = items.map(n => '<div class="history-card" style="margin-bottom:10px;"><div class="history-card-top"><div class="history-card-title">' + (n.title || 'Notification') + '</div><div class="text-xs text-muted">' + (n.time ? new Date(n.time).toLocaleString('en-IN') : '') + '</div></div><div class="text-sm text-secondary">' + (n.body || '') + '</div></div>').join('');
}

function updateNotifPermissionUI() {
  const box = document.getElementById('notifPermissionBox');
  if (!box) return;
  if (localStorage.getItem(NOTIF_NEVER_KEY) === '1') { box.style.display = 'none'; return; }
  if (!('Notification' in window) || Notification.permission === 'granted' || Notification.permission === 'denied') {
    box.style.display = 'none'; return;
  }
  box.style.display = 'block';
}

async function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('Not supported on this device', 'error'); return; }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('Notifications enabled!', 'success');
      try { new Notification('PuppyPay', { body: 'You will receive updates & rewards here.' }); } catch (_) {}
    } else if (perm === 'denied') showToast('Permission denied', 'error');
  } catch (_) { showToast('Could not request permission', 'error'); }
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

function initMine() {
  applyAvatars();
  document.getElementById('avatarEditBtn')?.addEventListener('click', (e) => { e.stopPropagation(); openAvatarPicker(); });
  document.getElementById('profileAvatarWrap')?.addEventListener('click', openAvatarPicker);
  document.getElementById('avatarFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleAvatarFile(file);
    e.target.value = '';
  });
  document.getElementById('copyUserIdBtn')?.addEventListener('click', copyUserId);
  document.getElementById('menuDepositHistory')?.addEventListener('click', () => {
    window.__historyKind = 'deposit';
    const h = document.querySelector('#historyView h2');
    if (h) h.textContent = 'Deposit History';
    showView('history');
    loadFilteredHistory('deposit');
  });
  document.getElementById('menuWithdrawHistory')?.addEventListener('click', () => {
    window.__historyKind = 'withdraw';
    const h = document.querySelector('#historyView h2');
    if (h) h.textContent = 'Withdraw History';
    showView('history');
    loadFilteredHistory('withdraw');
  });
  document.getElementById('menuBonus')?.addEventListener('click', () => { showView('bonus'); loadBonusStatus(); });
  document.getElementById('claimBonusBtn')?.addEventListener('click', claimDailyBonus);
  document.getElementById('menuNotifications')?.addEventListener('click', () => {
    showView('notifications');
    updateNotifPermissionUI();
    renderNotifications();
  });
  document.getElementById('allowNotifBtn')?.addEventListener('click', requestNotifPermission);
  document.getElementById('laterNotifBtn')?.addEventListener('click', () => {
    const box = document.getElementById('notifPermissionBox');
    if (box) box.style.display = 'none';
  });
  document.getElementById('neverNotifBtn')?.addEventListener('click', () => {
    localStorage.setItem(NOTIF_NEVER_KEY, '1');
    const box = document.getElementById('notifPermissionBox');
    if (box) box.style.display = 'none';
    showToast("Won't ask again");
  });
}

document.addEventListener('DOMContentLoaded', initMine);
if (document.readyState !== 'loading') setTimeout(initMine, 0);

window.applyAvatars = applyAvatars;
window.pushLocalNotification = pushLocalNotification;
window.loadFilteredHistory = loadFilteredHistory;
window.loadBonusStatus = loadBonusStatus;
window.updateNotifPermissionUI = updateNotifPermissionUI;
window.renderNotifications = renderNotifications;
