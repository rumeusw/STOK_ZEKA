const API = 'http://localhost:8000';

let users = [
  { name: 'Ahmet Kaya', role: 'Yönetici', color: '#1f6feb', icon: '👨‍💼', pwd: '1234' },
  { name: 'Fatma Öz', role: 'Şef Barista', color: '#1d9e75', icon: '👩‍🍳', pwd: '1234' },
  { name: 'Murat Demir', role: 'Stok Sorumlusu', color: '#ba7517', icon: '📦', pwd: '1234' },
  { name: 'Zeynep Ak', role: 'Kasiyer', color: '#8250df', icon: '💳', pwd: '1234' }
];

let currentUser = users[0];
let stokData = [];
let urunler = [];
let tariflerData = {};
let aiAnalysis = null;
let stokChart = null;
let malzemeChart = null;

// ── USER MANAGEMENT ────────────────────────────────
function renderUsers() {
  const list = document.getElementById('userList');
  if(!list) return;
  list.innerHTML = users.map((u, i) => `
    <div class="user-opt ${u.name === currentUser.name ? 'selected' : ''}" 
         onclick="selectUser(this, '${u.name}', '${u.role}', '${u.color}')"
         data-color="${u.color}">
      <div class="uo-icon">${u.icon || '👤'}</div>
      <div class="uo-name">${u.name}</div>
      <div class="uo-role">${u.role}</div>
    </div>
  `).join('');
}

function selectUser(el, name, role, color) {
  document.querySelectorAll('.user-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  currentUser = users.find(u => u.name === name);
}

function showRegister() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('registerPage').style.display = 'flex';
}

function hideRegister() {
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

function doRegister() {
  const name = document.getElementById('regName').value;
  const role = document.getElementById('regRole').value;
  const icon = document.getElementById('regIcon').value;
  const color = document.getElementById('regColor').value;
  const pwd = document.getElementById('regPwd').value || '1234';
  
  if(!name) { alert('Lütfen isim giriniz!'); return; }
  
  users.push({ name, role, icon, color, pwd });
  alert('Kullanıcı başarıyla oluşturuldu! Şifreniz: ' + pwd);
  renderUsers();
  hideRegister();
}

function doLogin() {
  const inputPwd = document.getElementById('loginPwd').value;
  
  if (currentUser && inputPwd === currentUser.pwd) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    initApp();
  } else {
    alert('Hatalı şifre! Lütfen seçtiğiniz kullanıcıya ait şifreyi girin.');
  }
}

function doLogout() {
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

// ── NAVIGATION ────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const page = document.getElementById('page-' + id);
  if(page) page.classList.add('active');
  
  if (window.event && window.event.currentTarget && window.event.currentTarget.classList) {
    window.event.currentTarget.classList.add('active');
  }
  
  if (id === 'malzeme') loadMalzeme();
  if (id === 'tarifler') loadTarifler();
  if (id === 'urunler') loadUretim();
  if (id === 'personel') loadPersonelTable();
  if (id === 'finans') loadFinans();
}

// ── INIT ───────────────────────────────────────────
async function initApp() {
  const el = document.getElementById('avatarEl');
  el.textContent = currentUser.name.split(' ').map(w=>w[0]).join('');
  el.style.background = currentUser.color + '22';
  el.style.color = currentUser.color;
  document.getElementById('userNameEl').textContent = currentUser.name;
  document.getElementById('userRoleEl').textContent = currentUser.role;
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('tr-TR', {weekday:'long',year:'numeric',month:'long',day:'numeric'});

  // ADMIN KONTROLÜ
  const adminMenu = document.getElementById('adminMenu');
  if (currentUser.role === 'Yönetici') {
    adminMenu.style.display = 'block';
  } else {
    adminMenu.style.display = 'none';
  }

  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('satisTarih')) document.getElementById('satisTarih').value = today;
  if(document.getElementById('stokTarih')) document.getElementById('stokTarih').value = today;

  await loadStok();
  await loadUrunSelect();
  renderStokChart();
}

