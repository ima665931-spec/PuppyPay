/* PuppyPay — notif cards: short + full width + tight gap */
(function () {
  var LIST_KEY = 'puppypay_notifications';
  var SHOWN_KEY = 'puppypay_notif_shown';
  var NEVER_KEY = 'puppypay_notif_never';
  var ASKED_KEY = 'puppypay_notif_asked';
  var ICON_PNG = null;

  function buildIconPng(cb) {
    if (ICON_PNG) { cb(ICON_PNG); return; }
    try {
      var c = document.createElement('canvas');
      c.width = 192; c.height = 192;
      var ctx = c.getContext('2d');
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
      ctx.lineTo(130, 110); ctx.lineTo(142, 126); ctx.lineTo(50, 126); ctx.lineTo(62, 110);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(96, 140, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(96, 52, 7, 0, Math.PI * 2); ctx.stroke();
      ICON_PNG = c.toDataURL('image/png');
      cb(ICON_PNG);
    } catch (_) {
      cb((location.origin || '') + '/assets/logo.svg');
    }
  }

  var BELL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

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
    var old = document.getElementById('pp-notif-styles');
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = 'pp-notif-styles';
    /* lambai kam | chodai full | gap kam */
    style.textContent = [
      '.pp-nlist{display:flex;flex-direction:column;gap:6px;padding:0 0 20px;width:100%;box-sizing:border-box;}',
      '.pp-ncard{display:flex;align-items:center;gap:12px;padding:12px 14px;min-height:0;',
      'background:linear-gradient(160deg,#ffffff 0%,#eff6ff 45%,#dbeafe 100%);',
      'border:1.5px solid #93c5fd;border-radius:14px;',
      'box-shadow:0 4px 12px rgba(37,99,235,0.08),0 1px 4px rgba(15,23,42,0.04);}',
      '.pp-nicon{flex-shrink:0;width:36px;height:36px;border-radius:10px;',
      'background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;}',
      '.pp-nbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}',
      '.pp-nrow{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '.pp-ntitle{font-size:14px;font-weight:800;color:#0f172a;line-height:1.25;letter-spacing:-.02em;flex:1;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.pp-ntime{font-size:11px;font-weight:600;color:#94a3b8;flex-shrink:0;}',
      '.pp-nmsg{font-size:12.5px;line-height:1.4;color:#64748b;word-break:break-word;',
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.pp-nempty{text-align:center;padding:40px 20px;}',
      '.pp-nempty-ic{width:40px;height:40px;margin:0 auto 10px;border-radius:12px;',
      'background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;}',
      '.pp-nperm{margin:0 0 10px;padding:12px 14px;border-radius:14px;',
      'background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1.5px solid #93c5fd;}',
      '.pp-nperm-title{font-size:13px;font-weight:800;color:#1e40af;margin:0 0 4px;}',
      '.pp-nperm-desc{font-size:12px;color:#3b82f6;margin:0 0 10px;line-height:1.4;}',
      '.pp-nperm-btns{display:flex;gap:8px;flex-wrap:wrap;}',
      '.pp-nperm-btns button{border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}',
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

  function permBannerHtml() {
    if (!('Notification' in window)) return '';
    if (localStorage.getItem(NEVER_KEY) === '1') return '';
    if (Notification.permission === 'granted') return '';
    if (Notification.permission === 'denied') {
      return (
        '<div class="pp-nperm" id="ppNotifPermBanner">' +
          '<div class="pp-nperm-title">Notifications blocked</div>' +
          '<div class="pp-nperm-desc">Browser settings me is site ke liye Notifications Allow karo</div>' +
        '</div>'
      );
    }
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

  function requestAndroidPermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    if (localStorage.getItem(NEVER_KEY) === '1') return Promise.resolve('never');
    try {
      localStorage.setItem(ASKED_KEY, '1');
      return Notification.requestPermission().then(function (perm) {
        var banner = document.getElementById('ppNotifPermBanner');
        var old = document.getElementById('notifPermissionBox');
        if (perm === 'granted' || perm === 'denied') {
          if (banner) banner.style.display = 'none';
          if (old) old.style.display = 'none';
        }
        if (perm === 'granted') {
          if (typeof showToast === 'function') showToast('Notifications enabled', 'success');
          showSystem('PuppyPay', 'You will receive updates here');
        }
        return perm;
      }).catch(function () { return 'error'; });
    } catch (_) {
      return Promise.resolve('error');
    }
  }

  function bindPermButtons() {
    var allow = document.getElementById('ppNotifAllowBtn');
    var later = document.getElementById('ppNotifLaterBtn');
    var never = document.getElementById('ppNotifNeverBtn');
    var banner = document.getElementById('ppNotifPermBanner');
    if (allow && !allow._ppBound) {
      allow._ppBound = true;
      allow.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        requestAndroidPermission();
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
    var oldBox = document.getElementById('notifPermissionBox');
    if (oldBox) oldBox.style.display = 'none';

    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';

    if ('Notification' in window && Notification.permission === 'default' && localStorage.getItem(NEVER_KEY) !== '1') {
      requestAndroidPermission();
    }

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
