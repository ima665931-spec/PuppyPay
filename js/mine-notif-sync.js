/* PuppyPay — notifications UI + system bar (permission only on user tap) */
(function () {
  var LIST_KEY = 'puppypay_notifications';
  var SHOWN_KEY = 'puppypay_notif_shown';
  var NEVER_KEY = 'puppypay_notif_never';
  var ICON_PNG = null;

  function buildIconPng(cb) {
    if (ICON_PNG) { cb(ICON_PNG); return; }
    try {
      var c = document.createElement('canvas');
      c.width = 192; c.height = 192;
      var ctx = c.getContext('2d');
      /* rounded square bg */
      var r = 40;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(192 - r, 0); ctx.quadraticCurveTo(192, 0, 192, r);
      ctx.lineTo(192, 192 - r); ctx.quadraticCurveTo(192, 192, 192 - r, 192);
      ctx.lineTo(r, 192); ctx.quadraticCurveTo(0, 192, 0, 192 - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(62, 88);
      ctx.quadraticCurveTo(62, 58, 96, 58);
      ctx.quadraticCurveTo(130, 58, 130, 88);
      ctx.lineTo(130, 110);
      ctx.lineTo(142, 126);
      ctx.lineTo(50, 126);
      ctx.lineTo(62, 110);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath(); ctx.arc(96, 140, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(96, 52, 7, 0, Math.PI * 2); ctx.stroke();
      ICON_PNG = c.toDataURL('image/png');
      cb(ICON_PNG);
    } catch (_) {
      cb((location.origin || '') + '/assets/logo.svg');
    }
  }

  var BELL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

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
      /* list */
      '.pp-nlist{display:flex;flex-direction:column;gap:10px;padding:4px 0 24px;}',
      /* card — full width, taller, clean */
      '.pp-ncard{position:relative;display:flex;gap:12px;align-items:flex-start;',
      'padding:16px 14px 16px 14px;min-height:76px;',
      'background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);',
      'border:1px solid rgba(226,232,240,0.95);border-radius:16px;',
      'box-shadow:0 2px 12px rgba(15,23,42,0.05);overflow:hidden;}',
      '.pp-ncard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;',
      'background:linear-gradient(180deg,#3b82f6,#60a5fa);border-radius:16px 0 0 16px;}',
      '.pp-nicon{flex-shrink:0;width:40px;height:40px;border-radius:12px;',
      'background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;}',
      '.pp-nbody{flex:1;min-width:0;}',
      '.pp-nrow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;}',
      '.pp-ntitle{font-size:14px;font-weight:700;color:#0f172a;line-height:1.3;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}',
      '.pp-ntime{font-size:11px;font-weight:600;color:#94a3b8;flex-shrink:0;}',
      '.pp-nmsg{font-size:13px;line-height:1.5;color:#64748b;display:-webkit-box;',
      '-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}',
      /* empty */
      '.pp-nempty{text-align:center;padding:48px 20px;}',
      '.pp-nempty-ic{width:56px;height:56px;margin:0 auto 14px;border-radius:16px;',
      'background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;}',
      /* permission banner — only when needed */
      '.pp-nperm{margin:0 0 14px;padding:14px 14px;border-radius:16px;',
      'background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;}',
      '.pp-nperm-title{font-size:13px;font-weight:700;color:#1e40af;margin:0 0 4px;}',
      '.pp-nperm-desc{font-size:12px;color:#3b82f6;margin:0 0 12px;line-height:1.4;}',
      '.pp-nperm-btns{display:flex;gap:8px;flex-wrap:wrap;}',
      '.pp-nperm-btns button{border:none;border-radius:10px;padding:8px 14px;font-size:12px;',
      'font-weight:700;cursor:pointer;font-family:inherit;}',
      '.pp-nperm-allow{background:#2563eb;color:#fff;}',
      '.pp-nperm-later{background:#fff;color:#64748b;border:1px solid #e2e8f0 !important;}',
      '.pp-nperm-never{background:transparent;color:#94a3b8;padding:8px 6px;}'
    ].join('');
    document.head.appendChild(style);
  }

  function cardHtml(n) {
    return (
      '<div class="pp-ncard">' +
        '<div class="pp-nicon">' + BELL + '</div>' +
        '<div class="pp-nbody">' +
          '<div class="pp-nrow">' +
            '<div class="pp-ntitle">' + escapeHtml(n.title || 'PuppyPay') + '</div>' +
            '<div class="pp-ntime">' + escapeHtml(relativeTime(n.time)) + '</div>' +
          '</div>' +
          (n.body ? '<div class="pp-nmsg">' + escapeHtml(n.body) + '</div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function emptyHtml() {
    return (
      '<div class="pp-nempty">' +
        '<div class="pp-nempty-ic">' + BELL + '</div>' +
        '<p style="font-size:14px;font-weight:700;color:#64748b;margin:0 0 4px;">No notifications yet</p>' +
        '<p style="font-size:12px;margin:0;color:#94a3b8;">Updates & rewards will show here</p>' +
      '</div>'
    );
  }

  /* Show Allow banner ONLY if permission is still default and user didn't say never */
  function permBannerHtml() {
    if (!('Notification' in window)) return '';
    if (localStorage.getItem(NEVER_KEY) === '1') return '';
    if (Notification.permission !== 'default') return '';
    return (
      '<div class="pp-nperm" id="ppNotifPermBanner">' +
        '<div class="pp-nperm-title">Enable notifications</div>' +
        '<div class="pp-nperm-desc">Get deposit, bonus & account alerts on your phone</div>' +
        '<div class="pp-nperm-btns">' +
          '<button type="button" class="pp-nperm-allow" id="ppNotifAllowBtn">Allow</button>' +
          '<button type="button" class="pp-nperm-later" id="ppNotifLaterBtn">Later</button>' +
          '<button type="button" class="pp-nperm-never" id="ppNotifNeverBtn">Never</button>' +
        '</div>' +
      '</div>'
    );
  }

  function bindPermButtons() {
    var allow = document.getElementById('ppNotifAllowBtn');
    var later = document.getElementById('ppNotifLaterBtn');
    var never = document.getElementById('ppNotifNeverBtn');
    var banner = document.getElementById('ppNotifPermBanner');
    if (allow && !allow._ppBound) {
      allow._ppBound = true;
      allow.addEventListener('click', function () {
        /* ONLY here — user tap triggers Android/Chrome permission popup */
        if (!('Notification' in window)) return;
        Notification.requestPermission().then(function (perm) {
          if (banner) banner.style.display = 'none';
          /* hide old mine.js box too */
          var old = document.getElementById('notifPermissionBox');
          if (old) old.style.display = 'none';
          if (perm === 'granted') {
            if (typeof showToast === 'function') showToast('Notifications enabled', 'success');
            showSystem('PuppyPay', 'You will receive updates here');
          } else if (typeof showToast === 'function') {
            showToast('Permission denied', 'error');
          }
        }).catch(function () {});
      });
    }
    if (later && !later._ppBound) {
      later._ppBound = true;
      later.addEventListener('click', function () {
        if (banner) banner.style.display = 'none';
      });
    }
    if (never && !never._ppBound) {
      never._ppBound = true;
      never.addEventListener('click', function () {
        localStorage.setItem(NEVER_KEY, '1');
        if (banner) banner.style.display = 'none';
        var old = document.getElementById('notifPermissionBox');
        if (old) old.style.display = 'none';
      });
    }
  }

  function showSystem(title, body, id) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    buildIconPng(function (icon) {
      try {
        new Notification(title || 'PuppyPay', {
          body: body || '',
          icon: icon,
          badge: icon,
          tag: 'puppypay-' + (id || Date.now()),
          renotify: true
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
    /* hide old glass permission box from mine.js — we handle it */
    var oldBox = document.getElementById('notifPermissionBox');
    if (oldBox) oldBox.style.display = 'none';

    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
    loadServer().then(function () {
      var items = getList();
      var html = permBannerHtml();
      if (!items.length) {
        list.innerHTML = html + emptyHtml();
      } else {
        list.innerHTML = html + '<div class="pp-nlist">' + items.map(cardHtml).join('') + '</div>';
      }
      bindPermButtons();
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

  /* NEVER auto-call Notification.requestPermission — only on Allow button */
  setInterval(function () {
    if (localStorage.getItem('puppypay_token')) loadServer();
  }, 8000);

  function boot() {
    buildIconPng(function () {});
    if (localStorage.getItem('puppypay_token')) loadServer();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  } else {
    setTimeout(boot, 600);
  }
})();
