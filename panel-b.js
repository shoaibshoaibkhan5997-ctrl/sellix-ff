/* ---- settings ---- */
function fillPick(){
  var sel = $("setPick"); sel.innerHTML = "";
  sel.appendChild(h("option", {value: "", text: "➕ Naya tournament"}));
  tournaments.forEach(function(t){ sel.appendChild(h("option", {value: t.id, text: t.name})); });
  sel.value = settingsTid || "";
}
function loadSettingsForm(tid){
  settingsTid = tid || null;
  fillPick();
  var t = tournaments.find(function(x){ return x.id === settingsTid; });
  if(settingsTid && !t){ settingsTid = null; }
  $("setTitle").textContent = t ? "Tournament Settings: " + t.name : "Naya Tournament";
  $("sName").value = t ? t.name : ""; $("sPrizeIn").value = t ? t.prizePool : ""; $("sEntry").value = t ? (t.entryFee || 0) : 0; $("sMax").value = t ? t.maxPlayers : 50;
  $("sDate").value = t ? (t.tournamentDate || "") : ""; $("sStatus").value = t ? t.status : "upcoming";
  $("sReg").value = t && (t.registrationClosedManually || !t.registrationOpen) ? "closed" : "open";
  $("sDelete").classList.toggle("hidden", !t);
  showMsg("sMsg", "", "");
}
$("setPick").onchange = function(){ loadSettingsForm(this.value || null); };
$("sSave").onclick = async function(){
  var name = $("sName").value.trim(), prize = Number($("sPrizeIn").value), max = parseInt($("sMax").value, 10), date = $("sDate").value;
  if(!name){ showMsg("sMsg", "Tournament ka naam daalo.", "err"); return; }
  if($("sPrizeIn").value === "" || !(prize >= 0)){ showMsg("sMsg", "Prize pool daalo.", "err"); return; }
  var entry = $("sEntry").value === "" ? 0 : Number($("sEntry").value);
  if(!(entry >= 0)){ showMsg("sMsg", "Entry fee 0 ya usse zyada honi chahiye.", "err"); return; }
  if(!(max >= 1)){ showMsg("sMsg", "Maximum players kam se kam 1 hona chahiye.", "err"); return; }
  if(!date){ showMsg("sMsg", "Tournament ki date chuno.", "err"); return; }
  var closed = $("sReg").value === "closed";
  var data = {name: name, prizePool: prize, entryFee: entry, maxPlayers: max, tournamentDate: date, status: $("sStatus").value,
    registrationOpen: !closed, registrationClosedManually: closed};
  $("sSave").disabled = true;
  try{
    if(settingsTid){
      await db.collection("tournaments").doc(settingsTid).update(data);
      toast("Settings save ho gayi");
    }else{
      data.playerCount = 0; data.createdAt = TS();
      var ref = await db.collection("tournaments").add(data);
      settingsTid = ref.id; selectedTid = ref.id;
      toast("Tournament ban gaya");
    }
    showMsg("sMsg", "", "");
  }catch(e){ showMsg("sMsg", friendlyError(e), "err"); }
  $("sSave").disabled = false;
};
$("sDelete").onclick = async function(){
  var t = tournaments.find(function(x){ return x.id === settingsTid; }); if(!t) return;
  if(!confirm("\"" + t.name + "\" aur uske saare registrations hamesha ke liye delete honge. Pakka?")) return;
  $("sDelete").disabled = true;
  try{
    var snap = await db.collection("registrations").where("tournamentId", "==", t.id).get();
    var docs = snap.docs;
    for(var i = 0; i < docs.length; i += 400){
      var b = db.batch(); docs.slice(i, i + 400).forEach(function(d){ b.delete(d.ref); }); await b.commit();
    }
    await db.collection("tournaments").doc(t.id).delete();
    settingsTid = null; toast("Tournament delete ho gaya"); go("tournaments");
  }catch(e){ showMsg("sMsg", friendlyError(e), "err"); }
  $("sDelete").disabled = false;
};

