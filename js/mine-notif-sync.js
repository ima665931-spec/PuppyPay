/* PuppyPay — notifications: tall cards, bell icon, system bar */
(function () {
  var LIST_KEY = 'puppypay_notifications';
  var SHOWN_KEY = 'puppypay_notif_shown';
  var ICON_PNG = null;

  /* Blue circle + white bell as PNG data-URL (works in system notification bar) */
  function buildIconPng(cb) {
    if (ICON_PNG) { cb(ICON_PNG); return; }
    try {
      var c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      /* bell body */
      ctx.beginPath();
      ctx.moveTo(44, 58);
      ctx.quadraticCurveTo(44, 38, 64, 38);
      ctx.quadraticCurveTo(84, 38, 84, 58);
      ctx.lineTo(84, 72);
      ctx.lineTo(92, 82);
      ctx.lineTo(36, 82);
      ctx.lineTo(44, 72);
      ctx.closePath();
      ctx.stroke();
      /* bell clapper */
      ctx.beginPath();
      ctx.arc(64, 90, 8, 0, Math.PI * 2);
      ctx.stroke();
      /* top knob */
      ctx.beginPath();
      ctx.arc(64, 34, 5, 0, Math.PI * 2);
      ctx.stroke();
      ICON_PNG = c.toDataURL('image/png');
      cb(ICON_PNG);
    } catch (_) {
      cb((location.origin || '') + '/assets/logo.svg');
    }
  }

  var BELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  function getList() {
    try { return JSON.parse(localStorage.getItem(LIST_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveList(list) {
    try { localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 50))); } catch (_) {}
  }
  function getShown() {
    try { return JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}'); } catch (_) { return {}; }
  }
  function markShown(id) {
    try {
      var s = getShown();
      s[id] = 1;
      var keys = Object.keys(s);
      if (keys.length > 100) keys.slice(0, keys.length - 70).forEach(function (k) { delete s[k]; });
      localStorage.setItem(SHOWN_KEY, JSON.stringify(s));
    } catch (_) {}
  }
  function notifKey(n) {
    return (n.title || '') + '|' + (n.body || '') + '|' + Math.floor((n.time || 0) / 60000);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }
  function relativeTime(ts) {
    if (!ts) return '';
    var diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function ensureStyles() {
    if (document.getElementById('pp-notif-styles')) return;
    var style = document.createElement('style');
    style.id = 'pp-notif-styles';
    style.textContent = [
      '.pp-notif-list{display:flex;flex-direction:column;gap:14px;padding:8px 18px 28px;max-width:340px;margin:0 auto;width:100%;box-sizing:border-box;}',
      '.pp-notif-card{display:flex;gap:14px;align-items:flex-start;min-height:88px;',
      'padding:18px 16px;background:#fff;border:1px solid #e8eef5;border-radius:18px;',
      'box-shadow:0 6px 20px rgba(15,23,42,.07);}',
      '.pp-notif-icon{flex-shrink:0;width:48px;height:48px;border-radius:14px;margin-top:2px;',
      'background:linear-gradient(145deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 6px 14px rgba(37,99,235,.3);}',
      '.pp-notif-body{flex:1;min-width:0;padding-top:2px;}',
      '.pp-notif-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;}',
      '.pp-notif-title{font-size:15px;font-weight:700;color:#0f172a;line-height:1.35;letter-spacing:-.01em;}',
      '.pp-notif-time{font-size:11px;font-weight:600;color:#94a3b8;white-space:nowrap;flex-shrink:0;padding-top:3px;}',
      '.pp-notif-msg{font-size:13.5px;line-height:1.55;color:#64748b;word-break:break-word;}',
      '.pp-notif-empty{text-align:center;padding:56px 24px;color:#94a3b8;max-width:300px;margin:0 auto;}',
      '.pp-notif-empty-icon{width:64px;height:64px;margin:0 auto 16px;border-radius:18px;',
      'background:linear-gradient(145deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 8px 20px rgba(37,99,235,.25);}'
    ].join('');
    document.head.appendChild(style);
  }

  function cardHtml(n) {
    return (
      '<div class="pp-notif-card">' +
        '<div class="pp-notif-icon">' + BELL_SVG + '</div>' +
        '<div class="pp-notif-body">' +
          '<div class="pp-notif-top">' +
            '<div class="pp-notif-title">' + escapeHtml(n.title || 'PuppyPay') + '</div>' +
            '<div class="pp-notif-time">' + escapeHtml(relativeTime(n.time)) + '</div>' +
          '</div>' +
          (n.body ? '<div class="pp-notif-msg">' + escapeHtml(n.body) + '</div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function emptyHtml() {
    return (
      '<div class="pp-notif-empty">' +
        '<div class="pp-notif-empty-icon">' + BELL_SVG + '</div>' +
        '<p style="font-size:15px;font-weight:700;color:#64748b;margin:0 0 6px;">No notifications yet</p>' +
        '<p style="font-size:13px;margin:0;color:#94a3b8;line-height:1.4;">Updates & rewards will appear here</p>' +
      '</div>'
    );
  }

  function showSystem(title, body, id) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    buildIconPng(function (icon) {
      try {
        new Notification(title || 'PuppyPay', {
          body: body || '',
          icon: icon,
          badge: icon,
          tag: 'puppypay-' + (id || Date.now()),
          renotify: true,
          requireInteraction: false
        });
      } catch (_) {}
    });
  }

  function fireNewSystem(items) {
    var shown = getShown();
    items.forEach(function (n) {
      var id = notifKey(n);
      if (shown[id]) return;
      markShown(id);
      showSystem(n.title || 'PuppyPay', n.body || '', id);
    });
  }

  async function loadServer() {
    if (typeof walletApiCall !== 'function') return;
    try {
      var res = await walletApiCall('/notifications', 'GET');
      if (!res.ok || !res.data || !res.data.success) return;
      var server = (res.data.notifications || []).map(function (n) {
        return {
          title: n.title || 'PuppyPay',
          body: n.body || '',
          time: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
          fromServer: true
        };
      });
      var local = getList().filter(function (n) { return !n.fromServer; });
      var merged = server.concat(local).sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
      var seen = {}, unique = [];
      merged.forEach(function (n) {
        var k = notifKey(n);
        if (seen[k]) return;
        seen[k] = 1;
        unique.push(n);
      });
      saveList(unique);
      fireNewSystem(server);
      try { await walletApiCall('/notifications/read', 'POST', {}); } catch (_) {}
    } catch (_) {}
  }

  window.renderNotifications = function () {
    ensureStyles();
    var list = document.getElementById('notificationsList');
    if (!list) return;
    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
    loadServer().then(function () {
      var items = getList();
      if (!items.length) {
        list.innerHTML = emptyHtml();
        return;
      }
      list.innerHTML = '<div class="pp-notif-list">' + items.map(cardHtml).join('') + '</div>';
    });
  };

  window.pushLocalNotification = function (title, body) {
    var list = getList();
    list.unshift({ title: title, body: body, time: Date.now() });
    saveList(list);
    var id = notifKey({ title: title, body: body, time: Date.now() });
    markShown(id);
    showSystem(title, body, id);
    try { if (typeof window.renderNotifications === 'function') window.renderNotifications(); } catch (_) {}
  };

  /* Ask permission once if default (needed for system bar) */
  function ensurePermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default' && localStorage.getItem('puppypay_notif_never') !== '1') {
      /* soft — don't force popup; user can Allow from Notifications screen */
    }
  }

  /* Poll every 8s while app open so admin-sent msgs hit system bar fast */
  setInterval(function () {
    if (localStorage.getItem('puppypay_token')) loadServer();
  }, 8000);

  function boot() {
    ensurePermission();
    buildIconPng(function () {});
    if (localStorage.getItem('puppypay_token')) loadServer();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  } else {
    setTimeout(boot, 600);
  }
})();