// ── ADMIN ÖZEL ────────────────────────────────────
function loadPersonelTable() {
  const tbody = document.getElementById('personelTable');
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td><span class="badge ${u.role === 'Yönetici' ? 'badge-purple' : 'badge-blue'}">${u.role}</span></td>
      <td><div style="width:12px;height:12px;border-radius:50%;background:${u.color}"></div></td>
      <td><span class="badge badge-green">Aktif</span></td>
      <td>
        ${u.name !== 'Ahmet Kaya' ? `<button class="btn btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteUser(${i})">Sil</button>` : '-'}
      </td>
    </tr>
  `).join('');
}

function deleteUser(idx) {
  if (confirm(users[idx].name + ' personeli silinsin mi?')) {
    users.splice(idx, 1);
    loadPersonelTable();
    renderUsers();
  }
}

function loadFinans() {
  const list = document.getElementById('karAnalizList');
  list.innerHTML = stokData.map(u => {
    const cost = Math.round(Math.random() * 20 + 15);
    const price = Math.round(cost * 2.8);
    return `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:500">${u.urun_adi}</div>
          <div style="font-size:11px;color:var(--text3)">Birim Maliyet: ${cost} TL | Satış: ${price} TL</div>
        </div>
        <div style="text-align:right">
          <div style="color:var(--green);font-weight:600">+${price-cost} TL</div>
          <div style="font-size:10px;color:var(--text3)">Birim Kar</div>
        </div>
      </div>`;
  }).join('');
}

// Sayfa yüklendiğinde kullanıcıları listele
window.onload = () => {
  renderUsers();
};

// ── LOAD STOK ─────────────────────────────────────
async function loadStok() {
  try {
    const r = await fetch(API + '/stok/mevcut');
    const d = await r.json();
    stokData = d.urunler;
    const oz = d.ozet;
    document.getElementById('mToplam').textContent = oz.toplam;
    document.getElementById('mKritik').textContent = oz.kritik;
    document.getElementById('mDusuk').textContent = oz.dusuk;
    document.getElementById('mYeterli').textContent = oz.yeterli;
    document.getElementById('kritikBadge').textContent = oz.kritik;
    document.getElementById('uyariBadge').textContent = oz.kritik + ' ürün';
    renderStokTable(stokData);
    renderUyariler(stokData.filter(u => u.durum === 'Kritik'));
  } catch(e) {
    useDemoData();
  }
}

function useDemoData() {
  const demo = [
    {urun_id:'P001',urun_adi:'Çay',mevcut_stok:28,kritik_esik:50,durum:'Kritik',Tedarikci_Adi:'Kahve Pazarı',Tedarik_Suresi_Gun:3},
    {urun_id:'P002',urun_adi:'Türk Kahvesi',mevcut_stok:65,kritik_esik:30,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı',Tedarik_Suresi_Gun:1},
    {urun_id:'P003',urun_adi:'Latte',mevcut_stok:18,kritik_esik:25,durum:'Kritik',Tedarikci_Adi:'Kahve Pazarı',Tedarik_Suresi_Gun:1},
    {urun_id:'P004',urun_adi:'Ice Latte',mevcut_stok:35,kritik_esik:20,durum:'Yeterli',Tedarikci_Adi:'Yerel Dağıtım',Tedarik_Suresi_Gun:2},
    {urun_id:'P005',urun_adi:'Americano',mevcut_stok:42,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı',Tedarik_Suresi_Gun:1},
    {urun_id:'P006',urun_adi:'Cappuccino',mevcut_stok:22,kritik_esik:20,durum:'Düşük',Tedarikci_Adi:'Kahve Pazarı',Tedarik_Suresi_Gun:1},
    {urun_id:'P007',urun_adi:'Limonata',mevcut_stok:12,kritik_esik:20,durum:'Kritik',Tedarikci_Adi:'Yerel Dağıtım',Tedarik_Suresi_Gun:2},
    {urun_id:'P008',urun_adi:'Kruvasan',mevcut_stok:55,kritik_esik:30,durum:'Yeterli',Tedarikci_Adi:'Tatlı Ltd.',Tedarik_Suresi_Gun:1},
    {urun_id:'P009',urun_adi:'Tiramisu',mevcut_stok:8,kritik_esik:15,durum:'Kritik',Tedarikci_Adi:'Tatlı Ltd.',Tedarik_Suresi_Gun:2},
    {urun_id:'P010',urun_adi:'Mocha',mevcut_stok:38,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı',Tedarik_Suresi_Gun:1},
  ];
  stokData = demo;
  urunler = demo;
  const kritikSay = demo.filter(u=>u.durum==='Kritik').length;
  const dusukSay = demo.filter(u=>u.durum==='Düşük').length;
  const yeterliSay = demo.filter(u=>u.durum==='Yeterli').length;
  document.getElementById('mToplam').textContent = demo.length;
  document.getElementById('mKritik').textContent = kritikSay;
  document.getElementById('mDusuk').textContent = dusukSay;
  document.getElementById('mYeterli').textContent = yeterliSay;
  document.getElementById('kritikBadge').textContent = kritikSay;
  document.getElementById('uyariBadge').textContent = kritikSay + ' ürün';
  renderStokTable(stokData);
  renderUyariler(stokData.filter(u=>u.durum==='Kritik'));
  populateSelects(demo);
}

function renderUyariler(kritikler) {
  const el = document.getElementById('uyariListesi');
  if (!kritikler.length) { el.innerHTML = '<div class="alert alert-ok"><div class="alert-icon">✅</div><div class="alert-body"><div class="alert-title">Tüm stoklar yeterli</div></div></div>'; return; }
  el.innerHTML = kritikler.map(u => `
    <div class="alert alert-critical">
      <div class="alert-icon">🔴</div>
      <div class="alert-body">
        <div class="alert-title" style="color:var(--red)">${u.urun_adi}</div>
        <div class="alert-desc">Mevcut: <strong>${u.mevcut_stok}</strong> | Kritik eşik: ${u.kritik_esik} | Tedarik: ${u.Tedarik_Suresi_Gun || '?'} gün</div>
      </div>
    </div>
  `).join('');
}

function renderStokTable(data) {
  const tbody = document.getElementById('stokTable');
  if(!tbody) return;
  tbody.innerHTML = data.map(u => {
    const pct = Math.min(100, Math.round((u.mevcut_stok / (u.kritik_esik * 3)) * 100));
    const col = u.durum === 'Kritik' ? 'var(--red)' : u.durum === 'Düşük' ? 'var(--amber)' : 'var(--green)';
    const badge = u.durum === 'Kritik' ? 'badge-red' : u.durum === 'Düşük' ? 'badge-amber' : 'badge-green';
    return `<tr>
      <td style="font-weight:500">${u.urun_adi}</td>
      <td><strong>${u.mevcut_stok}</strong></td>
      <td>${u.kritik_esik}</td>
      <td style="min-width:100px">
        <div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${col}"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${pct}%</div>
      </td>
      <td><span class="badge ${badge}">${u.durum}</span></td>
      <td style="color:var(--text2)">${u.Tedarikci_Adi || '-'}</td>
      <td style="color:var(--text3)">${u.Tedarik_Suresi_Gun || '-'} gün</td>
    </tr>`;
  }).join('');
}

function filterStok(q) {
  const filtered = stokData.filter(u => u.urun_adi.toLowerCase().includes(q.toLowerCase()));
  renderStokTable(filtered);
}

function renderStokChart() {
  if (!stokData.length) return;
  const kritik = stokData.filter(u=>u.durum==='Kritik').length;
  const dusuk = stokData.filter(u=>u.durum==='Düşük').length;
  const yeterli = stokData.filter(u=>u.durum==='Yeterli').length;
  const ctx = document.getElementById('stokChart');
  if(!ctx) return;
  if (stokChart) stokChart.destroy();
  stokChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Kritik','Düşük','Yeterli'],
      datasets: [{ data: [kritik, dusuk, yeterli], backgroundColor: ['#f85149','#e3b341','#3fb950'], borderWidth: 2, borderColor: '#161b22', hoverOffset: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b949e', font: { size: 12 }, padding: 16 } } }
    }
  });
}

// ── AI ANALİZ UPGRADE ─────────────────────────────
async function typeWriter(text, elementId, speed = 15) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = '';
  let i = 0;
  return new Promise(resolve => {
    function type() {
      if (i < text.length) {
        el.innerHTML += text.charAt(i);
        i++;
        setTimeout(type, speed);
      } else {
        el.innerHTML += '<span class="typing-cursor"></span>';
        resolve();
      }
    }
    type();
  });
}

function renderClaudeResult(d) {
  const mainEl = document.getElementById('aiOutputMain');
  const ozEl = document.getElementById('aiOzet');
  if(!mainEl || !ozEl) return;
  
  ozEl.innerHTML = `<span style="color:#38bdf8">✨ AI:</span> ${d.ozet}`;

  const risks = (d.acil_siparisler || []).map(s => `• ${s.urun}: ${s.neden}`).join('<br>');
  const actions = (d.aylik_tedarik || []).slice(0,3).map(t => `• ${t.malzeme} tedariği planla.`).join('<br>');

  mainEl.innerHTML = `
    <div id="aiMainText" style="margin-bottom:20px; font-weight:600; font-size:15px; color:#e0f2fe; line-height:1.7;">
      ${d.ozet}
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
      <div class="ai-insight-card" style="border-color: var(--red); background: rgba(248,81,73,0.03);">
        <div class="ai-insight-label">🚨 Kritik Riskler</div>
        <div id="aiRisks" style="font-size:13px; color:var(--text2); font-weight:500;">
          ${risks || 'Kritik bir risk saptanmadı.'}
        </div>
      </div>
      <div class="ai-insight-card" style="border-color: var(--green); background: rgba(63,185,80,0.03);">
        <div class="ai-insight-label">💡 Stratejik Öneriler</div>
        <div id="aiActions" style="font-size:13px; color:var(--text2); font-weight:500;">
          ${actions || 'Mevcut plan stabil görünüyor.'}
        </div>
      </div>
    </div>
  `;

  renderSiparisCards(d);
}

async function runAI() {
  const mainEl = document.getElementById('aiOutputMain');
  if(!mainEl) return;
  mainEl.innerHTML = `
    <div class="ai-loading-wrap">
      <div class="ai-spinner"></div>
      <div style="color:#38bdf8; font-weight:600; letter-spacing:1px; margin-top:10px;">CLAUDE AI ANALİZ MOTORU ÇALIŞIYOR...</div>
    </div>
  `;

  setTimeout(async () => {
    try {
      const r = await fetch(API + '/ai/analiz');
      const d = await r.json();
      renderClaudeResult(d);
    } catch(e) {
      const demo = {
        ozet: "Mevcut veriler soğuk içecek grubunda %25 talep artışı öngörüyor. Stok seviyeleri kritik eşik sınırında seyrediyor. Lojistik optimizasyonu için toplu hammadde alımı önerilir.",
        acil_siparisler: [
          {urun: "Ice Latte", miktar: 150, neden: "Hava sıcaklığı artışı kaynaklı talep patlaması."},
          {urun: "Limonata", miktar: 100, neden: "Kritik stok seviyesinin %30 altında."}
        ],
        aylik_tedarik: [{malzeme: "Süt", miktar: 500, birim: "L"}, {malzeme: "Kahve", miktar: 50, birim: "kg"}]
      };
      renderClaudeResult(demo);
    }
  }, 1200);
}

// ── TAHMİN ────────────────────────────────────────
async function runTahmin() {
  const grid = document.getElementById('tahminGrid');
  if(!grid) return;
  grid.innerHTML = '<div style="color:var(--text3)"><span class="pulse"></span> Hesaplanıyor...</div>';
  
  if (aiAnalysis && aiAnalysis.haftalik_tahmin) {
    renderTahminGrid(aiAnalysis.haftalik_tahmin);
    return;
  }

  try {
    const r = await fetch(API + '/ai/analiz');
    const d = await r.json();
    if(d.haftalik_tahmin) {
        renderTahminGrid(d.haftalik_tahmin);
        computeMalzemeHafta(d.haftalik_tahmin);
    } else {
        renderDemoTahmin();
    }
  } catch(e) {
    renderDemoTahmin();
  }
}

function renderTahminGrid(tahminler) {
  const el = document.getElementById('tahminGrid');
  if (!el) return;
  if (!tahminler || !tahminler.length) { el.innerHTML = '<div style="color:var(--text3)">Veri yok</div>'; return; }
  el.innerHTML = tahminler.map(t => {
    const urun = t.urun || t.urun_adi;
    const satis = t.tahmini_satis || t.haftalik || 0;
    const gunluk = t.gunluk_ortalama || t.gunluk || Math.round(satis/7);
    const trend = t.trend || 'stabil';
    const tc = trend==='artiyor'?'trend-up':trend==='azaliyor'?'trend-down':'trend-stable';
    const ti = trend==='artiyor'?'↑':trend==='azaliyor'?'↓':'→';
    return `<div class="forecast-card">
      <div class="forecast-name">${urun}</div>
      <div class="forecast-val">${satis}</div>
      <div class="forecast-row"><span>Haftalık tahmin</span><span class="${tc}">${ti} ${trend}</span></div>
      <div class="forecast-row"><span>Günlük ort.</span><span>${gunluk}</span></div>
    </div>`;
  }).join('');
}

function computeMalzemeHafta(tahminler) {
  const RECIPE = {
    'Çay': {'Çay Yaprağı (g)': 3, 'Su (ml)': 200},
    'Latte': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 200},
    'Ice Latte': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 180, 'Buz (g)': 80},
    'Americano': {'Espresso Çekirdeği (g)': 18, 'Su (ml)': 180},
    'Cappuccino': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 120},
    'Mocha': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 180, 'Çikolata Sosu (ml)': 20},
    'Türk Kahvesi': {'Türk Kahvesi Tozu (g)': 7, 'Su (ml)': 80},
    'Limonata': {'Limon (adet)': 1.5, 'Şeker (g)': 20, 'Su (ml)': 250},
    'Kruvasan': {'Un (g)': 80},
    'Tiramisu': {'Maskarpone (g)': 50, 'Espresso Çekirdeği (g)': 5},
  };
  const totals = {};
  tahminler.forEach(t => {
    const recipe = RECIPE[t.urun || t.urun_adi] || {};
    const qty = t.haftalik || t.tahmini_satis || 0;
    Object.entries(recipe).forEach(([k,v]) => { totals[k] = (totals[k]||0) + v*qty; });
  });
  renderMalzemeHafta(totals);
}

function renderMalzemeHafta(totals) {
  const el = document.getElementById('malzemeHafta');
  if (!el) return;
  if (!totals || !Object.keys(totals).length) { el.innerHTML = '<div style="color:var(--text3)">Hesaplanamadı</div>'; return; }
  const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,15);
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">`
    + sorted.map(([k,v]) => `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--text2)">${k}</span>
      <span style="font-size:13px;font-weight:600;color:var(--blue)">${Math.round(v).toLocaleString()}</span>
    </div>`).join('') + '</div>';
}

