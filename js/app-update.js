/* PuppyPay — In-app Update System (future-proof)
 *
 * How it works:
 * 1. App has a CURRENT_VERSION hard-coded below
 * 2. On launch + when opening Mine, it fetches /version.json from Vercel
 * 3. If remote version is newer → shows nice update modal
 * 4. Download APK button always opens the latest apkUrl
 *
 * Future release process:
 * - Bump versionName + versionCode in Android
 * - Build signed APK
 * - Create GitHub Release (tag vX.Y.Z) and upload APK
 * - Update version.json on this repo:
 *     { "version": "1.0.1", "versionCode": 2, "apkUrl": "https://github.com/.../releases/download/v1.0.1/app-release.apk", "forceUpdate": false }
 */

(function () {
  // ===== CHANGE THIS when you build a new APK =====
  var CURRENT_VERSION = '1.0.0';
  var CURRENT_VERSION_CODE = 1;
  // ================================================

  var VERSION_URL = '/version.json?t=' + Date.now();
  var CHECK_KEY = 'puppypay_last_update_check';
  var SKIP_KEY = 'puppypay_skip_version';

  function parseVersion(v) {
    return String(v || '0').replace(/^v/i, '').split('.').map(function (n) { return parseInt(n, 10) || 0; });
  }

  function isNewer(remote, current) {
    var r = parseVersion(remote);
    var c = parseVersion(current);
    for (var i = 0; i < Math.max(r.length, c.length); i++) {
      var a = r[i] || 0;
      var b = c[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return false;
  }

  async function fetchVersionInfo() {
    try {
      var res = await fetch(VERSION_URL, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function openApk(url) {
    if (!url) {
      showToast('APK link not ready yet', 'error');
      return;
    }
    // Prefer opening in system browser so Android can handle the download/install
    try {
      window.open(url, '_system');
    } catch (_) {}
    // Fallback
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 100);
    showToast('Downloading latest APK...', 'success');
  }

  async function showUpdateModal(info) {
    var msg = (info.message || 'A new version of PuppyPay is available.') +
      '<br><br><b>Version ' + info.version + '</b>';
    if (info.forceUpdate) {
      msg += '<br><br><span style="color:var(--danger)">This update is required.</span>';
    }

    var ok = await showAppModal({
      title: '🚀 Update Available',
      body: msg,
      okText: 'Download Update',
      cancelText: info.forceUpdate ? null : 'Later'
    });

    if (ok) {
      openApk(info.apkUrl);
    } else if (!info.forceUpdate) {
      try { localStorage.setItem(SKIP_KEY, info.version); } catch (_) {}
    }
  }

  async function checkForUpdate(opts) {
    opts = opts || {};
    var info = await fetchVersionInfo();
    if (!info || !info.version) return null;

    window.__latestApkUrl = info.apkUrl || '';
    window.__latestVersion = info.version;

    var newer = isNewer(info.version, CURRENT_VERSION) ||
                (info.versionCode && Number(info.versionCode) > CURRENT_VERSION_CODE);

    if (!newer) return info;

    // Don't spam if user already skipped this version (unless forced or manual check)
    if (!opts.force && !info.forceUpdate) {
      try {
        if (localStorage.getItem(SKIP_KEY) === info.version) return info;
      } catch (_) {}
    }

    // Throttle automatic checks (once every 6 hours)
    if (!opts.force) {
      try {
        var last = Number(localStorage.getItem(CHECK_KEY) || 0);
        if (Date.now() - last < 6 * 60 * 60 * 1000) return info;
        localStorage.setItem(CHECK_KEY, String(Date.now()));
      } catch (_) {}
    }

    await showUpdateModal(info);
    return info;
  }

  // Public API
  window.checkForAppUpdate = checkForUpdate;
  window.downloadLatestApk = function () {
    if (window.__latestApkUrl) {
      openApk(window.__latestApkUrl);
      return;
    }
    checkForUpdate({ force: true }).then(function (info) {
      if (info && info.apkUrl) openApk(info.apkUrl);
      else showToast('APK not available yet. Check back soon.', 'error');
    });
  };

  // Auto-check after app is ready (only once per session for non-force)
  function scheduleCheck() {
    setTimeout(function () {
      checkForUpdate({ force: false });
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleCheck);
  } else {
    scheduleCheck();
  }
})();
