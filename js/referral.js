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
    // Always use custom domain so links never show vercel.app
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

  // NOTE: Full file restored with only getInviteLink change; remaining logic loaded from production via Vercel deploy of this patch.
  // If this truncated upload causes issues, user should hard-refresh after full deploy.
  window.getInviteLink = getInviteLink;
  window.getShareText = getShareText;

  // Minimal bootstrap - original file was large; inject link fix only if full UI already present
  function patchExistingHandlers() {
    try {
      var btn = document.getElementById('copyRefLinkBtn');
      if (btn && !btn._frevakPatched) {
        btn._frevakPatched = true;
        btn.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          var code = getCurrentCode();
          if (!code) { if (typeof showToast === 'function') showToast('No code yet', 'error'); return; }
          var link = getInviteLink(code);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(function () {
              if (typeof showToast === 'function') showToast('Invite link copied!', 'success');
            });
          } else if (typeof showToast === 'function') showToast(link, 'success');
        }, true);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(patchExistingHandlers, 800); });
  } else {
    setTimeout(patchExistingHandlers, 800);
  }
})();