function renderDemoTahmin() {
  const demo = stokData.map(u => ({
    urun: u.urun_adi,
    tahmini_satis: Math.round(Math.random()*300+100),
    gunluk_ortalama: Math.round(Math.random()*40+15),
    trend: ['artiyor','stabil','azaliyor'][Math.floor(Math.random()*3)]
  }));
  renderTahminGrid(demo);
  computeMalzemeHafta(demo.map(d=>({urun:d.urun,haftalik:d.tahmini_satis})));
}

// ── MALZEME TÜKETİMİ ─────────────────────────────
async function loadMalzeme() {
  const gun = document.getElementById('malzemeDon').value;
  try {
    const r = await fetch(`${API}/ai/malzeme-tuketimi?gunler=${gun}`);
    const d = await r.json();
    renderMalzemeChartData(d.malzeme_tuketimi);
    renderAylikTedarikFromData(d.malzeme_tuketimi);
  } catch(e) { renderDemoMalzeme(); }
}

function renderDemoMalzeme() {
  const demo = {
    'Espresso Çekirdeği (g)': 125400, 'Süt (ml)': 892000, 'Su (ml)': 445000,
    'Çay Yaprağı (g)': 38400, 'Şeker (g)': 28500, 'Buz (g)': 185000,
    'Bardak (M)': 4200, 'Bardak (L)': 2800, 'Bardak (S)': 1600,
    'Pipet': 3200, 'Fincan': 1800, 'Un (g)': 48000,
    'Yumurta (adet)': 920, 'Tereyağı (g)': 22000, 'Çikolata (g)': 18500
  };
  renderMalzemeChartData(demo);
  renderAylikTedarikFromData(demo);
}

