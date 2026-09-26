/* PuppyPay — notifications: in-app beautiful cards + system bar with logo */
(function () {
  var LOGO = (location.origin || '') + '/assets/logo.svg';
  var LIST_KEY = 'puppypay_notifications';
  var SHOWN_KEY = 'puppypay_notif_shown';

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
      if (keys.length > 80) keys.slice(0, keys.length - 60).forEach(function (k) { delete s[k]; });
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
    var d = new Date(ts);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function ensureStyles() {
    if (document.getElementById('pp-notif-styles')) return;
    var style = document.createElement('style');
    style.id = 'pp-notif-styles';
    style.textContent = [
      '.pp-notif-list{display:flex;flex-direction:column;gap:12px;padding:4px 0 20px;}',
      '.pp-notif-card{display:flex;gap:12px;align-items:flex-start;padding:14px 14px 14px 12px;',
      'background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(248,250,252,.88));',
      'border:1px solid rgba(226,232,240,.9);border-radius:16px;',
      'box-shadow:0 4px 16px rgba(15,23,42,.06);transition:transform .15s ease,box-shadow .15s;}',
      '.pp-notif-card:active{transform:scale(.98);}',
      '.pp-notif-icon{flex-shrink:0;width:42px;height:42px;border-radius:12px;',
      'background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 4px 12px rgba(37,99,235,.28);}',
      '.pp-notif-icon img{width:24px;height:24px;border-radius:6px;object-fit:contain;filter:brightness(0) invert(1);}',
      '.pp-notif-body{flex:1;min-width:0;}',
      '.pp-notif-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;}',
      '.pp-notif-title{font-size:14px;font-weight:700;color:#0f172a;line-height:1.3;letter-spacing:-.01em;}',
      '.pp-notif-time{font-size:11px;font-weight:500;color:#94a3b8;white-space:nowrap;flex-shrink:0;padding-top:2px;}',
      '.pp-notif-msg{font-size:13px;line-height:1.45;color:#64748b;word-break:break-word;}',
      '.pp-notif-empty{text-align:center;padding:48px 20px;color:#94a3b8;}',
      '.pp-notif-empty-icon{width:56px;height:56px;margin:0 auto 14px;border-radius:16px;',
      'background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;}',
      '.pp-notif-empty-icon img{width:28px;height:28px;opacity:.7;}'
    ].join('');
    document.head.appendChild(style);
  }

  function cardHtml(n) {
    var title = escapeHtml(n.title || 'PuppyPay');
    var body = escapeHtml(n.body || '');
    var time = relativeTime(n.time);
    return (
      '<div class="pp-notif-card">' +
        '<div class="pp-notif-icon"><img src="' + LOGO + '" alt="" onerror="this.style.display=\'none\'"></div>' +
        '<div class="pp-notif-body">' +
          '<div class="pp-notif-top">' +
            '<div class="pp-notif-title">' + title + '</div>' +
            '<div class="pp-notif-time">' + escapeHtml(time) + '</div>' +
          '</div>' +
          (body ? '<div class="pp-notif-msg">' + body + '</div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function emptyHtml() {
    return (
      '<div class="pp-notif-empty">' +
        '<div class="pp-notif-empty-icon"><img src="' + LOGO + '" alt=""></div>' +
        '<p style="font-size:14px;font-weight:600;color:#64748b;margin:0 0 4px;">No notifications yet</p>' +
        '<p style="font-size:12px;margin:0;color:#94a3b8;">Updates & rewards will show here</p>' +
      '</div>'
    );
  }

  function showSystem(title, body, id) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      var opts = {
        body: body || '',
        icon: LOGO,
        badge: LOGO,
        tag: 'puppypay-' + (id || Date.now()),
        renotify: false
      };
      new Notification(title || 'PuppyPay', opts);
    } catch (_) {}
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

  /* Patch local push so system bar gets logo */
  window.pushLocalNotification = function (title, body) {
    var list = getList();
    list.unshift({ title: title, body: body, time: Date.now() });
    saveList(list);
    var id = notifKey({ title: title, body: body, time: Date.now() });
    markShown(id);
    showSystem(title, body, id);
    if (typeof window.renderNotifications === 'function') {
      try { window.renderNotifications(); } catch (_) {}
    }
  };

  setInterval(function () {
    if (localStorage.getItem('puppypay_token')) loadServer();
  }, 30000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (localStorage.getItem('puppypay_token')) loadServer(); }, 800); });
  } else {
    setTimeout(function () { if (localStorage.getItem('puppypay_token')) loadServer(); }, 800);
  }
})();
