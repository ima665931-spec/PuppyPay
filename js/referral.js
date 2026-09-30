/* PuppyPay - Premium Referral / Team section */
(function () {
  const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  const WA_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.5-1-.9-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9 2.6 1.1 2.6.7 3.1.7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1 0-.3-.1-.6-.2z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3C4.4 15 4 13.5 4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8.2-8 8.2z"/></svg>';
  const QR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M17 17h3v3"/></svg>';

  let _refFilter = 'all';
  let _refCache = [];

  const MILESTONES = [
    { id: 'm5', need: 5, reward: 50, label: '5 active referrals' },
    { id: 'm10', need: 10, reward: 100, label: '10 active referrals' },
    { id: 'm25', need: 25, reward: 300, label: '25 active referrals' },
    { id: 'm50', need: 50, reward: 750, label: '50 active referrals' }
  ];

  function getInviteLink(code) {
  const base = 'https://frevak.online';
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

  function getClaimedMilestones() {
    try { return JSON.parse(localStorage.getItem('puppypay_claimed_milestones') || '[]'); }
    catch (_) { return []; }
  }
  function saveClaimedMilestones(arr) {
    try { localStorage.setItem('puppypay_claimed_milestones', JSON.stringify(arr)); } catch (_) {}
  }
  function getActiveCount() {
    const el = document.getElementById('refActive');
    if (el) {
      const n = parseInt(String(el.textContent).replace(/[^\d]/g, ''), 10);
      if (!isNaN(n)) return n;
    }
    return 0;
  }

  function updateMilestones(activeCount) {
    const list = document.getElementById('refMsList');
    if (!list) return;
    const active = typeof activeCount === 'number' ? activeCount : getActiveCount();
    const claimed = getClaimedMilestones();
    let next = null;
    for (let i = 0; i < MILESTONES.length; i++) {
      if (claimed.indexOf(MILESTONES[i].id) === -1) { next = MILESTONES[i]; break; }
    }
    const nextLabel = document.getElementById('refMsNextLabel');
    const nextCount = document.getElementById('refMsNextCount');
    const bar = document.getElementById('refMsBarFill');
    const ringFg = document.getElementById('refMsRingFg');
    const ringTxt = document.getElementById('refMsRingTxt');
    let pct = 0;
    if (next) {
      pct = Math.min(100, Math.round((active / next.need) * 100));
      if (nextLabel) nextLabel.textContent = 'Next · ₹' + next.reward;
      if (nextCount) nextCount.textContent = Math.min(active, next.need) + ' / ' + next.need + ' active';
      if (bar) bar.style.width = pct + '%';
    } else {
      pct = 100;
      if (nextLabel) nextLabel.textContent = 'All rewards unlocked';
      if (nextCount) nextCount.textContent = active + ' active referrals';
      if (bar) bar.style.width = '100%';
    }
    if (ringFg) ringFg.setAttribute('stroke-dasharray', pct + ',100');
    if (ringTxt) ringTxt.textContent = pct + '%';

    const tiers = [
      { icon: '🥉', name: 'Bronze' },
      { icon: '🥈', name: 'Silver' },
      { icon: '🥇', name: 'Gold' },
      { icon: '💎', name: 'Diamond' }
    ];

    list.innerHTML = MILESTONES.map(function (m, i) {
      const isClaimed = claimed.indexOf(m.id) !== -1;
      const unlocked = active >= m.need;
      const tier = tiers[i] || tiers[0];
      let cls = 'locked';
      let action = '<span class="ref-ms-chip-lock">' + (m.need - active > 0 ? (m.need - active) + ' left' : 'Locked') + '</span>';
      if (isClaimed) {
        cls = 'claimed';
        action = '<span class="ref-ms-chip-done">✓ Claimed</span>';
      } else if (unlocked) {
        cls = 'ready';
        action = '<button type="button" class="ref-ms-claim-btn" data-ms="' + m.id + '">Claim ₹' + m.reward + '</button>';
      }
      return (
        '<div class="ref-ms-chip ' + cls + '">' +
          '<div class="ref-ms-chip-icon">' + tier.icon + '</div>' +
          '<div class="ref-ms-chip-body">' +
            '<div class="ref-ms-chip-name">' + tier.name + ' · ₹' + m.reward + '</div>' +
            '<div class="ref-ms-chip-need">' + m.need + ' active referrals</div>' +
          '</div>' +
          '<div class="ref-ms-chip-action">' + action + '</div>' +
        '</div>'
      );
    }).join('');

    const histWrap = document.getElementById('refMsHistory');
    const histList = document.getElementById('refMsHistList');
    if (histWrap && histList) {
      const claimedMs = MILESTONES.filter(function (m) { return claimed.indexOf(m.id) !== -1; });
      if (claimedMs.length) {
        histWrap.style.display = 'block';
        histList.innerHTML = claimedMs.map(function (m) {
          const t = tiers[MILESTONES.indexOf(m)] || { icon: '✓' };
          return '<div class="ref-ms-hist-row"><span>' + t.icon + ' ' + m.label + '</span><strong>+₹' + m.reward + '</strong></div>';
        }).join('');
      } else histWrap.style.display = 'none';
    }
  }

  function claimMilestone(id) {
    const m = MILESTONES.find(function (x) { return x.id === id; });
    if (!m) return;
    const active = getActiveCount();
    if (active < m.need) { if (typeof showToast === 'function') showToast('Not unlocked yet', 'error'); return; }
    const claimed = getClaimedMilestones();
    if (claimed.indexOf(id) !== -1) { if (typeof showToast === 'function') showToast('Already claimed', 'error'); return; }
    claimed.push(id);
    saveClaimedMilestones(claimed);
    if (typeof showToast === 'function') showToast('₹' + m.reward + ' milestone claimed! (wallet credit pending)', 'success');
    updateMilestones(active);
    try {
      if (typeof walletApiCall === 'function') {
        walletApiCall('/referrals/claim-milestone', 'POST', { milestoneId: id, reward: m.reward }).catch(function () {});
      }
    } catch (_) {}
  }

  function refreshQr(code) {
    const wrap = document.getElementById('refQrWrap');
    const img = document.getElementById('refQrImg');
    if (!wrap || !img) return;
    if (!code) { wrap.style.display = 'none'; return; }
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=' + encodeURIComponent(getInviteLink(code));
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
    if (!code) { if (typeof showToast === 'function') showToast('No code yet', 'error'); return; }
    const text = getShareText(code);
    const url = getInviteLink(code);
    if (navigator.share) {
      navigator.share({ title: 'PuppyPay Invite', text: text, url: url }).catch(function () { copyText(text, 'Invite text copied!'); });
    } else copyText(text, 'Invite text copied!');
  }

  async function downloadQr() {
    const img = document.getElementById('refQrImg');
    const code = getCurrentCode();
    if (!img || !img.src || !code) { if (typeof showToast === 'function') showToast('QR not ready', 'error'); return; }
    try {
      const res = await fetch(img.src);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'PuppyPay-Invite-' + code + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      if (typeof showToast === 'function') showToast('QR downloaded', 'success');
    } catch (_) { window.open(img.src, '_blank'); }
  }

  function ensureStickyInvite() {
    let bar = document.getElementById('refStickyInvite');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'refStickyInvite';
      bar.className = 'ref-sticky-invite';
      bar.innerHTML = '<button type="button" class="btn btn-primary ref-sticky-btn" id="refStickyInviteBtn">' + SHARE_SVG + ' Invite Now</button>';
      document.body.appendChild(bar);
      bar.querySelector('#refStickyInviteBtn').addEventListener('click', openInviteShare);
    }
    bar.classList.remove('show');
    bar.style.display = 'none';
    syncStickyVisibility();
  }

  function syncStickyVisibility() {
    const bar = document.getElementById('refStickyInvite');
    if (!bar) return;
    const team = document.getElementById('teamView');
    const shown = !!(team && team.classList.contains('active'));
    bar.classList.toggle('show', shown);
    bar.style.display = shown ? '' : 'none';
  }

  function injectReferralUI() {
    const team = document.getElementById('teamView');
    if (!team) return;
    const pc = team.querySelector('.page-content');
    if (!pc) return;
    if (pc.querySelector('.ref-hero') && pc.querySelector('.ref-ms-top') && pc.querySelector('#refWalletCard')) {
      ensureStickyInvite();
      updateMilestones(getActiveCount());
      return;
    }

    const header = team.querySelector('.page-header h2');
    if (header) header.textContent = 'Refer & Earn';

    pc.innerHTML = `
      <div class="ref-banner-carousel">
        <div class="ref-banner b1"><h3>Invite friends · Earn ₹27</h3><p>When your friend completes their first order, you get a flat ₹27 referral bonus in your wallet.</p></div>
        <div class="ref-banner b2"><h3>Every order pays you</h3><p>Standard commission: <b>4.9% + ₹4</b> on every completed order your network places.</p></div>
        <div class="ref-banner b3"><h3>First order = 10% boost</h3><p>New users get <b>10% of order amount</b> as extra profit on their lifetime first order only.</p></div>
      </div>
      <div class="ref-hero">
        <div class="ref-hero-label">YOUR REFERRAL CODE</div>
        <div class="ref-code-row">
          <span class="ref-code" id="myReferralCode">—</span>
          <button type="button" class="ref-icon-btn" id="copyRefBtn" title="Copy code">${COPY_SVG}</button>
          <button type="button" class="ref-icon-btn" id="copyRefLinkBtn" title="Copy link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
        </div>
        <div class="ref-qr-wrap" id="refQrWrap" style="display:none;">
          <img class="ref-qr-img" id="refQrImg" alt="Invite QR" width="160" height="160">
          <div class="ref-qr-actions"><button type="button" class="btn btn-secondary btn-sm" id="downloadQrBtn">${QR_SVG} Download QR</button></div>
          <p class="ref-qr-hint">Scan to join with your code</p>
        </div>
        <div class="ref-share-row">
          <button type="button" class="btn btn-primary btn-sm" id="shareWaBtn">${WA_SVG} WhatsApp</button>
          <button type="button" class="btn btn-secondary btn-sm" id="shareMoreBtn">${SHARE_SVG} Share</button>
        </div>
      </div>
      <div class="ref-stats">
        <div class="ref-stat"><div class="lbl">Total Referrals</div><div class="val" id="refCount">0</div></div>
        <div class="ref-stat green"><div class="lbl">Total Earned</div><div class="val" id="refEarnings">₹0</div></div>
        <div class="ref-stat"><div class="lbl">Active</div><div class="val" id="refActive">0</div></div>
        <div class="ref-stat green"><div class="lbl">This Month</div><div class="val" id="refMonth">₹0</div></div>
      </div>
      <div class="ref-wallet-card" id="refWalletCard">
        <div class="ref-wallet-top">
          <div>
            <div class="ref-wallet-label">Referral Wallet</div>
            <div class="ref-wallet-bal" id="refWalletBal">₹0</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="refTransferBtn">Transfer to Main</button>
        </div>
        <p class="ref-wallet-hint">Min transfer ₹100 · Then withdrawable from main wallet</p>
      </div>
      <div class="ref-milestones" id="refMilestones">
        <div class="ref-ms-top">
          <div class="ref-ms-top-left">
            <div class="ref-ms-badge-icon">🏆</div>
            <div>
              <div class="ref-ms-title">Reward Roadmap</div>
              <div class="ref-ms-sub" id="refMsSub">Grow team · Unlock cash bonuses</div>
            </div>
          </div>
          <div class="ref-ms-ring" id="refMsRing">
            <svg viewBox="0 0 36 36" class="ref-ms-ring-svg">
              <path class="ref-ms-ring-bg" d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 1 1 0-31"/>
              <path class="ref-ms-ring-fg" id="refMsRingFg" stroke-dasharray="0,100" d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 1 1 0-31"/>
            </svg>
            <div class="ref-ms-ring-txt" id="refMsRingTxt">0%</div>
          </div>
        </div>
        <div class="ref-ms-next" id="refMsNextBox">
          <div class="ref-ms-next-main">
            <span class="ref-ms-next-label" id="refMsNextLabel">Next: ₹50</span>
            <span class="ref-ms-next-count" id="refMsNextCount">0 / 5 active</span>
          </div>
          <div class="ref-ms-bar"><div class="ref-ms-bar-fill" id="refMsBarFill" style="width:0%"></div></div>
        </div>
        <div class="ref-ms-track" id="refMsList"></div>
        <div class="ref-ms-history" id="refMsHistory" style="display:none;">
          <div class="ref-ms-hist-title">Claimed</div>
          <div id="refMsHistList"></div>
        </div>
      </div>
      <div class="ref-info-banner-wrap" id="refInfoBannerWrap">
        <img class="ref-info-banner" id="refInfoBannerImg" src="assets/referral-info-banner.jpg" alt="How referral works" style="display:none;">
        <div class="ref-rules" id="refRulesFallback">
          <h4>How you earn</h4>
          <div class="ref-rule-item"><span class="ref-rule-badge">₹27</span><span>Friend completes <b>first order</b> → you get flat ₹27</span></div>
          <div class="ref-rule-item"><span class="ref-rule-badge">4.9%+₹4</span><span><b>Every order</b> after that → standard commission</span></div>
          <div class="ref-rule-item"><span class="ref-rule-badge">10%</span><span>Friend's <b>first order only</b> → they get 10% extra profit</span></div>
        </div>
      </div>
      <div class="ref-section-title"><span>Your team</span><span class="text-xs text-muted" id="refListCount"></span></div>
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
    updateMilestones(getActiveCount());

    var img = document.getElementById('refInfoBannerImg');
    var fb = document.getElementById('refRulesFallback');
    if (img) {
      img.onload = function () { img.style.display = 'block'; if (fb) fb.style.display = 'none'; };
      img.onerror = function () { img.style.display = 'none'; if (fb) fb.style.display = 'block'; };
      if (img.complete && img.naturalWidth > 0) { img.style.display = 'block'; if (fb) fb.style.display = 'none'; }
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
      window.open('https://wa.me/?text=' + encodeURIComponent(getShareText(code)), '_blank');
    });
    document.getElementById('shareMoreBtn')?.addEventListener('click', openInviteShare);
    document.getElementById('downloadQrBtn')?.addEventListener('click', downloadQr);
    document.getElementById('refMsList')?.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-ms]');
      if (!btn) return;
      claimMilestone(btn.getAttribute('data-ms'));
    });
    document.getElementById('refFilterBar')?.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      _refFilter = btn.getAttribute('data-filter') || 'all';
      document.querySelectorAll('#refFilterBar button').forEach(function (b) { b.classList.toggle('active', b === btn); });
      renderReferralList(_refCache);
    });
    const tBtn = document.getElementById('refTransferBtn');
    if (tBtn && !tBtn._ppBound) {
      tBtn._ppBound = true;
      tBtn.addEventListener('click', function () { transferReferralToMain(); });
    }
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast(okMsg || 'Copied!', 'success'); }).catch(function () {
        showToast(text, 'success');
      });
    } else {
      showToast(text, 'success');
    }
  }

  function renderReferralList(list) {
    const el = document.getElementById('referralList');
    if (!el) return;
    let items = Array.isArray(list) ? list.slice() : [];
    if (_refFilter === 'active') items = items.filter(function (r) { return r.active || r.status === 'active'; });
    if (_refFilter === 'pending') items = items.filter(function (r) { return !r.active && r.status !== 'active'; });
    const countEl = document.getElementById('refListCount');
    if (countEl) countEl.textContent = items.length ? (items.length + ' members') : '';
    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><p>No referrals yet. Share your code!</p></div>';
      return;
    }
    el.innerHTML = items.map(function (r) {
      const name = r.name || r.mobile || r.appId || 'User';
      const initial = String(name).charAt(0).toUpperCase();
      const earn = (typeof formatINR === 'function' ? formatINR(r.earned || r.amount || 0) : ('₹' + (r.earned || 0)));
      return '<div class="ref-card"><div class="ref-card-av">' + initial + '</div><div class="ref-card-body"><div class="ref-card-name">' + name + '</div><div class="ref-card-meta">' + (r.appId || '') + '</div></div><div class="ref-card-right"><div class="ref-card-earn">' + earn + '</div></div></div>';
    }).join('');
  }

  async function loadReferrals() {
    injectReferralUI();
    try {
      let data = {};
      if (typeof walletApiCall === 'function') {
        const res = await walletApiCall('/referrals', 'GET');
        data = (res && res.data) ? res.data : (res || {});
      }
      if (data.success === false) data = {};
      const count = data.count ?? data.totalReferrals ?? data.total ?? (data.referrals && data.referrals.length) ?? 0;
      const activeN = data.activeCount ?? data.active ?? 0;
      const totalEarned = data.totalEarned ?? data.totalEarnings ?? data.earnings ?? 0;
      const refBal = data.referralBalance ?? 0;
      const earnEl = document.getElementById('refEarnings');
      const countEl = document.getElementById('refCount');
      const activeEl = document.getElementById('refActive');
      const monthEl = document.getElementById('refMonth');
      const balEl = document.getElementById('refWalletBal');
      if (countEl) countEl.textContent = String(count);
      if (activeEl) activeEl.textContent = String(activeN);
      if (earnEl) earnEl.textContent = (typeof formatINR === 'function' ? formatINR(totalEarned) : ('₹' + totalEarned));
      if (monthEl) monthEl.textContent = (typeof formatINR === 'function' ? formatINR(data.monthEarnings ?? data.thisMonth ?? 0) : ('₹' + (data.monthEarnings || 0)));
      if (balEl) balEl.textContent = (typeof formatINR === 'function' ? formatINR(refBal) : ('₹' + refBal));
      if (data.referralCode) setReferralCode(data.referralCode);
      _refCache = data.referrals || data.list || data.team || data.referredUsers || [];
      renderReferralList(_refCache);
      updateMilestones(Number(activeN) || 0);
    } catch (e) { updateMilestones(getActiveCount()); }
  }

  async function transferReferralToMain() {
    const btn = document.getElementById('refTransferBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Transferring...'; }
    try {
      const balEl = document.getElementById('refWalletBal');
      let bal = 0;
      if (balEl) bal = parseInt(String(balEl.textContent).replace(/[^\d]/g, ''), 10) || 0;
      if (bal < 100) {
        if (typeof showToast === 'function') showToast('Minimum transfer is ₹100', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Transfer to Main'; }
        return;
      }
      const res = await walletApiCall('/referrals/transfer', 'POST', { amount: bal });
      const data = (res && res.data) ? res.data : {};
      if (res && res.ok && data.success) {
        if (typeof showToast === 'function') showToast(data.message || 'Transferred to main wallet', 'success');
        if (typeof loadDashboard === 'function') loadDashboard();
        loadReferrals();
      } else {
        if (typeof showToast === 'function') showToast(data.message || 'Transfer failed', 'error');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Network error', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Transfer to Main'; }
  }

  window.loadReferrals = loadReferrals;
  window.injectReferralUI = injectReferralUI;

  function startBannerAutoScroll() {
    const el = document.querySelector('.ref-banner-carousel');
    if (!el || el._autoScroll) return;
    el._autoScroll = true;
    let idx = 0;
    el.addEventListener('touchstart', function () { el._userScrolling = true; }, { passive: true });
    el.addEventListener('touchend', function () {
      setTimeout(function () { el._userScrolling = false; }, 2500);
    }, { passive: true });
    setInterval(function () {
      if (el._userScrolling) return;
      const team = document.getElementById('teamView');
      if (!team || !team.classList.contains('active')) return;
      const cards = el.querySelectorAll('.ref-banner');
      if (!cards.length) return;
      idx = (idx + 1) % cards.length;
      cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { injectReferralUI(); startBannerAutoScroll(); }, 100);
    });
  } else {
    setTimeout(function () { injectReferralUI(); startBannerAutoScroll(); }, 100);
  }

  setInterval(syncStickyVisibility, 800);
})();