function renderMalzemeChartData(data) {
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = sorted.map(([k])=>k.length>20?k.slice(0,18)+'..':k);
  const values = sorted.map(([,v])=>Math.round(v));

  const ctx = document.getElementById('malzemeChart');
  if(!ctx) return;
  if (malzemeChart) malzemeChart.destroy();
  malzemeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tüketim',
        data: values,
        backgroundColor: 'rgba(88,166,255,0.6)',
        borderColor: '#58a6ff',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', font:{size:11} }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#e6edf3', font:{size:11} }, grid: { display: false } }
      }
    }
  });

  const tableEl = document.getElementById('malzemeTable');
  if(!tableEl) return;
  const all = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  tableEl.innerHTML = all.map(([k,v]) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="color:var(--text2)">${k}</span>
      <span style="font-weight:500;color:var(--blue)">${Math.round(v).toLocaleString()}</span>
    </div>`).join('');
}

function renderAylikTedarikFromData(data) {
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const el = document.getElementById('aylikTedarik');
  if(!el) return;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">
      ${sorted.map(([k,v]) => `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px 12px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px">${k}</div>
          <div style="font-size:16px;font-weight:600;color:var(--amber)">${Math.round(v*1.2).toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text3)">+%20 güvenlik payı</div>
        </div>`).join('')}
    </div>`;
}

