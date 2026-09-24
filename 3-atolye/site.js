// Sayfa geçiş yükleyicisi (HSN amblemi), acil konum bildirimi, galeri büyütme ve fotoğraf şeridi okları
(function () {
  // --- Acil durum: konumla WhatsApp bildirimi ---
  // [data-acil] öğesine tıklanınca konum istenir; izin verilirse Google Haritalar linki mesaja eklenir.
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-acil]");
    if (!a) return;
    e.preventDefault();
    var wa = "https://wa.me/" + a.getAttribute("data-acil") + "?text=";
    var base = "🚨 ACİL – Aracım yolda kaldı, yardım istiyorum.";
    var send = function (extra) { location.href = wa + encodeURIComponent(base + extra); };
    if (!navigator.geolocation) return send("\n(Konum paylaşılamadı, adresimi yazacağım.)");
    a.classList.add("busy");
    navigator.geolocation.getCurrentPosition(function (p) {
      a.classList.remove("busy");
      var c = p.coords;
      send("\nKonumum: https://maps.google.com/?q=" + c.latitude.toFixed(6) + "," + c.longitude.toFixed(6) + " (±" + Math.round(c.accuracy) + " m)");
    }, function () {
      a.classList.remove("busy");
      send("\n(Konum paylaşılamadı, adresimi yazacağım.)");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  // --- Yükleyici ---
  var ldr = document.createElement("div");
  ldr.className = "ldr";
  ldr.setAttribute("aria-hidden", "true");
  ldr.innerHTML = '<div class="ldr-mark"><span class="ldr-ring"></span><span class="ldr-txt">HSN</span></div>';
  document.body.appendChild(ldr);
  var hide = function () { ldr.classList.remove("on"); };
  window.addEventListener("pageshow", hide); // geri/ileri tuşunda takılı kalmasın

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a[href]");
    if (!a || a.hasAttribute("data-lb") || a.target === "_blank" || a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(tel:|mailto:|https?:|\/\/|javascript:)/i.test(href)) return;
    if (href.split("#")[0] === "" ) return;
    ldr.classList.add("on");
    setTimeout(hide, 6000); // her ihtimale karşı
  });

  // --- Lightbox ---
  var lb = document.createElement("div");
  lb.className = "lb";
  lb.innerHTML = '<img alt="">';
  document.body.appendChild(lb);
  var lbImg = lb.querySelector("img");
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-lb]");
    if (a) {
      e.preventDefault();
      lbImg.src = a.getAttribute("href");
      lbImg.alt = (a.querySelector("img") || {}).alt || "";
      lb.classList.add("open");
      return;
    }
    var b = e.target.closest("[data-strip]");
    var s = document.getElementById("shots");
    if (b && s) s.scrollBy({ left: +b.dataset.strip * s.clientWidth * 0.8, behavior: "smooth" });
  });
  lb.addEventListener("click", function () { lb.classList.remove("open"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") lb.classList.remove("open"); });
})();
