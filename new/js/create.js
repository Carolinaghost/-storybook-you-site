/* ==========================================================================
   Crayonauts – create.html flow
   --------------------------------------------------------------------------
   Steps:  upload → theme → details → drawing → preview → order → (Stripe)
   All calls to the order system go through js/api.js (CrayonautsAPI).
   All tracking goes through js/tracking.js (CrayonautsTrack).
   Nothing in this file needs to change to connect the API.
   ========================================================================== */
(function () {
  var CFG = window.CRAYONAUTS_CONFIG;
  var API = window.CrayonautsAPI;
  var TRACK = window.CrayonautsTrack;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- State ---------------- */
  var params = new URLSearchParams(window.location.search);
  var state = {
    mode: params.get("mode") === "family" ? "family" : "personal",
    personalFile: null,
    familyFiles: [],                                   // up to CFG.MAX_FAMILY_PHOTOS
    theme: CFG.THEMES.some(function (t) { return t.id === params.get("theme"); }) ? params.get("theme") : "superhero",
    level: "standard",
    name: "",
    previewId: null,
    previewPages: [],
    product: null,                                     // set from mode
    promoCode: ""
  };

  function money(n) { return "$" + n.toFixed(2); }

  /* ---------------- Several books in one order ----------------
     Same place and shape as the main site's cart (localStorage
     "crayonauts_cart"), so the page Stripe sends buyers back to clears the
     paid books as it always has. */
  var CART_KEY = "crayonauts_cart", MAX_CART = 4;   // plus the one on screen: 5 books
  function loadCart() {
    try { var c = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(c) ? c.filter(function (it) { return it && it.orderId && it.token; }) : []; }
    catch (e) { return []; }
  }
  function saveCart(items) { try { localStorage.setItem(CART_KEY, JSON.stringify(items || [])); } catch (e) {} }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function itemPrice(it) { return it.family ? CFG.PRODUCTS.family_pdf.book : CFG.PRODUCTS.pdf.book; }
  function apiProduct(key) { return /print/.test(key) ? "print" : "digital"; }
  function money0(n) { return n % 1 ? money(n) : "$" + n; }
  function themeLabel() { return CFG.THEMES.filter(function (t) { return t.id === state.theme; })[0].label; }
  function bookName() { return state.name.trim() || (state.mode === "family" ? "Your family" : "Your kid"); }
  function firstPhotoURL() {
    var f = state.mode === "family" ? state.familyFiles[0] : state.personalFile;
    return f ? URL.createObjectURL(f) : "images/samples/jasmin-photo.jpg";
  }

  /* ---------------- Step switching ---------------- */
  function go(step) {
    $$("[data-step]").forEach(function (s) { s.classList.toggle("hidden", s.getAttribute("data-step") !== step); });
    window.scrollTo(0, 0);
    if (step === "details") $("#summaryPhoto").src = firstPhotoURL();
    if (step === "order") renderOrder();
    if (step === "upload") renderCartWaiting();
    refreshText();
  }
  $$("[data-go]").forEach(function (b) { b.addEventListener("click", function () { go(b.getAttribute("data-go")); }); });

  function refreshText() {
    $$(".js-name").forEach(function (el) { el.textContent = bookName(); });
    $$(".js-theme").forEach(function (el) { el.textContent = themeLabel(); });
  }

  /* ---------------- Step 1: mode + photos ---------------- */
  function setMode(mode) {
    state.mode = mode;
    $$(".segmented button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode)); });
    $$("[data-show-mode]").forEach(function (el) { el.classList.toggle("hidden", el.getAttribute("data-show-mode") !== mode); });
    $("#bookName").placeholder = mode === "family" ? "e.g. The Rivera Family" : "e.g. Ava";
    state.product = mode === "family" ? "family_print" : "print";
    renderProducts();
    updateUploadButton();
  }
  $$(".segmented button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); }); });

  // Personal: one photo
  $("#personalFile").addEventListener("change", function (e) {
    var f = e.target.files[0];
    if (!f) return;
    state.personalFile = f;
    var drop = $("#personalDrop");
    drop.classList.add("has-photo");
    $$(".photo, .photo-ok, .photo-change", drop).forEach(function (el) { el.remove(); });
    var img = document.createElement("img"); img.className = "photo"; img.alt = "Your photo"; img.src = URL.createObjectURL(f);
    var ok = document.createElement("span"); ok.className = "photo-ok"; ok.textContent = "✓ Photo added";
    var ch = document.createElement("span"); ch.className = "photo-change"; ch.textContent = "Change";
    drop.appendChild(img); drop.appendChild(ok); drop.appendChild(ch);
    updateUploadButton();
  });

  // Family: up to 5 photos
  function renderFamilySlots() {
    var box = $("#familySlots"); box.innerHTML = "";
    for (var i = 0; i < CFG.MAX_FAMILY_PHOTOS; i++) {
      var slot = document.createElement("label");
      slot.className = "family-slot";
      if (i < state.familyFiles.length) {
        slot.classList.add("filled");
        var img = document.createElement("img"); img.alt = "Person " + (i + 1); img.src = URL.createObjectURL(state.familyFiles[i]);
        var rm = document.createElement("button"); rm.type = "button"; rm.className = "remove"; rm.textContent = "×"; rm.setAttribute("aria-label", "Remove person " + (i + 1));
        (function (idx) { rm.addEventListener("click", function (ev) { ev.preventDefault(); state.familyFiles.splice(idx, 1); renderFamilySlots(); updateUploadButton(); }); })(i);
        slot.appendChild(img); slot.appendChild(rm);
      } else if (i === state.familyFiles.length) {
        slot.innerHTML = '<span class="plus">+</span>Add person ' + (i + 1);
        var input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.setAttribute("aria-label", "Add person " + (i + 1));
        input.addEventListener("change", function (e) { if (e.target.files[0]) { state.familyFiles.push(e.target.files[0]); renderFamilySlots(); updateUploadButton(); } });
        slot.appendChild(input);
      } else {
        slot.style.opacity = ".35"; slot.style.cursor = "default"; slot.textContent = "Person " + (i + 1);
      }
      box.appendChild(slot);
    }
  }

  function updateUploadButton() {
    $("#toTheme").disabled = state.mode === "family" ? state.familyFiles.length < (CFG.MIN_FAMILY_PHOTOS || 2) : !state.personalFile;
    var fh = $("#familyMinNote"); if (fh) fh.classList.toggle("hidden", !(state.mode === "family" && state.familyFiles.length === 1));
  }
  $("#toTheme").addEventListener("click", function () { go("theme"); });

  /* ---------------- Step 2: themes ---------------- */
  function renderThemes() {
    var grid = $("#themeGrid"); grid.innerHTML = "";
    CFG.THEMES.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "theme-card"; b.setAttribute("aria-pressed", String(t.id === state.theme));
      b.innerHTML = '<span class="theme-art bg-' + t.id + '"><img src="images/themes/' + t.id + '.svg" alt=""></span>' + t.label + '<span class="tick">✓</span>';
      b.addEventListener("click", function () { state.theme = t.id; renderThemes(); refreshText(); });
      grid.appendChild(b);
    });
  }

  /* ---------------- Step 3: name + level ---------------- */
  function renderLevels() {
    var box = $("#levels"); box.innerHTML = "";
    CFG.LEVELS.forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "level"; b.setAttribute("aria-pressed", String(l.id === state.level));
      b.innerHTML = l.label + "<small>" + l.ages + "</small>";
      b.addEventListener("click", function () { state.level = l.id; renderLevels(); });
      box.appendChild(b);
    });
  }
  $("#bookName").addEventListener("input", function (e) { state.name = e.target.value; refreshText(); });

  /* ---------------- Step 4: upload + draw the free preview ---------------- */
  $("#startPreview").addEventListener("click", async function () {
    var err = $("#detailsError"); err.classList.add("hidden");
    if (!state.name.trim()) { err.textContent = "Please add a name for the cover."; err.classList.remove("hidden"); return; }
    go("drawing");
    $("#drawKicker").textContent = "MAKING " + bookName().toUpperCase() + "'S PREVIEW";
    $("#drawError").classList.add("hidden");
    setDrawProgress(5);
    try {
      var files = state.mode === "family" ? state.familyFiles : [state.personalFile];
      var up = await API.uploadPhotos(files, state.mode);
      var pv = await API.startPreview({
        uploadIds: up.uploadIds, mode: state.mode, theme: state.theme, level: state.level,
        name: state.name.trim(), creatorCode: window.CrayonautsCreator.get()
      });
      state.previewId = pv.previewId;
      pollPreview();
    } catch (e) {
      showDrawError(e && e.message);
    }
  });

  function setDrawProgress(p) {
    $("#drawBar").style.width = p + "%";
    $("#drawCover").style.height = (100 - p) + "%";
    $("#drawMsg").textContent = p < 35 ? "Finding that smile…" : p < 70 ? "Sketching the scene…" : p < 100 ? "Adding the final lines…" : "Ready! Your 2 free pages are done.";
  }
  function showDrawError(msg) {
    var e = $("#drawError");
    e.textContent = msg || "Something went wrong drawing your preview. Please go back and try again.";
    e.classList.remove("hidden");
  }

  async function pollPreview() {
    try {
      var r = await API.getPreview(state.previewId);
      setDrawProgress(r.progress || 50);
      if (r.status === "ready") {
        state.previewPages = r.pages || [];
        $("#previewPage1").src = state.previewPages[0] || "";
        $("#previewPage2").src = state.previewPages[1] || "";
        TRACK.viewContent({ theme: state.theme, level: state.level, mode: state.mode, previewId: state.previewId });
        setTimeout(function () { go("preview"); }, 600);
      } else if (r.status === "failed") {
        showDrawError(r.error);
      } else {
        setTimeout(pollPreview, CFG.DEMO_MODE ? 350 : 2000);
      }
    } catch (e) { showDrawError(e && e.message); }
  }

  /* ---------------- Step 5: choose product ---------------- */
  function productsForMode() {
    return Object.keys(CFG.PRODUCTS).filter(function (k) { return CFG.PRODUCTS[k].family === (state.mode === "family"); });
  }
  function renderProducts() {
    var box = $("#productList"); box.innerHTML = "";
    productsForMode().forEach(function (k) {
      var p = CFG.PRODUCTS[k], total = p.book + p.shipping;
      var b = document.createElement("button");
      b.type = "button"; b.className = "product"; b.setAttribute("aria-pressed", String(k === state.product));
      b.innerHTML = '<span class="dot"></span><span style="flex:1"><span class="name">' + p.name + '</span><span class="desc">' + p.desc + "</span></span>" +
        '<span><span class="amount">' + money0(total) + '</span><span class="breakdown">' + (p.shipping ? "$" + p.book + " + $9.95 ship" : "PDF") + "</span></span>";
      b.addEventListener("click", function () { state.product = k; renderProducts(); });
      box.appendChild(b);
    });
    var cur = CFG.PRODUCTS[state.product];
    $("#shipNote").classList.toggle("hidden", !cur.shipping);
    $("#toOrder").textContent = "Continue · " + money0(cur.book + cur.shipping);
  }
  $("#toOrder").addEventListener("click", function () { go("order"); });

  $("#emailPreviewForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("#previewEmailBtn");
    try { await API.emailPreview({ previewId: state.previewId, email: $("#previewEmail").value }); btn.textContent = "Sent ✓"; }
    catch (err) { btn.textContent = "Try again"; }
  });

  function renderCartWaiting() {
    var n = loadCart().length, box = $("#cartWaiting");
    if (!box) return;
    box.classList.toggle("hidden", n === 0);
    $("#cartWaitingText").textContent = n + (n === 1 ? " book" : " books") + " in your order";
  }
  function resetForNextBook() {
    state.personalFile = null; state.familyFiles = []; state.name = ""; state.previewId = null; state.previewPages = [];
    $("#bookName").value = "";
    var drop = $("#personalDrop"); drop.classList.remove("has-photo");
    $$(".photo, .photo-ok, .photo-change", drop).forEach(function (el) { el.remove(); });
    try { $("#personalFile").value = ""; } catch (e) {}
    renderFamilySlots(); updateUploadButton();
  }
  $("#addBook").addEventListener("click", function () {
    var err = $("#addBookError"); err.classList.add("hidden");
    var cur = API.currentOrder && API.currentOrder();
    if (!cur || !state.previewPages.filter(Boolean).length) { err.textContent = "See the free preview of this book first, then add it."; err.classList.remove("hidden"); return; }
    var items = loadCart();
    if (items.length >= MAX_CART) { err.textContent = "That is the most books we can take in one order."; err.classList.remove("hidden"); return; }
    if (!items.some(function (it) { return String(it.orderId) === String(cur.orderId); })) {
      items.push({ orderId: cur.orderId, token: cur.token, childName: state.name.trim(), product: apiProduct(state.product), family: state.mode === "family" });
    }
    saveCart(items);
    resetForNextBook();
    state.cartOnly = false;
    go("upload");
  });
  $("#checkoutCart").addEventListener("click", function () {
    if (!loadCart().length) return;
    state.cartOnly = true;
    go("order");
  });

  /* ---------------- Step 6: order summary → Stripe ---------------- */
  function renderOrder() {
    var p = CFG.PRODUCTS[state.product];
    var cart = loadCart();
    var onlyCart = state.cartOnly && cart.length;
    var back = $('[data-step="order"] .btn-back'); if (back) back.setAttribute("data-go", onlyCart ? "upload" : "preview");
    var leadCard = $("#orderThumb").closest(".card");
    if (leadCard) leadCard.classList.toggle("hidden", !!onlyCart);
    if (!onlyCart) {
      $("#orderThumb").src = state.previewPages[0] || "images/samples/jasmin-superhero-page.jpg";
      $("#orderProduct").textContent = p.name + " · 15 pages";
    }
    // Other books already in the order
    $("#cartBox").classList.toggle("hidden", cart.length === 0);
    $("#cartBox b").textContent = onlyCart ? "Your order" : "Also in this order";
    $("#cartList").innerHTML = cart.map(function (it, i) {
      return '<li style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:4px 0"><span>' + esc(it.childName || "Book " + (i + 1)) +
        (it.family ? " (family)" : "") + (it.product === "print" ? " · printed + PDF" : " · PDF") + "</span><span>" + money(itemPrice(it)) +
        ' <button type="button" class="btn-link" data-remove="' + i + '" style="padding:0 0 0 8px;font-size:13px">Remove</button></span></li>';
    }).join("");
    $$("[data-remove]", $("#cartList")).forEach(function (b) {
      b.addEventListener("click", function () {
        var now = loadCart(); now.splice(Number(b.getAttribute("data-remove")), 1); saveCart(now);
        if (state.cartOnly && !now.length) { state.cartOnly = false; go("upload"); return; }
        renderOrder();
      });
    });
    var books = (onlyCart ? 0 : p.book) + cart.reduce(function (a, it) { return a + itemPrice(it); }, 0);
    var anyPrint = (!onlyCart && p.shipping > 0) || cart.some(function (it) { return it.product === "print"; });
    var ship = anyPrint ? CFG.PRODUCTS.print.shipping : 0;
    var count = (onlyCart ? 0 : 1) + cart.length;
    var html = '<div class="row"><span>' + (count > 1 ? count + " books" : "Book") + "</span><span>" + money(books) + "</span></div>";
    if (ship) html += '<div class="row"><span>Shipping (US)' + (count > 1 ? " - one box" : "") + "</span><span>" + money(ship) + "</span></div>";
    if (state.promoCode) html += '<div class="row" style="color:#1E7B4D"><span>Promo ' + state.promoCode + "</span><span>applied at checkout</span></div>";
    html += '<div class="row total"><span>Total</span><span>' + money(books + ship) + "</span></div>";
    $("#orderTotals").innerHTML = html;
    state.orderTotal = books + ship;
    $("#addressNote").classList.toggle("hidden", !anyPrint);
    var c = window.CrayonautsCreator.get();
    $("#creatorNote").classList.toggle("hidden", !c);
    $("#creatorCode").textContent = c;
  }

  $("#promoForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var code = $("#promoCode").value.trim().toUpperCase(), msg = $("#promoMsg");
    if (!code) { state.promoCode = ""; msg.textContent = ""; renderOrder(); return; }
    msg.textContent = "Checking…";
    try {
      var r = await API.checkPromo({ code: code, product: state.product });
      if (r.valid) { state.promoCode = code; msg.textContent = r.label || "Code applied"; }
      else { state.promoCode = ""; msg.textContent = "That code isn't valid."; }
    } catch (err) { msg.textContent = "Couldn't check the code. Please try again."; }
    renderOrder();
  });

  $("#toStripe").addEventListener("click", async function () {
    var btn = this, err = $("#checkoutError"), p = CFG.PRODUCTS[state.product];
    err.classList.add("hidden");
    var email = ($("#orderEmail").value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.textContent = "Please add the email address your book should go to."; err.classList.remove("hidden");
      $("#orderEmail").focus(); return;
    }
    var smsOn = $("#smsOpt").checked, phone = $("#smsPhone").value;
    $("#smsPhoneError").classList.add("hidden");
    if (smsOn && !usPhone(phone)) { $("#smsPhoneError").classList.remove("hidden"); $("#smsPhone").focus(); return; }
    btn.disabled = true;
    TRACK.initiateCheckout({ product: state.product, value: state.orderTotal || (p.book + p.shipping), currency: "USD", theme: state.theme, previewId: state.previewId });
    if (smsOn) API.smsOptin({ phone: phone, promos: $("#smsPromos").checked });
    var cart = loadCart(), lead = null, extra = cart;
    if (state.cartOnly && cart.length) { lead = cart[0]; extra = cart.slice(1); }
    try {
      var r = await API.startCheckout({ previewId: state.previewId, product: state.product, promoCode: state.promoCode, creatorCode: window.CrayonautsCreator.get(), email: email, name: lead ? (lead.childName || "") : state.name.trim(), lead: lead, extra: extra });
      window.location.href = r.checkoutUrl;
    } catch (e) {
      btn.disabled = false; err.textContent = (e && e.message) || "Couldn't open checkout. Please try again."; err.classList.remove("hidden");
    }
  });

  /* ---------------- Text-message updates (optional) ---------------- */
  function usPhone(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    return d.length === 10 && d[0] >= "2" && d[3] >= "2" ? d : "";
  }
  $("#smsOpt").addEventListener("change", function () {
    $("#smsFields").classList.toggle("hidden", !this.checked);
    if (!this.checked) $("#smsPhoneError").classList.add("hidden");
  });

  /* ---------------- Start ---------------- */
  renderFamilySlots();
  renderThemes();
  renderLevels();
  setMode(state.mode);
  refreshText();
  renderCartWaiting();
})();
