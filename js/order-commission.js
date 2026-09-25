/* Order commission display: first order 10%, then 4.9% + Rs4 */
(function () {
  function firstDone() {
    try {
      if (window.__dashboard) {
        var s = window.__dashboard.stats || window.__dashboard;
        var n = s.completeOrders ?? s.completedOrders ?? s.totalOrders ?? 0;
        if (Number(n) > 0) return true;
      }
      if (localStorage.getItem('puppypay_first_order_done') === '1') return true;
    } catch (_) {}
    return false;
  }
  function shortId(oid) {
    if (typeof shortOrderId === 'function') return shortOrderId(oid);
    var s = String(oid || '');
    return s.length <= 10 ? s : s.slice(0, 3) + '\u2026' + s.slice(-4);
  }
  window.renderOrderCard = function (o, opts) {
    var oid = o.orderId || o.id || '';
    var amt = Number(o.amount) || 0;
    var isFirst = !firstDone();
    var rate, reward;
    if (o.reward != null && o.profitRate != null) {
      rate = (o.profitRate * 100).toFixed(1);
      reward = o.reward;
      isFirst = false;
    } else if (isFirst) {
      rate = '10';
      reward = Math.round(amt * 0.10 * 100) / 100;
    } else {
      rate = '4.9';
      reward = Math.round((Math.round(amt * 0.049 * 100) / 100 + 4) * 100) / 100;
    }
    var topClass = opts && opts.isTop ? ' order-card-top' : '';
    var badge = isFirst
      ? '<div class="order-first-badge">First order \u00b7 10% profit</div>'
      : '<div class="order-first-badge" style="background:#ecfdf5;border-color:#6ee7b7;color:#047857;">4.9% + \u20b94</div>';
    var extra = isFirst ? '' : '<span class="order-profit-extra">+\u20b94</span>';
    var buying = (typeof buyingOrderId !== 'undefined' && buyingOrderId === oid);
    return '<div class="order-card' + topClass + '" data-order-id="' + oid + '"><div class="order-card-left"><div class="order-amount">' + formatINR(amt) + '</div><div class="order-id-row">ID ' + shortId(oid) + '</div><div class="order-profit-row"><span class="order-profit">+' + formatINR(reward) + '</span><span class="order-rate">' + rate + '%</span>' + extra + '</div>' + badge + '</div><button class="btn btn-primary btn-buy" data-buy="' + oid + '" ' + (buying ? 'disabled' : '') + '>' + (buying ? '...' : 'Buy') + '</button></div>';
  };

  window.paintOrders = function (orders) {
    var list = document.getElementById('ordersList');
    if (!list) return;
    var filtered = typeof applyOrderFilter === 'function' ? applyOrderFilter(orders) : (orders || []);
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><p>No orders in this range</p></div>';
      return;
    }
    list.innerHTML = filtered.map(function (o, i) {
      return window.renderOrderCard(o, { isTop: i === 0 });
    }).join('');
  };

  setTimeout(function () {
    if (typeof loadDashboard !== 'function') return;
    var orig = loadDashboard;
    window.loadDashboard = async function () {
      var r = await orig.apply(this, arguments);
      try {
        if (window.__dashboard) {
          var s = window.__dashboard.stats || window.__dashboard;
          var n = s.completeOrders ?? s.completedOrders ?? 0;
          if (Number(n) > 0) localStorage.setItem('puppypay_first_order_done', '1');
        }
      } catch (_) {}
      return r;
    };
  }, 0);
})();
