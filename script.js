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

document.querySelectorAll(".tab").forEach(function(b){
  b.onclick = function(){
    document.querySelectorAll(".tab").forEach(function(x){ x.classList.remove("on"); });
    b.classList.add("on"); draw(b.dataset.f);
  };
});

try{
  var sv = JSON.parse(localStorage.getItem("sx") || "null");
  if(sv){
    openSite();
    var h = $("hi"); h.style.display = "block"; h.textContent = "Welcome back, " + sv.n + "!";
    $("suf").querySelectorAll("input,button").forEach(function(x){ x.style.display = "none"; });
    $("su").textContent = "Welcome";
  }
}catch(e){}

$("suf").onsubmit = async function(e){
  e.preventDefault();
  var er = $("er"); er.style.display = "none";
  function bad(m){ er.textContent = m; er.style.display = "block"; }
  var ph = $("sp").value.replace(/\D/g, "");
  if(ph.length < 10) return bad("Sahi phone number daalo (10 digit).");
  if($("pw1").value.length < 6) return bad("Password kam se kam 6 akshar ka rakho.");
  if($("pw1").value !== $("pw2").value) return bad("Dono password same nahi hain. Dobara likho.");
  var hs = "";
  try{
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode($("pw1").value));
    hs = Array.from(new Uint8Array(buf)).map(function(x){ return x.toString(16).padStart(2, "0"); }).join("");
  }catch(x){}
  try{ localStorage.setItem("sx", JSON.stringify({ n: $("sn").value, ph: ph, h: hs })); }catch(x){}
  openSite(); $("main").scrollIntoView();
  window.open(wa("SIGN UP\nNaam: " + $("sn").value + "\nPhone: " + ph), "_blank");
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