// ── ÜRÜNLER / ÜRETİM ─────────────────────────────
async function loadUretim() {
  const el = document.getElementById('uretimGrid');
  if(!el) return;
  el.innerHTML = stokData.map(u => {
    const maxPor = u.mevcut_stok;
    const pct = Math.min(100, Math.round((u.mevcut_stok / Math.max(u.kritik_esik*3,1))*100));
    const col = u.durum==='Kritik'?'var(--red)':u.durum==='Düşük'?'var(--amber)':'var(--blue)';
    return `<div class="forecast-card">
      <div class="forecast-name">${u.urun_adi}</div>
      <div class="forecast-val" style="color:${col}">${maxPor}</div>
      <div class="forecast-row"><span>Mevcut stok</span><span class="badge ${u.durum==='Kritik'?'badge-red':u.durum==='Düşük'?'badge-amber':'badge-green'}">${u.durum}</span></div>
      <div style="margin-top:6px">
        <div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${col}"></div></div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Kapasite: ${pct}%</div>
      </div>
    </div>`;
  }).join('');
}

// ── TARİFLER ─────────────────────────────────────
async function loadTarifler() {
  const RECIPE_BOOK = {
    "Çay": {"Çay Yaprağı (g)": "3 g", "Su (ml)": "200 ml", "Bardak (S)": "1 adet"},
    "Türk Kahvesi": {"Türk Kahvesi Tozu (g)": "7 g", "Su (ml)": "80 ml", "Fincan": "1 adet"},
    "Latte": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "200 ml", "Bardak (M)": "1 adet"},
    "Ice Latte": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "180 ml", "Buz (g)": "80 g", "Bardak (L)": "1 adet"},
    "Americano": {"Espresso Çekirdeği (g)": "18 g", "Su (ml)": "180 ml", "Bardak (M)": "1 adet"},
    "Cappuccino": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "120 ml", "Bardak (M)": "1 adet"},
    "Limonata": {"Limon (adet)": "1.5 adet", "Şeker (g)": "20 g", "Su (ml)": "250 ml", "Buz (g)": "60 g"},
    "Mocha": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "180 ml", "Çikolata Sosu (ml)": "20 ml"},
    "Kruvasan": {"Kruvasan Hamuru (g)": "80 g", "Tereyağı (g)": "20 g"},
    "Tiramisu": {"Maskarpone (g)": "50 g", "Bisküvi (g)": "30 g", "Espresso Çekirdeği (g)": "5 g"},
    "Brownie": {"Çikolata (g)": "40 g", "Tereyağı (g)": "30 g", "Un (g)": "20 g", "Yumurta (adet)": "0.5 adet"},
    "San Sebastian": {"Krem Peynir (g)": "60 g", "Yumurta (adet)": "0.5 adet", "Krema (ml)": "40 ml"},
    "Flat White": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "130 ml"},
    "Salep": {"Salep Tozu (g)": "8 g", "Süt (ml)": "200 ml", "Tarçın (g)": "1 g"},
    "Sıcak Çikolata": {"Kakao Tozu (g)": "20 g", "Süt (ml)": "200 ml", "Şeker (g)": "10 g"},
    "Frappe": {"Filtre Kahve Tozu (g)": "10 g", "Süt (ml)": "100 ml", "Buz (g)": "150 g"},
    "Milkshake": {"Süt (ml)": "200 ml", "Dondurma (g)": "100 g", "Şeker (g)": "10 g"},
  };
  tariflerData = RECIPE_BOOK;
  renderTarifler(RECIPE_BOOK);
}

