/* PuppyPay - Premium Referral / Team section */
(function () {
  const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  const WA_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.5-1-.9-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9 2.6 1.1 2.6.7 3.1.7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1 0-.3-.1-.6-.2z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3C4.4 15 4 13.5 4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8.2-8 8.2z"/></svg>';
  const QR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M17 17h3v3"/></svg>';

  let _refFilter = 'all';
  let _refCache = [];

  function getInviteLink(code) {
    const base = (typeof location !== 'undefined' && location.origin) ? location.origin : 'https://puppy-pay.vercel.app';
    return base + '/?ref=' + encodeURIComponent(code || '');
  }

  function getShareText(code) {
    const link = getInviteLink(code);
    return 'Join PuppyPay with my code *' + code + '* and earn on every order!\n\n' +
      'First order: 10% extra profit\n' +
      'Standard: 4.9% + Rs 4 per order\n' +
      'I get Rs 27 when you complete your first order\n\n' +
      link;
  }

  function getCurrentCode() {
    const el = document.getElementById('myReferralCode');
    const code = (el && el.textContent) ? el.textContent.trim() : '';
    if (!code || code === '\u2014') return '';
    return code;
  }

  function refreshQr(code) {
    const wrap = document.getElementById('refQrWrap');
    const img = document.getElementById('refQrImg');
    if (!wrap || !img) return;
    if (!code) {
      wrap.style.display = 'none';
      return;
    }
    const link = getInviteLink(code);
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=' + encodeURIComponent(link);
    wrap.style.display = 'flex';
  }

  function setReferralCode(code) {
    if (!code) return;
    const el = document.getElementById('myReferralCode');
    if (el) el.textContent = code;
    refreshQr(code);
  }

  function openInviteShare() {
    const code = getCurrentCode();
    if (!code) {
      if (typeof showToast === 'function') showToast('No code yet', 'error');
      return;
    }
    const text = getShareText(code);
    const url = getInviteLink(code);
    if (navigator.share) {
      navigator.share({ title: 'PuppyPay Invite', text: text, url: url }).catch(function () {
        copyText(text, 'Invite text copied!');
      });
    } else {
      copyText(text, 'Invite text copied!');
    }
  }

  async function downloadQr() {
    const img = document.getElementById('refQrImg');
    const code = getCurrentCode();
    if (!img || !img.src || !code) {
      if (typeof showToast === 'function') showToast('QR not ready', 'error');
      return;
    }
    try {
      const res = await fetch(img.src);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'PuppyPay-Invite-' + code + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      if (typeof showToast === 'function') showToast('QR downloaded', 'success');
    } catch (_) {
      window.open(img.src, '_blank');
    }
  }

  function ensureStickyInvite() {
    let bar = document.getElementById('refStickyInvite');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'refStickyInvite';
      bar.className = 'ref-sticky-invite';
      bar.innerHTML =
        '<button type="button" class="btn btn-primary ref-sticky-btn" id="refStickyInviteBtn">' +
        SHARE_SVG + ' Invite Now</button>';
      document.body.appendChild(bar);
      bar.querySelector('#refStickyInviteBtn').addEventListener('click', openInviteShare);
    }
    syncStickyVisibility();
  }

  function syncStickyVisibility() {
    const bar = document.getElementById('refStickyInvite');
    if (!bar) return;
    const team = document.getElementById('teamView');
    const shown = team && (getComputedStyle(team).display !== 'none') && !team.classList.contains('hidden');
    bar.classList.toggle('show', !!shown);
  }

  function injectReferralUI() {
    const team = document.getElementById('teamView');
    if (!team) return;
    const pc = team.querySelector('.page-content');
    if (!pc) return;
    if (pc.querySelector('.ref-hero')) {
      ensureStickyInvite();
      return;
    }

    const header = team.querySelector('.page-header h2');
    if (header) header.textContent = 'Refer & Earn';

    pc.innerHTML = `
      <div class="ref-banner-carousel">
        <div class="ref-banner b1">
          <h3>Invite friends \u00b7 Earn \u20b927</h3>
          <p>When your friend completes their first order, you get a flat \u20b927 referral bonus in your wallet.</p>
        </div>
        <div class="ref-banner b2">
          <h3>Every order pays you</h3>
          <p>Standard commission: <b>4.9% + \u20b94</b> on every completed order your network places.</p>
        </div>
        <div class="ref-banner b3">
          <h3>First order = 10% boost</h3>
          <p>New users get <b>10% of order amount</b> as extra profit on their lifetime first order only.</p>
        </div>
      </div>

      <div class="ref-hero">
        <div class="ref-hero-label">YOUR REFERRAL CODE</div>
        <div class="ref-code-row">
          <span class="ref-code" id="myReferralCode">\u2014</span>
          <button type="button" class="ref-icon-btn" id="copyRefBtn" title="Copy code" aria-label="Copy">${COPY_SVG}</button>
          <button type="button" class="ref-icon-btn" id="copyRefLinkBtn" title="Copy link" aria-label="Copy link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
        </div>
        <div class="ref-qr-wrap" id="refQrWrap" style="display:none;">
          <img class="ref-qr-img" id="refQrImg" alt="Invite QR" width="160" height="160">
          <div class="ref-qr-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="downloadQrBtn">${QR_SVG} Download QR</button>
          </div>
          <p class="ref-qr-hint">Scan to join with your code</p>
        </div>
        <div class="ref-share-row">
          <button type="button" class="btn btn-primary btn-sm" id="shareWaBtn">${WA_SVG} WhatsApp</button>
          <button type="button" class="btn btn-secondary btn-sm" id="shareMoreBtn">${SHARE_SVG} Share</button>
        </div>
      </div>

      <div class="ref-stats">
        <div class="ref-stat"><div class="lbl">Total Referrals</div><div class="val" id="refCount">0</div></div>
        <div class="ref-stat green"><div class="lbl">Total Earned</div><div class="val" id="refEarnings">\u20b90</div></div>
        <div class="ref-stat"><div class="lbl">Active</div><div class="val" id="refActive">0</div></div>
        <div class="ref-stat green"><div class="lbl">This Month</div><div class="val" id="refMonth">\u20b90</div></div>
      </div>

      <div class="ref-info-banner-wrap" id="refInfoBannerWrap">
        <img class="ref-info-banner" id="refInfoBannerImg" src="assets/referral-info-banner.jpg" alt="How referral works" style="display:none;">
        <div class="ref-rules" id="refRulesFallback">
          <h4>How you earn</h4>
          <div class="ref-rule-item"><span class="ref-rule-badge">\u20b927</span><span>Friend completes <b>first order</b> \u2192 you get flat \u20b927</span></div>
          <div class="ref-rule-item"><span class="ref-rule-badge">4.9%+\u20b94</span><span><b>Every order</b> after that \u2192 standard commission</span></div>
          <div class="ref-rule-item"><span class="ref-rule-badge">10%</span><span>Friend\u2019s <b>first order only</b> \u2192 they get 10% extra profit on that order</span></div>
        </div>
      </div>

      <div class="ref-section-title">
        <span>Your team</span>
        <span class="text-xs text-muted" id="refListCount"></span>
      </div>
      <div class="ref-filter" id="refFilterBar">
        <button type="button" class="active" data-filter="all">All</button>
        <button type="button" data-filter="active">Active</button>
        <button type="button" data-filter="pending">Pending</button>
      </div>
      <div id="referralList" class="empty-state"><p>No referrals yet. Share your code!</p></div>
      <div class="ref-bottom-spacer"></div>
    `;

    bindReferralUI();
    ensureStickyInvite();

    var img = document.getElementById('refInfoBannerImg');
    var fb = document.getElementById('refRulesFallback');
    if (img) {
      img.onload = function () { img.style.display = 'block'; if (fb) fb.style.display = 'none'; };
      img.onerror = function () { img.style.display = 'none'; if (fb) fb.style.display = 'block'; };
      if (img.complete && img.naturalWidth > 0) {
        img.style.display = 'block';
        if (fb) fb.style.display = 'none';
      }
    }

    try {
      const user = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      if (user.referralCode) setReferralCode(user.referralCode);
    } catch (_) {}
  }

  function bindReferralUI() {
    document.getElementById('copyRefBtn')?.addEventListener('click', function () {
      const code = getCurrentCode();
      if (!code) { showToast('No code yet', 'error'); return; }
      copyText(code, 'Code copied!');
    });

    document.getElementById('copyRefLinkBtn')?.addEventListener('click', function () {
      const code = getCurrentCode();
      if (!code) { showToast('No code yet', 'error'); return; }
      copyText(getInviteLink(code), 'Invite link copied!');
    });

    document.getElementById('shareWaBtn')?.addEventListener('click', function () {
      const code = getCurrentCode();
      if (!code) { showToast('No code yet', 'error'); return; }
      const url = 'https://wa.me/?text=' + encodeURIComponent(getShareText(code));
      window.open(url, '_blank');
    });

    document.getElementById('shareMoreBtn')?.addEventListener('click', openInviteShare);
    document.getElementById('downloadQrBtn')?.addEventListener('click', downloadQr);

    document.getElementById('refFilterBar')?.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      _refFilter = btn.getAttribute('data-filter') || 'all';
      document.querySelectorAll('#refFilterBar button').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      renderReferralList(_refCache);
    });
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(okMsg || 'Copied!', 'success');
      }).catch(function () { fallbackCopy(text, okMsg); });
    } else {
      fallbackCopy(text, okMsg);
    }
  }

  function fallbackCopy(text, okMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(okMsg || 'Copied!', 'success');
    } catch (_) {
      showToast(text, 'success');
    }
    document.body.removeChild(ta);
  }

  function renderReferralList(list) {
    const el = document.getElementById('referralList');
    if (!el) return;
    let items = Array.isArray(list) ? list.slice() : [];
    if (_refFilter === 'active') {
      items = items.filter(function (r) {
        const s = String(r.status || '').toLowerCase();
        return s === 'active' || r.hasOrdered || r.orders > 0 || r.totalOrders > 0;
      });
    } else if (_refFilter === 'pending') {
      items = items.filter(function (r) {
        const s = String(r.status || '').toLowerCase();
        return s === 'pending' || s === 'joined' || (!r.hasOrdered && !(r.orders > 0) && !(r.totalOrders > 0));
      });
    }

    const countEl = document.getElementById('refListCount');
    if (countEl) countEl.textContent = items.length ? items.length + ' shown' : '';

    if (!items.length) {
      el.className = 'empty-state';
      el.innerHTML = '<p>No referrals in this filter. Share your code!</p>';
      return;
    }

    el.className = '';
    el.innerHTML = items.map(function (r) {
      const name = r.name || r.mobile || r.phone || r.appId || 'User';
      const initial = String(name).replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase() || 'U';
      const earned = r.earned != null ? r.earned : (r.earnings != null ? r.earnings : 0);
      const joined = r.joinedAt || r.createdAt || r.date;
      const hasOrder = r.hasOrdered || r.orders > 0 || r.totalOrders > 0 || String(r.status || '').toLowerCase() === 'active';
      const status = hasOrder ? 'active' : (String(r.status || '').toLowerCase() === 'pending' ? 'pending' : 'joined');
      const statusLabel = status === 'active' ? 'Active' : status === 'pending' ? 'Pending' : 'Joined';
      const meta = joined ? new Date(joined).toLocaleDateString('en-IN') : '';
      return (
        '<div class="ref-card">' +
          '<div class="ref-card-av">' + initial + '</div>' +
          '<div class="ref-card-body">' +
            '<div class="ref-card-name">' + escapeHtml(String(name)) + '</div>' +
            '<div class="ref-card-meta">' + (meta ? 'Joined ' + meta : 'Team member') + '</div>' +
          '</div>' +
          '<div class="ref-card-right">' +
            '<div class="ref-card-earn">+' + (typeof formatINR === 'function' ? formatINR(earned) : ('\u20b9' + earned)) + '</div>' +
            '<span class="ref-badge ' + status + '">' + statusLabel + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  async function loadReferrals() {
    injectReferralUI();
    try {
      const user = JSON.parse(localStorage.getItem('puppypay_user') || '{}');
      if (user.referralCode) setReferralCode(user.referralCode);
    } catch (_) {}

    try {
      const { ok, data } = await walletApiCall('/referrals', 'GET');
      if (!ok || !data?.success) return;
      const set = function (id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      set('refCount', data.totalReferrals ?? data.referredCount ?? 0);
      set('refEarnings', typeof formatINR === 'function' ? formatINR(data.totalEarnings ?? data.totalEarned ?? 0) : ('\u20b9' + (data.totalEarnings || 0)));
      set('refActive', data.activeReferrals ?? data.activeCount ?? 0);
      set('refMonth', typeof formatINR === 'function' ? formatINR(data.monthEarnings ?? data.thisMonth ?? 0) : ('\u20b9' + (data.monthEarnings || 0)));
      if (data.referralCode) setReferralCode(data.referralCode);
      _refCache = data.referrals || data.list || data.team || [];
      renderReferralList(_refCache);
    } catch (e) {}
  }

  window.loadReferrals = loadReferrals;
  window.injectReferralUI = injectReferralUI;

  function startBannerAutoScroll() {
    const el = document.querySelector('.ref-banner-carousel');
    if (!el || el._autoScroll) return;
    el._autoScroll = true;
    let idx = 0;
    setInterval(function () {
      const cards = el.querySelectorAll('.ref-banner');
      if (!cards.length) return;
      idx = (idx + 1) % cards.length;
      try {
        cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      } catch (_) {
        el.scrollLeft = cards[idx].offsetLeft - 8;
      }
    }, 3500);
  }

  function boot() {
    injectReferralUI();
    setTimeout(startBannerAutoScroll, 400);
    ensureStickyInvite();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }

  document.getElementById('bottomNav')?.addEventListener('click', function (e) {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    setTimeout(function () {
      if (item.dataset.view === 'team') {
        injectReferralUI();
        loadReferrals();
        setTimeout(startBannerAutoScroll, 400);
      }
      syncStickyVisibility();
    }, 40);
  });

  setInterval(syncStickyVisibility, 800);
})();
