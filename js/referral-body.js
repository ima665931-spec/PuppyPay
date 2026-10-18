/* PuppyPay - Premium Referral / Team section */
(function () {
  const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  const WA_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.5-1-.9-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9 2.6 1.1 2.6.7 3.1.7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1 0-.3-.1-.6-.2z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3C4.4 15 4 13.5 4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8.2-8 8.2z"/></svg>';
  const QR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M17 17h3v3"/></svg>';

  let _refFilter = 'all';
  let _refCache = [];

  function getInviteLink(code) {
    return 'https://frevak.online/?ref=' + encodeURIComponent(code || '');
  }
  function getShareText(code) {
    return 'Join PuppyPay with my code *' + code + '*!\n' + getInviteLink(code);
  }
  function getCurrentCode() {
    var el = document.getElementById('myReferralCode');
    var code = (el && el.textContent) ? el.textContent.trim() : '';
    return (!code || code === '\u2014') ? '' : code;
  }
  function setReferralCode(code) {
    if (!code) return;
    var el = document.getElementById('myReferralCode');
    if (el) el.textContent = code;
    var img = document.getElementById('refQrImg');
    var wrap = document.getElementById('refQrWrap');
    if (img && wrap) {
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=' + encodeURIComponent(getInviteLink(code));
      wrap.style.display = 'flex';
    }
  }
  function copyText(t, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () {
        if (typeof showToast === 'function') showToast(msg || 'Copied!', 'success');
      }).catch(function () {});
    }
  }

  async function transferReferralToMain() {
    var btn = document.getElementById('refTransferBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Transferring...'; }
    try {
      var balEl = document.getElementById('refWalletBal');
      var bal = 0;
      if (balEl) {
        bal = parseFloat(String(balEl.textContent).replace(/[^\d.]/g, '')) || 0;
      }
      if (!Number.isFinite(bal) || bal < 100) {
        if (typeof showToast === 'function') showToast('Minimum transfer is \u20b9100', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Transfer to Main'; }
        return;
      }
      bal = Math.round(bal * 100) / 100;
      var res = await walletApiCall('/referrals/transfer', 'POST', { amount: bal });
      var data = (res && res.data) ? res.data : {};
      if (res && res.ok && data.success) {
        if (typeof showToast === 'function') showToast(data.message || 'Transferred to main wallet', 'success');
        if (typeof loadDashboard === 'function') loadDashboard();
        loadReferrals();
      } else {
        if (typeof showToast === 'function') showToast((data && data.message) || 'Transfer failed', 'error');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Network error', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Transfer to Main'; }
  }

  function renderReferralList(list) {
    var el = document.getElementById('referralList');
    if (!el) return;
    var items = Array.isArray(list) ? list.slice() : [];
    if (_refFilter === 'active') items = items.filter(function (r) { return r.active || r.status === 'active'; });
    if (_refFilter === 'pending') items = items.filter(function (r) { return !r.active && r.status !== 'active'; });
    var countEl = document.getElementById('refListCount');
    if (countEl) countEl.textContent = items.length ? (items.length + ' members') : '';
    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><p>No referrals yet. Share your code!</p></div>';
      return;
    }
    el.innerHTML = items.map(function (r) {
      var name = r.name || r.mobile || r.appId || 'User';
      var initial = String(name).charAt(0).toUpperCase();
      var earn = (typeof formatINR === 'function' ? formatINR(r.earned || r.amount || 0) : ('\u20b9' + (r.earned || 0)));
      return '<div class="ref-card"><div class="ref-card-av">' + initial + '</div><div class="ref-card-body"><div class="ref-card-name">' + name + '</div><div class="ref-card-meta">' + (r.appId || '') + '</div></div><div class="ref-card-right"><div class="ref-card-earn">' + earn + '</div></div></div>';
    }).join('');
  }

  async function loadReferrals() {
    injectReferralUI();
    try {
      var data = {};
      if (typeof walletApiCall === 'function') {
        var res = await walletApiCall('/referrals', 'GET');
        data = (res && res.data) ? res.data : (res || {});
      }
      if (data.success === false) data = {};
      var count = data.count ?? data.totalReferrals ?? 0;
      var activeN = data.activeCount ?? data.active ?? 0;
      var totalEarned = data.totalEarned ?? data.totalEarnings ?? 0;
      var refBal = data.referralBalance ?? 0;
      var earnEl = document.getElementById('refEarnings');
      var countEl = document.getElementById('refCount');
      var activeEl = document.getElementById('refActive');
      var monthEl = document.getElementById('refMonth');
      var balEl = document.getElementById('refWalletBal');
      if (countEl) countEl.textContent = String(count);
      if (activeEl) activeEl.textContent = String(activeN);
      if (earnEl) earnEl.textContent = (typeof formatINR === 'function' ? formatINR(totalEarned) : ('\u20b9' + totalEarned));
      if (monthEl) monthEl.textContent = (typeof formatINR === 'function' ? formatINR(data.monthEarnings ?? 0) : ('\u20b9' + (data.monthEarnings || 0)));
      if (balEl) balEl.textContent = (typeof formatINR === 'function' ? formatINR(refBal) : ('\u20b9' + refBal));
      if (data.referralCode) setReferralCode(data.referralCode);
      _refCache = data.referrals || data.list || data.team || data.referredUsers || [];
      renderReferralList(_refCache);
    } catch (e) {}
  }

  function injectReferralUI() {
    var team = document.getElementById('teamView');
    if (!team) return;
    var pc = team.querySelector('.page-content');
    if (!pc) return;
    if (pc.querySelector('#refWalletCard')) return;
    var header = team.querySelector('.page-header h2');
    if (header) header.textContent = 'Refer & Earn';
    pc.innerHTML = '<div class="ref-hero"><div class="ref-hero-label">YOUR REFERRAL CODE</div><div class="ref-code-row"><span class="ref-code" id="myReferralCode">\u2014</span><button type="button" class="ref-icon-btn" id="copyRefBtn" title="Copy">' + COPY_SVG + '</button><button type="button" class="ref-icon-btn" id="copyRefLinkBtn" title="Link">' + SHARE_SVG + '</button></div><div class="ref-qr-wrap" id="refQrWrap" style="display:none"><img class="ref-qr-img" id="refQrImg" alt="QR" width="160" height="160"><p class="ref-qr-hint">Scan to join with your code</p></div><div class="ref-share-row"><button type="button" class="btn btn-primary btn-sm" id="shareWaBtn">' + WA_SVG + ' WhatsApp</button><button type="button" class="btn btn-secondary btn-sm" id="shareMoreBtn">' + SHARE_SVG + ' Share</button></div></div><div class="ref-stats"><div class="ref-stat"><div class="lbl">Total Referrals</div><div class="val" id="refCount">0</div></div><div class="ref-stat green"><div class="lbl">Total Earned</div><div class="val" id="refEarnings">\u20b90</div></div><div class="ref-stat"><div class="lbl">Active</div><div class="val" id="refActive">0</div></div><div class="ref-stat green"><div class="lbl">This Month</div><div class="val" id="refMonth">\u20b90</div></div></div><div class="ref-wallet-card" id="refWalletCard"><div class="ref-wallet-top"><div><div class="ref-wallet-label">Referral Wallet</div><div class="ref-wallet-bal" id="refWalletBal">\u20b90</div></div><button type="button" class="btn btn-primary btn-sm" id="refTransferBtn">Transfer to Main</button></div><p class="ref-wallet-hint">Min transfer \u20b9100 \u00b7 Then withdrawable from main wallet</p></div><div class="ref-section-title"><span>Your team</span><span class="text-xs text-muted" id="refListCount"></span></div><div class="ref-filter" id="refFilterBar"><button type="button" class="active" data-filter="all">All</button><button type="button" data-filter="active">Active</button><button type="button" data-filter="pending">Pending</button></div><div id="referralList" class="empty-state"><p>No referrals yet. Share your code!</p></div>';
    document.getElementById('copyRefBtn')?.addEventListener('click', function () {
      var code = getCurrentCode();
      if (!code) return showToast('No code yet', 'error');
      copyText(code, 'Code copied!');
    });
    document.getElementById('copyRefLinkBtn')?.addEventListener('click', function () {
      var code = getCurrentCode();
      if (!code) return showToast('No code yet', 'error');
      copyText(getInviteLink(code), 'Invite link copied!');
    });
    document.getElementById('shareWaBtn')?.addEventListener('click', function () {
      var code = getCurrentCode();
      if (!code) return showToast('No code yet', 'error');
      window.open('https://wa.me/?text=' + encodeURIComponent(getShareText(code)), '_blank');
    });
    document.getElementById('shareMoreBtn')?.addEventListener('click', function () {
      var code = getCurrentCode();
      if (!code) return showToast('No code yet', 'error');
      var text = getShareText(code);
      if (navigator.share) navigator.share({ title: 'PuppyPay', text: text, url: getInviteLink(code) }).catch(function () { copyText(text, 'Copied!'); });
      else copyText(text, 'Copied!');
    });
    document.getElementById('refTransferBtn')?.addEventListener('click', transferReferralToMain);
    document.getElementById('refFilterBar')?.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      _refFilter = b.getAttribute('data-filter') || 'all';
      document.querySelectorAll('#refFilterBar button').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderReferralList(_refCache);
    });
    try {
      var user = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      if (user.referralCode) setReferralCode(user.referralCode);
    } catch (_) {}
  }

  window.loadReferrals = loadReferrals;
  window.injectReferralUI = injectReferralUI;
})();
