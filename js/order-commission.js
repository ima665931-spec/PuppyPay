/* Order commission + Orders P0 UI
   First order: 10% | After: 4.9% + Rs4
   Chips: All / High / New | Tabs: Available / My Orders */
(function () {
  var orderChip = 'all';
  var ordersTab = 'available';

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

  function calcReward(amt) {
    amt = Number(amt) || 0;
    if (!firstDone()) {
      return { rate: '10', reward: Math.round(amt * 0.10 * 100) / 100, isFirst: true };
    }
    return {
      rate: '4.9',
      reward: Math.round((Math.round(amt * 0.049 * 100) / 100 + 4) * 100) / 100,
      isFirst: false
    };
  }

  function updateSummary(orders) {
    var list = orders || (typeof allOrdersCache !== 'undefined' ? allOrdersCache : []) || [];
    var avail = document.getElementById('ordersAvailableCount');
    if (avail) avail.textContent = String(list.length);

    var todayEl = document.getElementById('ordersTodayEarn');
    try {
      var s = (window.__dashboard && (window.__dashboard.stats || window.__dashboard)) || {};
      var te = s.todaySold ?? s.todayCommission ?? s.todayEarn ?? null;
      if (todayEl) {
        if (te != null && typeof formatINR === 'function') todayEl.textContent = formatINR(te);
        else todayEl.textContent = '\u20b90';
      }
    } catch (_) {
      if (todayEl) todayEl.textContent = '\u20b90';
    }

    var firstCard = document.getElementById('ordersFirstBonusCard');
    var firstVal = document.getElementById('ordersFirstBonus');
    if (firstDone()) {
      if (firstCard) firstCard.classList.add('done');
      if (firstVal) firstVal.textContent = 'Done';
    } else {
      if (firstCard) firstCard.classList.remove('done');
      if (firstVal) firstVal.textContent = '+10%';
    }
  }

  window.renderOrderCard = function (o, opts) {
    var oid = o.orderId || o.id || '';
    var amt = Number(o.amount) || 0;
    var isFirst, rate, reward;

    if (o.reward != null && o.profitRate != null) {
      rate = (o.profitRate * 100).toFixed(1);
      reward = o.reward;
      isFirst = false;
    } else {
      var c = calcReward(amt);
      rate = c.rate;
      reward = c.reward;
      isFirst = c.isFirst;
    }

    var topClass = opts && opts.isTop ? ' order-card-top' : '';
    var firstBadge = isFirst ? '<span class="order-first-badge">FIRST +10%</span>' : '';
    var extra = isFirst ? '' : '<span class="order-profit-extra">+\u20b94</span>';
    var buying = typeof buyingOrderId !== 'undefined' && buyingOrderId === oid;
    var amtStr = typeof formatINR === 'function' ? formatINR(amt) : ('\u20b9' + amt);
    var rewStr = typeof formatINR === 'function' ? formatINR(reward) : ('\u20b9' + reward);

    return (
      '<div class="order-card' + topClass + (isFirst ? ' order-card-first' : '') + '" data-order-id="' + oid + '">' +
        '<div class="order-card-left">' +
          '<div class="order-amount-row">' +
            '<div class="order-amount">' + amtStr + '</div>' +
            firstBadge +
          '</div>' +
          '<div class="order-id-row">' +
            '<span>ID ' + shortId(oid) + '</span>' +
            '<button type="button" class="order-copy-id" data-copy-id="' + oid + '" title="Copy ID" aria-label="Copy order ID">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="order-profit-row">' +
            '<span class="order-profit">+' + rewStr + '</span>' +
            '<span class="order-rate">' + rate + '%</span>' +
            extra +
          '</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-buy" data-buy="' + oid + '" ' + (buying ? 'disabled' : '') + '>' +
          (buying ? '...' : 'Buy') +
        '</button>' +
      '</div>'
    );
  };

  function applyChips(orders) {
    var list = (orders || []).slice();
    if (orderChip === 'high') {
      list.sort(function (a, b) { return (Number(b.amount) || 0) - (Number(a.amount) || 0); });
    } else if (orderChip === 'new') {
      list.sort(function (a, b) {
        var ta = new Date(a.createdAt || a.created || 0).getTime() || 0;
        var tb = new Date(b.createdAt || b.created || 0).getTime() || 0;
        if (tb !== ta) return tb - ta;
        return String(b.orderId || b.id || '').localeCompare(String(a.orderId || a.id || ''));
      });
    } else {
      list.sort(function (a, b) { return (Number(a.amount) || 0) - (Number(b.amount) || 0); });
    }
    return list;
  }

  window.paintOrders = function (orders) {
    updateSummary(orders);
    if (ordersTab !== 'available') return;

    var list = document.getElementById('ordersList');
    if (!list) return;

    var filtered = typeof applyOrderFilter === 'function' ? applyOrderFilter(orders) : (orders || []);
    filtered = applyChips(filtered);

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><p>No orders in this range</p><p class="empty-hint">Pull to refresh or clear filters</p></div>';
      return;
    }
    list.innerHTML = filtered.map(function (o, i) {
      return window.renderOrderCard(o, { isTop: i === 0 });
    }).join('');
  };

  function setTab(tab) {
    ordersTab = tab;
    document.querySelectorAll('.orders-tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-otab') === tab);
    });
    var availList = document.getElementById('ordersList');
    var mineList = document.getElementById('myOrdersList');
    var chips = document.getElementById('orderChips');
    var filterBar = document.getElementById('orderFilterBar');

    if (tab === 'available') {
      if (availList) availList.style.display = '';
      if (mineList) mineList.style.display = 'none';
      if (chips) chips.style.display = '';
      if (filterBar) filterBar.style.display = '';
      if (typeof allOrdersCache !== 'undefined') window.paintOrders(allOrdersCache);
    } else {
      if (availList) availList.style.display = 'none';
      if (mineList) mineList.style.display = '';
      if (chips) chips.style.display = 'none';
      if (filterBar) filterBar.style.display = 'none';
      loadMyOrders();
    }
  }

  async function loadMyOrders() {
    var list = document.getElementById('myOrdersList');
    if (!list) return;
    list.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><p>Loading...</p></div>';
    try {
      var api = window.__puppypayWalletApiCall || (typeof walletApiCall === 'function' ? walletApiCall : null);
      if (!api) {
        list.innerHTML = '<div class="empty-state"><p>Could not load</p></div>';
        return;
      }
      var res = await api('/my-orders', 'GET');
      var items = [];
      if (res.ok && res.data && res.data.success && (res.data.orders || res.data.list)) {
        items = res.data.orders || res.data.list || [];
      } else {
        res = await api('/history', 'GET');
        if (res.ok && res.data && res.data.success) {
          items = (res.data.history || res.data.deposits || []).map(function (h) {
            return {
              orderId: h.orderId || h.id || h._id || '\u2014',
              amount: h.amount,
              status: h.status || 'completed',
              createdAt: h.createdAt || h.time,
              reward: h.commission || h.reward || h.profit
            };
          });
        }
      }

      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p>No buys yet</p><p class="empty-hint">Complete an order from Available tab</p></div>';
        return;
      }

      list.innerHTML = items.slice(0, 50).map(function (o) {
        var st = String(o.status || 'done').toLowerCase();
        var badge =
          st.indexOf('pend') >= 0 || st.indexOf('process') >= 0 ? 'wait' :
          st.indexOf('fail') >= 0 || st.indexOf('cancel') >= 0 ? 'bad' : 'ok';
        var label = badge === 'wait' ? 'Pending' : badge === 'bad' ? 'Failed' : 'Completed';
        var amtStr = typeof formatINR === 'function' ? formatINR(o.amount) : ('\u20b9' + (o.amount || 0));
        var rew = o.reward != null
          ? (typeof formatINR === 'function' ? formatINR(o.reward) : ('\u20b9' + o.reward))
          : '';
        var time = o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        return (
          '<div class="my-order-card">' +
            '<div class="my-order-top">' +
              '<div class="my-order-amt">' + amtStr + '</div>' +
              '<span class="history-status ' + badge + '">' + label + '</span>' +
            '</div>' +
            '<div class="my-order-meta">' +
              '<span>ID ' + shortId(o.orderId) + '</span>' +
              (rew ? '<span class="my-order-earn">+' + rew + '</span>' : '') +
              (time ? '<span class="my-order-time">' + time + '</span>' : '') +
            '</div>' +
          '</div>'
        );
      }).join('');
    } catch (e) {
      list.innerHTML = '<div class="empty-state"><p>Could not load your orders</p></div>';
    }
  }

  function wireUI() {
    document.querySelectorAll('.orders-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-otab') || 'available');
      });
    });

    document.querySelectorAll('.order-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        orderChip = btn.getAttribute('data-chip') || 'all';
        document.querySelectorAll('.order-chip').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        if (typeof allOrdersCache !== 'undefined') window.paintOrders(allOrdersCache);
      });
    });

    var ol = document.getElementById('ordersList');
    if (ol) {
      ol.addEventListener('click', function (e) {
        var copyBtn = e.target.closest('[data-copy-id]');
        if (!copyBtn) return;
        e.preventDefault();
        e.stopPropagation();
        var id = copyBtn.getAttribute('data-copy-id');
        if (!id) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(id).then(function () {
            if (typeof showToast === 'function') showToast('Order ID copied', 'success');
          }).catch(function () {
            if (typeof showToast === 'function') showToast(id, 'success');
          });
        } else if (typeof showToast === 'function') {
          showToast(id, 'success');
        }
      });
    }
  }

  setTimeout(function () {
    if (typeof loadDashboard === 'function') {
      var orig = loadDashboard;
      window.loadDashboard = async function () {
        var r = await orig.apply(this, arguments);
        try {
          if (window.__dashboard) {
            var s = window.__dashboard.stats || window.__dashboard;
            var n = s.completeOrders ?? s.completedOrders ?? 0;
            if (Number(n) > 0) localStorage.setItem('puppypay_first_order_done', '1');
          }
          updateSummary(typeof allOrdersCache !== 'undefined' ? allOrdersCache : []);
        } catch (_) {}
        return r;
      };
    }
    wireUI();
    updateSummary([]);
  }, 0);
})();
