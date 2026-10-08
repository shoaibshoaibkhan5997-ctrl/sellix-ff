var NUM = "917081573944";

var items = [];
var loggedIn = false;
function wa(m){ return "https://wa.me/" + NUM + "?text=" + encodeURIComponent(m); }
function esc(x){ return String(x).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function $(id){ return document.getElementById(id); }

function openSite(){ $("main").style.display = "block"; }

function draw(f){
  var L = items.filter(function(i){ return f === "all" || i.type === f; })
    .sort(function(a, b){ return (a.sold ? 1 : 0) - (b.sold ? 1 : 0); });
  var h = "";
  if(!L.length) h = '<div class="empty">Abhi koi item list nahi hai. Jaldi naye items aayenge!</div>';
  L.forEach(function(i){
    var im = (i.imgs || []).map(function(u){ return '<img src="images/' + esc(u) + '" alt="">'; }).join("");
    var tag = i.sold ? '<span class="badge so">SOLD</span>' : '<span class="badge av">AVAILABLE</span>';
    var act = i.sold
      ? '<span class="btn dis">Sold ho chuka</span>'
      : '<a class="btn" href="' + wa("Mujhe ye chahiye: " + i.title + " (Rs " + i.price + ")") + '">Buy karo</a>';
    h += '<div class="card' + (i.sold ? ' sold' : '') + '"><div class="imgwrap">' + tag + '<div class="imgs">' + im + '</div></div><h3>' + esc(i.title) + '</h3><p>' + esc(i.desc || "") + '</p><div class="price">Rs ' + esc(i.price) + '</div>' + act + '</div>';
  });
  $("list").innerHTML = h;
}

function drawProofs(list){
  if(!list || !list.length) return;
  var h = "";
  list.forEach(function(p){
    h += '<div class="card proof">' + (p.img ? '<img src="images/' + esc(p.img) + '" alt="">' : '') + '<p>' + esc(p.text || "") + '</p><div class="who">- ' + esc(p.name || "Customer") + '</div></div>';
  });
  $("proofs").innerHTML = h;
  $("proofbox").style.display = "block";
}

fetch("items.json").then(function(r){ return r.json(); }).then(function(j){ items = j; draw("all"); }).catch(function(){ draw("all"); });
fetch("proofs.json").then(function(r){ return r.json(); }).then(drawProofs).catch(function(){});

document.querySelectorAll("#main .tab").forEach(function(b){
  b.onclick = function(){
    document.querySelectorAll("#main .tab").forEach(function(x){ x.classList.remove("on"); });
    b.classList.add("on"); draw(b.dataset.f);
  };
});

function needLogin(e){
  if(!loggedIn){
    e.preventDefault();
    $("gate").style.display = "block";
    $("su").scrollIntoView();
  }
}
$("bb").onclick = needLogin;
$("bs").onclick = needLogin;

function getAcc(){ try{ return JSON.parse(localStorage.getItem("acc") || "{}"); }catch(e){ return {}; } }
function setAcc(a){ try{ localStorage.setItem("acc", JSON.stringify(a)); }catch(e){} }

async function sha(s){
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(function(x){ return x.toString(16).padStart(2, "0"); }).join("");
}

function showMode(m){
  $("lf").style.display = (m === "l") ? "grid" : "none";
  $("suf").style.display = (m === "s") ? "grid" : "none";
  $("su").textContent = (m === "l") ? "Login karo" : "Sign up karo";
  $("swl").textContent = (m === "l") ? "Naya account banana hai? Sign up karo" : "Pehle se account hai? Login karo";
  $("swl").dataset.m = m;
}
$("swl").onclick = function(e){
  e.preventDefault();
  showMode(this.dataset.m === "l" ? "s" : "l");
};
$("bsu").onclick = function(){
  if(!loggedIn) showMode("s");
};

function enter(phone, name){
  loggedIn = true;
  try{ localStorage.setItem("cur", phone); }catch(e){}
  $("auth").style.display = "none";
  $("gate").style.display = "none";
  $("bsu").style.display = "none";
  $("bar").style.display = "flex";
  $("wel").textContent = "Welcome, " + name + "!";
  openSite();
}

$("lo").onclick = function(){
  try{ localStorage.removeItem("cur"); }catch(e){}
  location.reload();
};

try{
  var old = JSON.parse(localStorage.getItem("sx") || "null");
  if(old && old.ph && old.h){
    var a0 = getAcc();
    if(!a0[old.ph]){ a0[old.ph] = { n: old.n, h: old.h }; setAcc(a0); }
    localStorage.removeItem("sx");
  }
}catch(e){}

var accs = getAcc();
var cur = null;
try{ cur = localStorage.getItem("cur"); }catch(e){}
if(cur && accs[cur]){
  enter(cur, accs[cur].n);
}else{
  showMode(Object.keys(accs).length ? "l" : "s");
}

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