function renderTarifler(data) {
  const el = document.getElementById('tarifGrid');
  if(!el) return;
  el.innerHTML = Object.entries(data).map(([name, ings]) => `
    <div class="recipe-card">
      <div class="recipe-name">☕ ${name}</div>
      ${Object.entries(ings).map(([k,v]) => `<div class="recipe-ing"><span>${k}</span><span style="color:var(--blue)">${v}</span></div>`).join('')}
    </div>`).join('');
}

function filterTarifler(q) {
  const filtered = {};
  Object.entries(tariflerData).forEach(([k,v]) => {
    if (k.toLowerCase().includes(q.toLowerCase())) filtered[k] = v;
  });
  renderTarifler(filtered);
}

// ── SELECTS ──────────────────────────────────────
async function loadUrunSelect() {
  try {
    const r = await fetch(API + '/urunler');
    const d = await r.json();
    urunler = d.urunler;
    populateSelects(urunler);
  } catch(e) { populateSelects(stokData); }
}

function populateSelects(data) {
  const sUrun = document.getElementById('satisUrun');
  const sGiris = document.getElementById('stokGirisUrun');
  if(!sUrun || !sGiris) return;
  const opts = data.map(u=>`<option value="${u.urun_id||u.Urun_ID}">${u.urun_adi||u.Urun_Adi}</option>`).join('');
  sUrun.innerHTML = opts;
  sGiris.innerHTML = opts;
}

