// Landing pages: keep a creator/ad code from the link (?c=CODE) for the order
// page. Same rule and same storage key as index.html's rememberCreatorCode, so
// an ad that lands on, say, the gift page still credits the right code when
// the visitor clicks through to make their book. Last link wins.
(function () {
  try {
    var q = new URLSearchParams(location.search);
    var raw = (q.get('c') || q.get('code') || '').trim().toUpperCase();
    if (raw && raw.length <= 64 && /^[A-Z0-9_-]+$/.test(raw)) localStorage.setItem('crayonauts_ref', raw);
  } catch (e) { /* private browsing: nothing kept, nothing broken */ }
})();
