var firebaseConfig = {
  apiKey: "AIzaSyB8uGrxTOTE2KixYo9pIR7sJ5Adx1Vfo88",
  authDomain: "sellix-ff.firebaseapp.com",
  projectId: "sellix-ff",
  storageBucket: "sellix-ff.firebasestorage.app",
  messagingSenderId: "469342363035",
  appId: "1:469342363035:web:97e2c80ed3a3e107be953e"
};
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();
var TS = firebase.firestore.FieldValue.serverTimestamp;

function $(id){ return document.getElementById(id); }
function h(tag, attrs){
  var el = document.createElement(tag);
  if(attrs) Object.keys(attrs).forEach(function(k){
    if(k === "class") el.className = attrs[k];
    else if(k === "text") el.textContent = attrs[k];
    else if(k.indexOf("on") === 0) el[k] = attrs[k];
    else el.setAttribute(k, attrs[k]);
  });
  for(var i = 2; i < arguments.length; i++){
    var c = arguments[i];
    if(c == null) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}
function toast(t, err){
  var e = $("toast"); e.textContent = t; e.className = err ? "err" : ""; e.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(function(){ e.style.display = "none"; }, 2800);
}
function showMsg(id, text, kind){
  var el = $(id); el.innerHTML = "";
  if(text) el.appendChild(h("div", {"class": "msg " + kind, text: text}));
}
function friendlyError(e){
  var c = (e && e.code) || "", m = (e && e.message) || "";
  if(/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "Email ya password galat hai.";
  if(/invalid-email/.test(c)) return "Email ka format galat hai.";
  if(/too-many-requests/.test(c)) return "Bahut zyada koshish. Thodi der baad try karo.";
  if(/network/.test(c)) return "Internet check karo.";
  if(/permission-denied/.test(c)) return "Permission nahi mili. Firestore Rules check karo (naye rules publish hue?).";
  return m || "Kuch galat ho gaya.";
}
function inr(n){ return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function fmtDate(s){
  if(!s) return "-";
  var p = String(s).split("-");
  if(p.length !== 3) return s;
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-IN", {day: "numeric", month: "long", year: "numeric"});
}
function fmtTs(ts){
  if(!ts || !ts.toDate) return "-";
  return ts.toDate().toLocaleString("en-IN", {day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"});
}
function millis(x){ return x && x.toMillis ? x.toMillis() : 0; }

/* ---- shared tournament logic ---- */
function regState(t){
  var n = t.playerCount || 0, max = t.maxPlayers || 0;
  if(n >= max) return {open: false, label: "🔴 Registration Closed (Full)"};
  if(t.registrationClosedManually || !t.registrationOpen) return {open: false, label: "🔴 Registration Closed"};
  if(t.status !== "upcoming" && t.status !== "live") return {open: false, label: "🔴 Registration Closed"};
  return {open: true, label: "🟢 Registration Open"};
}
function feeText(t){ return Number(t.entryFee) > 0 ? inr(t.entryFee) : "Free"; }
function pickCurrent(list){
  var live = list.filter(function(t){ return t.status === "live"; }).sort(function(a, b){ return millis(b.createdAt) - millis(a.createdAt); });
  if(live.length) return live[0];
  var up = list.filter(function(t){ return t.status === "upcoming"; }).sort(function(a, b){ return String(a.tournamentDate || "9999").localeCompare(String(b.tournamentDate || "9999")); });
  if(up.length) return up[0];
  return list.slice().sort(function(a, b){ return millis(b.createdAt) - millis(a.createdAt); })[0] || null;
}
function statusPill(t){
  var cls = t.status === "live" ? "live" : (t.status === "upcoming" ? "open" : "other");
  var txt = {upcoming: "Upcoming", live: "🟢 Live", completed: "Completed", cancelled: "Cancelled"}[t.status] || t.status;
  return h("span", {"class": "pill " + cls, text: txt});
}

/* ---- state ---- */
var tournaments = [], regs = [], itemsSnap = null, proofsSnap = null;
var selectedTid = null;     // registrations/export selection
var settingsTid = null;     // null = new
var unsubs = [];
var currentView = "dashboard";

/* ---- auth ---- */
$("loginBtn").onclick = async function(){
  var em = $("email").value.trim(), pw = $("password").value;
  if(!em || !pw){ showMsg("loginMsg", "Email aur password dono daalo.", "err"); return; }
  $("loginBtn").disabled = true; showMsg("loginMsg", "", "");
  try{ await auth.signInWithEmailAndPassword(em, pw); }
  catch(e){ showMsg("loginMsg", friendlyError(e), "err"); }
  $("loginBtn").disabled = false;
};
$("password").addEventListener("keydown", function(e){ if(e.key === "Enter") $("loginBtn").click(); });
$("logoutBtn").onclick = function(){ auth.signOut(); };

/* ---- navigation ---- */
function go(v){
  currentView = v;
  document.querySelectorAll("main > section").forEach(function(s){ s.classList.add("hidden"); });
  $("v-" + v).classList.remove("hidden");
  document.querySelectorAll(".nav[data-v]").forEach(function(b){ b.classList.toggle("on", b.dataset.v === v); });
  document.body.classList.remove("open");
  if(v === "settings") loadSettingsForm(settingsTid);
  if(v === "registrations") $("rTour").dataset.force = selectedTid || "all";
  renderAll();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".nav[data-v]").forEach(function(b){ b.onclick = function(){ go(b.dataset.v); }; });
$("burger").onclick = function(){ document.body.classList.toggle("open"); };
$("overlay").onclick = function(){ document.body.classList.remove("open"); };

/* ---- listeners ---- */
function listen(){
  unlisten();
  unsubs.push(db.collection("tournaments").onSnapshot(function(s){
    tournaments = s.docs.map(function(d){ var o = d.data(); o.id = d.id; return o; })
      .sort(function(a, b){ return millis(b.createdAt) - millis(a.createdAt); });
    if(!selectedTid || !tournaments.some(function(t){ return t.id === selectedTid; })){
      var c = pickCurrent(tournaments); selectedTid = c ? c.id : null;
    }
    renderAll();
  }, function(e){ toast(friendlyError(e), true); }));
  unsubs.push(db.collection("registrations").onSnapshot(function(s){
    regs = s.docs.map(function(d){ var o = d.data(); o.id = d.id; return o; });
    renderAll();
  }, function(e){ toast(friendlyError(e), true); }));
  unsubs.push(db.collection("items").orderBy("createdAt", "desc").onSnapshot(function(s){ itemsSnap = s; renderItems(); },
    function(e){ $("itemList").textContent = friendlyError(e); }));
  unsubs.push(db.collection("proofs").orderBy("createdAt", "desc").onSnapshot(function(s){ proofsSnap = s; renderProofs(); },
    function(e){ $("proofList").textContent = friendlyError(e); }));
}
function unlisten(){ unsubs.forEach(function(u){ u(); }); unsubs = []; }

function tName(id){ var t = tournaments.find(function(x){ return x.id === id; }); return t ? t.name : "(deleted)"; }

function renderAll(){
  renderDashboard();
  if(currentView === "tournaments") renderTournaments();
  if(currentView === "registrations") renderRegs();
  if(currentView === "export") renderExport();
  if(currentView === "settings") fillPick();
}

/* ---- dashboard ---- */
function renderDashboard(){
  $("sTournaments").textContent = tournaments.length;
  $("sPlayers").textContent = regs.length;
  var live = tournaments.filter(function(t){ return t.status === "live"; });
  $("sLive").textContent = live.length ? live.map(function(t){ return t.name; }).join(", ") : "Koi nahi";
  var cur = pickCurrent(tournaments);
  $("sPrize").textContent = cur ? inr(cur.prizePool) : "-";
  var box = $("currentCard"); box.innerHTML = "";
  if(!cur){
    box.appendChild(h("div", {"class": "empty", text: "Abhi koi tournament nahi hai. Tournaments tab se naya banao."}));
    return;
  }
  var n = cur.playerCount || 0, max = cur.maxPlayers || 0, st = regState(cur);
  var pct = max ? Math.min(100, Math.round(n / max * 100)) : 0;
  var fill = h("i"); fill.style.width = pct + "%"; if(n >= max) fill.className = "full";
  box.append(
    h("div", {"class": "row", style: "justify-content:space-between"}, h("h3", {text: "Current Tournament"}), statusPill(cur)),
    h("div", {style: "font-size:22px;font-weight:700;margin-top:6px", text: cur.name}),
    h("div", {style: "margin-top:4px", text: n + " / " + max + " Players" + (n >= max ? " Registered" : "")}),
    h("div", {"class": "bar"}, fill),
    h("div", {"class": "kv"},
      h("div", null, h("span", {text: "Match Type"}), cur.matchType || "Solo"),
      h("div", null, h("span", {text: "Prize Pool"}), inr(cur.prizePool)),
      h("div", null, h("span", {text: "Entry Fee"}), feeText(cur)),
      h("div", null, h("span", {text: "Tournament Date"}), fmtDate(cur.tournamentDate)),
      h("div", null, h("span", {text: "Registration"}), h("b", {text: st.label}))
    ),
    h("div", {"class": "row", style: "margin-top:14px"},
      h("button", {text: "Registrations dekho", onclick: function(){ selectedTid = cur.id; go("registrations"); }}),
      h("button", {"class": "ghost", text: "Settings", onclick: function(){ settingsTid = cur.id; go("settings"); }})
    )
  );
}

/* ---- tournaments list ---- */
function renderTournaments(){
  var box = $("tList"); box.innerHTML = "";
  if(!tournaments.length){ box.appendChild(h("div", {"class": "empty", text: "Koi tournament nahi. \"+ Naya Tournament\" dabao."})); return; }
  tournaments.forEach(function(t){
    var n = t.playerCount || 0, max = t.maxPlayers || 0, st = regState(t);
    var fill = h("i"); fill.style.width = (max ? Math.min(100, Math.round(n / max * 100)) : 0) + "%"; if(n >= max) fill.className = "full";
    box.appendChild(h("div", {"class": "panel", style: "margin:0"},
      h("div", {"class": "row", style: "justify-content:space-between"}, h("h3", {text: t.name}), statusPill(t)),
      h("div", {style: "color:var(--muted);font-size:14px;margin-top:4px", text: fmtDate(t.tournamentDate) + " · Prize " + inr(t.prizePool) + " · Entry " + feeText(t)}),
      h("div", {style: "font-size:14px;margin-top:4px", text: "Match Type: " + (t.matchType || "Solo")}),
      h("div", {style: "margin-top:8px", text: n + " / " + max + " Players"}),
      h("div", {"class": "bar"}, fill),
      h("div", {style: "font-size:14px", text: st.label}),
      h("div", {"class": "acts2"},
        h("button", {"class": "sm", text: "Registrations", onclick: function(){ selectedTid = t.id; go("registrations"); }}),
        h("button", {"class": "sm ghost", text: "Edit", onclick: function(){ settingsTid = t.id; go("settings"); }})
      )
    ));
  });
}
$("newTBtn").onclick = function(){ settingsTid = null; go("settings"); };

/* ---- tournament select helper ---- */
function fillSelect(sel, withAll){
  var val = sel.value || selectedTid;
  sel.innerHTML = "";
  if(withAll) sel.appendChild(h("option", {value: "all", text: "Saare tournaments"}));
  tournaments.forEach(function(t){ sel.appendChild(h("option", {value: t.id, text: t.name + " (" + (t.playerCount || 0) + "/" + (t.maxPlayers || 0) + ")"})); });
  var ok = Array.prototype.some.call(sel.options, function(o){ return o.value === val; });
  sel.value = ok ? val : (withAll ? "all" : (tournaments[0] ? tournaments[0].id : ""));
}

/* ---- registrations ---- */
function renderRegs(){
  var sel = $("rTour");
  var prev = sel.value;
  fillSelect(sel, true);
  var want = sel.dataset.force || prev || selectedTid || "all";
  delete sel.dataset.force;
  sel.value = Array.prototype.some.call(sel.options, function(o){ return o.value === want; }) ? want : "all";
  var tid = sel.value, q = $("rSearch").value.trim().toLowerCase();
  var list = regs.filter(function(r){ return tid === "all" || r.tournamentId === tid; });
  var total = list.length;
  if(q) list = list.filter(function(r){
    return [r.fullName, r.uid, r.mobile, r.inGameName].some(function(x){ return String(x || "").toLowerCase().indexOf(q) > -1; });
  });
  list.sort(function(a, b){ return millis(b.createdAt) - millis(a.createdAt); });
  var t = tournaments.find(function(x){ return x.id === tid; });
  $("rCount").textContent = (t ? t.name + ": " + (t.playerCount || 0) + " / " + t.maxPlayers + " players. " : "") + "Dikh rahe: " + list.length + " / " + total;
  $("rAdd").disabled = tid === "all";
  var body = $("rBody"); body.innerHTML = "";
  if(!list.length){
    body.appendChild(h("tr", null, h("td", {colspan: "8", style: "text-align:center;color:var(--muted);padding:22px", text: "Koi registration nahi mila."})));
    return;
  }
  list.forEach(function(r){
    body.appendChild(h("tr", null,
      h("td", {text: r.fullName || ""}), h("td", {text: r.uid || ""}), h("td", {text: r.inGameName || ""}),
      h("td", {text: r.mobile || ""}), h("td", {text: r.email || "-"}), h("td", {text: tName(r.tournamentId)}),
      h("td", {text: fmtTs(r.createdAt)}),
      h("td", {"class": "acts"},
        h("button", {"class": "sm ghost", text: "Edit", onclick: function(){ openRegModal(r); }}),
        h("button", {"class": "sm danger", text: "Delete", onclick: function(){ deleteReg(r); }})
      )
    ));
  });
}
$("rTour").onchange = function(){ selectedTid = this.value === "all" ? selectedTid : this.value; renderRegs(); };
$("rSearch").oninput = renderRegs;
$("rAdd").onclick = function(){ openRegModal(null); };

function closeModal(){ $("modal").classList.remove("on"); }
$("modal").onclick = function(e){ if(e.target === $("modal")) closeModal(); };

function openRegModal(r){
  var isNew = !r;
  var tid = isNew ? $("rTour").value : r.tournamentId;
  var f = {};
  function field(label, key, type, val){
    f[key] = h("input", {type: type || "text", value: val || ""});
    if(key === "mobile" || key === "uid") f[key].setAttribute("inputmode", "numeric");
    return [h("label", {text: label}), f[key]];
  }
  var msg = h("div");
  var save = h("button", {text: isNew ? "Player add karo" : "Save karo"});
  var box = $("modalBox"); box.innerHTML = "";
  box.append(h("h3", {text: isNew ? "Player add karo" : "Player edit karo", style: "margin-bottom:6px"}));
  [].concat(
    field("Full Name", "fullName", "text", r && r.fullName),
    field("Free Fire UID", "uid", "text", r && r.uid),
    field("In-Game Name", "inGameName", "text", r && r.inGameName),
    field("Mobile (10 digit)", "mobile", "tel", r && r.mobile),
    field("Email", "email", "email", r && r.email)
  ).forEach(function(n){ box.appendChild(n); });
  box.append(msg, h("div", {"class": "row", style: "margin-top:16px"}, save, h("button", {"class": "ghost", text: "Cancel", onclick: closeModal})));

  save.onclick = async function(){
    var d = {
      fullName: f.fullName.value.trim(), uid: f.uid.value.replace(/\D/g, ""),
      inGameName: f.inGameName.value.trim(), mobile: f.mobile.value.replace(/\D/g, ""), email: f.email.value.trim()
    };
    var bad = null;
    if(d.fullName.length < 2) bad = "Naam daalo.";
    else if(d.uid.length < 6 || d.uid.length > 14) bad = "Free Fire UID sahi daalo (6-14 digit).";
    else if(!d.inGameName) bad = "In-game name daalo.";
    else if(d.mobile.length !== 10) bad = "Mobile 10 digit ka hona chahiye.";
    if(bad){ showErr(msg, bad); return; }
    save.disabled = true;
    try{
      if(isNew) await adminAddPlayer(tid, d);
      else await db.collection("registrations").doc(r.id).update(d);
      closeModal(); toast(isNew ? "Player add ho gaya" : "Update ho gaya");
    }catch(e){
      showErr(msg, e.message === "DUP" ? "Ye UID is tournament mein pehle se registered hai." : friendlyError(e));
    }
    save.disabled = false;
  };
  $("modal").classList.add("on");
}
function showErr(el, text){ el.innerHTML = ""; el.appendChild(h("div", {"class": "msg err", text: text})); }

async function adminAddPlayer(tid, d){
  var tRef = db.collection("tournaments").doc(tid), rRef = db.collection("registrations").doc(tid + "_" + d.uid);
  await db.runTransaction(async function(tx){
    var t = await tx.get(tRef); if(!t.exists) throw new Error("Tournament nahi mila.");
    var td = t.data();
    if((td.playerCount || 0) >= td.maxPlayers) throw new Error("Tournament full hai. Pehle Maximum Players badhao.");
    var ex = await tx.get(rRef); if(ex.exists) throw new Error("DUP");
    tx.set(rRef, {fullName: d.fullName, uid: d.uid, inGameName: d.inGameName, mobile: d.mobile, email: d.email, tournamentId: tid, createdAt: TS()});
    tx.update(tRef, {playerCount: (td.playerCount || 0) + 1, lastRegId: d.uid});
  });
}
async function deleteReg(r){
  if(!confirm("\"" + r.fullName + "\" ko delete karna hai? Ye wapas nahi hoga.")) return;
  var tRef = db.collection("tournaments").doc(r.tournamentId), rRef = db.collection("registrations").doc(r.id);
  try{
    await db.runTransaction(async function(tx){
      var t = await tx.get(tRef);
      tx.delete(rRef);
      if(t.exists) tx.update(tRef, {playerCount: Math.max(0, (t.data().playerCount || 0) - 1)});
    });
    toast("Delete ho gaya");
  }catch(e){ toast(friendlyError(e), true); }
}