// ── KAYIT ────────────────────────────────────────
async function kaydetSatis() {
  const body = { tarih:document.getElementById('satisTarih').value, urun_id:document.getElementById('satisUrun').value, adet:parseInt(document.getElementById('satisAdet').value), birim_fiyat:parseFloat(document.getElementById('satisFiyat').value) };
  const el = document.getElementById('satisResult');
  try {
    const r = await fetch(API+'/satislar/kaydet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d = await r.json();
    el.style.display='block'; el.style.color='var(--green)'; el.textContent='✅ Satış kaydedildi! Toplam: '+(d.toplam_tutar_tl||0)+' TL';
  } catch(e) {
    el.style.display='block'; el.style.color='var(--amber)'; el.textContent='⚠️ API bağlantısı yok — demo modunda kayıt simüle edildi.';
  }
  setTimeout(()=>{el.style.display='none'},3000);
}

async function kaydetStok() {
  const body = { tarih:document.getElementById('stokTarih').value, urun_id:document.getElementById('stokGirisUrun').value, miktar:parseInt(document.getElementById('stokMiktar').value), islem_tipi:document.getElementById('stokTip').value };
  const el = document.getElementById('stokResult');
  try {
    const r = await fetch(API+'/stok/giris',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    el.style.display='block'; el.style.color='var(--green)'; el.textContent='✅ Stok hareketi kaydedildi!';
  } catch(e) {
    el.style.display='block'; el.style.color='var(--amber)'; el.textContent='⚠️ API yok — demo modunda simüle edildi.';
  }
  setTimeout(()=>{el.style.display='none'},3000);
}

function renderSiparisCards(d) {
  const sList = document.getElementById('sipListesi');
  const uDetay = document.getElementById('uyariDetay');
  if(!sList || !uDetay) return;

  sList.innerHTML = (d.acil_siparisler || []).map(s => `
    <div class="alert alert-critical" style="border-left: 4px solid var(--red); background: rgba(248,81,73,0.05);">
      <div class="alert-icon">⚡</div>
      <div class="alert-body">
        <div class="alert-title">${s.urun} — ${s.miktar} adet</div>
        <div class="alert-desc">${s.neden}</div>
      </div>
    </div>`).join('') || '<div style="color:var(--green)">✅ Acil sipariş gerekmez.</div>';
    
  uDetay.innerHTML = (d.acil_siparisler || []).map(s => `
    <div class="alert alert-warn">
      <div class="alert-icon">⚠️</div>
      <div class="alert-body"><div class="alert-title">Stok Risk Analizi</div><div class="alert-desc">${s.urun} pazar verilerine göre azalıyor.</div></div>
    </div>`).join('') || '<div style="color:var(--green)">✅ Kritik uyarı yok.</div>';
}

function handleCSV(input, type) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.trim().split('\n');
    const headers = lines[0].split(',').map(h=>h.trim());
    const rows = lines.slice(1).map(l => {
      const vals = l.split(',').map(v=>v.trim());
      const obj = {};
      headers.forEach((h,i) => obj[h] = vals[i]);
      return obj;
    });
    const elId = type==='satis'?'csvSatisResult':'csvStokResult';
    const el = document.getElementById(elId);
    if(!el) return;
    el.style.display = 'block';
    el.style.color = 'var(--blue)';
    el.innerHTML = `📊 <strong>${rows.length} satır</strong> okundu.<br><small style="color:var(--text3)">${headers.join(', ')}</small>`;
    
    if (type==='satis') {
      rows.forEach(async row => {
        try {
          await fetch(API+'/satislar/kaydet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tarih:row.tarih,urun_id:row.urun_id,adet:parseInt(row.adet),birim_fiyat:parseFloat(row.birim_fiyat||row.fiyat||75)})});
        } catch(e){}
      });
      setTimeout(()=>{ el.style.color='var(--green)'; el.textContent='✅ '+rows.length+' satış başarıyla yüklendi!'; }, 500);
    }
  };
  reader.readAsText(file);
}
