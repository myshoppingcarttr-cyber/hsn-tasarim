// HSN Otomotiv – Servis paneli (CRM): araçlar, işlem girişi, yaklaşan bakımlar, onaylar, müşteriler
(function () {
  "use strict";
  var H = window.HSN, api = H.api, e = H.esc;
  var root = document.getElementById("panel");
  if (!root) return;
  var S = { tab: "araclar", q: "", vehicles: [], claims: [], customers: [], open: null, email: "" };
  var demoNote = api.mode === "demo" ? '<div class="app-demo"><b>Demo modu:</b> Servis girişi için <code>usta@hsnotomotiv.com</code>, kod <code>123456</code>. Veriler sadece bu tarayıcıda saklanır. <button type="button" class="linkbtn" id="reset">Demo verilerini sıfırla</button></div>' : "";
  var waPhone = function (p) { var n = H.normPhone(p); return n.length === 10 ? "90" + n : ""; };
  var catOpts = function (sel) { return Object.keys(H.CATS).map(function (k) { return '<option value="' + k + '"' + (k === sel ? " selected" : "") + ">" + H.CATS[k].ad + "</option>"; }).join(""); };
  var stLabel = { ok: "İyi", soon: "Yaklaşıyor", late: "Gecikti" };

  function render(html) {
    root.innerHTML = demoNote + html;
    var r = document.getElementById("reset");
    if (r) r.onclick = function () { if (confirm("Demo verileri sıfırlansın mı?")) api.resetDemo().then(boot); };
  }

  // ---------- Giriş ----------
  function viewLogin(step, msg) {
    render('<div class="app-card auth"><h2>Servis paneli girişi</h2>' +
      (msg ? '<p class="app-err">' + e(msg) + "</p>" : "") +
      (step === "code"
        ? '<p class="app-mute">' + e(S.email) + ' adresine giriş e-postası gönderildi. E-postadaki bağlantıya tıklayın ya da kodu girin.</p><form id="f" class="app-form"><label>Kod<input name="v" inputmode="numeric" maxlength="6" required></label><p class="app-err" hidden></p><button class="btn btn-primary">Giriş</button></form>'
        : '<form id="f" class="app-form"><label>Servis e-postası<input name="v" type="email" required value="' + e(S.email) + '"></label><p class="app-err" hidden></p><button class="btn btn-primary">Kod gönder</button></form>') +
      "</div>");
    var f = document.getElementById("f");
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var er = f.querySelector(".app-err"), b = f.querySelector("button"); b.disabled = true;
      var p = step === "code" ? api.verifyCode(S.email, f.v.value).then(boot) : api.sendCode((S.email = f.v.value.trim())).then(function () { viewLogin("code"); });
      p.catch(function (x) { b.disabled = false; er.hidden = false; er.textContent = x.message; });
    };
  }

  // ---------- Kabuk ----------
  function shell(inner) {
    var tabs = [["araclar", "Araçlar"], ["bakim", "Yaklaşan bakımlar"], ["onay", "Onay bekleyen" + (S.claims.length ? " <em>" + S.claims.length + "</em>" : "")], ["musteri", "Müşteriler"]];
    render('<div class="pn-top"><div><b>HSN Servis Paneli</b><small>' + e(S.email) + '</small></div><div class="pn-tabs">' +
      tabs.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (S.tab === t[0] ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") +
      '</div><button type="button" class="btn btn-outline" id="out">Çıkış</button></div>' + inner);
    root.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { S.tab = b.dataset.tab; S.open = null; draw(); }; });
    document.getElementById("out").onclick = function () { api.signOut().then(function () { viewLogin("mail"); }); };
  }

  // ---------- Araçlar ----------
  function vehicleForm(v) {
    v = v || {};
    return '<form id="vf" class="app-form grid2">' +
      '<label>Plaka<input name="plate" required value="' + e(v.plate ? H.fmtPlate(v.plate) : "") + '" style="text-transform:uppercase"></label>' +
      '<label>Model<input name="model" placeholder="320d (F30)" value="' + e(v.model) + '"></label>' +
      '<label>Model yılı<input name="year" type="number" value="' + e(v.year) + '"></label>' +
      '<label>Motor kodu<input name="engine_code" placeholder="N47" value="' + e(v.engine_code) + '"></label>' +
      '<label>Araç sahibi<input name="owner_name" value="' + e(v.owner_name) + '"></label>' +
      '<label>Sahip telefonu<input name="owner_phone" type="tel" value="' + e(v.owner_phone) + '"></label>' +
      '<label>Şasi no (VIN)<input name="vin" value="' + e(v.vin) + '"></label>' +
      '<label>Not<input name="notes" value="' + e(v.notes) + '"></label>' +
      '<div class="span2"><button class="btn btn-primary">' + (v.id ? "Aracı güncelle" : "Aracı kaydet") + "</button></div></form>";
  }
  function bindVehicleForm(v) {
    var f = document.getElementById("vf");
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var d = { plate: f.plate.value, model: f.model.value || null, year: f.year.value ? +f.year.value : null, engine_code: f.engine_code.value || null, owner_name: f.owner_name.value || null, owner_phone: f.owner_phone.value || null, vin: f.vin.value || null, notes: f.notes.value || null };
      if (v && v.id) d.id = v.id;
      api.saveVehicle(d).then(function (saved) { S.open = saved.id; return load(); }).then(draw).catch(function (x) { alert(x.message); });
    };
  }

  function listVehicles() {
    var q = H.normPlate(S.q), ql = S.q.toLocaleLowerCase("tr-TR");
    var rows = S.vehicles.filter(function (v) {
      return !S.q || v.plate.indexOf(q) > -1 || String(v.owner_name || "").toLocaleLowerCase("tr-TR").indexOf(ql) > -1 || H.normPhone(v.owner_phone).indexOf(S.q.replace(/\D/g, "")) > -1 && S.q.replace(/\D/g, "");
    });
    shell('<div class="pn-bar"><input id="q" placeholder="Plaka, isim veya telefon ara…" value="' + e(S.q) + '"><button class="btn btn-primary" id="new">+ Yeni araç</button></div>' +
      '<div id="newbox"></div>' +
      '<div class="app-card tbl"><table><thead><tr><th>Plaka</th><th>Model</th><th>Sahibi</th><th>Telefon</th><th>Son km</th><th>Durum</th><th>Müşteri hesabı</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (v) {
        var h = H.health(v, v.service_records);
        return "<tr><td><b>" + e(H.fmtPlate(v.plate)) + "</b></td><td>" + e(v.model || "—") + "</td><td>" + e(v.owner_name || "—") + "</td><td>" + e(v.owner_phone || "—") + "</td><td>" + H.fmtKm(h.lastKm) + '</td><td><span class="pill ' + h.overall + '">' + stLabel[h.overall] + "</span></td><td>" + (v.customer_id ? "Bağlı" : "—") + '</td><td><button class="btn btn-outline sm" data-open="' + v.id + '">Aç</button></td></tr>';
      }).join("") : '<tr><td colspan="8" class="app-mute">Kayıt bulunamadı.</td></tr>') + "</tbody></table></div>");
    var qi = document.getElementById("q");
    qi.oninput = function () { S.q = qi.value; var pos = qi.selectionStart; listVehicles(); var n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); };
    document.getElementById("new").onclick = function () { document.getElementById("newbox").innerHTML = '<div class="app-card"><h3>Yeni araç</h3>' + vehicleForm() + "</div>"; bindVehicleForm(); };
    root.querySelectorAll("[data-open]").forEach(function (b) { b.onclick = function () { S.open = b.dataset.open; draw(); }; });
  }

  function vehicleDetail(v) {
    var h = H.health(v, v.service_records);
    var recs = h.records.map(function (r) {
      return "<tr><td>" + H.fmtDate(r.service_date) + "</td><td>" + H.fmtKm(r.km) + "</td><td>" + e((H.CATS[r.category] || {}).ad || r.category) + "</td><td><b>" + e(r.title) + "</b>" + ((r.items || []).length ? '<br><small class="app-mute">' + r.items.map(e).join(" · ") + "</small>" : "") + "</td><td>" + (r.next_date ? H.fmtDate(r.next_date) : "") + (r.next_km ? "<br>" + H.fmtKm(r.next_km) : "") + '</td><td><button class="linkbtn" data-del="' + r.id + '">Sil</button></td></tr>';
    }).join("");
    shell('<p><button class="linkbtn" id="back">← Araçlar</button></p>' +
      '<div class="app-card"><div class="veh-head"><span class="plate"><i>TR</i><b>' + e(H.fmtPlate(v.plate)) + '</b></span><div><h3>BMW ' + e(v.model || "") + '</h3><p class="app-mute">' + e(v.owner_name || "") + " · " + e(v.owner_phone || "") + (v.customer_id ? " · Müşteri hesabına bağlı" : "") + '</p></div><div class="km"><small>Son km</small><b>' + H.fmtKm(h.lastKm) + "</b></div></div>" +
      '<div class="health">' + h.items.map(function (it) { return '<div class="hi ' + it.status + '"><b>' + e(it.ad) + "</b><span>" + (it.status === "none" ? "Kayıt yok" : stLabel[it.status] + (it.last.next_date ? " · " + H.fmtDate(it.last.next_date) : "") + (it.last.next_km ? " · " + H.fmtKm(it.last.next_km) : "")) + "</span></div>"; }).join("") + "</div></div>" +
      '<div class="app-card"><h3>Yeni işlem ekle</h3><form id="rf" class="app-form grid2">' +
      '<label>Tarih<input name="service_date" type="date" required value="' + H.today() + '"></label>' +
      '<label>Kilometre<input name="km" type="number" placeholder="' + (h.lastKm || "") + '"></label>' +
      '<label>Kategori<select name="category">' + catOpts("bakim") + "</select></label>" +
      '<label>Başlık<input name="title" required value="Periyodik bakım"></label>' +
      '<label class="span2">Yapılan işler (her satıra bir kalem)<textarea name="items" rows="4" placeholder="Motor yağı değişimi&#10;Yağ, hava ve polen filtresi&#10;Diyagnostik tarama"></textarea></label>' +
      '<label>Kullanılan parçalar<input name="parts"></label>' +
      '<label>Fatura no<input name="invoice_no"></label>' +
      '<label>Tutar (₺, isteğe bağlı)<input name="amount" type="number" step="0.01"></label>' +
      '<label>Not (müşteri görür)<input name="notes"></label>' +
      '<label>Sonraki bakım tarihi<input name="next_date" type="date"></label>' +
      '<label>Sonraki bakım km<input name="next_km" type="number"></label>' +
      '<div class="span2"><button class="btn btn-primary">İşlemi kaydet</button> <span class="app-small">Kayıt anında müşterinin panelinde görünür.</span></div></form></div>' +
      '<div class="app-card tbl"><h3>Servis geçmişi (' + h.records.length + ')</h3><table><thead><tr><th>Tarih</th><th>Km</th><th>Kategori</th><th>İşlem</th><th>Sonraki</th><th></th></tr></thead><tbody>' + (recs || '<tr><td colspan="6" class="app-mute">Kayıt yok.</td></tr>') + "</tbody></table></div>" +
      '<details class="app-card"><summary>Araç bilgilerini düzenle</summary>' + vehicleForm(v) + "</details>");
    document.getElementById("back").onclick = function () { S.open = null; draw(); };
    bindVehicleForm(v);
    var f = document.getElementById("rf");
    var fill = function (setTitle) {
      var s = H.suggestNext(f.category.value, f.service_date.value, f.km.value);
      f.next_date.value = s.next_date || ""; f.next_km.value = s.next_km || "";
      if (setTitle) f.title.value = H.CATS[f.category.value].ad;
    };
    f.category.onchange = function () { fill(true); };
    f.km.oninput = f.service_date.onchange = function () { fill(false); };
    fill(false);
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var r = { vehicle_id: v.id, service_date: f.service_date.value, km: f.km.value ? +f.km.value : null, category: f.category.value, title: f.title.value.trim(), items: f.items.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean), parts: f.parts.value || null, invoice_no: f.invoice_no.value || null, amount: f.amount.value ? +f.amount.value : null, notes: f.notes.value || null, next_date: f.next_date.value || null, next_km: f.next_km.value ? +f.next_km.value : null };
      f.querySelector("button").disabled = true;
      api.addRecord(r).then(load).then(draw).catch(function (x) { alert(x.message); f.querySelector("button").disabled = false; });
    };
    root.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { if (confirm("Bu işlem kaydı silinsin mi?")) api.deleteRecord(b.dataset.del).then(load).then(draw); }; });
  }

  // ---------- Yaklaşan bakımlar ----------
  function dueList() {
    var rows = [];
    S.vehicles.forEach(function (v) {
      H.health(v, v.service_records).items.forEach(function (it) { if (it.status === "soon" || it.status === "late") rows.push({ v: v, it: it }); });
    });
    rows.sort(function (a, b) { return (a.it.status === "late" ? 0 : 1) - (b.it.status === "late" ? 0 : 1) || (a.it.daysLeft || 0) - (b.it.daysLeft || 0); });
    shell('<div class="app-card tbl"><h3>Yaklaşan ve geciken bakımlar (' + rows.length + ')</h3><table><thead><tr><th>Plaka</th><th>Sahibi</th><th>Kalem</th><th>Durum</th><th>Sonraki</th><th>Hatırlatma</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (x) {
        var it = x.it, v = x.v, tel = waPhone(v.owner_phone);
        var msg = "Merhaba " + (v.owner_name || "") + ", HSN Otomotiv'den yazıyoruz. " + H.fmtPlate(v.plate) + " plakalı BMW'nizin " + it.ad.toLocaleLowerCase("tr-TR") + " zamanı " + (it.status === "late" ? "geçmiş görünüyor" : "yaklaştı") + ". Randevu için bu mesajı yanıtlayabilirsiniz.";
        return "<tr><td><b>" + e(H.fmtPlate(v.plate)) + "</b></td><td>" + e(v.owner_name || "—") + "</td><td>" + e(it.ad) + '</td><td><span class="pill ' + it.status + '">' + stLabel[it.status] + "</span></td><td>" + (it.last.next_date ? H.fmtDate(it.last.next_date) : "") + (it.last.next_km ? "<br>" + H.fmtKm(it.last.next_km) : "") + "</td><td>" + (tel ? '<a class="btn btn-wa sm" target="_blank" rel="noopener" href="https://wa.me/' + tel + "?text=" + encodeURIComponent(msg) + '">WhatsApp</a>' : '<span class="app-mute">Telefon yok</span>') + "</td></tr>";
      }).join("") : '<tr><td colspan="6" class="app-mute">Yaklaşan bakım yok.</td></tr>') + "</tbody></table></div>");
  }

  // ---------- Onay bekleyenler ----------
  function claimList() {
    shell('<div class="app-card tbl"><h3>Plaka eşleştirme onayları</h3><p class="app-mute">Müşteri kayıt olurken girdiği plaka ve telefon servis kaydıyla eşleşmediyse burada onay bekler. Müşteriyi arayıp doğruladıktan sonra onaylayın.</p><table><thead><tr><th>Plaka</th><th>Müşteri</th><th>Telefon</th><th>E-posta</th><th>Tarih</th><th></th></tr></thead><tbody>' +
      (S.claims.length ? S.claims.map(function (c) {
        var cu = c.customers || {};
        return "<tr><td><b>" + e(H.fmtPlate(c.plate)) + "</b></td><td>" + e(cu.full_name || "") + "</td><td>" + e(cu.phone || "") + "</td><td>" + e(cu.email || "") + "</td><td>" + H.fmtDate(c.created_at) + '</td><td><button class="btn btn-primary sm" data-ok="' + c.id + '">Onayla</button> <button class="linkbtn" data-no="' + c.id + '">Reddet</button></td></tr>';
      }).join("") : '<tr><td colspan="6" class="app-mute">Bekleyen onay yok.</td></tr>') + "</tbody></table></div>");
    root.querySelectorAll("[data-ok]").forEach(function (b) { b.onclick = function () { var m = prompt("Araç modeli (isteğe bağlı, ör. 320d F30):") || ""; api.approveClaim(b.dataset.ok, m).then(load).then(draw).catch(function (x) { alert(x.message); }); }; });
    root.querySelectorAll("[data-no]").forEach(function (b) { b.onclick = function () { if (confirm("Talep reddedilsin mi?")) api.rejectClaim(b.dataset.no).then(load).then(draw); }; });
  }

  // ---------- Müşteriler ----------
  function customerList() {
    shell('<div class="app-card tbl"><h3>Kayıtlı müşteriler (' + S.customers.length + ')</h3><table><thead><tr><th>Ad soyad</th><th>Telefon</th><th>E-posta</th><th>Araçlar</th></tr></thead><tbody>' +
      (S.customers.length ? S.customers.map(function (c) {
        var vs = S.vehicles.filter(function (v) { return v.customer_id === c.id; }).map(function (v) { return H.fmtPlate(v.plate); });
        return "<tr><td>" + e(c.full_name) + "</td><td>" + e(c.phone) + "</td><td>" + e(c.email) + "</td><td>" + e(vs.join(", ") || "—") + "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="app-mute">Henüz müşteri kaydı yok.</td></tr>') + "</tbody></table></div>");
  }

  function draw() {
    if (S.tab === "araclar") { var v = S.open && S.vehicles.find(function (x) { return x.id === S.open; }); return v ? vehicleDetail(v) : listVehicles(); }
    if (S.tab === "bakim") return dueList();
    if (S.tab === "onay") return claimList();
    return customerList();
  }
  function load() {
    return Promise.all([api.listVehicles(), api.listClaims(), api.listCustomers()]).then(function (r) { S.vehicles = r[0] || []; S.claims = r[1] || []; S.customers = r[2] || []; });
  }
  function boot() {
    render('<div class="app-card"><p class="app-mute">Yükleniyor…</p></div>');
    return api.currentUser().then(function (u) {
      if (!u) return viewLogin("mail");
      S.email = u.email;
      return api.isStaff().then(function (ok) {
        if (!ok) { render('<div class="app-card auth"><h2>Servis paneli</h2><p class="app-err">' + e(u.email) + ' servis çalışanı olarak tanımlı değil.</p><p class="app-mute">Müşteri hesabınızla giriş yaptıysanız araç bilgilerinizi müşteri panelinde görebilirsiniz.</p><p><a class="btn btn-primary" href="hesabim.html">Müşteri paneline git</a> <button type="button" class="btn btn-outline" id="sw">Farklı hesapla giriş</button></p></div>'); document.getElementById("sw").onclick = function () { api.signOut().then(function () { viewLogin("mail"); }); }; return; }
        return load().then(draw);
      });
    }).catch(function (x) { render('<div class="app-card"><p class="app-err">' + e(x.message) + "</p></div>"); });
  }
  // Başka sekmede giriş/çıkış olursa (ör. e-postadaki bağlantı yeni sekmede açıldıysa) bu sekmeyi de güncelle
  window.addEventListener("storage", function (ev) { if (ev.key && /auth-token|hsn_demo_session/.test(ev.key)) boot(); });
  boot();
})();
