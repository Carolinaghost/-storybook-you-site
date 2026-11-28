/* ==========================================================================
   Crayonauts – the new pages' connection to the order system
   (api.crayonauts.com). The same calls the main site makes:
     POST /orders      start the order (photo kept so the paid book can be
                       drawn on the server after payment)
     POST /convert     draw one page (the 2 free preview pages, in parallel)
     POST /checkout    Stripe Checkout session (name + email go here)
   The order is also saved where the main site keeps it (localStorage
   "crayonauts_order_v1"), because Stripe sends buyers back to the main site,
   which shows the book being drawn, the download and reports the Purchase.
   ========================================================================== */
(function () {
  var CFG = window.CRAYONAUTS_CONFIG;
  var TRACK = window.CrayonautsTrack;
  var API = CFG.API_BASE;
  var STATE_KEY = "crayonauts_order_v1";

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function themeName(id) {
    var t = CFG.THEMES.filter(function (x) { return x.id === id; })[0];
    return t ? t.label : "Superhero";
  }

  // Phone photos are 3-8MB. 1024px JPEG is plenty for line art and keeps the
  // upload quick - the same as the main site.
  function downscale(file, maxDim) {
    maxDim = maxDim || 1024;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height, scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          var canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          canvas.toBlob(function (blob) { resolve({ file: new File([blob], "photo.jpg", { type: "image/jpeg" }), dataUrl: dataUrl }); }, "image/jpeg", 0.85);
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  var photos = [];          // [{ file, dataUrl }] in upload order
  var preview = null;       // { orderId, token, started, pages[], done, failed, error, mode, theme, level, name }

  function saveForReturn(extra) {
    if (!preview) return;
    try {
      var prev = {};
      try { prev = JSON.parse(localStorage.getItem(STATE_KEY) || "{}") || {}; } catch (e) {}
      var st = {
        orderId: preview.orderId, accessToken: preview.token,
        photoDataUrl: preview.mode === "family" ? null : (photos[0] && photos[0].dataUrl),
        selectedTheme: themeName(preview.theme), childCount: 1, audience: "kid", detailLevel: preview.level,
        notes: "", childName: preview.name, email: (extra && extra.email) || prev.email || "",
        product: (extra && extra.product) || ""
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(st));
    } catch (e) {
      // Too big for storage (the photo) - keep everything else; the return
      // page only needs the order id and its key.
      try { localStorage.setItem(STATE_KEY, JSON.stringify({ orderId: preview.orderId, accessToken: preview.token, childName: preview.name, email: (extra && extra.email) || "" })); } catch (e2) {}
    }
  }

  async function drawPage(i) {
    var lastErr = null;
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        var form = new FormData();
        if (preview.mode === "family") {
          photos.forEach(function (p) { form.append("photos", p.file); });
          form.append("people", JSON.stringify(photos.map(function (p, n) { return { name: "Person " + (n + 1), subjectType: "auto", star: n === 0 }; })));
        } else {
          form.append("photo", photos[0].file);
        }
        form.append("theme", themeName(preview.theme));
        form.append("sceneIndex", i);
        form.append("childCount", 1);
        form.append("subjectType", "kid");
        form.append("detailLevel", preview.level || "standard");
        form.append("notes", "");
        form.append("orderId", preview.orderId);
        form.append("token", preview.token);
        var res = await fetch(API + "/convert", { method: "POST", body: form });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          // 402/403/429 are our own sentences for a customer (e.g. out of free
          // previews) - shown as they are, and not retried.
          var settled = res.status === 402 || res.status === 403 || res.status === 429;
          var e = new Error(settled ? (data.error || "That didn't work.") : "Hiccup on our end - that page didn't draw. Please try again.");
          e.settled = settled; throw e;
        }
        preview.pages[i] = data.image;
        return;
      } catch (err) {
        lastErr = err;
        if (err.settled || attempt === 3) break;
        await wait(1500 * attempt);
      }
    }
    throw lastErr;
  }

  window.CrayonautsAPI = {

    // 1) Photos are kept here (shrunk) until the preview starts.
    uploadPhotos: async function (files, mode) {
      TRACK.count("uploaded");
      photos = [];
      for (var i = 0; i < files.length; i++) photos.push(await downscale(files[i]));
      return { uploadIds: photos.map(function (_, n) { return "photo-" + n; }) };
    },

    // 2) Start the order, then draw the free pages (both at once).
    startPreview: async function (data) {
      TRACK.previewStarted();
      var sceneCount = 15;
      try {
        var sl = await fetch(API + "/story-length?theme=" + encodeURIComponent(themeName(data.theme)));
        var sd = await sl.json(); if (sd && sd.sceneCount) sceneCount = sd.sceneCount;
      } catch (e) {}
      var family = data.mode === "family";
      var res = await fetch(API + "/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: data.name || "", childCount: 1, email: "",
          theme: themeName(data.theme), notes: "", thumb: null, pageCount: sceneCount,
          photo: family ? null : photos[0].dataUrl,
          people: family ? photos.map(function (p, n) { return { name: "Person " + (n + 1), subjectType: "auto", star: n === 0, photo: p.dataUrl }; }) : [],
          subjectType: "kid", detailLevel: data.level || "standard",
          visitor: TRACK.visitor, source: TRACK.source, campaign: TRACK.campaign
        })
      });
      var body = await res.json().catch(function () { return {}; });
      if (!res.ok || !body.accessToken) throw new Error((body && body.error) || "Could not start your order. Please try again.");
      preview = { orderId: body.order.id, token: body.accessToken, started: Date.now(), pages: [], done: false, failed: false, error: "",
                  mode: data.mode, theme: data.theme, level: data.level, name: data.name || "" };
      saveForReturn();
      var jobs = [];
      for (var i = 0; i < (CFG.FREE_PREVIEW_PAGES || 2); i++) jobs.push(drawPage(i).catch(function (e) { return e; }));
      Promise.all(jobs).then(function (results) {
        var errs = results.filter(function (r) { return r instanceof Error; });
        if (preview.pages.filter(Boolean).length === 0) {
          preview.failed = true;
          preview.error = (errs[0] && errs[0].message) || "The preview didn't draw. Please try again.";
        }
        preview.done = true;
      });
      return { previewId: String(preview.orderId) };
    },

    // 3) How the preview is going. Progress is an estimate from the time
    //    taken so far (a page usually takes 15-50 seconds).
    getPreview: async function () {
      if (!preview) return { status: "failed", error: "No preview started." };
      if (preview.failed) return { status: "failed", progress: 100, error: preview.error };
      var pages = preview.pages.filter(Boolean);
      if (preview.done) return { status: "ready", progress: 100, pages: pages };
      var t = (Date.now() - preview.started) / 1000;
      return { status: "drawing", progress: Math.min(95, Math.round(100 * (1 - Math.exp(-t / 20)))) };
    },

    // 4) Codes are checked by the order system at checkout (a bad code is
    //    refused there with a clear message). Here only the shape is checked.
    checkPromo: async function (data) {
      var c = String(data.code || "").trim().toUpperCase();
      var ok = c.length > 0 && c.length <= 64 && /^[A-Z0-9_-]+$/.test(c);
      return { valid: ok, label: ok ? "Code saved - applied at checkout" : "" };
    },

    // 5) Stripe Checkout. Name + email are required by the order system (the
    //    book is emailed); printed vs PDF; a typed code wins over a creator
    //    link's code, as on the main site.
    startCheckout: async function (data) {
      // A cart checked out on its own: its first book leads (and is the one
      // the return page watches), the rest go as extra books.
      var lead = data.lead || null;
      if (!lead && !preview) throw new Error("Please make your free preview first.");
      var isPrint = lead ? lead.product === "print" : /print/.test(data.product);
      if (lead) {
        try { localStorage.setItem(STATE_KEY, JSON.stringify({ orderId: lead.orderId, accessToken: lead.token, childName: lead.childName || "", email: data.email || "", product: lead.product })); } catch (e) {}
      } else {
        saveForReturn({ email: data.email, product: isPrint ? "print" : "digital" });
      }
      var res = await fetch(API + "/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: lead ? lead.orderId : preview.orderId, token: lead ? lead.token : preview.token,
          product: isPrint ? "print" : "digital",
          code: data.promoCode || data.creatorCode || "",
          fb: TRACK.browserDetails(), trybe: TRACK.trybeVisitorId(),
          childName: data.name || (preview && preview.name) || "", email: data.email || "",
          extra: (data.extra || []).map(function (it) { return { orderId: it.orderId, token: it.token, product: it.product, childName: it.childName }; })
        })
      });
      var body = await res.json().catch(function () { return {}; });
      if (!res.ok || !body.url) throw new Error(body.detail || body.error || "Couldn't open checkout. Please try again.");
      return { checkoutUrl: body.url };
    },

    // The order on screen (for "Add a book for another child").
    currentOrder: function () { return preview && preview.pages.filter(Boolean).length ? { orderId: preview.orderId, token: preview.token } : null; },

    // Optional text updates: sent on its own, never holds up checkout.
    smsOptin: function (d) {
      try {
        fetch(API + "/sms/optin", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: d.phone, orderUpdates: true, promos: !!d.promos, source: "order" }) }).catch(function () {});
      } catch (e) {}
    },

    // 6) Not offered yet on the new pages (the box is hidden).
    emailPreview: async function () { throw new Error("Not available"); }
  };
})();