/* ---- export csv ---- */
function renderExport(){
  var sel = $("eTour"); var prev = sel.value; fillSelect(sel, false);
  if(prev && Array.prototype.some.call(sel.options, function(o){ return o.value === prev; })) sel.value = prev;
  else if(selectedTid) sel.value = selectedTid;
  var n = regs.filter(function(r){ return r.tournamentId === sel.value; }).length;
  $("eInfo").textContent = sel.value ? n + " registrations export honge." : "Pehle tournament banao.";
  $("eBtn").disabled = !sel.value || !n;
}
$("eTour").onchange = function(){ selectedTid = this.value; renderExport(); };
function csvCell(v){
  var s = String(v == null ? "" : v);
  if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;           // spreadsheet formula injection guard
  return '"' + s.replace(/"/g, '""') + '"';
}
$("eBtn").onclick = function(){
  var tid = $("eTour").value, t = tournaments.find(function(x){ return x.id === tid; });
  var rows = regs.filter(function(r){ return r.tournamentId === tid; }).sort(function(a, b){ return millis(a.createdAt) - millis(b.createdAt); });
  if(!rows.length){ toast("Export ke liye koi registration nahi.", true); return; }
  var out = [["Full Name", "Free Fire UID", "In-Game Name", "Mobile", "Email", "Tournament", "Registered At"]];
  rows.forEach(function(r){ out.push([r.fullName, r.uid, r.inGameName, r.mobile, r.email, t ? t.name : "", r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString() : ""]); });
  var csv = "\uFEFF" + out.map(function(r){ return r.map(csvCell).join(","); }).join("\r\n");
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
  a.download = ((t ? t.name : "registrations").replace(/[^\w\-]+/g, "_")) + "_registrations.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  toast("CSV download ho rahi hai");
};

/* ---- image helper ---- */
function compressImage(file, maxSide, quality){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onerror = function(){ reject(new Error("Photo padh nahi paye.")); };
    reader.onload = function(){
      var img = new Image();
      img.onerror = function(){ reject(new Error("Ye photo khul nahi rahi.")); };
      img.onload = function(){
        var s = Math.min(1, maxSide / Math.max(img.width, img.height));
        var c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function renderThumbs(el, list){ el.innerHTML = ""; list.forEach(function(s){ el.appendChild(h("img", {src: s, alt: ""})); }); }

/* ---- items (existing feature) ---- */
var editingId = null, editingPhotos = [], newPhotos = [], proofPhoto = "";
$("iPhotos").onchange = async function(e){
  var files = Array.from(e.target.files).slice(0, 3);
  if(e.target.files.length > 3) toast("Sirf pehli 3 photos li gayi.", true);
  try{
    newPhotos = [];
    for(var i = 0; i < files.length; i++) newPhotos.push(await compressImage(files[i], 700, 0.6));
    renderThumbs($("iThumbs"), newPhotos);
  }catch(err){ showMsg("itemMsg", err.message, "err"); }
};
function resetItemForm(){
  editingId = null; editingPhotos = []; newPhotos = [];
  $("iTitle").value = ""; $("iPrice").value = ""; $("iDesc").value = ""; $("iPhotos").value = ""; $("iSold").checked = false;
  $("iThumbs").innerHTML = ""; $("itemFormTitle").textContent = "Naya item add karo"; $("itemSaveBtn").textContent = "Item save karo";
  $("itemCancelBtn").classList.add("hidden"); showMsg("itemMsg", "", "");
}
$("itemCancelBtn").onclick = resetItemForm;
$("itemSaveBtn").onclick = async function(){
  var title = $("iTitle").value.trim(), price = Number($("iPrice").value);
  if(!title){ showMsg("itemMsg", "Item ka naam daalo.", "err"); return; }
  if($("iPrice").value === "" || !(price >= 0)){ showMsg("itemMsg", "Price daalo.", "err"); return; }
  var photos = newPhotos.length ? newPhotos : editingPhotos;
  if(photos.reduce(function(n, s){ return n + s.length; }, 0) > 850000){ showMsg("itemMsg", "Photos bahut badi hain. Kam ya chhoti photos chuno.", "err"); return; }
  var data = {title: title, price: price, desc: $("iDesc").value.trim(), photos: photos, sold: $("iSold").checked};
  $("itemSaveBtn").disabled = true;
  try{
    if(editingId){ await db.collection("items").doc(editingId).update(data); toast("Item update ho gaya"); }
    else{ data.createdAt = TS(); await db.collection("items").add(data); toast("Item add ho gaya"); }
    resetItemForm();
  }catch(e){ showMsg("itemMsg", friendlyError(e), "err"); }
  $("itemSaveBtn").disabled = false;
};
function renderItems(){
  var box = $("itemList"); box.innerHTML = "";
  if(!itemsSnap || itemsSnap.empty){ box.appendChild(h("div", {"class": "empty", text: "Abhi koi item nahi hai."})); return; }
  itemsSnap.forEach(function(doc){
    var it = doc.data();
    var badge = h("span", {text: it.sold ? "Sold" : "Available", "class": "pill " + (it.sold ? "closed" : "open"), style: "margin-left:6px;font-size:12px"});
    box.appendChild(h("div", {"class": "item"},
      h("img", {alt: "", src: (it.photos && it.photos[0]) || "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="}),
      h("div", {"class": "info"},
        h("div", {"class": "t"}, it.title || "(naam nahi)", badge),
        h("div", {"class": "m", text: inr(it.price) + (it.desc ? " · " + it.desc : "")}),
        h("div", {"class": "acts2"},
          h("button", {"class": "sm ghost", text: it.sold ? "Available karo" : "Sold mark karo", onclick: async function(){
            try{ await db.collection("items").doc(doc.id).update({sold: !it.sold}); toast("Update ho gaya"); }catch(e){ toast(friendlyError(e), true); } }}),
          h("button", {"class": "sm ghost", text: "Edit", onclick: function(){
            editingId = doc.id; editingPhotos = it.photos || []; newPhotos = [];
            $("iTitle").value = it.title || ""; $("iPrice").value = it.price == null ? "" : it.price; $("iDesc").value = it.desc || "";
            $("iSold").checked = !!it.sold; $("iPhotos").value = ""; renderThumbs($("iThumbs"), editingPhotos);
            $("itemFormTitle").textContent = "Item edit karo"; $("itemSaveBtn").textContent = "Changes save karo";
            $("itemCancelBtn").classList.remove("hidden"); showMsg("itemMsg", "Nayi photos na chuno to purani photos rahengi.", "ok");
            window.scrollTo({top: 0, behavior: "smooth"}); }}),
          h("button", {"class": "sm danger", text: "Delete", onclick: async function(){
            if(!confirm("Ye item hamesha ke liye delete ho jayega. Pakka?")) return;
            try{ await db.collection("items").doc(doc.id).delete(); toast("Delete ho gaya"); }catch(e){ toast(friendlyError(e), true); } }})
        )
      )
    ));
  });
}

/* ---- proofs (existing feature) ---- */
$("pPhoto").onchange = async function(e){
  var f = e.target.files[0]; proofPhoto = "";
  if(!f){ $("pThumbs").innerHTML = ""; return; }
  try{ proofPhoto = await compressImage(f, 700, 0.6); renderThumbs($("pThumbs"), [proofPhoto]); }
  catch(err){ showMsg("proofMsg", err.message, "err"); }
};
$("proofSaveBtn").onclick = async function(){
  var name = $("pName").value.trim(), text = $("pText").value.trim();
  if(!name && !text && !proofPhoto){ showMsg("proofMsg", "Naam, review ya screenshot mein se kuch to daalo.", "err"); return; }
  $("proofSaveBtn").disabled = true;
  try{
    await db.collection("proofs").add({name: name, text: text, photo: proofPhoto, createdAt: TS()});
    $("pName").value = ""; $("pText").value = ""; $("pPhoto").value = ""; $("pThumbs").innerHTML = ""; proofPhoto = "";
    showMsg("proofMsg", "", ""); toast("Proof add ho gaya");
  }catch(e){ showMsg("proofMsg", friendlyError(e), "err"); }
  $("proofSaveBtn").disabled = false;
};
function renderProofs(){
  var box = $("proofList"); box.innerHTML = "";
  if(!proofsSnap || proofsSnap.empty){ box.appendChild(h("div", {"class": "empty", text: "Abhi koi proof nahi hai."})); return; }
  proofsSnap.forEach(function(doc){
    var p = doc.data();
    var img = h("img", {alt: "", src: p.photo || "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="});
    if(!p.photo) img.style.visibility = "hidden";
    box.appendChild(h("div", {"class": "item"}, img,
      h("div", {"class": "info"},
        h("div", {"class": "t", text: p.name || "(naam nahi)"}), h("div", {"class": "m", text: p.text || ""}),
        h("div", {"class": "acts2"}, h("button", {"class": "sm danger", text: "Delete", onclick: async function(){
          if(!confirm("Ye proof delete karna hai?")) return;
          try{ await db.collection("proofs").doc(doc.id).delete(); toast("Delete ho gaya"); }catch(e){ toast(friendlyError(e), true); } }}))
      )
    ));
  });
}

/* ---- start: auth state (runs after all code is loaded) ---- */
auth.onAuthStateChanged(function(user){
  if(user){
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    listen();
  }else{
    $("appView").classList.add("hidden");
    $("loginView").classList.remove("hidden");
    unlisten();
  }
});
