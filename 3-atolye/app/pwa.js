// HSN Otomotiv – uygulama (PWA) desteği: service worker kaydı + "Uygulamayı yükle" bandı
(function () {
  "use strict";
  var isHttp = /^https?:$/.test(location.protocol);
  var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  var isServis = !!document.getElementById("panel");
  var appName = isServis ? "HSN Servis" : "HSN Aracım";
  var KEY = "hsn_pwa_gizle_" + (isServis ? "servis" : "musteri");

  if (isHttp && "serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  if (standalone) { document.documentElement.classList.add("pwa-app"); return; }
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}

  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var deferred = null;

  function bar(html) {
    var wrap = document.querySelector(".app-wrap");
    if (!wrap || document.getElementById("pwa-bar")) return null;
    var b = document.createElement("div");
    b.id = "pwa-bar"; b.className = "pwa-bar";
    b.innerHTML = '<img src="app/icons/' + (isServis ? "servis" : "musteri") + '-192.png" alt="" width="44" height="44"><div>' + html + '</div><button type="button" class="pwa-x" aria-label="Kapat">×</button>';
    wrap.insertBefore(b, wrap.firstChild);
    b.querySelector(".pwa-x").onclick = function () { b.remove(); try { localStorage.setItem(KEY, "1"); } catch (e) {} };
    return b;
  }

  // Android / bilgisayar (Chrome, Edge): tek tıkla yükleme
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    var b = bar("<b>" + appName + " uygulamasını yükleyin</b><span>" + (isServis ? "Telefonunuza veya bilgisayarınıza kendi simgesiyle eklenir, ayrı pencerede açılır." : "Telefonunuzun ana ekranına eklenir; aracınızın bakımını tek dokunuşla takip edin.") + '</span></div><div><button type="button" class="btn btn-primary sm" id="pwa-yukle">Yükle</button>');
    if (!b) return;
    document.getElementById("pwa-yukle").onclick = function () {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; b.remove(); });
    };
  });
  window.addEventListener("appinstalled", function () { var b = document.getElementById("pwa-bar"); if (b) b.remove(); });

  // iPhone / iPad (Safari): elle ekleme tarifi
  if (isIOS && isHttp) {
    window.addEventListener("load", function () {
      bar("<b>" + appName + " uygulamasını ana ekranınıza ekleyin</b><span>Safari'de alttaki <b>Paylaş</b> simgesine (kare ve yukarı ok) dokunun, ardından <b>Ana Ekrana Ekle</b>'yi seçin.</span>");
    });
  }
})();
