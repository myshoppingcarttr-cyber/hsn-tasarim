// HSN Otomotiv – veri katmanı (Supabase canlı mod + yerel DEMO mod) ve araç sağlığı hesapları
(function () {
  "use strict";
  var CFG = window.HSN_CONFIG || {};
  var LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);

  // ---------- İşlem kategorileri ve bakım aralıkları ----------
  var CATS = {
    bakim:          { ad: "Periyodik bakım",        ay: 12, km: 10000, takip: true },
    fren_hidroligi: { ad: "Fren hidroliği",         ay: 24,            takip: true },
    sanziman:       { ad: "Şanzıman yağı",          ay: 48, km: 60000, takip: true },
    buji:           { ad: "Buji",                   ay: 48, km: 60000, takip: true },
    klima:          { ad: "Klima bakımı",           ay: 12,            takip: true },
    motor:          { ad: "Motor" },
    zincir:         { ad: "Zincir değişimi" },
    turbo:          { ad: "Turbo" },
    dpf:            { ad: "Partikül filtresi (DPF)" },
    elektrik:       { ad: "Elektrik / kodlama" },
    kaporta:        { ad: "Kaporta / boya" },
    yuruyen:        { ad: "Yürüyen / fren" },
    parca:          { ad: "Yedek parça" },
    diger:          { ad: "Diğer" }
  };

  var normPlate = function (p) { return String(p || "").toLocaleUpperCase("tr-TR").replace(/[^0-9A-ZÇĞİÖŞÜ]/g, ""); };
  var normPhone = function (p) { return String(p || "").replace(/\D/g, "").slice(-10); };
  var fmtPlate = function (p) { var m = normPlate(p).match(/^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,4})$/); return m ? m[1] + " " + m[2] + " " + m[3] : normPlate(p); };
  var addMonths = function (iso, n) { var d = new Date(iso); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
  var daysBetween = function (a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); };
  var today = function () { return new Date().toISOString().slice(0, 10); };

  // Kategori + tarih + km'ye göre sonraki bakım önerisi
  function suggestNext(cat, date, km) {
    var c = CATS[cat] || {};
    return { next_date: c.ay ? addMonths(date || today(), c.ay) : null, next_km: c.km && km ? Number(km) + c.km : null };
  }

  // Araç sağlığı: tahmini güncel km + takip edilen kalemlerin durumu
  function health(vehicle, records) {
    var recs = (records || []).slice().sort(function (a, b) { return a.service_date < b.service_date ? 1 : -1; });
    var withKm = recs.filter(function (r) { return r.km; });
    var perDay = 40; // veri azsa yıllık ~15.000 km varsay
    if (withKm.length >= 2) {
      var a = withKm[withKm.length - 1], b = withKm[0], d = daysBetween(a.service_date, b.service_date);
      if (d > 30 && b.km > a.km) perDay = (b.km - a.km) / d;
    }
    var lastKm = Math.max(vehicle.last_km || 0, withKm.length ? withKm[0].km : 0) || null;
    var lastKmDate = withKm.length ? withKm[0].service_date : null;
    var estKm = lastKm && lastKmDate ? Math.round(lastKm + perDay * Math.max(0, daysBetween(lastKmDate, today()))) : lastKm;

    var items = [];
    Object.keys(CATS).forEach(function (k) {
      if (!CATS[k].takip) return;
      var last = recs.find(function (r) { return r.category === k; });
      if (!last) { items.push({ cat: k, ad: CATS[k].ad, status: "none" }); return; }
      var daysLeft = last.next_date ? daysBetween(today(), last.next_date) : null;
      var kmLeft = last.next_km && estKm ? last.next_km - estKm : null;
      var status = "ok";
      if ((daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft < 0)) status = "late";
      else if ((daysLeft !== null && daysLeft <= 45) || (kmLeft !== null && kmLeft <= 1500)) status = "soon";
      // ilerleme: son işlemden sonraki bakıma ne kadar yol alındı (0–1)
      var prog = null;
      if (last.next_date) prog = daysBetween(last.service_date, today()) / Math.max(1, daysBetween(last.service_date, last.next_date));
      if (last.next_km && last.km && estKm) prog = Math.max(prog || 0, (estKm - last.km) / Math.max(1, last.next_km - last.km));
      items.push({ cat: k, ad: CATS[k].ad, last: last, daysLeft: daysLeft, kmLeft: kmLeft, status: status, prog: prog === null ? null : Math.min(1, Math.max(0, prog)) });
    });
    var overall = items.some(function (i) { return i.status === "late"; }) ? "late" : items.some(function (i) { return i.status === "soon"; }) ? "soon" : "ok";
    return { records: recs, estKm: estKm, lastKm: lastKm, perDay: perDay, items: items, overall: overall };
  }

  // =====================================================================
  // DEMO modu: tarayıcıda (localStorage) örnek verilerle çalışır
  // =====================================================================
  function demoApi() {
    var KEY = "hsn_demo_v1", SES = "hsn_demo_session";
    var uid = function () { return "d" + Math.random().toString(36).slice(2, 10); };
    var ago = function (m) { return addMonths(today(), -m); };
    function seed() {
      var v1 = { id: "v1", plate: "07ABC123", model: "320d (F30)", year: 2015, engine_code: "N47", owner_name: "Demo Müşteri", owner_phone: "05320000000", customer_id: "c1", last_km: 0 };
      var v2 = { id: "v2", plate: "07XYZ789", model: "520d (G30)", year: 2019, engine_code: "B47", owner_name: "Örnek Sürücü", owner_phone: "05329999999", customer_id: null, last_km: 0 };
      var r = function (vid, m, km, cat, title, items, extra) { var d = ago(m); return Object.assign({ id: uid(), vehicle_id: vid, service_date: d, km: km, category: cat, title: title, items: items, parts: "", amount: null, invoice_no: "A-" + (1000 + Math.floor(Math.random() * 900)), notes: "" }, suggestNext(cat, d, km), extra || {}); };
      var recs = [
        r("v1", 11, 141200, "bakim", "Periyodik bakım", ["Motor yağı değişimi (LL-04 5W-30)", "Yağ, hava ve polen filtresi", "Diyagnostik tarama, servis sıfırlama"]),
        r("v1", 17, 133900, "zincir", "N47 zincir seti değişimi", ["Zincir, gergi ve kızak seti", "Arka krank keçesi", "Motor yağı"], { notes: "Motor indirildi, parçalar fotoğraflı raporlandı." }),
        r("v1", 23, 128400, "fren_hidroligi", "Fren hidroliği değişimi", ["DOT 4 fren hidroliği", "Hava alma"]),
        r("v1", 23, 128400, "bakim", "Periyodik bakım", ["Motor yağı ve filtreler"]),
        r("v1", 30, 119800, "sanziman", "ZF 8HP şanzıman bakımı", ["Karter + filtre", "Şanzıman yağı", "Adaptasyon sıfırlama"]),
        r("v2", 5, 88400, "bakim", "Periyodik bakım", ["Motor yağı ve filtreler", "Diyagnostik"]),
        r("v2", 9, 83000, "klima", "Klima bakımı", ["Gaz dolumu", "Kaçak testi", "Polen filtresi"])
      ];
      return { vehicles: [v1, v2], records: recs, customers: [{ id: "c1", full_name: "Demo Müşteri", email: "demo@musteri.com", phone: "05320000000" }], claims: [], staff: ["usta@hsnotomotiv.com"] };
    }
    var db = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } })();
    var save = function () { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
    save();
    var session = function () { try { return JSON.parse(localStorage.getItem(SES)); } catch (e) { return null; } };
    var me = function () { var s = session(); if (!s) throw new Error("Giriş yapılmamış"); return s; };
    var isStaffEmail = function (e) { return db.staff.indexOf(String(e).toLowerCase()) > -1; };
    var withRecs = function (v) { return Object.assign({}, v, { service_records: db.records.filter(function (r) { return r.vehicle_id === v.id; }) }); };
    var P = function (x) { return new Promise(function (res) { setTimeout(function () { res(x); }, 150); }); };

    return {
      mode: "demo",
      sendCode: function () { return P(true); },
      verifyCode: function (email, code) {
        if (String(code).trim() !== "123456") return Promise.reject(new Error("Kod hatalı. Demo modunda kod: 123456"));
        email = String(email).trim().toLowerCase();
        var c = db.customers.find(function (x) { return x.email === email; });
        localStorage.setItem(SES, JSON.stringify({ id: c ? c.id : "u_" + email, email: email }));
        return P({ email: email });
      },
      currentUser: function () { return P(session()); },
      signOut: function () { localStorage.removeItem(SES); return P(true); },
      isStaff: function () { var s = session(); return P(!!s && isStaffEmail(s.email)); },
      myProfile: function () { var s = me(); return P(db.customers.find(function (c) { return c.id === s.id; }) || null); },
      register: function (f) {
        var s = me(), plate = normPlate(f.plate);
        if (!f.kvkk) return Promise.reject(new Error("KVKK onayı gerekli"));
        var c = db.customers.find(function (x) { return x.id === s.id; });
        if (!c) { c = { id: s.id, email: s.email }; db.customers.push(c); }
        c.full_name = f.full_name; c.phone = f.phone;
        var v = db.vehicles.find(function (x) { return x.plate === plate; });
        var res = "pending";
        if (v && (v.customer_id === s.id || (!v.customer_id && normPhone(v.owner_phone) === normPhone(f.phone)))) { v.customer_id = s.id; res = "linked"; }
        else if (!db.claims.some(function (x) { return x.customer_id === s.id && x.plate === plate && x.status === "pending"; })) db.claims.push({ id: uid(), customer_id: s.id, plate: plate, status: "pending", created_at: new Date().toISOString() });
        save(); return P(res);
      },
      myVehicles: function () { var s = me(); return P(db.vehicles.filter(function (v) { return v.customer_id === s.id; }).map(withRecs)); },
      myClaims: function () { var s = me(); return P(db.claims.filter(function (x) { return x.customer_id === s.id && x.status === "pending"; })); },
      // --- servis (CRM) ---
      listVehicles: function () { return P(db.vehicles.map(withRecs)); },
      saveVehicle: function (v) {
        v = Object.assign({}, v, { plate: normPlate(v.plate) });
        var ex = v.id ? db.vehicles.find(function (x) { return x.id === v.id; }) : db.vehicles.find(function (x) { return x.plate === v.plate; });
        if (ex) Object.assign(ex, v); else { v.id = uid(); db.vehicles.push(v); ex = v; }
        save(); return P(ex);
      },
      addRecord: function (r) {
        r = Object.assign({ id: uid(), items: [] }, r);
        db.records.push(r);
        var v = db.vehicles.find(function (x) { return x.id === r.vehicle_id; });
        if (v && r.km) v.last_km = Math.max(v.last_km || 0, Number(r.km));
        save(); return P(r);
      },
      deleteRecord: function (id) { db.records = db.records.filter(function (r) { return r.id !== id; }); save(); return P(true); },
      listClaims: function () { return P(db.claims.filter(function (x) { return x.status === "pending"; }).map(function (x) { return Object.assign({}, x, { customers: db.customers.find(function (c) { return c.id === x.customer_id; }) }); })); },
      approveClaim: function (id, model) {
        var cl = db.claims.find(function (x) { return x.id === id; }), c = db.customers.find(function (x) { return x.id === cl.customer_id; });
        var v = db.vehicles.find(function (x) { return x.plate === cl.plate; });
        if (!v) { v = { id: uid(), plate: cl.plate, model: model || null, owner_name: c.full_name, owner_phone: c.phone }; db.vehicles.push(v); }
        v.customer_id = c.id; cl.status = "approved"; save(); return P(v.id);
      },
      rejectClaim: function (id) { var cl = db.claims.find(function (x) { return x.id === id; }); cl.status = "rejected"; save(); return P(true); },
      listCustomers: function () { return P(db.customers.slice()); },
      resetDemo: function () { db = seed(); save(); localStorage.removeItem(SES); return P(true); }
    };
  }

  // =====================================================================
  // CANLI mod: Supabase
  // =====================================================================
  function liveApi() {
    var ready = new Promise(function (res, rej) {
      if (window.supabase) return res();
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = res; s.onerror = function () { rej(new Error("Supabase yüklenemedi")); };
      document.head.appendChild(s);
    }).then(function () { return window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey); });
    var q = function (fn) { return ready.then(fn).then(function (r) { if (r && r.error) throw new Error(r.error.message); return r ? r.data : r; }); };
    var uid = function (sb) { return sb.auth.getUser().then(function (r) { if (!r.data.user) throw new Error("Giriş yapılmamış"); return r.data.user; }); };

    return {
      mode: "live",
      sendCode: function (email) { return q(function (sb) { var back = /^https?:/.test(location.protocol) ? location.origin + location.pathname : undefined; return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: back } }); }); },
      verifyCode: function (email, code) { return q(function (sb) { return sb.auth.verifyOtp({ email: email, token: String(code).trim(), type: "email" }); }); },
      currentUser: function () { return ready.then(function (sb) { return sb.auth.getSession(); }).then(function (r) { var u = r.data.session && r.data.session.user; return u ? { id: u.id, email: u.email } : null; }); },
      signOut: function () { return q(function (sb) { return sb.auth.signOut(); }); },
      isStaff: function () { return q(function (sb) { return sb.rpc("is_staff"); }).then(Boolean); },
      myProfile: function () { return ready.then(function (sb) { return uid(sb).then(function (u) { return sb.from("customers").select("*").eq("id", u.id).maybeSingle(); }); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; }); },
      register: function (f) { return q(function (sb) { return sb.rpc("register_customer", { p_full_name: f.full_name, p_phone: f.phone, p_plate: f.plate, p_kvkk: !!f.kvkk }); }); },
      myVehicles: function () { return ready.then(function (sb) { return uid(sb).then(function (u) { return sb.from("vehicles").select("*, service_records(*)").eq("customer_id", u.id); }); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; }); },
      myClaims: function () { return q(function (sb) { return sb.from("claim_requests").select("*").eq("status", "pending"); }); },
      listVehicles: function () { return q(function (sb) { return sb.from("vehicles").select("*, service_records(*)").order("updated_at", { ascending: false }); }); },
      saveVehicle: function (v) { v = Object.assign({}, v, { plate: normPlate(v.plate), updated_at: new Date().toISOString() }); delete v.service_records; return q(function (sb) { return sb.from("vehicles").upsert(v, { onConflict: "plate" }).select().single(); }); },
      addRecord: function (r) { return q(function (sb) { return sb.from("service_records").insert(r).select().single(); }); },
      deleteRecord: function (id) { return q(function (sb) { return sb.from("service_records").delete().eq("id", id); }); },
      listClaims: function () { return q(function (sb) { return sb.from("claim_requests").select("*, customers(full_name, phone, email)").eq("status", "pending").order("created_at"); }); },
      approveClaim: function (id, model) { return q(function (sb) { return sb.rpc("approve_claim", { p_claim: id, p_model: model || null }); }); },
      rejectClaim: function (id) { return q(function (sb) { return sb.from("claim_requests").update({ status: "rejected" }).eq("id", id); }); },
      listCustomers: function () { return q(function (sb) { return sb.from("customers").select("*").order("created_at", { ascending: false }); }); }
    };
  }

  window.HSN = {
    api: LIVE ? liveApi() : demoApi(),
    CATS: CATS, normPlate: normPlate, normPhone: normPhone, fmtPlate: fmtPlate,
    suggestNext: suggestNext, health: health, today: today,
    fmtDate: function (iso) { return iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "—"; },
    fmtKm: function (n) { return n || n === 0 ? Number(n).toLocaleString("tr-TR") + " km" : "—"; },
    esc: function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  };
})();
