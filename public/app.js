(function(){
"use strict";

/* ---------- icons ---------- */
var ICON = {
  table:'leaderboard', calendar:'calendar_month', bracket:'account_tree', user:'groups', admin:'tune',
  chevronRight:'chevron_right', trophy:'emoji_events', logout:'logout', news:'newspaper', report:'bar_chart'
};
function icon(name){ return ICON[name] ? '<span class="ms" aria-hidden="true">'+ICON[name]+'</span>' : ''; }
var SKEL = '<div class="skel" aria-busy="true">'+new Array(6).join('<i></i>')+'</div>';

var BOLGELER = ['Başkent','AYEDAŞ','Toroslar'];
var BOLGE_TONE = {'Başkent':'#FF7A1F','AYEDAŞ':'#35D399','Toroslar':'#FFC94A'};
var BOLGE_TONE_SOFT = {'Başkent':'rgba(255,122,31,.18)','AYEDAŞ':'rgba(53,211,153,.16)','Toroslar':'rgba(255,201,74,.16)'};

/* ---------- app state ---------- */
var S = {
  view: 'tablo',
  tabloBolge: 'Başkent',
  fiksturBolge: 'Başkent',
  playerFilter: 'Tümü',
  playerSearch: '',
  selectedPlayer: null,
  selectedNews: null,
  loggedIn: false,
  isAdmin: false,
  myTeam: null,
  teams: null,
  matches: null,
  players: null,
  news: null,
  adminAuth: null
};

var TABS = [
  {id:'tablo', label:'Tablo', icon:'table'},
  {id:'haberler', label:'Haberler', icon:'news'},
  {id:'fikstur', label:'Fikstür', icon:'calendar'},
  {id:'bracket', label:'Bracket', icon:'bracket'},
  {id:'oyuncular', label:'Oyuncular', icon:'user'},
  {id:'istatistik', label:'Liderler', icon:'trophy'}
];

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function animateIn(el){
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  el.classList.add('entering');
  clearTimeout(el._enterT);
  el._enterT = setTimeout(function(){ el.classList.remove('entering'); }, 1100);
}

/* ---------- login gate ---------- */
function storageGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function storageSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function storageDel(k){ try{ localStorage.removeItem(k); }catch(e){} }

function renderGate(){
  var sel = document.getElementById('teamSelect');
  if (S.teams){
    var ids = Object.keys(S.teams).sort(function(a,b){ return S.teams[a].name.localeCompare(S.teams[b].name,'tr'); });
    sel.innerHTML = ids.map(function(id){ return '<option value="'+id+'">'+esc(S.teams[id].name)+'</option>'; }).join('');
    var strip = document.getElementById('teamStrip');
    if (strip) gateTeams(ids, strip);
  }
}
document.getElementById('loginTabTeam').addEventListener('click', function(){ setLoginTab('team'); });
document.getElementById('loginTabAdmin').addEventListener('click', function(){ setLoginTab('admin'); });
function setLoginTab(which){
  document.getElementById('loginTabTeam').setAttribute('aria-selected', which==='team');
  document.getElementById('loginTabAdmin').setAttribute('aria-selected', which==='admin');
  document.getElementById('paneTeam').hidden = which!=='team';
  document.getElementById('paneAdmin').hidden = which!=='admin';
  document.getElementById('loginError').textContent = '';
}
function showLoginError(msg){ document.getElementById('loginError').textContent = msg; }
function loginAs(role, teamId){
  S.loggedIn = true;
  S.isAdmin = (role === 'admin');
  S.myTeam = teamId;
  /* session lives in the signed cookie */
  document.getElementById('loginError').textContent = '';
  showApp();
}
function restoreSession(){
  var raw = storageGet('sl_session') || sessionGet();
  if (!raw) return false;
  try{
    var s = JSON.parse(raw);
    S.loggedIn = true;
    S.isAdmin = (s.role === 'admin');
    S.myTeam = s.team || null;
    return true;
  }catch(e){ return false; }
}
function logout(){
  try{ fetch('/api/logout', {method:'POST', credentials:'same-origin'}); }catch(e){}
  stopSync(); S.matches = null; S.players = null; S.news = null; S.teams = null;
  S.loggedIn = false; S.isAdmin = false; S.myTeam = null; S.view = 'tablo';
  storageDel('sl_session'); try{ sessionStorage.removeItem('sl_session'); }catch(e){}
  document.getElementById('appRoot').hidden = true;
  document.getElementById('gate').hidden = false;
  renderGate();
  loadPublicTeams().catch(function(){});
}
function showApp(){
  document.getElementById('gate').hidden = true;
  document.getElementById('appRoot').hidden = false;
  animateIn(document.getElementById('view-'+S.view));
  renderNav();
  renderSessionBox();
  rerenderCurrent();
}
function renderSessionBox(){
  var box = document.getElementById('sessionBox');
  var label = S.isAdmin ? 'Yönetim' : (S.myTeam && S.teams ? teamName(S.myTeam) : 'Takım');
  box.innerHTML =
    '<span class="session-chip'+(S.isAdmin?' admin':'')+'">'+esc(label)+'</span>'+
    '<button class="logout-btn" id="logoutBtn">'+icon('logout')+'<span>Çıkış</span></button>';
  document.getElementById('logoutBtn').addEventListener('click', logout);
}

/* ---------- navigation ---------- */
function visibleTabs(){
  var t = TABS.slice();
  if (S.isAdmin) t.push({id:'rapor', label:'Rapor', icon:'report'});
  if (S.isAdmin) t.push({id:'admin', label:'Yönetim', icon:'admin'});
  return t;
}
function setView(v){
  S.view = v;
  ['tablo','haberler','haber-detay','fikstur','bracket','oyuncular','detay','istatistik','takim','rapor','admin'].forEach(function(id){
    var el = document.getElementById('view-'+id);
    if (el) el.hidden = (id !== v);
  });
  animateIn(document.getElementById('view-'+v));
  renderNav();
  if (v==='tablo') renderTablo();
  if (v==='haberler') renderHaberler();
  if (v==='haber-detay') renderHaberDetay();
  if (v==='fikstur') renderFikstur();
  if (v==='bracket') renderBracket();
  if (v==='oyuncular') renderPlayers();
  if (v==='detay') renderDetail();
  if (v==='rapor') renderRapor();
  if (v==='istatistik') renderIstatistik();
  if (v==='takim') renderTakim();
  if (v==='admin') renderAdmin();
}
function renderNav(){
  var tabs = visibleTabs();
  var desktop = tabs.map(function(t){
    return '<button class="tab-btn" data-nav="'+t.id+'" aria-current="'+(S.view===t.id)+'">'+icon(t.icon)+'<span>'+t.label+'</span></button>';
  }).join('');
  document.getElementById('tabsDesktop').innerHTML = desktop;
  var mobile = tabs.map(function(t){
    return '<button class="nav-item" data-nav="'+t.id+'" aria-current="'+(S.view===t.id)+'">'+icon(t.icon)+'<span>'+t.label+'</span></button>';
  }).join('');
  document.getElementById('bottomNav').innerHTML = mobile;
}
document.addEventListener('click', function(e){
  var btn = e.target.closest('[data-nav]');
  if (btn){ setView(btn.getAttribute('data-nav')); return; }
  var open = e.target.closest('[data-open-player]');
  if (open){ e.preventDefault(); S.selectedPlayer = open.getAttribute('data-open-player'); setView('detay'); return; }
  var openNews = e.target.closest('[data-open-news]');
  if (openNews){ e.preventDefault(); S.selectedNews = openNews.getAttribute('data-open-news'); setView('haber-detay'); return; }
  var chip = e.target.closest('[data-chip]');
  if (chip){
    var group = chip.getAttribute('data-chip-group');
    var val = chip.getAttribute('data-chip');
    if (group==='tablo'){ S.tabloBolge = val; renderTablo(); }
    if (group==='fikstur'){ S.fiksturBolge = val; S.fiksturTeam = ''; renderFikstur(); }
    if (group==='player'){ S.playerFilter = val; renderPlayerList(); }
    if (group==='stat'){ S.statFilter = val; renderIstatistik(); }
  }
});
document.getElementById('playerSearch').addEventListener('input', function(e){
  S.playerSearch = e.target.value.toLocaleLowerCase('tr');
  renderPlayerList();
});

/* ---------- domain helpers ---------- */
function teamsIn(bolge){
  var out = [];
  for (var id in S.teams){ if (S.teams[id].bolge === bolge) out.push(Object.assign({id:id}, S.teams[id])); }
  return out;
}
function standings(bolge){
  var teams = teamsIn(bolge);
  var map = {};
  teams.forEach(function(t){ map[t.id] = {id:t.id, name:t.name, tag:t.tag, played:0, w:0, d:0, l:0, gf:0, ga:0, pts:0}; });
  var anyUnfinished = false;
  for (var mid in S.matches){
    var m = S.matches[mid];
    if (m.bolge !== bolge) continue;
    if (m.status !== 'BİTTİ'){ anyUnfinished = true; continue; }
    if (!map[m.home] || !map[m.away]) continue;
    var h = map[m.home], a = map[m.away];
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore){ h.w++; h.pts+=3; a.l++; }
    else if (m.homeScore < m.awayScore){ a.w++; a.pts+=3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  var list = Object.keys(map).map(function(k){ return map[k]; });
  list.sort(function(x,y){
    if (y.pts !== x.pts) return y.pts - x.pts;
    var gdx = x.gf-x.ga, gdy = y.gf-y.ga;
    if (gdy !== gdx) return gdy - gdx;
    if (y.gf !== x.gf) return y.gf - x.gf;
    return x.name.localeCompare(y.name,'tr');
  });
  list.forEach(function(row,i){ row.rank = i+1; });
  return {rows:list, unfinished:anyUnfinished};
}
function teamName(id){ return S.teams && S.teams[id] ? S.teams[id].name : '-'; }
function findTeamDoc(team){
  if (!S.teams || !team) return null;
  if (S.teams[team]) return S.teams[team];
  for (var id in S.teams){ if (S.teams[id].name === team) return S.teams[id]; }
  return null;
}
function playerTeamLabel(team){
  var t = findTeamDoc(team);
  return t ? t.name : (team || '-');
}
function crestHtml(teamId, big){
  var t = S.teams && S.teams[teamId];
  var cls = 'crest'+(big?' big':'');
  var tcol = t && t.color ? t.color : '';
  if (tcol) cls += ' tc';
  var tcs = tcol ? '--tc:'+esc(tcol)+';' : '';
  if (t && t.photoUrl) return '<div class="'+cls+'" style="'+tcs+'padding:0"><img src="'+esc(t.photoUrl)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block"></div>';
  return '<div class="'+cls+'"'+(tcs ? ' style="'+tcs+'"' : '')+'>'+esc(initials(teamName(teamId)))+'</div>';
}
function statusMeta(status){
  if (status==='CANLI') return {bg:'var(--bad-bg)', fg:'var(--bad)', dot:'var(--bad)'};
  if (status==='YAKINDA') return {bg:'var(--warn-bg)', fg:'var(--warn)', dot:'var(--warn)'};
  return {bg:'var(--surface-2)', fg:'var(--fg-muted)', dot:'var(--fg-muted)'};
}
function initials(name){
  return name.split(' ').map(function(w){return w.charAt(0);}).join('').slice(0,2).toLocaleUpperCase('tr');
}

/* ---------- spotlight ---------- */
function pickSpotlight(){
  if (!S.matches) return null;
  var list = Object.keys(S.matches).map(function(id){return Object.assign({id:id}, S.matches[id]);});
  var live = list.filter(function(m){return m.status==='CANLI';});
  if (live.length) return live[0];
  var upcoming = list.filter(function(m){return m.status==='YAKINDA';});
  if (upcoming.length) return upcoming[0];
  return null;
}
function spotlightHtml(m){
  if (!m) return '';
  var meta = statusMeta(m.status);
  var scoreTxt = (m.homeScore==null?'-':m.homeScore)+' : '+(m.awayScore==null?'-':m.awayScore);
  var sub = m.info || m.week;
  return '<div class="spotlight'+(m.status==='CANLI'?' live':'')+'">'+
    '<div class="spotlight-glow"></div>'+
    '<div class="spotlight-top">'+
      '<span class="status-pill'+(m.status==='CANLI'?' pulse':'')+'" style="background:'+meta.bg+';color:'+meta.fg+'"><span class="dot" style="background:'+meta.dot+'"></span>'+m.status+'</span>'+
      '<span class="spotlight-venue">'+esc(m.bolge)+' / '+esc(m.venue)+(sub?' / '+esc(sub):'')+'</span>'+
    '</div>'+
    '<div class="spotlight-body">'+
      '<div class="spotlight-team">'+crestHtml(m.home,true)+'<div class="spotlight-name">'+esc(teamName(m.home))+'</div></div>'+
      '<div class="spotlight-score">'+scoreTxt+'</div>'+
      '<div class="spotlight-team">'+crestHtml(m.away,true)+'<div class="spotlight-name">'+esc(teamName(m.away))+'</div></div>'+
    '</div>'+
  '</div>';
}

/* ---------- Tablo ---------- */
function renderTablo(){
  document.getElementById('tabloSpotlight').innerHTML = spotlightHtml(pickSpotlight());
  renderRibbon();

  var chips = BOLGELER.map(function(b){
    return '<button class="chip" data-chip="'+b+'" data-chip-group="tablo" aria-pressed="'+(S.tabloBolge===b)+'">'+b+'</button>';
  }).join('');
  document.getElementById('tabloChips').innerHTML = chips;

  var body = document.getElementById('tabloBody');
  if (!S.teams || !S.matches){
    body.innerHTML = SKEL;
    return;
  }
  var res = standings(S.tabloBolge);
  if (!res.rows.length){
    body.innerHTML = '<div class="card empty"><strong>Henüz takım yok</strong>Bu bölge için kayıt bekleniyor.</div>';
    return;
  }
  var head = '<div class="standings-row head"><div></div><div>TAKIM</div><div style="text-align:center">O</div><div class="gx">A</div><div class="gx">Y</div><div style="text-align:right">PUAN</div></div>';
  var rows = res.rows.map(function(r){
    var youFlag = (r.id === S.myTeam) ? '<span class="you-flag">SEN</span>' : '';
    return '<div class="standings-row'+(r.id===S.myTeam?' you':'')+'" data-open-team="'+r.id+'" role="link" tabindex="0">'+
      '<div class="rank'+(r.rank<=2?' advance':'')+'">'+r.rank+'</div>'+
      '<div class="teamcell"><div class="tname">'+esc(r.name)+youFlag+'</div><div class="ttag">'+esc(r.tag)+'</div></div>'+
      '<div class="num">'+r.played+'</div>'+
      '<div class="gx">'+r.w+'-'+r.d+'-'+r.l+'</div>'+
      '<div class="gx">'+(r.gf-r.ga>0?'+':'')+(r.gf-r.ga)+'</div>'+
      '<div class="pts">'+r.pts+'</div>'+
    '</div>';
  }).join('');
  var legend = '<div class="legend"><span class="dot" style="background:var(--good)"></span>İlk 2: Eleme ağacına yükselir, 3-4: Dostluk Kupası</div>';
  var note = res.unfinished ? '<div class="note">Bu bölgede devam eden veya henüz oynanmamış maçlar var - sıralama değişebilir.</div>' : '';
  body.innerHTML = '<div class="table">'+head+rows+'</div>'+legend+note;
  renderStats(res);
}

function renderStats(res){
  var el = document.getElementById('tabloStats');
  if (!el) return;
  var played = 0, goals = 0;
  res.rows.forEach(function(r){ played += r.played; goals += r.gf; });
  played = Math.round(played/2);
  var lead = res.rows[0];
  el.innerHTML =
    '<div class="tile hot"><div class="k">Lider</div><div class="v t">'+esc(lead?lead.name:'-')+'</div><div class="s">'+(lead?lead.pts+' puan':'')+'</div></div>'+
    '<div class="tile"><div class="k">Oynanan maç</div><div class="v" data-count="'+played+'">'+played+'</div></div>'+
    '<div class="tile"><div class="k">Atılan gol</div><div class="v" data-count="'+goals+'">'+goals+'</div></div>';
  countUp(document.getElementById('view-tablo'));
}
function countUp(root){
  if (!root || !root.classList.contains('entering')) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('[data-count]').forEach(function(n){
    var to = Number(n.getAttribute('data-count')) || 0, t0 = null;
    if (!to) return;
    function step(t){
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / 800);
      n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    n.textContent = '0';
    requestAnimationFrame(step);
  });
}
/* cursor spotlight on glass surfaces */
var spotRaf = 0;
document.addEventListener('pointermove', function(e){
  var el = e.target.closest ? e.target.closest('.card,.tile,.login-card') : null;
  if (!el || spotRaf) return;
  spotRaf = requestAnimationFrame(function(){
    spotRaf = 0;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});

/* translucent sun watermark: cut the logo's white background out at runtime so only the sun remains */
(function(){
  try{
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--logo');
    var m = raw.match(/url\(["']?(.*?)["']?\)/);
    if (!m) return;
    var img = new Image();
    img.onload = function(){
      var w = img.naturalWidth, h = Math.round(img.naturalHeight * .74);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0);
      var d = x.getImageData(0, 0, w, h), p = d.data;
      for (var i = 0; i < p.length; i += 4){ p[i+3] = Math.min(255, Math.max(0, (255 - p[i+2] - 10) * 1.9)); }
      x.putImageData(d, 0, 0);
      c.toBlob(function(b){
        if (b) document.documentElement.style.setProperty('--wm', 'url('+URL.createObjectURL(b)+')');
      });
      var x0 = w, x1 = 0, y0 = h, y1 = 0;
      for (var yy = 0; yy < h; yy++){ for (var xx = 0; xx < w; xx++){ if (p[(yy*w+xx)*4+3] > 60){ if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; } } }
      var side = Math.max(x1 - x0, y1 - y0) + 6, c2 = document.createElement('canvas');
      c2.width = side; c2.height = side;
      c2.getContext('2d').drawImage(c, x0 - (side - (x1 - x0)) / 2, y0 - (side - (y1 - y0)) / 2, side, side, 0, 0, side, side);
      c2.toBlob(function(b2){
        if (b2) document.documentElement.style.setProperty('--sun', 'url('+URL.createObjectURL(b2)+')');
      });
    };
    img.src = m[1];
  }catch(e){}
})();

/* ---------- shared helpers ---------- */
function teamIdOf(p){
  if (!S.teams || !p) return '';
  if (S.teams[p.team]) return p.team;
  for (var id in S.teams){ if (S.teams[id].name === p.team) return id; }
  return '';
}
function playerList(){
  return S.players ? Object.keys(S.players).map(function(id){ return Object.assign({id:id}, S.players[id]); }) : [];
}
function playerFace(p, cls){
  var t = findTeamDoc(p.team);
  var tone = BOLGE_TONE[t ? t.bolge : null] || '#FF7A1F';
  return p.photoUrl
    ? '<span class="'+cls+'"><img src="'+esc(p.photoUrl)+'" alt=""></span>'
    : '<span class="'+cls+'" style="background:'+tone+';color:var(--accent-contrast)">'+esc(initials(p.name))+'</span>';
}

/* ---------- match ribbon (top of Tablo) ---------- */
function ribbonCard(m){
  var meta = statusMeta(m.status);
  function sc(v){ return v == null ? '-' : v; }
  return '<button class="rcard" data-open-match="'+m.id+'">'+
    '<div class="rtop"><span class="status-pill'+(m.status==='CANLI'?' pulse':'')+'" style="background:'+meta.bg+';color:'+meta.fg+'"><span class="dot" style="background:'+meta.dot+'"></span>'+m.status+'</span><span class="rmeta">'+esc(m.bolge)+'</span></div>'+
    '<div class="rrow">'+crestHtml(m.home)+'<span class="rname">'+esc(teamName(m.home))+'</span><b>'+sc(m.homeScore)+'</b></div>'+
    '<div class="rrow">'+crestHtml(m.away)+'<span class="rname">'+esc(teamName(m.away))+'</span><b>'+sc(m.awayScore)+'</b></div>'+
    '<div class="rfoot">'+esc(m.info || m.week || '')+'</div>'+
  '</button>';
}
function renderRibbon(){
  var el = document.getElementById('tabloRibbon');
  if (!el) return;
  var prev = document.getElementById('ribbonTrack');
  var keep = prev ? prev.scrollLeft : 0;
  if (!S.matches || !S.teams){ el.innerHTML = ''; return; }
  var order = {'CANLI':0,'YAKINDA':1,'BİTTİ':2};
  var list = Object.keys(S.matches).map(function(id){ return Object.assign({id:id}, S.matches[id]); })
    .sort(function(a,b){ return (order[a.status]-order[b.status]) || String(b.week).localeCompare(String(a.week),'tr',{numeric:true}); });
  if (!list.length){ el.innerHTML = ''; return; }
  el.innerHTML =
    '<div class="ribbon-head"><div class="section-label">Maçlar</div><div class="ribbon-ctl">'+
      '<button class="rb" data-ribbon="-1" aria-label="Önceki maçlar"><span class="ms" aria-hidden="true">arrow_back</span></button>'+
      '<button class="rb" data-ribbon="1" aria-label="Sonraki maçlar"><span class="ms" aria-hidden="true">arrow_forward</span></button>'+
    '</div></div>'+
    '<div class="ribbon" id="ribbonTrack">'+list.map(ribbonCard).join('')+'</div>';
  document.getElementById('ribbonTrack').scrollLeft = keep;
}

/* ---------- highlight rings, computed from live data ---------- */
function momentHtml(attr, inner, label, sub, live){
  return '<button class="moment'+(live?' live':'')+'" '+attr+'><span class="ring"><span class="mi">'+inner+'</span></span>'+
    '<span class="ml">'+esc(label)+'</span><span class="msub">'+esc(sub)+'</span></button>';
}
function renderMoments(){
  var el = document.getElementById('tabloMoments');
  if (!el) return;
  var prev = document.getElementById('momentTrack');
  var keep = prev ? prev.scrollLeft : 0;
  if (!S.matches || !S.teams || !S.players){ el.innerHTML = ''; return; }
  var items = [];
  var live = Object.keys(S.matches).map(function(id){ return Object.assign({id:id}, S.matches[id]); }).filter(function(m){ return m.status==='CANLI'; })[0];
  if (live) items.push(momentHtml('data-open-match="'+live.id+'"', '<span class="mscore">'+(live.homeScore==null?0:live.homeScore)+':'+(live.awayScore==null?0:live.awayScore)+'</span>', 'Canlı maç', teamName(live.home), true));
  var pl = playerList();
  var byGoals = pl.filter(function(p){ return (p.goals||0) > 0; }).sort(function(a,b){ return b.goals - a.goals; })[0];
  if (byGoals) items.push(momentHtml('data-open-player="'+byGoals.id+'"', playerFace(byGoals,'mface'), 'Gol kralı', byGoals.name+', '+byGoals.goals+' gol'));
  var byAssists = pl.filter(function(p){ return (p.assists||0) > 0; }).sort(function(a,b){ return b.assists - a.assists; })[0];
  if (byAssists) items.push(momentHtml('data-open-player="'+byAssists.id+'"', playerFace(byAssists,'mface'), 'Asist lideri', byAssists.name+', '+byAssists.assists+' asist'));
  BOLGELER.forEach(function(b){
    var top = standings(b).rows[0];
    if (top && top.played > 0) items.push(momentHtml('data-open-team="'+top.id+'"', crestHtml(top.id), b+' lideri', top.name+', '+top.pts+' puan'));
  });
  if (!items.length){ el.innerHTML = ''; return; }
  el.innerHTML = '<div class="moments" id="momentTrack">'+items.join('')+'</div>';
  document.getElementById('momentTrack').scrollLeft = keep;
}

/* ---------- Liderler (goal / assist / team goals) ---------- */
function leaderList(title, rows, unit, key){
  var on = (S.leaderSel || 'goals') === key;
  var head = '<button type="button" class="k lk" data-leader="'+key+'" aria-pressed="'+on+'">'+title+'</button>';
  if (!rows.length) return '<div class="tile leader-list'+(on?' hot':'')+'" data-leader="'+key+'">'+head+'<div class="s">Henüz veri yok.</div></div>';
  return '<div class="tile leader-list'+(on?' hot':'')+'" data-leader="'+key+'">'+head+rows.map(function(r,i){
    return '<a href="#" class="lrow'+(i===0?' first':'')+'" '+r.attr+'>'+
      '<span class="lrank">'+(i+1)+'</span>'+r.face+
      '<span class="linfo"><span class="lname">'+esc(r.name)+'</span><span class="lsub">'+esc(r.sub)+'</span></span>'+
      '<span class="lval">'+r.val+'<small>'+unit+'</small></span></a>';
  }).join('')+'</div>';
}
function renderIstatistik(){
  var chips = ['Tümü'].concat(BOLGELER).map(function(f){
    return '<button class="chip" data-chip="'+f+'" data-chip-group="stat" aria-pressed="'+((S.statFilter||'Tümü')===f)+'">'+f+'</button>';
  }).join('');
  document.getElementById('statChips').innerHTML = chips;
  var body = document.getElementById('statBody');
  if (!S.players || !S.teams || !S.matches){ body.innerHTML = SKEL; return; }
  var f = S.statFilter || 'Tümü';
  var pl = playerList().filter(function(p){ return f==='Tümü' || (findTeamDoc(p.team)||{}).bolge === f; });
  function top(key){
    return pl.filter(function(p){ return (p[key]||0) > 0; })
      .sort(function(a,b){ return (b[key]-a[key]) || a.name.localeCompare(b.name,'tr'); }).slice(0,8)
      .map(function(p){ return {attr:'data-open-player="'+p.id+'"', face:playerFace(p,'lface'), name:p.name, sub:playerTeamLabel(p.team), val:p[key]}; });
  }
  var teamRows = [];
  BOLGELER.forEach(function(b){ if (f==='Tümü' || f===b) standings(b).rows.forEach(function(r){ teamRows.push(r); }); });
  teamRows = teamRows.filter(function(r){ return r.gf > 0; }).sort(function(a,b){ return (b.gf-a.gf) || a.name.localeCompare(b.name,'tr'); }).slice(0,8)
    .map(function(r){ return {attr:'data-open-team="'+r.id+'"', face:crestHtml(r.id), name:r.name, sub:S.teams[r.id].bolge, val:r.gf}; });
  body.innerHTML = '<div class="leaders">'+
    leaderList('Gol krallığı', top('goals'), 'gol', 'goals')+
    leaderList('Asist krallığı', top('assists'), 'asist', 'assists')+
    leaderList('Takımların attığı gol', teamRows, 'gol', 'teams')+
  '</div>';
}

/* ---------- Takım sayfası ---------- */
function renderTakim(){
  var body = document.getElementById('takimBody');
  var id = S.selectedTeam;
  var t = S.teams && id ? S.teams[id] : null;
  if (!S.teams || !S.matches || !S.players){ body.innerHTML = SKEL; return; }
  if (!t){ body.innerHTML = '<div class="card empty"><strong>Takım bulunamadı</strong></div>'; return; }
  var res = standings(t.bolge);
  var row = res.rows.filter(function(r){ return r.id === id; })[0] || {rank:'-',pts:0,played:0,gf:0,ga:0,w:0,d:0,l:0};
  var mine = Object.keys(S.matches).map(function(mid){ return Object.assign({id:mid}, S.matches[mid]); })
    .filter(function(m){ return m.home === id || m.away === id; })
    .sort(function(a,b){ return String(a.week).localeCompare(String(b.week),'tr',{numeric:true}); });
  var played = mine.filter(function(m){ return m.status === 'BİTTİ'; });
  var form = played.slice(-5).map(function(m){
    var h = m.home === id, gf = h ? m.homeScore : m.awayScore, ga = h ? m.awayScore : m.homeScore;
    var r = gf > ga ? 'G' : (gf < ga ? 'M' : 'B');
    var label = r==='G' ? 'Galibiyet' : (r==='M' ? 'Mağlubiyet' : 'Beraberlik');
    return '<span class="form f'+r+'" title="'+label+'" aria-label="'+label+'">'+r+'</span>';
  }).join('') || '<span class="s">Henüz oynanan maç yok.</span>';
  var roster = playerList().filter(function(p){ return teamIdOf(p) === id; })
    .sort(function(a,b){ return ((b.goals||0)+(b.assists||0)) - ((a.goals||0)+(a.assists||0)); });
  var gd = row.gf - row.ga;
  body.innerHTML =
    '<div class="team-hero">'+crestHtml(id,true)+
      '<div><h1 class="team-name">'+esc(t.name)+'</h1><div class="team-sub">'+esc(t.tag||'')+'</div>'+
      '<div class="detail-badges" style="justify-content:flex-start"><span class="badge">'+esc(t.bolge)+'</span>'+(id===S.myTeam?'<span class="badge cap">Senin takımın</span>':'')+'</div></div>'+
    '</div>'+
    '<div class="stat-bento team-stats">'+
      '<div class="tile hot"><div class="k">Bölge sırası</div><div class="v">'+row.rank+'</div></div>'+
      '<div class="tile"><div class="k">Puan</div><div class="v">'+row.pts+'</div></div>'+
      '<div class="tile"><div class="k">Oynanan</div><div class="v">'+row.played+'</div></div>'+
      '<div class="tile"><div class="k">Averaj</div><div class="v">'+(gd>0?'+':'')+gd+'</div></div>'+
    '</div>'+
    '<div class="team-cols">'+
      '<div><div class="section-label">Son maçlar</div><div class="form-row">'+form+'</div>'+
        '<div class="section-label" style="margin-top:26px">Fikstür</div>'+
        (mine.length ? '<div class="match-list one">'+mine.map(matchCardHtml).join('')+'</div>' : '<div class="card empty"><strong>Maç yok</strong>Bu takım için fikstür bekleniyor.</div>')+
      '</div>'+
      '<div><div class="section-label">Kadro</div>'+
        (roster.length ? '<div class="roster">'+roster.map(function(p){
          return '<a href="#" class="lrow" data-open-player="'+p.id+'">'+playerFace(p,'lface')+
            '<span class="linfo"><span class="lname">'+esc(p.name)+(p.captain?' <em class="cap-flag">K</em>':'')+'</span><span class="lsub">'+esc(p.position||'')+'</span></span>'+
            '<span class="lval">'+(p.goals||0)+'<small>gol</small></span><span class="lval">'+(p.assists||0)+'<small>asist</small></span></a>';
        }).join('')+'</div>' : '<div class="card empty"><strong>Kadro boş</strong>Yönetim panelinden oyuncu ekleyince burada görünür.</div>')+
      '</div>'+
    '</div>';
}

/* ---------- new interactions ---------- */
document.addEventListener('click', function(e){
  var ld = e.target.closest('[data-leader]');
  if (ld && !e.target.closest('.lrow')){ S.leaderSel = ld.getAttribute('data-leader'); renderIstatistik(); return; }
  var team = e.target.closest('[data-open-team]');
  if (team){ e.preventDefault(); S.selectedTeam = team.getAttribute('data-open-team'); setView('takim'); return; }
  var match = e.target.closest('[data-open-match]');
  if (match){
    var m = S.matches && S.matches[match.getAttribute('data-open-match')];
    if (m){ S.fiksturBolge = m.bolge; setView('fikstur'); }
    return;
  }
  var rb = e.target.closest('[data-ribbon]');
  if (rb){
    var track = document.getElementById('ribbonTrack');
    if (track) track.scrollBy({left: Number(rb.getAttribute('data-ribbon')) * Math.max(240, track.clientWidth * .8), behavior: 'smooth'});
  }
});
document.addEventListener('keydown', function(e){
  if (e.key !== 'Enter') return;
  var team = e.target.closest && e.target.closest('.standings-row[data-open-team]');
  if (team){ S.selectedTeam = team.getAttribute('data-open-team'); setView('takim'); }
});

/* ---------- gate: photo scene with live region pins ---------- */
function buildScene(){
  var host = document.getElementById('gateScene');
  if (!host) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seed = 11;
  function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function f(n){ return Math.round(n * 10) / 10; }
  var o = [];
  o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">');
  o.push('<defs><radialGradient id="sg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFB02E" stop-opacity=".55"/><stop offset=".5" stop-color="#FF6B1F" stop-opacity=".18"/><stop offset="1" stop-color="#FF6B1F" stop-opacity="0"/></radialGradient>'+
    '<filter id="gl2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter></defs>');
  o.push('<image href="/img/scene.webp" x="0" y="0" width="1672" height="941" preserveAspectRatio="xMidYMid slice"/>');
  o.push('<circle class="sunglow" cx="880" cy="270" r="380" fill="url(#sg)"/>');
  if (!reduce){
    for (var i = 0; i < 26; i++){
      o.push('<circle class="ember" cx="'+f(120+rnd()*1100)+'" cy="'+f(520+rnd()*330)+'" r="'+f(1.2+rnd()*2.2)+'" fill="#FFC870" style="animation-delay:-'+f(rnd()*9)+'s;animation-duration:'+f(7+rnd()*7)+'s"/>');
    }
  }
  function pin(x, y, label, color, delay){
    var w = label.length * 12 + 58;
    return '<g class="pin" style="animation-delay:'+delay+'s"><g transform="translate('+x+' '+y+') scale(1.2)">'+
      '<path d="M0 0L-8 -15H8Z" fill="'+color+'"/>'+
      '<rect x="'+f(-w/2)+'" y="-58" width="'+w+'" height="42" rx="21" fill="'+color+'" opacity=".45" filter="url(#gl2)"/>'+
      '<rect x="'+f(-w/2)+'" y="-58" width="'+w+'" height="42" rx="21" fill="#0A0E18" fill-opacity=".78" stroke="'+color+'" stroke-width="2"/>'+
      '<circle class="pulse" cx="'+f(-w/2+22)+'" cy="-37" r="6" fill="none" stroke="'+color+'" stroke-width="2"/>'+
      '<circle cx="'+f(-w/2+22)+'" cy="-37" r="6" fill="'+color+'"/>'+
      '<text x="'+f(-w/2+40)+'" y="-31" font-family="Geist,Segoe UI,sans-serif" font-weight="700" font-size="18" letter-spacing=".5" fill="#fff">'+label+'</text></g></g>';
  }
  o.push(pin(330, 592, 'AYEDAŞ', '#3D8BFF', 0));
  o.push(pin(690, 528, 'BAŞKENT', '#FF6A2E', -1.2));
  o.push(pin(935, 545, 'TOROSLAR', '#35D86F', -2.4));
  o.push('</svg>');
  host.innerHTML = o.join('');
}
buildScene();

/* ---------- gate: password toggle, remember me, forgot hint, Enter to submit ---------- */
function saveSession(obj){
  var raw = JSON.stringify(obj);
  var keep = document.getElementById('rememberMe');
  if (keep && !keep.checked){ try{ sessionStorage.setItem('sl_session', raw); }catch(e){} storageDel('sl_session'); }
  else { storageSet('sl_session', raw); try{ sessionStorage.removeItem('sl_session'); }catch(e){} }
}
function sessionGet(){ try{ return sessionStorage.getItem('sl_session'); }catch(e){ return null; } }
document.addEventListener('click', function(e){
  var eye = e.target.closest('[data-eye]');
  if (eye){
    var inp = document.getElementById(eye.getAttribute('data-eye'));
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    eye.setAttribute('aria-label', show ? 'Şifreyi gizle' : 'Şifreyi göster');
    eye.setAttribute('aria-pressed', show);
    eye.querySelector('.ms').textContent = show ? 'visibility_off' : 'visibility';
    return;
  }
  if (e.target.closest('#forgotBtn')) showLoginError('Takım şifreni küme sorumlundan öğrenebilirsin.');
});
document.addEventListener('keydown', function(e){
  if (e.key !== 'Enter' || !e.target || !e.target.id) return;
  if (e.target.id === 'teamPass') document.getElementById('teamLoginBtn').click();
  if (e.target.id === 'adminPass') document.getElementById('adminLoginBtn').click();
});


/* ---------- gate: team showcase ---------- */
function gateTeams(ids, strip){
  strip.innerHTML = '<div class="ts-head"><i></i><span>'+ids.length+' TAKIM</span><b></b><span>ŞAMPİYONLAR LİGİ</span><i></i></div>';
}
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-ts]');
  if (!b) return;
  var tr = document.getElementById('tsTrack');
  if (tr) tr.scrollBy({left: Number(b.getAttribute('data-ts')) * Math.max(220, tr.clientWidth * .7), behavior: 'smooth'});
});
/* ---------- fixtures: team filter and "my team" shortcut ---------- */
function renderFiksturFilters(){
  var el = document.getElementById('fiksturFilters');
  if (!el) return;
  if (!S.teams){ el.innerHTML = ''; el._h = ''; return; }
  var ids = Object.keys(S.teams).filter(function(id){ return S.teams[id].bolge === S.fiksturBolge; })
    .sort(function(a,b){ return S.teams[a].name.localeCompare(S.teams[b].name,'tr'); });
  if (S.fiksturTeam && ids.indexOf(S.fiksturTeam) < 0) S.fiksturTeam = '';
  var mine = S.myTeam && S.teams[S.myTeam];
  var html = '<label class="sr" for="fiksturTeam">Takım filtresi</label>'+
    '<div class="inp sel"><span class="ms" aria-hidden="true">groups</span>'+
    '<select id="fiksturTeam"><option value="">Tüm takımlar</option>'+
    ids.map(function(id){ return '<option value="'+id+'"'+(S.fiksturTeam===id?' selected':'')+'>'+esc(S.teams[id].name)+'</option>'; }).join('')+
    '</select><span class="ms chev" aria-hidden="true">expand_more</span></div>'+
    (mine ? '<button type="button" class="chip-btn" data-my-fixtures="1" aria-pressed="'+(S.fiksturTeam===S.myTeam)+'"><span class="ms" aria-hidden="true">star</span>Takımım</button>' : '');
  if (el._h !== html){ el.innerHTML = html; el._h = html; }
}

/* ---------- admin: add match, bulk import ---------- */
function adminMatchForm(ids){
  function opts(second){
    return ids.map(function(id, i){
      return '<option value="'+id+'"'+(second && i === 1 ? ' selected' : '')+'>'+esc(S.teams[id].name)+' ('+esc(S.teams[id].bolge)+')</option>';
    }).join('');
  }
  return '<div class="admin-form card">'+
    '<label>Ev sahibi <select id="newMatchHome">'+opts(false)+'</select></label>'+
    '<label>Deplasman <select id="newMatchAway">'+opts(true)+'</select></label>'+
    '<input type="text" id="newMatchWeek" placeholder="Hafta (1. Hafta)" aria-label="Hafta" style="width:130px">'+
    '<input type="text" id="newMatchVenue" placeholder="Saha" aria-label="Saha" style="width:150px">'+
    '<input type="text" id="newMatchInfo" placeholder="Saat (Cmt 14:00)" aria-label="Saat" style="width:140px">'+
    '<select id="newMatchStatus" aria-label="Durum"><option value="YAKINDA">YAKINDA</option><option value="CANLI">CANLI</option><option value="BİTTİ">BİTTİ</option></select>'+
    '<button class="save-btn" data-create-match="1">Maç Ekle</button>'+
  '</div>';
}
function adminImportBlock(){
  return '<div class="admin-form card import">'+
    '<div class="imp-col"><div class="imp-t">Takımlar (CSV)</div><div class="imp-h">Sütunlar: Takım adı; Departman karması; Bölge; Şifre</div>'+
      '<label class="upload-btn">Dosya seç<input type="file" accept=".csv,text/csv,text/plain" data-import="teams" hidden></label></div>'+
    '<div class="imp-col"><div class="imp-t">Oyuncular (CSV)</div><div class="imp-h">Sütunlar: Ad Soyad; Takım adı; Pozisyon; Departman; Yaka (Mavi veya Beyaz); Kaptan (evet)</div>'+
      '<label class="upload-btn">Dosya seç<input type="file" accept=".csv,text/csv,text/plain" data-import="players" hidden></label></div>'+
    '<div class="imp-msg" id="importMsg" role="status">'+esc(S.importMsg||'')+'</div>'+
  '</div>';
}
function parseCsv(text){
  text = text.replace(/^﻿/, '');
  var first = text.split(/\r?\n/)[0] || '';
  var d = first.indexOf(';') > -1 ? ';' : (first.indexOf('\t') > -1 ? '\t' : ',');
  var rows = [], row = [], cur = '', q = false;
  for (var i = 0; i < text.length; i++){
    var ch = text.charAt(i);
    if (q){
      if (ch === '"'){ if (text.charAt(i+1) === '"'){ cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === d){ row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r'){
      if (ch === '\r' && text.charAt(i+1) === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length){ row.push(cur); rows.push(row); }
  return rows;
}
function lc(s){ return String(s || '').trim().toLocaleLowerCase('tr'); }
function runImport(input){
  var kind = input.getAttribute('data-import');
  var file = input.files && input.files[0];
  if (!file || !window.__db || !S.isAdmin) return;
  function say(t){ S.importMsg = t; var m = document.getElementById('importMsg'); if (m) m.textContent = t; }
  say('Dosya okunuyor…');
  file.text().then(function(text){
    var rows = parseCsv(text).filter(function(r){ return r.some(function(c){ return String(c).trim(); }); });
    if (rows.length && ['takım adı','takım','ad soyad','ad','name','isim'].indexOf(lc(rows[0][0])) > -1) rows.shift();
    var jobs = [], skip = 0;
    if (kind === 'teams'){
      var names = {};
      Object.keys(S.teams).forEach(function(id){ names[lc(S.teams[id].name)] = 1; });
      rows.forEach(function(r){
        var n = String(r[0]||'').trim(), tag = String(r[1]||'').trim(), pw = String(r[3]||'').trim();
        var bolge = BOLGELER.filter(function(b){ return lc(b) === lc(r[2]); })[0];
        if (!n || !bolge || !pw || names[lc(n)]){ skip++; return; }
        names[lc(n)] = 1;
        jobs.push(window.__db.collection('teams').add({ name:n, tag:tag, bolge:bolge, password:pw, color:'' }));
      });
    } else {
      var byName = {};
      Object.keys(S.teams).forEach(function(id){ byName[lc(S.teams[id].name)] = S.teams[id].name; });
      rows.forEach(function(r){
        var n = String(r[0]||'').trim(), team = byName[lc(r[1])];
        if (!n || !team){ skip++; return; }
        jobs.push(window.__db.collection('players').add({
          name:n, team:team, position:String(r[2]||'').trim() || '-', departman:String(r[3]||'').trim(),
          yaka: /beyaz/i.test(String(r[4]||'')) ? 'Beyaz Yaka' : 'Mavi Yaka',
          goals:0, assists:0, captain: /^(evet|e|1|true|x|k|kaptan)$/i.test(String(r[5]||'').trim())
        }));
      });
    }
    return Promise.all(jobs).then(function(){
      say(jobs.length + ' kayıt eklendi' + (skip ? ', ' + skip + ' satır atlandı (eksik bilgi, bilinmeyen bölge veya takım, ya da aynı adlı kayıt).' : '.'));
      input.value = '';
    });
  }).catch(function(){ say('Aktarım sırasında hata oluştu, dosyayı kontrol edip tekrar dene.'); });
}

document.addEventListener('change', function(e){
  if (e.target && e.target.id === 'fiksturTeam'){ S.fiksturTeam = e.target.value; renderFikstur(); return; }
  var imp = e.target.closest && e.target.closest('[data-import]');
  if (imp) runImport(imp);
});
document.addEventListener('click', function(e){
  var my = e.target.closest('[data-my-fixtures]');
  if (my && S.myTeam && S.teams && S.teams[S.myTeam]){
    if (S.fiksturTeam === S.myTeam) S.fiksturTeam = '';
    else { S.fiksturBolge = S.teams[S.myTeam].bolge; S.fiksturTeam = S.myTeam; }
    renderFikstur();
    return;
  }
  if (!S.isAdmin || !window.__db) return;
  var tc = e.target.closest('[data-save-tcolor]');
  if (tc){
    var tid = tc.getAttribute('data-save-tcolor');
    window.__db.collection('teams').doc(tid).update({ color: document.getElementById('tcolor-'+tid).value })
      .then(function(){ flash(tc); }).catch(function(){ flash(tc, 'Hata, tekrar dene'); });
    return;
  }
  var cm = e.target.closest('[data-create-match]');
  if (cm){
    var home = document.getElementById('newMatchHome').value, away = document.getElementById('newMatchAway').value;
    var th = S.teams[home], ta = S.teams[away];
    if (!th || !ta || home === away){ flash(cm, 'İki farklı takım seç'); return; }
    if (th.bolge !== ta.bolge){ flash(cm, 'Aynı bölgeden olmalı'); return; }
    var info = document.getElementById('newMatchInfo').value.trim();
    window.__db.collection('matches').add({
      bolge: th.bolge, home: home, away: away, homeScore: null, awayScore: null,
      status: document.getElementById('newMatchStatus').value,
      week: document.getElementById('newMatchWeek').value.trim() || '1. Hafta',
      venue: document.getElementById('newMatchVenue').value.trim() || '-',
      info: info || null
    }).then(function(){
      ['newMatchWeek','newMatchVenue','newMatchInfo'].forEach(function(k){ document.getElementById(k).value = ''; });
      flash(cm, 'Eklendi');
    }).catch(function(){ flash(cm, 'Hata, tekrar dene'); });
    return;
  }
  var dm = e.target.closest('[data-delete-match]');
  if (dm){
    var mid = dm.getAttribute('data-delete-match');
    if (dm.dataset.armed === '1'){
      window.__db.collection('matches').doc(mid).delete().then(function(){
        if (document.activeElement) document.activeElement.blur();
        renderAdmin();
      }).catch(function(){ flash(dm, 'Hata, tekrar dene'); });
    } else {
      dm.dataset.armed = '1';
      var old = dm.textContent;
      dm.textContent = 'Emin misin? Tekrar tıkla';
      setTimeout(function(){ if (dm.dataset.armed === '1'){ dm.dataset.armed = '0'; dm.textContent = old; } }, 4000);
    }
  }
});

/* ---------- Haberler ---------- */
function fmtNewsDate(ts){
  if (!ts) return '';
  try{ return new Date(ts).toLocaleDateString('tr-TR',{day:'numeric',month:'long'}); }catch(e){ return ''; }
}
function renderHaberler(){
  var body = document.getElementById('haberlerBody');
  if (!S.news){
    body.innerHTML = SKEL;
    return;
  }
  var list = Object.keys(S.news).map(function(id){ return Object.assign({id:id}, S.news[id]); })
    .sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
  if (!list.length){
    body.innerHTML = '<div class="card empty"><strong>Henüz haber yok</strong>Yönetim panelinden haber eklenince burada görünecek.</div>';
    return;
  }
  var featured = list.filter(function(n){ return n.featured; })[0] || list[0];
  var rest = list.filter(function(n){ return n.id !== featured.id; });

  var featHtml = '<a href="#" class="news-feature card" data-open-news="'+featured.id+'">'+
    '<div class="news-feature-photo"'+(featured.photoUrl?'':' data-empty="1"')+'>'+(featured.photoUrl?'<img src="'+esc(featured.photoUrl)+'" alt="">':'')+'</div>'+
    '<div class="news-feature-body">'+
      '<div class="news-tag">'+esc(featured.tag||'ÖNE ÇIKAN')+'</div>'+
      '<h2 class="news-feature-title">'+esc(featured.title)+'</h2>'+
      '<p class="news-feature-excerpt">'+esc(featured.body)+'</p>'+
      '<div class="news-date">'+esc(fmtNewsDate(featured.createdAt))+'</div>'+
    '</div>'+
  '</a>';

  var restHtml = !rest.length ? '' : '<div class="news-grid">'+rest.map(function(n){
    return '<a href="#" class="news-card card" data-open-news="'+n.id+'">'+
      '<div class="news-card-photo"'+(n.photoUrl?'':' data-empty="1"')+'>'+(n.photoUrl?'<img src="'+esc(n.photoUrl)+'" alt="">':'')+'</div>'+
      '<div class="news-card-body">'+
        '<div class="news-tag">'+esc(n.tag||'HABER')+'</div>'+
        '<div class="news-title">'+esc(n.title)+'</div>'+
        '<p class="news-excerpt">'+esc(n.body)+'</p>'+
        '<div class="news-date">'+esc(fmtNewsDate(n.createdAt))+'</div>'+
      '</div>'+
    '</a>';
  }).join('')+'</div>';

  body.innerHTML = '<div class="section-label">BU HAFTANIN ÖNE ÇIKANI</div>'+featHtml+
    (rest.length ? '<div class="section-label" style="margin-top:22px">DİĞER HABERLER</div>'+restHtml : '');
}
function renderHaberDetay(){
  var body = document.getElementById('haberDetayBody');
  var n = S.news && S.selectedNews ? S.news[S.selectedNews] : null;
  if (!n){ body.innerHTML = '<div class="card empty"><strong>Haber bulunamadı</strong></div>'; return; }
  body.innerHTML =
    (n.photoUrl ? '<div class="news-detail-photo"><img src="'+esc(n.photoUrl)+'" alt=""></div>' : '')+
    '<div class="news-tag">'+esc(n.tag||'HABER')+'</div>'+
    '<h1 class="news-detail-title">'+esc(n.title)+'</h1>'+
    '<div class="news-detail-meta"><div class="news-date">'+esc(fmtNewsDate(n.createdAt))+'</div></div>'+
    '<p class="news-detail-body">'+esc(n.body)+'</p>';
}

/* ---------- Fikstür ---------- */
function matchCardHtml(m){
  var meta = statusMeta(m.status);
  var scoreTxt = (m.homeScore==null ? '-' : m.homeScore) + ' : ' + (m.awayScore==null ? '-' : m.awayScore);
  var sub = m.status==='BİTTİ' ? m.week : (m.info || m.week);
  var mine = (m.home===S.myTeam || m.away===S.myTeam);
  return '<div class="match-card card'+(mine?' you':'')+'">'+
    '<div class="match-top">'+
      '<div class="match-venue">'+esc(m.venue)+', '+esc(sub)+'</div>'+
      '<div class="status-pill'+(m.status==='CANLI'?' pulse':'')+'" style="background:'+meta.bg+';color:'+meta.fg+'"><span class="dot" style="background:'+meta.dot+'"></span>'+m.status+'</div>'+
    '</div>'+
    '<div class="match-body">'+
      '<div class="side home">'+crestHtml(m.home)+'<div class="side-name">'+esc(teamName(m.home))+'</div></div>'+
      '<div class="score">'+scoreTxt+'</div>'+
      '<div class="side away"><div class="side-name">'+esc(teamName(m.away))+'</div>'+crestHtml(m.away)+'</div>'+
    '</div>'+
  '</div>';
}
function renderFikstur(){
  var chips = BOLGELER.map(function(b){
    return '<button class="chip" data-chip="'+b+'" data-chip-group="fikstur" aria-pressed="'+(S.fiksturBolge===b)+'">'+b+'</button>';
  }).join('');
  document.getElementById('fiksturChips').innerHTML = chips;
  renderFiksturFilters();

  var body = document.getElementById('fiksturBody');
  if (!S.matches || !S.teams){
    body.innerHTML = SKEL;
    return;
  }
  var order = {'CANLI':0,'YAKINDA':1,'BİTTİ':2};
  var list = Object.keys(S.matches).map(function(id){ return Object.assign({id:id}, S.matches[id]); })
    .filter(function(m){ return m.bolge === S.fiksturBolge && (!S.fiksturTeam || m.home === S.fiksturTeam || m.away === S.fiksturTeam); })
    .sort(function(a,b){ return (order[a.status]-order[b.status]) || a.week.localeCompare(b.week); });
  if (!list.length){
    body.innerHTML = '<div class="card empty"><strong>Maç yok</strong>Bu bölge için fikstür bekleniyor.</div>';
    return;
  }
  body.innerHTML = '<div class="match-list">'+list.map(matchCardHtml).join('')+'</div>';
}

/* ---------- Bracket ---------- */
function renderBracket(){
  var body = document.getElementById('bracketBody');
  if (!S.teams || !S.matches){
    body.innerHTML = SKEL;
    return;
  }
  var leaders = {};
  var cards = BOLGELER.map(function(b){
    var res = standings(b);
    var top = res.rows[0];
    leaders[b] = top;
    var statusTxt = !top ? 'Takım yok' : (res.unfinished ? 'Şu an 1. - kesinleşmedi' : 'Bölge şampiyonu');
    var color = (!res.unfinished && top) ? 'var(--good)' : 'var(--warn)';
    return '<div class="bolge-card" style="--tone:'+(BOLGE_TONE[b]||'var(--accent)')+'">'+
      '<div class="bname">'+b.toUpperCase()+'</div>'+
      '<div class="leader">'+esc(top ? top.name : '-')+'</div>'+
      '<div class="lstatus" style="color:'+color+'">'+statusTxt+'</div>'+
    '</div>';
  }).join('');

  var l1 = leaders['Başkent'], l2 = leaders['AYEDAŞ'], l3 = leaders['Toroslar'];
  var allFinal = BOLGELER.every(function(b){ return !standings(b).unfinished; });
  var champ = allFinal ? (l1&&l2&&l3 ? 'Yarı final galipleri' : 'Belirlenecek') : 'Belirlenecek';

  function bkSlot(name, sub, cls){
    return '<div class="bk-slot'+(cls?' '+cls:'')+'"><div class="bl">'+name+'</div><div class="bsub">'+sub+'</div></div>';
  }
  var tree =
    '<div class="bk-node">'+
      '<div class="bk-kids">'+
        '<div class="bk-kid end">'+bkSlot(esc(l1?l1.name:'Başkent Şampiyonu'), 'Başkent, finale doğrudan')+'</div>'+
        '<div class="bk-kid">'+
          '<div class="bk-node">'+
            '<div class="bk-kids">'+
              '<div class="bk-kid">'+bkSlot(esc(l2?l2.name:'AYEDAŞ Şampiyonu'), 'AYEDAŞ, yarı final')+'</div>'+
              '<div class="bk-kid">'+bkSlot(esc(l3?l3.name:'Toroslar Şampiyonu'), 'Toroslar, yarı final')+'</div>'+
            '</div>'+
            bkSlot('Yarı final galibi', 'Belirlenecek', 'semi')+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="bk-slot champion">'+icon('trophy')+'<div class="ctitle">ŞAMPİYON</div><div class="cname">Belirlenecek</div></div>'+
    '</div>';
  var bracket =
    '<div class="bracket-panel">'+
      '<div class="bk-caption">YARI FİNAL → FİNAL (5 ya da 12 Haziran, Ankara) → ŞAMPİYON</div>'+
      '<div class="bk-scroll">'+tree+'</div>'+
    '</div>';

  body.innerHTML = '<div class="bolge-grid">'+cards+'</div>'+bracket;
}

/* ---------- Oyuncular ---------- */
function renderPlayers(){
  var chips = ['Tümü'].concat(BOLGELER).map(function(f){
    return '<button class="chip" data-chip="'+f+'" data-chip-group="player" aria-pressed="'+(S.playerFilter===f)+'">'+f+'</button>';
  }).join('');
  document.getElementById('playerChips').innerHTML = chips;
  renderPlayerList();
}
function renderPlayerList(){
  var body = document.getElementById('playersBody');
  if (!S.players || !S.teams){
    body.innerHTML = SKEL;
    return;
  }
  var list = Object.keys(S.players).map(function(id){ return Object.assign({id:id}, S.players[id]); });
  if (S.playerFilter !== 'Tümü') list = list.filter(function(p){ return (findTeamDoc(p.team)||{}).bolge === S.playerFilter; });
  if (S.playerSearch){
    var q = S.playerSearch;
    list = list.filter(function(p){
      return p.name.toLocaleLowerCase('tr').indexOf(q) > -1 || playerTeamLabel(p.team).toLocaleLowerCase('tr').indexOf(q) > -1;
    });
  }
  if (!list.length){
    body.innerHTML = '<div class="card empty"><strong>Sonuç yok</strong>Arama veya filtreyi değiştirmeyi dene.</div>';
    return;
  }
  body.innerHTML = '<div class="player-grid">'+list.map(function(p){
    var teamDoc = findTeamDoc(p.team);
    var bolge = teamDoc ? teamDoc.bolge : null;
    var tone = BOLGE_TONE[bolge] || '#FF7A1F';
    var photo = p.photoUrl ? '<img src="'+esc(p.photoUrl)+'" alt="">' : '<div class="avatar" style="background:'+tone+'">'+esc(initials(p.name))+'</div>';
    return '<a class="player-card card" href="#" data-open-player="'+p.id+'" style="--tone:'+tone+'">'+
      '<div class="pcard-photo">'+photo+
        (bolge?'<span class="bolge-tag">'+esc(bolge)+'</span>':'')+
        (p.captain?'<span class="ptag">KAPTAN</span>':'')+
      '</div>'+
      '<div class="pcard-info">'+
        '<div class="pcard-name">'+esc(p.name)+'</div>'+
        '<div class="pcard-sub">'+esc(playerTeamLabel(p.team))+', '+esc(p.position)+'</div>'+
        '<div class="pcard-stats">'+
          '<div class="pcard-stat"><b>'+p.goals+'</b><span>GOL</span></div>'+
          '<div class="pcard-stat"><b>'+p.assists+'</b><span>ASİST</span></div>'+
        '</div>'+
      '</div>'+
    '</a>';
  }).join('')+'</div>';
}
function renderDetail(){
  var body = document.getElementById('detayBody');
  var p = S.players && S.selectedPlayer ? S.players[S.selectedPlayer] : null;
  if (!p){ body.innerHTML = '<div class="card empty"><strong>Oyuncu bulunamadı</strong></div>'; return; }
  var teamDoc = findTeamDoc(p.team);
  var bolge = teamDoc ? teamDoc.bolge : null;
  var tone = BOLGE_TONE[bolge] || '#FF7A1F';
  var photo = p.photoUrl ? '<img src="'+esc(p.photoUrl)+'" alt="">' : '<div class="avatar" style="background:'+tone+'">'+esc(initials(p.name))+'</div>';
  var badges = [];
  if (p.goals >= 5) badges.push('<span class="badge">Golcü</span>');
  if (p.assists >= 4) badges.push('<span class="badge">Asist Kralı</span>');
  body.innerHTML =
    '<div class="detail-head">'+
      '<div class="dcard-photo" style="--tone:'+tone+'">'+photo+
        (bolge?'<span class="bolge-tag">'+esc(bolge)+'</span>':'')+
        (p.captain?'<span class="ptag">KAPTAN</span>':'')+
      '</div>'+
      '<div class="dname">'+esc(p.name)+'</div>'+
      '<div class="dsub">'+esc(playerTeamLabel(p.team))+', '+esc(p.position)+'</div>'+
      '<div class="detail-badges"><span class="badge">'+esc(p.yaka)+'</span>'+badges.join('')+'</div>'+
    '</div>'+
    '<div class="stat-grid">'+
      '<div class="stat-tile card"><b>'+p.goals+'</b><span>Gol</span></div>'+
      '<div class="stat-tile card"><b>'+p.assists+'</b><span>Asist</span></div>'+
      '<div class="stat-tile card"><b>'+(p.goals+p.assists)+'</b><span>Katkı (G+A)</span></div>'+
    '</div>'+
    '<div class="section-label">Takım</div>'+
    '<div class="card" style="padding:13px;margin-bottom:4px" data-open-team="'+teamIdOf(p)+'"><div class="pname">'+esc(playerTeamLabel(p.team))+'</div>'+
    '<div class="psub">'+esc((findTeamDoc(p.team)||{}).tag||'')+'</div></div>';
}

/* ---------- Rapor ---------- */
function barRowHtml(label, count, total, color){
  var pct = total>0 ? Math.round((count/total)*100) : 0;
  return '<div class="rpt-bar-row">'+
    '<div class="rpt-bar-label">'+esc(label)+'</div>'+
    '<div class="rpt-bar-track"><div class="rpt-bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'+
    '<div class="rpt-bar-count">'+count+'</div>'+
  '</div>';
}
function renderRapor(){
  var body = document.getElementById('raporBody');
  if (!S.isAdmin){
    body.innerHTML = '<div class="card empty"><strong>Bu bölüm yönetim girişi gerektirir</strong>Üstteki oturum menüsünden çıkış yapıp yönetim şifresiyle tekrar gir.</div>';
    return;
  }
  if (!S.teams || !S.players || !S.matches){
    body.innerHTML = SKEL;
    return;
  }
  var players = Object.keys(S.players).map(function(id){ return Object.assign({id:id}, S.players[id]); });
  var totalPlayers = players.length;
  var totalTeams = Object.keys(S.teams).length;
  var totalMatches = Object.keys(S.matches).length;
  var playedMatches = Object.keys(S.matches).filter(function(id){ return S.matches[id].status==='BİTTİ'; }).length;
  var totalGoals = players.reduce(function(sum,p){ return sum + (p.goals||0); }, 0);
  var totalAssists = players.reduce(function(sum,p){ return sum + (p.assists||0); }, 0);
  var avgPerTeam = totalTeams>0 ? (totalPlayers/totalTeams).toFixed(1) : '0';

  var statsHtml = '<div class="rpt-grid">'+
    '<div class="stat-tile card"><b>'+totalPlayers+'</b><span>KATILIMCI</span></div>'+
    '<div class="stat-tile card"><b>'+totalTeams+'</b><span>TAKIM</span></div>'+
    '<div class="stat-tile card"><b>'+playedMatches+'/'+totalMatches+'</b><span>OYNANAN MAÇ</span></div>'+
    '<div class="stat-tile card"><b>'+totalGoals+'</b><span>TOPLAM GOL</span></div>'+
    '<div class="stat-tile card"><b>'+totalAssists+'</b><span>TOPLAM ASİST</span></div>'+
    '<div class="stat-tile card"><b>'+avgPerTeam+'</b><span>TAKIM BAŞINA ORT.</span></div>'+
  '</div>';

  var bolgeCounts = {};
  BOLGELER.forEach(function(b){ bolgeCounts[b] = 0; });
  players.forEach(function(p){
    var t = findTeamDoc(p.team);
    if (t && bolgeCounts.hasOwnProperty(t.bolge)) bolgeCounts[t.bolge]++;
  });
  var bolgeHtml = '<div class="rpt-block"><div class="section-label">BÖLGE BAZLI KATILIM</div>'+
    BOLGELER.map(function(b){ return barRowHtml(b, bolgeCounts[b], totalPlayers, BOLGE_TONE[b]); }).join('')+
  '</div>';

  var yakaCounts = {'Mavi Yaka':0, 'Beyaz Yaka':0};
  players.forEach(function(p){ if (yakaCounts.hasOwnProperty(p.yaka)) yakaCounts[p.yaka]++; });
  var yakaHtml = '<div class="rpt-block"><div class="section-label">YAKA BAZLI KATILIM</div>'+
    Object.keys(yakaCounts).map(function(y){ return barRowHtml(y, yakaCounts[y], totalPlayers, 'var(--accent)'); }).join('')+
  '</div>';

  var depCounts = {};
  players.forEach(function(p){
    var d = (p.departman && p.departman.trim()) ? p.departman.trim() : 'Belirtilmedi';
    depCounts[d] = (depCounts[d]||0) + 1;
  });
  var depKeys = Object.keys(depCounts).sort(function(a,b){ return depCounts[b]-depCounts[a]; });
  var depHtml = '<div class="rpt-block"><div class="section-label">DEPARTMAN BAZLI KATILIM</div>'+
    depKeys.map(function(d){ return barRowHtml(d, depCounts[d], totalPlayers, 'var(--accent-2)'); }).join('')+
    (depCounts['Belirtilmedi'] ? '<div class="rpt-note">"Belirtilmedi" - Yönetim panelinden oyuncuların departman bilgisini doldurdukça bu grup küçülür.</div>' : '')+
  '</div>';

  var exportHtml = '<div class="rpt-export"><button class="save-btn" data-export-csv="1">CSV olarak indir</button></div>';

  body.innerHTML = statsHtml + bolgeHtml + yakaHtml + depHtml + exportHtml;
}

/* ---------- Admin ---------- */
function renderAdmin(){
  var body = document.getElementById('adminBody');
  if (!S.isAdmin){
    body.innerHTML = '<div class="card empty"><strong>Bu bölüm yönetim girişi gerektirir</strong>Üstteki oturum menüsünden çıkış yapıp yönetim şifresiyle tekrar gir.</div>';
    return;
  }
  if (body.contains(document.activeElement) && document.activeElement.tagName !== 'BODY') return;
  if (!S.matches || !S.players || !S.teams || !S.news){
    body.innerHTML = SKEL;
    return;
  }
  var warn = '<div class="security-note">Bu panel yönetim şifresiyle korunuyor; şifreyi bilen linke sahip herkes buraya girebilir. Gerçek bir yetkilendirme sistemi değil, kullanım kolaylığı sağlayan bir ekrandır.</div>';

  var teamIds = Object.keys(S.teams).sort(function(a,b){ return S.teams[a].name.localeCompare(S.teams[b].name,'tr'); });
  var teamListRows = teamIds.map(function(id){
    var t = S.teams[id];
    return '<div class="team-row card" data-team-row="'+id+'">'+
      '<div class="tphoto">'+(t.photoUrl?'<img src="'+esc(t.photoUrl)+'" alt="">':'Logo')+'</div>'+
      '<div class="fields">'+
        '<div class="tname2">'+esc(t.name)+'</div>'+
        '<div class="tmeta">'+esc(t.bolge)+'</div>'+
        '<div class="tmeta">'+esc(t.tag||'')+'</div>'+
        '<div class="tmeta">Şifre: '+esc(t.password||'')+'</div>'+
      '</div>'+
      '<label class="color-pick" title="Takım rengi"><input type="color" id="tcolor-'+id+'" value="'+esc(t.color||'#ff6a1a')+'" aria-label="'+esc(t.name)+' rengi"></label>'+
      '<button class="save-btn" data-save-tcolor="'+id+'">Rengi kaydet</button>'+
      '<label class="upload-btn">Logo<input type="file" accept="image/*" data-upload-team="'+id+'" hidden></label>'+
      '<button class="danger-btn" data-delete-team="'+id+'">Sil</button>'+
    '</div>';
  }).join('');

  var createTeamForm = '<div class="admin-form card">'+
    '<input type="text" id="newTeamName" placeholder="Takım adı">'+
    '<input type="text" id="newTeamTag" placeholder="Departman karması (örn. Saha Ekipleri + İK)" style="width:260px">'+
    '<select id="newTeamBolge" aria-label="Bölge">'+BOLGELER.map(function(b){ return '<option value="'+b+'">'+b+'</option>'; }).join('')+'</select>'+
    '<input type="text" id="newTeamPass" placeholder="Şifre" style="width:110px">'+
    '<label class="color-pick" title="Takım rengi"><input type="color" id="newTeamColor" value="#ff6a1a" aria-label="Takım rengi"></label>'+
    '<button class="save-btn" data-create-team="1">Takım Oluştur</button>'+
  '</div>';

  var createMatchForm = adminMatchForm(teamIds);
  var importBlock = adminImportBlock();
  var matchRows = Object.keys(S.matches).map(function(id){
    var m = S.matches[id];
    return '<div class="admin-row card" data-match-row="'+id+'">'+
      '<div class="fields">'+
        '<div class="mnames">'+esc(teamName(m.home))+' - '+esc(teamName(m.away))+'</div>'+
        '<input type="number" min="0" id="hs-'+id+'" value="'+(m.homeScore==null?'':m.homeScore)+'" placeholder="Ev" aria-label="'+esc(teamName(m.home))+' skoru">'+
        '<input type="number" min="0" id="as-'+id+'" value="'+(m.awayScore==null?'':m.awayScore)+'" placeholder="Dep" aria-label="'+esc(teamName(m.away))+' skoru">'+
        '<select id="st-'+id+'" aria-label="Durum">'+
          ['YAKINDA','CANLI','BİTTİ'].map(function(s){ return '<option value="'+s+'"'+(m.status===s?' selected':'')+'>'+s+'</option>'; }).join('')+
        '</select>'+
        '<input type="text" id="info-'+id+'" value="'+esc(m.info||'')+'" placeholder="dakika / saat">'+
      '</div>'+
      '<div class="row-actions"><button class="save-btn" data-save-match="'+id+'">Kaydet</button><button class="danger-btn" data-delete-match="'+id+'">Sil</button></div>'+
    '</div>';
  }).join('');

  var playerRows = Object.keys(S.players).map(function(id){
    var p = S.players[id];
    return '<div class="player-row card" data-player-row="'+id+'">'+
      '<div class="pphoto">'+(p.photoUrl?'<img src="'+esc(p.photoUrl)+'" alt="">':'')+'</div>'+
      '<div class="pminfo">'+esc(p.name)+'</div>'+
      '<label>Takım <input type="text" id="team-'+id+'" value="'+esc(playerTeamLabel(p.team))+'" style="width:150px"></label>'+
      '<label>Departman <input type="text" id="dep-'+id+'" value="'+esc(p.departman||'')+'" style="width:120px"></label>'+
      '<label>Gol <input type="number" min="0" id="g-'+id+'" value="'+p.goals+'" style="width:52px"></label>'+
      '<label>Asist <input type="number" min="0" id="a-'+id+'" value="'+p.assists+'" style="width:52px"></label>'+
      '<label><input type="checkbox" id="c-'+id+'"'+(p.captain?' checked':'')+'> Kaptan</label>'+
      '<label class="upload-btn">Foto<input type="file" accept="image/*" data-upload-player="'+id+'" hidden></label>'+
      '<button class="save-btn" data-save-player="'+id+'">Kaydet</button>'+
    '</div>';
  }).join('');

  var createPlayerForm = '<div class="admin-form card">'+
    '<input type="text" id="newPlayerName" placeholder="Ad Soyad">'+
    '<input type="text" id="newPlayerTeam" placeholder="Takım adı" style="width:150px">'+
    '<input type="text" id="newPlayerPosition" placeholder="Pozisyon (Forvet, Kaleci...)" style="width:190px">'+
    '<input type="text" id="newPlayerDepartman" placeholder="Departman (İK, Satış, Teknik...)" style="width:190px">'+
    '<select id="newPlayerYaka" aria-label="Yaka"><option value="Mavi Yaka">Mavi Yaka</option><option value="Beyaz Yaka">Beyaz Yaka</option></select>'+
    '<label><input type="checkbox" id="newPlayerCaptain"> Kaptan</label>'+
    '<button class="save-btn" data-create-player="1">Oyuncu Ekle</button>'+
  '</div>';

  var newsIds = Object.keys(S.news).sort(function(a,b){ return (S.news[b].createdAt||0)-(S.news[a].createdAt||0); });
  var newsRows = newsIds.map(function(id){
    var n = S.news[id];
    return '<div class="news-row card" data-news-row="'+id+'">'+
      '<div class="nphoto">'+(n.photoUrl?'<img src="'+esc(n.photoUrl)+'" alt="">':'')+'</div>'+
      '<div class="fields2">'+
        '<input type="text" id="ntitle-'+id+'" value="'+esc(n.title)+'" placeholder="Başlık">'+
        '<textarea id="nbody-'+id+'" placeholder="Haber metni">'+esc(n.body)+'</textarea>'+
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+
          '<input type="text" id="ntag-'+id+'" value="'+esc(n.tag||'')+'" placeholder="Etiket (Duyuru, Transfer...)" style="width:160px">'+
          '<label><input type="checkbox" id="nfeat-'+id+'"'+(n.featured?' checked':'')+'> Öne çıkan</label>'+
        '</div>'+
      '</div>'+
      '<div class="actions">'+
        '<label class="upload-btn">Foto<input type="file" accept="image/*" data-upload-news="'+id+'" hidden></label>'+
        '<button class="save-btn" data-save-news="'+id+'">Kaydet</button>'+
        '<button class="danger-btn" data-delete-news="'+id+'">Sil</button>'+
      '</div>'+
    '</div>';
  }).join('');

  var createNewsForm = '<div class="admin-form card">'+
    '<input type="text" id="newNewsTitle" placeholder="Başlık" style="flex:1 1 220px">'+
    '<textarea id="newNewsBody" placeholder="Haber metni"></textarea>'+
    '<input type="text" id="newNewsTag" placeholder="Etiket (Duyuru, Transfer...)" style="width:180px">'+
    '<label><input type="checkbox" id="newNewsFeatured"> Öne çıkan</label>'+
    '<button class="save-btn" data-create-news="1">Haber Ekle</button>'+
  '</div>';

  body.innerHTML = warn+
    '<div class="admin-block"><div class="section-label">TAKIMLAR</div>'+teamListRows+createTeamForm+'</div>'+
    '<div class="admin-block"><div class="section-label">MAÇ EKLE</div>'+createMatchForm+'</div>'+
    '<div class="admin-block"><div class="section-label">MAÇ SONUÇLARI</div>'+matchRows+'</div>'+
    '<div class="admin-block"><div class="section-label">TOPLU AKTARIM</div>'+importBlock+'</div>'+
    '<div class="admin-block"><div class="section-label">OYUNCU İSTATİSTİKLERİ</div>'+playerRows+'</div>'+
    '<div class="admin-block"><div class="section-label">OYUNCU EKLE</div>'+createPlayerForm+'</div>'+
    '<div class="admin-block"><div class="section-label">HABERLER</div>'+newsRows+createNewsForm+'</div>';
}
document.addEventListener('click', function(e){
  var saveMatch = e.target.closest('[data-save-match]');
  if (saveMatch && window.__db && S.isAdmin){
    var id = saveMatch.getAttribute('data-save-match');
    var hs = document.getElementById('hs-'+id).value;
    var as = document.getElementById('as-'+id).value;
    var status = document.getElementById('st-'+id).value;
    var info = document.getElementById('info-'+id).value;
    window.__db.collection('matches').doc(id).update({
      homeScore: hs==='' ? null : Number(hs),
      awayScore: as==='' ? null : Number(as),
      status: status,
      info: info || null
    }).then(function(){ flash(saveMatch); }).catch(function(){});
  }
  var savePlayer = e.target.closest('[data-save-player]');
  if (savePlayer && window.__db && S.isAdmin){
    var pid = savePlayer.getAttribute('data-save-player');
    window.__db.collection('players').doc(pid).update({
      goals: Number(document.getElementById('g-'+pid).value || 0),
      assists: Number(document.getElementById('a-'+pid).value || 0),
      captain: document.getElementById('c-'+pid).checked,
      team: document.getElementById('team-'+pid).value.trim(),
      departman: document.getElementById('dep-'+pid).value.trim()
    }).then(function(){ flash(savePlayer); }).catch(function(){});
  }
  var createTeam = e.target.closest('[data-create-team]');
  if (createTeam && window.__db && S.isAdmin){
    var tn = document.getElementById('newTeamName').value.trim();
    var tg = document.getElementById('newTeamTag').value.trim();
    var tb = document.getElementById('newTeamBolge').value;
    var tp = document.getElementById('newTeamPass').value.trim();
    if (!tn || !tp){ flash(createTeam, 'Ad ve şifre gerekli'); return; }
    window.__db.collection('teams').add({ name: tn, tag: tg, bolge: tb, password: tp, color: (document.getElementById('newTeamColor')||{}).value || '' }).then(function(){
      document.getElementById('newTeamName').value = '';
      document.getElementById('newTeamTag').value = '';
      document.getElementById('newTeamPass').value = '';
      flash(createTeam);
      if (document.activeElement) document.activeElement.blur();
      renderAdmin();
    }).catch(function(){ flash(createTeam, 'Hata, tekrar dene'); });
  }
  var createPlayer = e.target.closest('[data-create-player]');
  if (createPlayer && window.__db && S.isAdmin){
    var pn = document.getElementById('newPlayerName').value.trim();
    var pteam = document.getElementById('newPlayerTeam').value.trim();
    var ppos = document.getElementById('newPlayerPosition').value.trim();
    var pdep = document.getElementById('newPlayerDepartman').value.trim();
    var pyaka = document.getElementById('newPlayerYaka').value;
    var pcap = document.getElementById('newPlayerCaptain').checked;
    if (!pn || !pteam){ flash(createPlayer, 'Ad ve takım gerekli'); return; }
    window.__db.collection('players').add({ name: pn, team: pteam, position: ppos || '-', departman: pdep || '', yaka: pyaka, goals: 0, assists: 0, captain: pcap }).then(function(){
      document.getElementById('newPlayerName').value = '';
      document.getElementById('newPlayerTeam').value = '';
      document.getElementById('newPlayerPosition').value = '';
      document.getElementById('newPlayerDepartman').value = '';
      document.getElementById('newPlayerCaptain').checked = false;
      flash(createPlayer);
      if (document.activeElement) document.activeElement.blur();
      renderAdmin();
    }).catch(function(){ flash(createPlayer, 'Hata, tekrar dene'); });
  }
  var deleteTeam = e.target.closest('[data-delete-team]');
  if (deleteTeam && window.__db && S.isAdmin){
    var tid2 = deleteTeam.getAttribute('data-delete-team');
    if (deleteTeam.dataset.armed === '1'){
      window.__db.collection('teams').doc(tid2).delete().then(function(){
        if (document.activeElement) document.activeElement.blur();
        renderAdmin();
      }).catch(function(){ flash(deleteTeam, 'Hata, tekrar dene'); });
    } else {
      deleteTeam.dataset.armed = '1';
      var oldTxt = deleteTeam.textContent;
      deleteTeam.textContent = 'Emin misin? Tekrar tıkla';
      setTimeout(function(){
        if (deleteTeam.dataset.armed === '1'){
          deleteTeam.dataset.armed = '0';
          deleteTeam.textContent = oldTxt;
        }
      }, 4000);
    }
  }
  var saveNews = e.target.closest('[data-save-news]');
  if (saveNews && window.__db && S.isAdmin){
    var nid = saveNews.getAttribute('data-save-news');
    window.__db.collection('news').doc(nid).update({
      title: document.getElementById('ntitle-'+nid).value.trim(),
      body: document.getElementById('nbody-'+nid).value.trim(),
      tag: document.getElementById('ntag-'+nid).value.trim(),
      featured: document.getElementById('nfeat-'+nid).checked
    }).then(function(){ flash(saveNews); }).catch(function(){ flash(saveNews, 'Hata, tekrar dene'); });
  }
  var createNews = e.target.closest('[data-create-news]');
  if (createNews && window.__db && S.isAdmin){
    var ntitle = document.getElementById('newNewsTitle').value.trim();
    var nbody = document.getElementById('newNewsBody').value.trim();
    var ntag = document.getElementById('newNewsTag').value.trim();
    var nfeat = document.getElementById('newNewsFeatured').checked;
    if (!ntitle || !nbody){ flash(createNews, 'Başlık ve metin gerekli'); return; }
    window.__db.collection('news').add({ title: ntitle, body: nbody, tag: ntag, featured: nfeat, createdAt: Date.now() }).then(function(){
      document.getElementById('newNewsTitle').value = '';
      document.getElementById('newNewsBody').value = '';
      document.getElementById('newNewsTag').value = '';
      document.getElementById('newNewsFeatured').checked = false;
      flash(createNews);
      if (document.activeElement) document.activeElement.blur();
      renderAdmin();
    }).catch(function(){ flash(createNews, 'Hata, tekrar dene'); });
  }
  var deleteNews = e.target.closest('[data-delete-news]');
  if (deleteNews && window.__db && S.isAdmin){
    var nid2 = deleteNews.getAttribute('data-delete-news');
    if (deleteNews.dataset.armed === '1'){
      window.__db.collection('news').doc(nid2).delete().then(function(){
        if (document.activeElement) document.activeElement.blur();
        renderAdmin();
      }).catch(function(){ flash(deleteNews, 'Hata, tekrar dene'); });
    } else {
      deleteNews.dataset.armed = '1';
      var oldTxt2 = deleteNews.textContent;
      deleteNews.textContent = 'Emin misin? Tekrar tıkla';
      setTimeout(function(){
        if (deleteNews.dataset.armed === '1'){
          deleteNews.dataset.armed = '0';
          deleteNews.textContent = oldTxt2;
        }
      }, 4000);
    }
  }
  var exportCsv = e.target.closest('[data-export-csv]');
  if (exportCsv && S.isAdmin){
    (async function(){
      var downloads = {save:function(o){ var b = new Blob([o.data], {type:'text/csv;charset=utf-8'}); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = o.filename; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); return Promise.resolve(); }};
      var rows = [['Ad Soyad','Takım','Bölge','Yaka','Departman','Gol','Asist']];
      Object.keys(S.players).forEach(function(id){
        var p = S.players[id];
        var t = findTeamDoc(p.team);
        rows.push([p.name, playerTeamLabel(p.team), t?t.bolge:'', p.yaka||'', (p.departman&&p.departman.trim())||'Belirtilmedi', p.goals||0, p.assists||0]);
      });
      var csv = '﻿' + rows.map(function(r){
        return r.map(function(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }).join(',');
      }).join('\r\n');
      downloads.save({ filename: 'katilim-raporu.csv', data: csv }).then(function(){ flash(exportCsv, 'İndirildi'); }).catch(function(){ flash(exportCsv, 'Hata, tekrar dene'); });
    })();
  }
});
document.addEventListener('change', function(e){
  var tf = e.target.closest('[data-upload-team]');
  if (tf && S.isAdmin){
    var tid = tf.getAttribute('data-upload-team');
    var file = tf.files && tf.files[0];
    if (!file || !window.__assets || !window.__db) return;
    tf.disabled = true;
    window.__assets.upload(file).then(function(res){
      return window.__db.collection('teams').doc(tid).update({ photoUrl: res.url });
    }).then(function(){
      if (document.activeElement) document.activeElement.blur();
      renderAdmin();
    }).catch(function(){ tf.disabled = false; });
    return;
  }
  var pf = e.target.closest('[data-upload-player]');
  if (pf && S.isAdmin){
    var pid = pf.getAttribute('data-upload-player');
    var file2 = pf.files && pf.files[0];
    if (!file2 || !window.__assets || !window.__db) return;
    pf.disabled = true;
    window.__assets.upload(file2).then(function(res){
      return window.__db.collection('players').doc(pid).update({ photoUrl: res.url });
    }).then(function(){
      if (document.activeElement) document.activeElement.blur();
      renderAdmin();
    }).catch(function(){ pf.disabled = false; });
    return;
  }
  var nf = e.target.closest('[data-upload-news]');
  if (nf && S.isAdmin){
    var nid3 = nf.getAttribute('data-upload-news');
    var file3 = nf.files && nf.files[0];
    if (!file3 || !window.__assets || !window.__db) return;
    nf.disabled = true;
    window.__assets.upload(file3).then(function(res){
      return window.__db.collection('news').doc(nid3).update({ photoUrl: res.url });
    }).then(function(){
      if (document.activeElement) document.activeElement.blur();
      renderAdmin();
    }).catch(function(){ nf.disabled = false; });
  }
});
function flash(btn, msg){
  var old = btn.textContent;
  btn.textContent = msg || 'Kaydedildi';
  setTimeout(function(){ btn.textContent = old; }, 1400);
}

/* ---------- boot ---------- */
var hadSession = false;

/* ---------- server connection (Vercel API + KV) ---------- */
var syncTimer = null, syncVer = -1, syncBusy = false, syncAgain = false;
var listeners = {teams:[], matches:[], players:[], news:[]};

function apiFetch(path, opt){
  opt = opt || {};
  opt.credentials = 'same-origin';
  if (opt.body && typeof opt.body !== 'string'){
    opt.body = JSON.stringify(opt.body);
    opt.headers = Object.assign({'Content-Type':'application/json'}, opt.headers || {});
  }
  return fetch(path, opt).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){
      if (!r.ok){ var e = new Error(j.error || ('HTTP '+r.status)); e.status = r.status; throw e; }
      return j;
    });
  });
}
function snapOf(map){
  var ids = Object.keys(map || {});
  return {docs: ids.map(function(id){ return {id:id, data:function(){ return map[id]; }}; })};
}
function emit(data){
  ['teams','matches','players','news'].forEach(function(c){
    listeners[c].forEach(function(cb){ cb(snapOf(data[c] || {})); });
  });
}
function sync(force){
  if (!S.loggedIn) return Promise.resolve();
  if (syncBusy){ syncAgain = true; return Promise.resolve(); }
  syncBusy = true;
  return apiFetch('/api/data?v=' + (force ? -1 : syncVer)).then(function(d){
    if (!d.unchanged){ syncVer = d.v; emit(d); }
  }).catch(function(e){
    if (e.status === 401){ logout(); showLoginError('Oturum süresi doldu, tekrar giriş yap.'); }
  }).then(function(){
    syncBusy = false;
    if (syncAgain){ syncAgain = false; return sync(true); }
  });
}
function startSync(){
  stopSync();
  sync(true);
  syncTimer = setInterval(function(){ if (!document.hidden) sync(false); }, 8000);
}
function stopSync(){
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null; syncVer = -1;
}
document.addEventListener('visibilitychange', function(){ if (!document.hidden && S.loggedIn) sync(false); });

function makeDb(){
  function mutate(body){ return apiFetch('/api/mutate', {method:'POST', body:body}); }
  return {
    collection: function(name){
      return {
        add: function(data){ return mutate({op:'add', col:name, data:data}).then(function(r){ return sync(true).then(function(){ return r; }); }); },
        doc: function(id){
          return {
            update: function(data){ return mutate({op:'update', col:name, id:id, data:data}).then(function(){ return sync(true); }); },
            delete: function(){ return mutate({op:'delete', col:name, id:id}).then(function(){ return sync(true); }); }
          };
        }
      };
    }
  };
}
/* photos are shrunk in the browser first, then stored in KV through /api/upload */
function makeAssets(){
  return {
    upload: function(file){
      return new Promise(function(resolve, reject){
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function(){
          var s = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
          var x = c.getContext('2d');
          x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
          x.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', .8));
        };
        img.onerror = function(){ reject(new Error('Görsel okunamadı.')); };
        img.src = url;
      }).then(function(dataUrl){ return apiFetch('/api/upload', {method:'POST', body:{dataUrl:dataUrl}}); });
    }
  };
}

function loadPublicTeams(){
  return apiFetch('/api/teams-public').then(function(list){
    if (S.loggedIn) return;
    var map = {};
    list.forEach(function(t){ map[t.id] = {name: t.name}; });
    S.teams = map;
    renderGate();
  });
}

async function boot(){
  window.__db = makeDb();
  window.__assets = makeAssets();
  listeners.teams.push(function(snap){
    var map = {}; snap.docs.forEach(function(d){ map[d.id] = d.data(); });
    S.teams = map;
    if (!S.loggedIn) renderGate();
    rerenderCurrent();
    if (S.loggedIn) renderSessionBox();
  });
  ['matches','players','news'].forEach(function(name){
    listeners[name].push(function(snap){
      var map = {}; snap.docs.forEach(function(d){ map[d.id] = d.data(); });
      S[name] = map;
      rerenderCurrent();
    });
  });
  try{ await loadPublicTeams(); }
  catch(e){ showLoginError('Sunucuya ulaşılamadı. Sayfayı yenileyip tekrar dene.'); }
  try{
    var me = await apiFetch('/api/session');
    if (me.role){
      S.loggedIn = true; S.isAdmin = (me.role === 'admin'); S.myTeam = me.team || null;
      showApp();
      startSync();
    }
  }catch(e){}
}

/* ---------- login against the server ---------- */
function doLogin(role, team, pass, btn){
  if (role === 'team' && !team){ showLoginError('Önce takımlar yüklensin, birazdan tekrar dene.'); return; }
  if (!pass){ showLoginError(role === 'admin' ? 'Yönetim şifresini gir.' : 'Şifreni gir.'); return; }
  var keep = document.getElementById('rememberMe');
  btn.disabled = true;
  apiFetch('/api/login', {method:'POST', body:{role:role, team:team, password:pass, remember:!!(keep && keep.checked)}}).then(function(r){
    loginAs(r.role, r.team || null);
    startSync();
  }).catch(function(e){
    showLoginError(e.status === 429 ? 'Çok fazla deneme yaptın, bir dakika sonra tekrar dene.' :
      (e.status === 401 ? (role === 'admin' ? 'Yönetim şifresi hatalı.' : 'Takım adı veya şifre hatalı.') : (e.message || 'Giriş yapılamadı.')));
  }).then(function(){ btn.disabled = false; });
}
document.getElementById('teamLoginBtn').addEventListener('click', function(e){
  doLogin('team', document.getElementById('teamSelect').value, document.getElementById('teamPass').value, e.currentTarget);
});
document.getElementById('adminLoginBtn').addEventListener('click', function(e){
  doLogin('admin', null, document.getElementById('adminPass').value, e.currentTarget);
});
function rerenderCurrent(){
  if (!S.loggedIn) return;
  if (S.view==='tablo') renderTablo();
  if (S.view==='haberler') renderHaberler();
  if (S.view==='haber-detay') renderHaberDetay();
  if (S.view==='fikstur') renderFikstur();
  if (S.view==='bracket') renderBracket();
  if (S.view==='oyuncular') renderPlayerList();
  if (S.view==='detay') renderDetail();
  if (S.view==='rapor') renderRapor();
  if (S.view==='istatistik') renderIstatistik();
  if (S.view==='takim') renderTakim();
  if (S.view==='admin') renderAdmin();
}
setLoginTab('team');
boot();
})();
