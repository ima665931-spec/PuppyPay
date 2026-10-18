/* PuppyPay referral loader */
(function () {
  var s = document.createElement('script');
  s.src = 'js/referral-body.js?v=' + Date.now();
  s.defer = true;
  s.onerror = function () {
    if (typeof showToast === 'function') showToast('Referral module failed to load', 'error');
  };
  document.body.appendChild(s);
})();
