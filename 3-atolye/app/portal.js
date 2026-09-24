// HSN Otomotiv – Müşteri paneli (Hesabım): giriş, kayıt, araç sağlığı, işlem geçmişi
(function () {
  "use strict";
  var H = window.HSN, api = H.api, e = H.esc, CFG = window.HSN_CONFIG || {};
  var root = document.getElementById("app");
  if (!root) return;
  var state = { email: "", vehicles: [], active: 0 };

  var plateHtml = function (p) { return '<span class="plate"><i>TR</i><b>' + e(H.fmtPlate(p)) + "</b></span>"; };
  var demoNote = api.mode === "demo" ? '<div class="app-demo"><b>Demo modu:</b> Örnek verilerle çalışıyor. Giriş için herhangi bir e-posta yazın (örnek: <code>demo@musteri.com</code>), kod: <code>123456</code>.</div>' : "";
  var busy = function (btn, on) { if (btn) { btn.disabled = on; btn.classList.toggle("busy", on); } };
  var err = function (el, m) { el.textContent = m || ""; el.hidden = !m; };

  function render(html) { root.innerHTML = demoNote + html; }

  // ---------- Giriş: e-posta -> kod ----------
  function viewLogin(step) {
    render(
      '<div class="app-card auth">' +
      '<h2>Müşteri girişi</h2>' +
      (step === "code"
        ? '<p class="app-mute"><b>' + e(state.email) + '</b> adresine bir giriş e-postası gönderdik. E-postadaki <b>giriş bağlantısına tıklayın</b> ya da e-postada 6 haneli kod varsa aşağıya yazın. Gelen kutunuzu ve gereksiz klasörünü kontrol edin.</p>' +
          '<form id="f-code" class="app-form"><label>Giriş kodu<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="••••••"></label>' +
          '<p class="app-err" hidden></p><button class="btn btn-primary" type="submit">Giriş yap</button> <button class="btn btn-outline" type="button" id="back">E-postayı değiştir</button></form>'
        : '<p class="app-mute">Aracınızın servis geçmişini, bakım zamanlarını ve sağlık durumunu görmek için e-posta adresinizi girin. Şifre gerekmez; e-postanıza tek kullanımlık giriş bağlantısı göndereceğiz.</p>' +
          '<form id="f-mail" class="app-form"><label>E-posta<input name="email" type="email" autocomplete="email" required placeholder="ornek@mail.com" value="' + e(state.email) + '"></label>' +
          '<p class="app-err" hidden></p><button class="btn btn-primary" type="submit">Giriş bağlantısı gönder</button></form>' +
          '<p class="app-small">İlk kez mi giriyorsunuz? Girişten sonra ad-soyad, telefon ve plakanızla kaydınızı tamamlayacaksınız.</p>') +
      "</div>"
    );
    var f = document.getElementById(step === "code" ? "f-code" : "f-mail");
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var b = f.querySelector("button[type=submit]"), er = f.querySelector(".app-err");
      busy(b, true); err(er);
      var p = step === "code" ? api.verifyCode(state.email, f.code.value).then(boot) : api.sendCode((state.email = f.email.value.trim())).then(function () { viewLogin("code"); });
      p.catch(function (x) { busy(b, false); err(er, x.message); });
    });
    var back = document.getElementById("back");
    if (back) back.onclick = function () { viewLogin("mail"); };
  }

  // ---------- Kayıt ----------
  function viewRegister(user) {
    render(
      '<div class="app-card auth">' +
      '<h2>Kaydınızı tamamlayın</h2><p class="app-mute">' + e(user.email) + ' ile giriş yaptınız. Aracınızı hesabınıza bağlamak için bilgilerinizi girin.</p>' +
      '<form id="f-reg" class="app-form">' +
      '<label>Ad soyad<input name="full_name" required autocomplete="name"></label>' +
      '<label>Telefon<input name="phone" type="tel" required autocomplete="tel" placeholder="05xx xxx xx xx"></label>' +
      '<label>Plaka<input name="plate" required placeholder="07 ABC 123" style="text-transform:uppercase"></label>' +
      '<label class="chk"><input type="checkbox" name="kvkk" required> <span><a href="kvkk.html" target="_blank">KVKK Aydınlatma Metni</a>\'ni okudum; kişisel verilerimin servis kayıtlarımın tutulması ve bana gösterilmesi amacıyla işlenmesine açık rıza veriyorum.</span></label>' +
      '<p class="app-err" hidden></p><button class="btn btn-primary" type="submit">Kaydı tamamla</button></form>' +
      '<p class="app-small">Plakanız ve telefonunuz servis kaydımızla eşleşirse aracınız hemen hesabınıza bağlanır. Eşleşmezse servisimiz kısa sürede onaylar.</p></div>'
    );
    var f = document.getElementById("f-reg");
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var b = f.querySelector("button"), er = f.querySelector(".app-err");
      busy(b, true); err(er);
      api.register({ full_name: f.full_name.value.trim(), phone: f.phone.value.trim(), plate: f.plate.value, kvkk: f.kvkk.checked }).then(boot).catch(function (x) { busy(b, false); err(er, x.message); });
    });
  }

  // ---------- Panel ----------
  var ST = { ok: ["İyi durumda", "ok"], soon: ["Bakım yaklaşıyor", "soon"], late: ["Bakım zamanı geçti", "late"], none: ["Kayıt yok", "none"] };

  function itemHtml(it) {
    if (it.status === "none") return '<div class="hi none"><b>' + e(it.ad) + '</b><span>Servis kaydı yok</span></div>';
    var parts = [];
    if (it.daysLeft !== null) parts.push(it.daysLeft < 0 ? Math.abs(it.daysLeft) + " gün gecikti" : it.daysLeft + " gün kaldı");
    if (it.kmLeft !== null) parts.push(it.kmLeft < 0 ? H.fmtKm(Math.abs(it.kmLeft)) + " aşıldı" : "~" + H.fmtKm(it.kmLeft) + " kaldı");
    var due = [it.last.next_date ? H.fmtDate(it.last.next_date) : "", it.last.next_km ? H.fmtKm(it.last.next_km) : ""].filter(Boolean).join(" · ");
    return '<div class="hi ' + it.status + '"><b>' + e(it.ad) + '</b>' +
      (it.prog !== null ? '<div class="bar"><i style="width:' + Math.round(it.prog * 100) + '%"></i></div>' : "") +
      '<span>' + e(parts.join(" · ") || "Takipte") + '</span><small>Son: ' + H.fmtDate(it.last.service_date) + (due ? " · Sonraki: " + e(due) : "") + "</small></div>";
  }

  function vehicleHtml(v) {
    var h = H.health(v, v.service_records), st = ST[h.overall];
    var tl = h.records.map(function (r) {
      return '<li><div class="tl-date"><b>' + H.fmtDate(r.service_date) + '</b><span>' + H.fmtKm(r.km) + '</span></div>' +
        '<div class="tl-body"><span class="tag">' + e((H.CATS[r.category] || {}).ad || r.category) + '</span><h4>' + e(r.title) + '</h4>' +
        ((r.items || []).length ? "<ul>" + r.items.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>" : "") +
        (r.parts ? '<p><b>Parçalar:</b> ' + e(r.parts) + "</p>" : "") +
        (r.notes ? '<p class="app-mute">' + e(r.notes) + "</p>" : "") +
        (r.invoice_no ? '<p class="app-small">Fatura no: ' + e(r.invoice_no) + "</p>" : "") + "</div></li>";
    }).join("");
    var wa = "https://wa.me/" + (CFG.whatsapp || "") + "?text=" + encodeURIComponent("Merhaba, " + H.fmtPlate(v.plate) + " plakalı aracım için randevu almak istiyorum.");
    return '<div class="veh-head">' + plateHtml(v.plate) +
      '<div><h3>BMW ' + e(v.model || "") + '</h3><p class="app-mute">' + [v.year, v.engine_code && "Motor: " + v.engine_code].filter(Boolean).map(e).join(" · ") + "</p></div>" +
      '<div class="km"><small>Son servis km</small><b>' + H.fmtKm(h.lastKm) + '</b>' + (h.estKm && h.estKm !== h.lastKm ? '<small>Tahmini güncel: ' + H.fmtKm(h.estKm) + "</small>" : "") + "</div></div>" +
      '<div class="status ' + st[1] + '"><b>' + st[0] + '</b><span>' + (h.overall === "ok" ? "Takip edilen tüm bakımlar zamanında." : "Aşağıdaki kalemleri kontrol edin ve randevu alın.") + '</span>' +
      (h.overall !== "ok" ? '<a class="btn btn-primary" href="' + wa + '" rel="nofollow">Randevu al</a>' : "") + "</div>" +
      '<h3 class="app-h">Bakım takibi</h3><div class="health">' + h.items.map(itemHtml).join("") + "</div>" +
      '<h3 class="app-h">Servis geçmişi <small>(' + h.records.length + ' işlem)</small></h3>' +
      (h.records.length ? '<ol class="timeline">' + tl + "</ol>" : '<p class="app-mute">Bu araç için henüz servis kaydı yok.</p>');
  }

  function viewDash(user, profile, vehicles, claims) {
    state.vehicles = vehicles;
    var tabs = vehicles.length > 1 ? '<div class="veh-tabs">' + vehicles.map(function (v, i) { return '<button type="button" data-i="' + i + '"' + (i === state.active ? ' class="on"' : "") + ">" + e(H.fmtPlate(v.plate)) + "</button>"; }).join("") + "</div>" : "";
    var pend = claims.length ? '<div class="app-note">Onay bekleyen plaka: <b>' + claims.map(function (c) { return e(H.fmtPlate(c.plate)); }).join(", ") + "</b>. Servisimiz aracınızı doğruladıktan sonra geçmişi burada göreceksiniz.</div>" : "";
    render(
      '<div class="app-top"><div><small class="app-mute">Hoş geldiniz</small><h2>' + e(profile.full_name) + '</h2></div><button class="btn btn-outline" id="logout">Çıkış</button></div>' +
      pend + tabs +
      (vehicles.length ? '<div class="app-card" id="veh">' + vehicleHtml(vehicles[state.active] || vehicles[0]) + "</div>"
        : (claims.length ? "" : '<div class="app-card"><p>Hesabınıza bağlı araç yok.</p></div>'))
    );
    document.getElementById("logout").onclick = function () { api.signOut().then(function () { state.active = 0; viewLogin("mail"); }); };
    root.querySelectorAll(".veh-tabs button").forEach(function (b) { b.onclick = function () { state.active = +b.dataset.i; viewDash(user, profile, vehicles, claims); }; });
  }

  // ---------- Açılış ----------
  function boot() {
    render('<div class="app-card"><p class="app-mute">Yükleniyor…</p></div>');
    return api.currentUser().then(function (u) {
      if (!u) return viewLogin("mail");
      return api.isStaff().then(function (staff) {
        if (staff) { render('<div class="app-card"><h2>Servis hesabı</h2><p>Servis çalışanı olarak giriş yaptınız.</p><p><a class="btn btn-primary" href="panel.html">Servis paneline git</a> <button class="btn btn-outline" id="logout">Çıkış</button></p></div>'); document.getElementById("logout").onclick = function () { api.signOut().then(function () { viewLogin("mail"); }); }; return; }
        return api.myProfile().then(function (p) {
          if (!p) return viewRegister(u);
          return Promise.all([api.myVehicles(), api.myClaims()]).then(function (r) { viewDash(u, p, r[0], r[1]); });
        });
      });
    }).catch(function (x) { render('<div class="app-card"><p class="app-err">' + e(x.message) + "</p></div>"); });
  }
  // Başka sekmede giriş/çıkış olursa (ör. e-postadaki bağlantı yeni sekmede açıldıysa) bu sekmeyi de güncelle
  window.addEventListener("storage", function (ev) { if (ev.key && /auth-token|hsn_demo_session/.test(ev.key)) boot(); });
  boot();
})();
