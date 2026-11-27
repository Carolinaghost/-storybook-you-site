/* ==========================================================================
   Crayonauts – runs on every page
   --------------------------------------------------------------------------
   Creator links: crayonauts.com/?c=CODE (or ?code=CODE). The code is kept in
   the SAME place the main site keeps it (localStorage "crayonauts_ref"), so a
   creator is credited whichever pages the visitor buys through. Same rules as
   the main site: upper-cased, letters/digits/_/- only, last link wins.
   ========================================================================== */
(function () {
  var KEY = "crayonauts_ref";
  function fromUrl() {
    try {
      var u = new URLSearchParams(window.location.search);
      var raw = (u.get("c") || u.get("code") || "").trim().toUpperCase();
      return raw && raw.length <= 64 && /^[A-Z0-9_-]+$/.test(raw) ? raw : "";
    } catch (e) { return ""; }
  }
  var linked = fromUrl();
  if (linked) { try { localStorage.setItem(KEY, linked); } catch (e) { /* private mode */ } }

  window.CrayonautsCreator = {
    get: function () {
      if (linked) return linked;
      try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
    }
  };

  // Keep ?c=CODE on links between our own pages
  var c = window.CrayonautsCreator.get();
  if (c) {
    document.querySelectorAll("a[data-keep-creator]").forEach(function (a) {
      var url = new URL(a.getAttribute("href"), window.location.href);
      if (!url.searchParams.get("c")) url.searchParams.set("c", c);
      a.setAttribute("href", url.pathname.split("/").pop() + url.search + url.hash);
    });
  }
})();
