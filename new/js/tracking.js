/* ==========================================================================
   Crayonauts – tracking for the new pages
   --------------------------------------------------------------------------
   Same events, same ids and same funnel counters as the main site, so the two
   can be compared fairly:
     - Meta pixel + TikTok pixel through fbTrack/ttTrack (never able to break
       the page if a script is blocked)
     - the site's own anonymous funnel counters (POST /event)
     - what the server needs at checkout: Meta's cookie ids and Trybe's
       visitor id
   Purchase is reported when the buyer comes back from Stripe, by the main
   site's return page (the order is saved where it looks for it), plus the
   server's own copy - exactly as for orders made on the main site.
   ========================================================================== */
(function () {
  var API_BASE = (window.CRAYONAUTS_CONFIG || {}).API_BASE || "https://api.crayonauts.com";

  function fbTrack(name, params, eventId) {
    try {
      if (!window.fbq) return;
      if (eventId) window.fbq("track", name, params || {}, { eventID: eventId });
      else window.fbq("track", name, params || {});
    } catch (e) { /* ignore */ }
  }
  function ttTrack(name, params, eventId) {
    try {
      if (!window.ttq || typeof window.ttq.track !== "function") return;
      window.ttq.track(name, params || {}, eventId ? { event_id: eventId } : undefined);
    } catch (e) { /* ignore */ }
  }
  function cookie(name) {
    try {
      var m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : "";
    } catch (e) { return ""; }
  }

  // Anonymous funnel counters - same as the main site: a throwaway id held in
  // memory only, the traffic source, and the campaign. "new-pages" is added to
  // the campaign so these visits can be told apart from the main site's.
  // Moving from the new homepage to create.html carries the same visit along
  // in the link (?v= &s= &cp=), never in storage, so one person is one visitor.
  var carried = (function () {
    try {
      var u = new URLSearchParams(location.search);
      var v = u.get("v") || "";
      return /^[a-z0-9]{6,40}$/.test(v) ? { v: v, s: (u.get("s") || "").slice(0, 80), cp: (u.get("cp") || "").slice(0, 80) } : null;
    } catch (e) { return null; }
  })();
  var visitorId = carried ? carried.v : Math.random().toString(36).slice(2) + Date.now().toString(36);
  var source = carried && carried.s ? carried.s : (function () {
    try {
      var tagged = new URLSearchParams(location.search).get("utm_source");
      if (tagged) return tagged;
      if (!document.referrer) return "direct";
      var host = new URL(document.referrer).hostname.replace(/^www\./, "");
      return host === location.hostname ? "direct" : host;
    } catch (e) { return "direct"; }
  })();
  var campaign = carried && carried.cp ? carried.cp : (function () {
    var c = "";
    try { c = new URLSearchParams(location.search).get("utm_campaign") || ""; } catch (e) {}
    return (c ? c + "|" : "") + "new-pages";
  })();

  function count(type) {
    try {
      fetch(API_BASE + "/event", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ type: type, visitor: visitorId, source: source, campaign: campaign })
      }).catch(function () {});
    } catch (e) { /* counters are never worth an error */ }
  }

  window.CrayonautsTrack = {
    visitor: visitorId, source: source, campaign: campaign,
    count: count, fbTrack: fbTrack, ttTrack: ttTrack,

    // Free preview requested: same moment the main site reports ViewContent.
    previewStarted: function () {
      count("preview_started");
      fbTrack("ViewContent");
      ttTrack("ViewContent", { content_type: "product", content_id: "coloring-book", currency: "USD", value: 15 });
    },
    // The 2 free pages are on screen.
    viewContent: function () { count("preview_shown"); },

    // "Continue to secure checkout". Returns the event id the server repeats
    // in its own copy of InitiateCheckout, so Meta counts it once.
    initiateCheckout: function (data) {
      count("unlock_clicked");
      var icId = "ic-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
      fbTrack("InitiateCheckout", {}, icId);
      ttTrack("InitiateCheckout", { content_type: "product", content_id: "coloring-book", currency: "USD", value: data && data.value }, icId);
      window.__crayonautsIcId = icId;
      return icId;
    },

    // What the server needs at checkout (same shape as the main site sends).
    browserDetails: function () {
      var fbc = cookie("_fbc");
      if (!fbc) {
        try { var clid = new URLSearchParams(location.search).get("fbclid"); if (clid) fbc = "fb.1." + Date.now() + "." + clid; } catch (e) {}
      }
      return { fbp: cookie("_fbp"), fbc: fbc, url: location.href.split("#")[0].slice(0, 480), icId: window.__crayonautsIcId || "" };
    },
    trybeVisitorId: function () {
      try {
        var id = window.trybe && typeof window.trybe.getVisitorId === "function" ? window.trybe.getVisitorId() : "";
        if (typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
      } catch (e) {}
      var c = cookie("ugc_vid_7715c0d8-d693-48e9-8c3b-866630920e2d") || cookie("ugc_vid");
      return /^[A-Za-z0-9_-]{8,64}$/.test(c) ? c : "";
    }
  };

  // A visit is counted as "landed" once, on the first of our pages it opens.
  if (!carried) count("landed");

  // Links to our other new pages carry the visit along.
  try {
    document.querySelectorAll('a[href^="create.html"], a[href^="index.html"]').forEach(function (a) {
      var url = new URL(a.getAttribute("href"), location.href);
      url.searchParams.set("v", visitorId);
      url.searchParams.set("s", source);
      url.searchParams.set("cp", campaign);
      a.setAttribute("href", url.pathname.split("/").pop() + url.search + url.hash);
    });
  } catch (e) { /* never let this break the page */ }
})();
