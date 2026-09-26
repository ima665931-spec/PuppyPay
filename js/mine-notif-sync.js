/* PuppyPay — pull admin notifications into notification bar */
(function () {
  function getList() {
    try { return JSON.parse(localStorage.getItem('puppypay_notifications') || '[]'); } catch (_) { return []; }
  }
  function saveList(list) {
    try { localStorage.setItem('puppypay_notifications', JSON.stringify(list.slice(0, 50))); } catch (_) {}
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
        var k = (n.title || '') + '|' + (n.body || '') + '|' + Math.floor((n.time || 0) / 60000);
        if (seen[k]) return;
        seen[k] = 1;
        unique.push(n);
      });
      saveList(unique);
      try { await walletApiCall('/notifications/read', 'POST', {}); } catch (_) {}
    } catch (_) {}
  }
  window.renderNotifications = function () {
    var list = document.getElementById('notificationsList');
    if (!list) return;
    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div></div>';
    loadServer().then(function () {
      var items = getList();
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p>No notifications yet</p></div>';
        return;
      }
      list.innerHTML = items.map(function (n) {
        return '<div class="history-card" style="margin-bottom:10px;"><div class="history-card-top"><div class="history-card-title">' +
          (n.title || 'Notification') + '</div><div class="text-xs text-muted">' +
          (n.time ? new Date(n.time).toLocaleString('en-IN') : '') +
          '</div></div><div class="text-sm text-secondary">' + (n.body || '') + '</div></div>';
      }).join('');
    });
  };
  setInterval(function () {
    if (localStorage.getItem('puppypay_token')) loadServer();
  }, 30000);
})();
