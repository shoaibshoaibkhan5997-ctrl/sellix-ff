var NUM = "917081573944";

var items = [];
function wa(m){ return "https://wa.me/" + NUM + "?text=" + encodeURIComponent(m); }
function esc(x){ return String(x).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function $(id){ return document.getElementById(id); }

function openSite(){ $("main").style.display = "block"; $("hr").style.display = "flex"; }

function draw(f){
  var L = items.filter(function(i){ return f === "all" || i.type === f; });
  var h = "";
  if(!L.length) h = '<div class="empty">Abhi koi item list nahi hai. Jaldi naye items aayenge!</div>';
  L.forEach(function(i){
    var im = (i.imgs || []).map(function(u){ return '<img src="images/' + esc(u) + '" alt="">'; }).join("");
    h += '<div class="card"><div class="imgs">' + im + '</div><h3>' + esc(i.title) + '</h3><p>' + esc(i.desc || "") + '</p><div class="price">Rs ' + esc(i.price) + '</div><a class="btn" href="' + wa("Mujhe ye chahiye: " + i.title + " (Rs " + i.price + ")") + '">Buy karo</a></div>';
  });
  $("list").innerHTML = h;
}

fetch("items.json").then(function(r){ return r.json(); }).then(function(j){ items = j; draw("all"); }).catch(function(){ draw("all"); });

document.querySelectorAll("#main .tab").forEach(function(b){
  b.onclick = function(){
    document.querySelectorAll("#main .tab").forEach(function(x){ x.classList.remove("on"); });
    b.classList.add("on"); draw(b.dataset.f);
  };
});

/* ---------- Accounts (is phone ke browser me save hote hain) ---------- */
function getAcc(){ try{ return JSON.parse(localStorage.getItem("acc") || "{}"); }catch(e){ return {}; } }
function setAcc(a){ try{ localStorage.setItem("acc", JSON.stringify(a)); }catch(e){} }

async function sha(s){
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(function(x){ return x.toString(16).padStart(2, "0"); }).join("");
}

function showMode(m){
  $("lf").style.display = (m === "l") ? "grid" : "none";
  $("suf").style.display = (m === "s") ? "grid" : "none";
  $("tl").classList.toggle("on", m === "l");
  $("ts").classList.toggle("on", m === "s");
}
$("tl").onclick = function(){ showMode("l"); };
$("ts").onclick = function(){ showMode("s"); };

function enter(phone, name){
  try{ localStorage.setItem("cur", phone); }catch(e){}
  $("auth").style.display = "none";
  $("bar").style.display = "flex";
  $("wel").textContent = "Welcome, " + name + "!";
  openSite();
}

$("lo").onclick = function(){
  try{ localStorage.removeItem("cur"); }catch(e){}
  location.reload();
};

/* purana sign up wala data naye system me le aao */
try{
  var old = JSON.parse(localStorage.getItem("sx") || "null");
  if(old && old.ph && old.h){
    var a0 = getAcc();
    if(!a0[old.ph]){ a0[old.ph] = { n: old.n, h: old.h }; setAcc(a0); }
    localStorage.removeItem("sx");
  }
}catch(e){}

/* page khulte hi: pehle se login ho to seedha andar */
var accs = getAcc();
var cur = null;
try{ cur = localStorage.getItem("cur"); }catch(e){}
if(cur && accs[cur]){
  enter(cur, accs[cur].n);
}else{
  showMode(Object.keys(accs).length ? "l" : "s");
}

/* Sign up */
$("suf").onsubmit = async function(e){
  e.preventDefault();
  var er = $("er"); er.style.display = "none";
  function bad(m){ er.textContent = m; er.style.display = "block"; }
  var ph = $("sp").value.replace(/\D/g, "");
  if(ph.length < 10) return bad("Sahi phone number daalo (10 digit).");
  if($("pw1").value.length < 6) return bad("Password kam se kam 6 akshar ka rakho.");
  if($("pw1").value !== $("pw2").value) return bad("Dono password same nahi hain. Dobara likho.");
  var a = getAcc();
  if(a[ph]) return bad("Ye number pehle se registered hai. Login karo.");
  a[ph] = { n: $("sn").value, h: await sha($("pw1").value) };
  setAcc(a);
  enter(ph, $("sn").value);
  window.scrollTo(0, 0);
  window.open(wa("SIGN UP\nNaam: " + $("sn").value + "\nPhone: " + ph), "_blank");
};

/* Login */
$("lf").onsubmit = async function(e){
  e.preventDefault();
  var er = $("er1"); er.style.display = "none";
  var ph = $("lp").value.replace(/\D/g, "");
  var a = getAcc();
  var hs = await sha($("lpw").value);
  if(!a[ph] || a[ph].h !== hs){
    er.textContent = "Number ya password galat hai.";
    er.style.display = "block";
    return;
  }
  enter(ph, a[ph].n);
  window.scrollTo(0, 0);
};

/* Sell form */
$("ss").onchange = function(){
  var f = this.files[0], v = $("pv");
  if(f){ v.src = URL.createObjectURL(f); v.style.display = "block"; } else { v.style.display = "none"; }
};

$("sf").onsubmit = function(e){
  e.preventDefault();
  var m = "SELL REQUEST\nNaam: " + $("n").value + "\nPhone: " + $("ph").value + "\nFree Fire ID: " + $("ffid").value + "\nType: " + $("t").value + "\nPrice: Rs " + $("p").value + "\nSell karne ka reason: " + $("d").value + "\n(Screenshot neeche bhej raha hoon)";
  $("tip").style.display = "block";
  window.open(wa(m), "_blank");
};

$("wa").href = wa("Hi SELLIX FF");
