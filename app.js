
const API = window.location.origin;

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
         onclick="selectUser(this, '${u.name}')"
         data-color="${u.color}">
      <div class="uo-icon">${u.icon || '👤'}</div>
      <div class="uo-name">${u.name}</div>
      <div class="uo-role">${u.role}</div>
    </div>
  `).join('');
}

function selectUser(el, name) {
  document.querySelectorAll('.user-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  currentUser = users.find(u => u.name === name);
}

function showRegister() {
  const loginPage = document.getElementById('loginPage');
  const registerPage = document.getElementById('registerPage');
  if(loginPage) loginPage.style.display = 'none';
  if(registerPage) registerPage.style.display = 'flex';
}

function hideRegister() {
  const loginPage = document.getElementById('loginPage');
  const registerPage = document.getElementById('registerPage');
  if(registerPage) registerPage.style.display = 'none';
  if(loginPage) loginPage.style.display = 'flex';
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
function showPage(id, event) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const page = document.getElementById('page-' + id);
  if(page) page.classList.add('active');
  
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  
  if (id === 'malzeme') loadMalzeme();
  if (id === 'tarifler') loadTarifler();
  if (id === 'urunler') loadUretim();
  if (id === 'personel') loadPersonelTable();
  if (id === 'finans') loadFinans();
  if (id === 'dashboard') { loadStok(); loadFinans(); }
}

// ── INIT ───────────────────────────────────────────
async function initApp() {
  const avatarEl = document.getElementById('avatarEl');
  if(avatarEl) {
    avatarEl.textContent = currentUser.name.split(' ').map(w=>w[0]).join('');
    avatarEl.style.background = currentUser.color + '22';
    avatarEl.style.color = currentUser.color;
  }
  
  const userNameEl = document.getElementById('userNameEl');
  const userRoleEl = document.getElementById('userRoleEl');
  if(userNameEl) userNameEl.textContent = currentUser.name;
  if(userRoleEl) userRoleEl.textContent = currentUser.role;
  
  const dashDate = document.getElementById('dashDate');
  if(dashDate) dashDate.textContent = new Date().toLocaleDateString('tr-TR', {weekday:'long',year:'numeric',month:'long',day:'numeric'});

  // ADMIN KONTROLÜ
  const adminMenu = document.getElementById('adminMenu');
  if (adminMenu) {
    adminMenu.style.display = (currentUser.role === 'Yönetici') ? 'block' : 'none';
  }

  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('satisTarih')) document.getElementById('satisTarih').value = today;
  if(document.getElementById('stokTarih')) document.getElementById('stokTarih').value = today;

  await loadStok();
  await loadFinans();
  await loadUrunSelect();
  await loadHammaddeSelect();
  renderStokChart();
}

// ── ADMIN ÖZEL ────────────────────────────────────
function loadPersonelTable() {
  const tbody = document.getElementById('personelTable');
  if(!tbody) return;
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

async function loadFinans() {
  const list = document.getElementById('karAnalizList');
  const finCiro = document.getElementById('finCiro');
  const finMaliyet = document.getElementById('finMaliyet');
  const finKar = document.getElementById('finKar');
  
  try {
    const r = await fetch(API + '/finans/analiz');
    if (!r.ok) throw new Error('Sunucu yanıt vermedi');
    const d = await r.json();
    
    // Üst kartları güncelle
    if(finCiro) finCiro.textContent = Math.round(d.toplam_ciro).toLocaleString('tr-TR') + ' TL';
    if(finMaliyet) finMaliyet.textContent = Math.round(d.toplam_maliyet).toLocaleString('tr-TR') + ' TL';
    // Brüt Kar Marjı kartını yüzde olarak güncelle
    if(finKar) finKar.textContent = '%' + Math.round(d.brut_kar_marji || 0);

    if(!list) return;
    list.innerHTML = d.analiz.map(u => {
      const cost = Math.round(u.birim_maliyet || 0);
      const price = Math.round(u.ortalama_satis_fiyat || 0);
      const profit = price - cost;
      return `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:500">${u.urun_adi || 'Bilinmeyen Ürün'}</div>
            <div style="font-size:11px;color:var(--text3)">Birim Maliyet: ${cost} TL | Satış: ${price} TL</div>
          </div>
          <div style="text-align:right">
            <div style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:600">${profit >= 0 ? '+' : ''}${profit} TL</div>
            <div style="font-size:10px;color:var(--text3)">Birim Kar</div>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    console.error('Finans yükleme hatası:', e);
  }
}

// Sayfa yüklendiğinde kullanıcıları listele
window.onload = () => {
  renderUsers();
};

// ── LOAD STOK ─────────────────────────────────────
async function loadStok() {
  try {
    const r = await fetch(API + '/stok/mevcut');
    if (!r.ok) throw new Error();
    const d = await r.json();
    stokData = d.urunler;
    const oz = d.ozet;
    
    const elements = {
        'mToplam': oz.toplam,
        'mKritik': oz.kritik,
        'mDusuk': oz.dusuk,
        'mYeterli': oz.yeterli,
        'kritikBadge': oz.kritik,
        'uyariBadge': oz.kritik + ' ürün'
    };

    for (let id in elements) {
        const el = document.getElementById(id);
        if(el) el.textContent = elements[id];
    }

    renderStokTable(stokData);
    renderUyariler(stokData.filter(u => u.durum === 'Kritik'));
  } catch(e) {
    useDemoData();
  }
}

function useDemoData() {
  const demo = [
    {urun_id:'P001',urun_adi:'Çay',mevcut_stok:386,kritik_esik:50,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:3},
    {urun_id:'P002',urun_adi:'Türk Kahvesi',mevcut_stok:105,kritik_esik:30,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P003',urun_adi:'Latte',mevcut_stok:80,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:3},
    {urun_id:'P004',urun_adi:'Ice Latte',mevcut_stok:252,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Yerel İçecek Dağıtım',Tedarik_Suresi_Gun:2},
    {urun_id:'P005',urun_adi:'Americano',mevcut_stok:17,kritik_esik:25,durum:'Kritik',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P009',urun_adi:'Espresso',mevcut_stok:0,kritik_esik:20,durum:'Kritik',Tedarikci_Adi:'Kahve Pazarı Toptan',Tedarik_Suresi_Gun:2},
    {urun_id:'P026',urun_adi:'San Sebastian',mevcut_stok:88,kritik_esik:15,durum:'Yeterli',Tedarikci_Adi:'Tatlı ve Unlu Mamuller Ltd.',Tedarik_Suresi_Gun:2},
    {urun_id:'P032',urun_adi:'Kruvasan',mevcut_stok:47,kritik_esik:25,durum:'Yeterli',Tedarikci_Adi:'Tatlı ve Unlu Mamuller Ltd.',Tedarik_Suresi_Gun:2},
  ];
  stokData = demo;
  urunler = demo;
  const kritikSay = demo.filter(u=>u.durum==='Kritik').length;
  const dusukSay = demo.filter(u=>u.durum==='Düşük').length;
  const yeterliSay = demo.filter(u=>u.durum==='Yeterli').length;
  
  const elMap = {'mToplam':demo.length, 'mKritik':kritikSay, 'mDusuk':dusukSay, 'mYeterli':yeterliSay, 'kritikBadge':kritikSay, 'uyariBadge': kritikSay + ' ürün'};
  for(let id in elMap) {
      const el = document.getElementById(id);
      if(el) el.textContent = elMap[id];
  }

  renderStokTable(stokData);
  renderUyariler(stokData.filter(u=>u.durum==='Kritik'));
  populateSelects(demo);
}

// ── HAMMADDE & ZİNCİRLEME KRİTİKLİK MANTIĞI ─────────────────────────────────
// Tarife göre hangi hammaddelerin hangi içeceklerde kullanıldığı
const HAMMADDE_KULLANIM = {
  'Espresso Çekirdeği (g)': ['Latte', 'Ice Latte', 'Americano', 'Ice Americano', 'Cappuccino', 'Mocha', 'Iced Mocha', 'Espresso', 'Flat White', 'Cortado', 'Tiramisu'],
  'Süt (ml)': ['Latte', 'Ice Latte', 'Cappuccino', 'Mocha', 'Iced Mocha', 'Flat White', 'Cortado', 'Sıcak Çikolata', 'Salep', 'Chai Tea Latte', 'Milkshake', 'Menengiç Kahvesi', 'Frappe'],
  'Çay Yaprağı (g)': ['Çay'],
  'Türk Kahvesi Tozu (g)': ['Türk Kahvesi'],
  'Buz (g)': ['Ice Latte', 'Ice Americano', 'Limonata', 'Soğuk Çay', 'Frappe', 'Frozen'],
  'Çikolata Sosu (ml)': ['Mocha', 'Iced Mocha'],
  'Limon (adet)': ['Limonata', 'Kış Çayı'],
  'Şeker (g)': ['Limonata', 'Sıcak Çikolata', 'Milkshake'],
  'Un (g)': ['Brownie', 'Sufle', 'Havuçlu Tarçınlı Kek', 'Kruvasan'],
  'Yumurta (adet)': ['San Sebastian', 'Brownie', 'Sufle'],
  'Bardak (M)': ['Latte', 'Americano', 'Filtre Kahve', 'Portakal Suyu'],
  'Bardak (L)': ['Ice Latte', 'Ice Americano'],
  'Pipet': ['Ice Latte', 'Ice Americano', 'Limonata', 'Soğuk Çay', 'Frappe', 'Frozen'],
  'Fincan': ['Türk Kahvesi', 'Espresso', 'Menengiç Kahvesi', 'Cortado'],
};

// Tarife göre her içeceğin kullandığı hammaddeler (app.js'teki RECIPE_BOOK ile aynı)
const URUN_HAMMADDE = {
  'Çay': ['Çay Yaprağı (g)', 'Su (ml)', 'Bardak (S)'],
  'Türk Kahvesi': ['Türk Kahvesi Tozu (g)', 'Su (ml)', 'Fincan'],
  'Latte': ['Espresso Çekirdeği (g)', 'Süt (ml)', 'Bardak (M)'],
  'Ice Latte': ['Espresso Çekirdeği (g)', 'Süt (ml)', 'Buz (g)', 'Bardak (L)', 'Pipet'],
  'Americano': ['Espresso Çekirdeği (g)', 'Su (ml)', 'Bardak (M)'],
  'Ice Americano': ['Espresso Çekirdeği (g)', 'Su (ml)', 'Buz (g)', 'Bardak (L)', 'Pipet'],
  'Cappuccino': ['Espresso Çekirdeği (g)', 'Süt (ml)', 'Bardak (M)'],
  'Mocha': ['Espresso Çekirdeği (g)', 'Süt (ml)', 'Çikolata Sosu (ml)'],
  'Iced Mocha': ['Espresso Çekirdeği (g)', 'Süt (ml)', 'Çikolata Sosu (ml)', 'Buz (g)'],
  'Espresso': ['Espresso Çekirdeği (g)', 'Fincan'],
  'Flat White': ['Espresso Çekirdeği (g)', 'Süt (ml)'],
  'Cortado': ['Espresso Çekirdeği (g)', 'Süt (ml)', 'Fincan'],
  'Limonata': ['Limon (adet)', 'Şeker (g)', 'Su (ml)', 'Buz (g)', 'Pipet'],
  'Tiramisu': ['Maskarpone (g)', 'Bisküvi (g)', 'Espresso Çekirdeği (g)'],
  'Kruvasan': ['Un (g)'],
};

/**
 * Kritik stok durumunu hammadde bazında analiz eder.
 * Bir içecek kritikse, onun kullandığı hammaddeler de kritik sayılır.
 * Aynı hammaddeyi kullanan diğer içecekler de bu nedenle etkilenmiş sayılır.
 */
function hesaplaHammaddeKritikligi(stokVerisi) {
  const kritikUrunler = stokVerisi.filter(u => u.durum === 'Kritik');
  const dusukUrunler = stokVerisi.filter(u => u.durum === 'Düşük');
  
  // Her kritik ürünün hammaddelerini bul
  const kritikHammaddeler = {}; // { hammadde: { urunler: [], stokVerisi: {...} } }
  
  kritikUrunler.forEach(u => {
    const hammaddeler = URUN_HAMMADDE[u.urun_adi] || [];
    hammaddeler.forEach(h => {
      if (!kritikHammaddeler[h]) {
        kritikHammaddeler[h] = { nedenUrunler: [], etkilenenUrunler: new Set() };
      }
      kritikHammaddeler[h].nedenUrunler.push(u.urun_adi);
      // Bu hammaddeyi kullanan TÜM içecekler etkileniyor
      (HAMMADDE_KULLANIM[h] || []).forEach(etkilenen => {
        kritikHammaddeler[h].etkilenenUrunler.add(etkilenen);
      });
    });
  });

  // Düşük stok için de aynı mantık (ama ayrı liste)
  const dusukHammaddeler = {};
  dusukUrunler.forEach(u => {
    const hammaddeler = URUN_HAMMADDE[u.urun_adi] || [];
    hammaddeler.forEach(h => {
      if (!kritikHammaddeler[h]) { // Zaten kritik değilse
        if (!dusukHammaddeler[h]) {
          dusukHammaddeler[h] = { nedenUrunler: [], etkilenenUrunler: new Set() };
        }
        dusukHammaddeler[h].nedenUrunler.push(u.urun_adi);
        (HAMMADDE_KULLANIM[h] || []).forEach(etkilenen => {
          dusukHammaddeler[h].etkilenenUrunler.add(etkilenen);
        });
      }
    });
  });

  return { kritikHammaddeler, dusukHammaddeler };
}

function renderUyariler(kritikler) {
  const el = document.getElementById('uyariListesi');
  if(!el) return;
  
  if (!kritikler.length) { 
    el.innerHTML = '<div class="alert alert-ok"><div class="alert-icon">✅</div><div class="alert-body"><div class="alert-title">Tüm stoklar yeterli</div></div></div>'; 
    return; 
  }

  const { kritikHammaddeler } = hesaplaHammaddeKritikligi(stokData);
  
  // Önce doğrudan kritik içecekleri göster, sonra hammadde etkisini
  let html = '';
  
  // Doğrudan kritik içecekler
  kritikler.forEach(u => {
    const hammaddeler = URUN_HAMMADDE[u.urun_adi] || [];
    const hammaddeStr = hammaddeler.length ? `<span style="color:var(--amber);font-size:11px">⚙️ Hammadde: ${hammaddeler.slice(0,3).join(', ')}${hammaddeler.length > 3 ? '...' : ''}</span>` : '';
    html += `
      <div class="alert alert-critical">
        <div class="alert-icon">🔴</div>
        <div class="alert-body">
          <div class="alert-title" style="color:var(--red)">${u.urun_adi}</div>
          <div class="alert-desc">Mevcut: <strong>${u.mevcut_stok}</strong> | Eşik: ${u.kritik_esik} | Tedarik: ${u.Tedarik_Suresi_Gun || '?'} gün</div>
          <div style="margin-top:3px">${hammaddeStr}</div>
        </div>
      </div>`;
  });

  // Zincirleme etkilenen hammaddeler (kritik içecekler aracılığıyla)
  const zincirUyarilari = [];
  Object.entries(kritikHammaddeler).forEach(([hammadde, info]) => {
    const etkilenenListesi = [...info.etkilenenUrunler].filter(u => 
      !kritikler.find(k => k.urun_adi === u) // Zaten doğrudan kritik olanları hariç tut
    );
    if (etkilenenListesi.length > 0) {
      zincirUyarilari.push({ hammadde, nedenler: info.nedenUrunler, etkilenen: etkilenenListesi });
    }
  });

  if (zincirUyarilari.length > 0) {
    html += `<div style="margin-top:8px;padding:6px 10px;background:rgba(230,100,50,0.08);border-radius:6px;border-left:3px solid var(--amber)">
      <div style="font-size:11px;color:var(--amber);font-weight:600;margin-bottom:4px">⛓️ ZİNCİRLEME ETKİ — Hammadde Bağımlılığı</div>`;
    zincirUyarilari.forEach(z => {
      html += `<div style="font-size:12px;color:var(--text2);margin:3px 0">
        <strong style="color:var(--orange)">${z.hammadde}</strong> kritik 
        <span style="color:var(--text3)">(${z.nedenler.join(', ')} nedeniyle)</span> → 
        <span style="color:var(--amber)">${z.etkilenen.slice(0,4).join(', ')}${z.etkilenen.length > 4 ? ` +${z.etkilenen.length-4}` : ''} de etkileniyor</span>
      </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;

  // Hammadde sipariş özeti (dashboard'un altında)
  const ozEl = document.getElementById('hammaddeOzet');
  if (ozEl && Object.keys(kritikHammaddeler).length > 0) {
    ozEl.style.display = 'block';
    ozEl.innerHTML = `
      <div style="padding:10px 12px;background:rgba(230,90,40,0.07);border:1px solid rgba(230,90,40,0.25);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:6px">📦 SİPARİŞ EDİLMESİ GEREKEN HAMMADDELER</div>
        ${Object.entries(kritikHammaddeler).map(([h, info]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px">
            <span style="color:var(--text1);font-weight:500">⚙️ ${h}</span>
            <span style="color:var(--text3)">${[...info.etkilenenUrunler].slice(0,3).join(', ')}${info.etkilenenUrunler.size > 3 ? ` +${info.etkilenenUrunler.size - 3}` : ''}</span>
          </div>`).join('')}
      </div>`;
  } else if (ozEl) {
    ozEl.style.display = 'none';
  }
}

function getArrivalDate(days) {
  if (!days) return '-';
  const date = new Date();
  date.setDate(date.getDate() + parseInt(days));
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function renderStokTable(data) {
  const tbody = document.getElementById('stokTable');
  if(!tbody) return;
  tbody.innerHTML = data.map(u => {
    const pct = Math.min(100, Math.round((u.mevcut_stok / (u.kritik_esik * 3)) * 100));
    const col = u.durum === 'Kritik' ? 'var(--red)' : u.durum === 'Düşük' ? 'var(--amber)' : 'var(--green)';
    const badge = u.durum === 'Kritik' ? 'badge-red' : u.durum === 'Düşük' ? 'badge-amber' : 'badge-green';
    const arrival = getArrivalDate(u.Tedarik_Suresi_Gun);
    
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
      <td>
        <div style="font-size:12px;color:var(--text2)">🚚 ${u.Tedarik_Suresi_Gun || '?'} Gün (Lojistik)</div>
        <div style="font-size:11px;color:var(--blue);font-weight:500">📅 Varış: ${arrival}</div>
      </td>
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
  if(!ctx || typeof Chart === 'undefined') return;
  
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

// ── AI ANALİZ ─────────────────────────────────────
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
  
  ozEl.innerHTML = `<span style="color:#38bdf8; font-weight:700;">✨ Claude AI:</span> ${d.ozet.substring(0, 80)}...`;

  mainEl.innerHTML = `
    <div id="aiMainText" style="margin-bottom:20px; font-weight:500; font-size:15px; color:#f1f5f9; line-height:1.7; background: rgba(56, 189, 248, 0.05); padding: 18px; border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.15); box-shadow: inset 0 0 20px rgba(56, 189, 248, 0.05); white-space: pre-line;"></div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="ai-insight-card" style="border-color: #f85149; background: rgba(248, 81, 73, 0.03); border-radius: 12px; border-width: 1px; border-left-width: 4px; white-space: pre-line;">
        <div class="ai-insight-label" style="color:#f85149; font-size:10px; letter-spacing:1px;">🚨 Kritik Riskler</div>
        <div id="aiRisks" style="font-size:13px; color:#cbd5e1; line-height:1.5;"></div>
      </div>
      <div class="ai-insight-card" style="border-color: #3fb950; background: rgba(63, 185, 80, 0.03); border-radius: 12px; border-width: 1px; border-left-width: 4px; white-space: pre-line;">
        <div class="ai-insight-label" style="color:#3fb950; font-size:10px; letter-spacing:1px;">💡 Stratejik Öneriler</div>
        <div id="aiActions" style="font-size:13px; color:#cbd5e1; line-height:1.5;"></div>
      </div>
    </div>
  `;

  typeWriter(d.ozet, 'aiMainText', 8).then(() => {
    const risks = (d.acil_siparisler || d.uyarilar || []).map(s => `• ${s.urun || s.urun_adi}: ${s.neden || s.mesaj}`).join('\n');
    typeWriter(risks || 'Kritik bir risk saptanmadı.', 'aiRisks', 5);
    
    // Hammadde bazlı öneriler (içecek değil malzeme siparişi)
    const hammaddeSiparisler = hesaplaHammaddeSiparisler(d.acil_siparisler || []);
    const actions = hammaddeSiparisler.length > 0
      ? hammaddeSiparisler.map(h => `• ${h.hammadde} sipariş et (Etkilenen: ${h.etkilenenUrunler.slice(0,3).join(', ')})`).join('\n')
      : (d.aylik_tedarik || d.siparis_onerileri || []).slice(0,3).map(t => `• ${t.malzeme || t.urun_adi} tedariği planla.`).join('\n');
    typeWriter(actions || 'Mevcut plan stabil görünüyor.', 'aiActions', 5);
  });

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
  const disEl = document.getElementById('disFaktorAnaliz');
  if(!grid) return;
  grid.innerHTML = '<div style="color:var(--text3)"><span class="pulse"></span> Hesaplanıyor...</div>';
  if(disEl) disEl.innerHTML = '<span class="pulse"></span> Dış faktörler analiz ediliyor...';
  
  try {
    const r = await fetch(API + '/ai/analiz');
    if (!r.ok) throw new Error('API hatası');
    const d = await r.json();
    
    if(disEl && d.dis_faktor_ozet) {
        disEl.textContent = d.dis_faktor_ozet;
    }

    if(d.haftalik_tahmin && d.haftalik_tahmin.length > 0) {
        renderTahminGrid(d.haftalik_tahmin);
        computeMalzemeHafta(d.haftalik_tahmin);
    } else {
        renderDemoTahmin();
    }
  } catch(e) {
    console.error('Tahmin hatası:', e);
    renderDemoTahmin();
    if(disEl) disEl.textContent = "Tahmin: Yarın hava parçalı bulutlu ve 22°C. Normal satış trendi bekleniyor.";
  }
}

function renderTahminGrid(tahminler) {
  const el = document.getElementById('tahminGrid');
  if (!el) return;
  if (!tahminler || !tahminler.length) { el.innerHTML = '<div style="color:var(--text3); padding:20px; text-align:center; grid-column:1/-1;">Veri yok</div>'; return; }
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
    'Çay': {'Çay Yaprağı (g)': 3, 'Su (ml)': 200, 'Bardak (S)': 1},
    'Türk Kahvesi': {'Türk Kahvesi Tozu (g)': 7, 'Su (ml)': 80, 'Fincan': 1},
    'Latte': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 200, 'Bardak (M)': 1},
    'Ice Latte': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 180, 'Buz (g)': 80, 'Bardak (L)': 1, 'Pipet': 1},
    'Americano': {'Espresso Çekirdeği (g)': 18, 'Su (ml)': 180, 'Bardak (M)': 1},
    'Ice Americano': {'Espresso Çekirdeği (g)': 18, 'Su (ml)': 150, 'Buz (g)': 100, 'Bardak (L)': 1, 'Pipet': 1},
    'Cappuccino': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 120, 'Bardak (M)': 1},
    'Limonata': {'Limon (adet)': 1.5, 'Şeker (g)': 20, 'Su (ml)': 250, 'Buz (g)': 60, 'Pipet': 1},
    'Espresso': {'Espresso Çekirdeği (g)': 18, 'Fincan': 1},
    'Filtre Kahve': {'Filtre Kahve Tozu (g)': 15, 'Su (ml)': 250, 'Bardak (M)': 1},
    'Mocha': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 180, 'Çikolata Sosu (ml)': 20, 'Bardak (M)': 1},
    'Menengiç Kahvesi': {'Menengiç (g)': 10, 'Süt (ml)': 80, 'Fincan': 1},
    'Sıcak Çikolata': {'Kakao Tozu (g)': 20, 'Süt (ml)': 200, 'Şeker (g)': 10, 'Bardak (M)': 1},
    'Salep': {'Salep Tozu (g)': 8, 'Süt (ml)': 200, 'Tarçın (g)': 1, 'Bardak (M)': 1},
    'Flat White': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 130, 'Bardak (M)': 1},
    'Cortado': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 30, 'Fincan': 1},
    'Chai Tea Latte': {'Chai Mix (g)': 15, 'Süt (ml)': 200, 'Tarçın (g)': 0.5, 'Bardak (M)': 1},
    'Kış Çayı': {'Bitki Mix (g)': 5, 'Bal (ml)': 10, 'Su (ml)': 250, 'Limon (dilim)': 1, 'Bardak (M)': 1},
    'Soğuk Çay': {'Çay Özü (ml)': 30, 'Su (ml)': 200, 'Buz (g)': 100, 'Şurup (ml)': 10, 'Bardak (L)': 1, 'Pipet': 1},
    'Frappe': {'Filtre Kahve Tozu (g)': 10, 'Süt (ml)': 100, 'Buz (g)': 150, 'Bardak (L)': 1, 'Pipet': 1},
    'Milkshake': {'Süt (ml)': 200, 'Dondurma (g)': 100, 'Şeker (g)': 10, 'Bardak (L)': 1, 'Pipet': 1},
    'Iced Mocha': {'Espresso Çekirdeği (g)': 18, 'Süt (ml)': 150, 'Çikolata Sosu (ml)': 20, 'Buz (g)': 100, 'Bardak (L)': 1, 'Pipet': 1},
    'Portakal Suyu': {'Portakal (adet)': 3, 'Bardak (M)': 1, 'Pipet': 1},
    'Churchill': {'Soda (ml)': 200, 'Limon (adet)': 0.5, 'Tuz (g)': 1, 'Bardak (M)': 1},
    'Frozen': {'Meyve Özü (ml)': 50, 'Buz (g)': 200, 'Şurup (ml)': 20, 'Bardak (L)': 1, 'Pipet': 1},
    'San Sebastian': {'Krem Peynir (g)': 60, 'Yumurta (adet)': 0.5, 'Krema (ml)': 40},
    'Tiramisu': {'Maskarpone (g)': 50, 'Bisküvi (g)': 30, 'Espresso Çekirdeği (g)': 5},
    'Brownie': {'Çikolata (g)': 40, 'Tereyağı (g)': 30, 'Un (g)': 20, 'Yumurta (adet)': 0.5},
    'Havuçlu Tarçınlı Kek': {'Havuç (g)': 30, 'Un (g)': 40, 'Tarçın (g)': 2, 'Ceviz (g)': 5},
    'Sufle': {'Çikolata (g)': 50, 'Un (g)': 15, 'Yumurta (adet)': 1},
    'Çikolatalı Cookie': {'Hamur (g)': 60, 'Çikolata Parçacığı (g)': 15},
    'Kruvasan': {'Un (g)': 80, 'Tereyağı (g)': 20},
    'Profiterol': {'Hamur (g)': 30, 'Krema (g)': 40, 'Çikolata Sosu (g)': 30}
  };

  const totals = {};
  const normalize = (s) => s.trim().toLowerCase();
  const recipeKeys = Object.keys(RECIPE);

  tahminler.forEach(t => {
    const urunAdi = (t.urun || t.urun_adi || '').trim();
    const qty = t.haftalik || t.tahmini_satis || 0;
    
    // Case-insensitive match
    const key = recipeKeys.find(k => normalize(k) === normalize(urunAdi));
    const recipe = key ? RECIPE[key] : null;

    if (recipe) {
      Object.entries(recipe).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + (v * qty);
      });
    }
  });

  renderMalzemeHafta(totals);
}

function renderMalzemeHafta(totals) {
  const el = document.getElementById('malzemeHafta');
  if (!el) return;
  if (!totals || !Object.keys(totals).length) { el.innerHTML = '<div style="color:var(--text3)">Hesaplanamadı</div>'; return; }
  const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,25);
  el.innerHTML = `<div style="display:flex; flex-direction:column; gap:6px;">`
    + sorted.map(([k,v]) => {
      let unit = k.includes('(') ? k.split('(')[1].replace(')','') : '';
      let name = k.split('(')[0].trim();
      return `
      <div style="background:var(--bg3); border-left:2px solid var(--blue); padding:6px 10px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:11px; color:var(--text2);">${name}</div>
        <div style="font-size:12px; font-weight:600; color:var(--blue);">${Math.round(v).toLocaleString()} <span style="font-size:9px; opacity:0.7;">${unit}</span></div>
      </div>`;
    }).join('') + '</div>';
}

function renderDemoTahmin() {
  const targetData = (urunler && urunler.length) ? urunler : stokData;
  const demo = targetData.map(u => ({
    urun: u.urun_adi || u.Urun_Adi,
    tahmini_satis: Math.round(Math.random()*200+50),
    gunluk_ortalama: Math.round(Math.random()*30+10),
    trend: ['artiyor','stabil','azaliyor'][Math.floor(Math.random()*3)]
  }));
  renderTahminGrid(demo);
  computeMalzemeHafta(demo.map(d=>({urun:d.urun,haftalik:d.tahmini_satis})));
}

// ── MALZEME TÜKETİMİ ─────────────────────────────
async function loadMalzeme() {
  const select = document.getElementById('malzemeDon');
  const gun = select ? select.value : 30;
  try {
    const r = await fetch(`${API}/ai/malzeme-tuketimi?gunler=${gun}`);
    if(!r.ok) throw new Error();
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
  if(!ctx || typeof Chart === 'undefined') return;
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
  
  try {
    const r = await fetch(API + '/api/uretilebilir-urunler');
    if(!r.ok) throw new Error();
    const d = await r.json();
    
    el.innerHTML = d.urunler.map(u => {
      const maxPor = u.max_porsiyon;
      const col = u.durum==='Kritik'?'var(--red)':u.durum==='Düşük'?'var(--amber)':'var(--blue)';
      const badge = u.durum==='Kritik'?'badge-red':u.durum==='Düşük'?'badge-amber':'badge-green';
      
      // Doluluk oranını porsiyon sayısına göre (max 100 üzerinden) gösterelim
      const pct = Math.min(100, Math.round((maxPor / 100) * 100));
      
      return `<div class="forecast-card">
        <div class="forecast-name">${u.urun_adi}</div>
        <div class="forecast-val" style="color:${col}">${maxPor}</div>
        <div class="forecast-row"><span>Üretilebilecek</span><span class="badge ${badge}">${u.durum}</span></div>
        <div style="margin-top:6px">
          <div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${col}"></div></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">Porsiyon Kapasitesi</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="color:var(--text3); padding:20px;">Üretim verileri yüklenemedi.</div>';
  }
}

// ── TARİFLER ─────────────────────────────────────
async function loadTarifler() {
  const RECIPE_BOOK = {
    "Çay": {"Çay Yaprağı (g)": "3 g", "Su (ml)": "200 ml", "Bardak (S)": "1 adet"},
    "Türk Kahvesi": {"Türk Kahvesi Tozu (g)": "7 g", "Su (ml)": "80 ml", "Fincan": "1 adet"},
    "Latte": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "200 ml", "Bardak (M)": "1 adet"},
    "Ice Latte": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "180 ml", "Buz (g)": "80 g", "Bardak (L)": "1 adet"},
    "Americano": {"Espresso Çekirdeği (g)": "18 g", "Su (ml)": "180 ml", "Bardak (M)": "1 adet"},
    "Ice Americano": {"Espresso Çekirdeği (g)": "18 g", "Su (ml)": "150 ml", "Buz (g)": "100 g", "Bardak (L)": "1 adet"},
    "Cappuccino": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "120 ml", "Bardak (M)": "1 adet"},
    "Limonata": {"Limon (adet)": "1.5 adet", "Şeker (g)": "20 g", "Su (ml)": "250 ml", "Buz (g)": "60 g"},
    "Espresso": {"Espresso Çekirdeği (g)": "18 g", "Fincan": "1 adet"},
    "Filtre Kahve": {"Filtre Kahve Tozu (g)": "15 g", "Su (ml)": "250 ml", "Bardak (M)": "1 adet"},
    "Mocha": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "180 ml", "Çikolata Sosu (ml)": "20 ml"},
    "Menengiç Kahvesi": {"Menengiç (g)": "10 g", "Süt (ml)": "80 ml", "Fincan": "1 adet"},
    "Sıcak Çikolata": {"Kakao Tozu (g)": "20 g", "Süt (ml)": "200 ml", "Şeker (g)": "10 g"},
    "Salep": {"Salep Tozu (g)": "8 g", "Süt (ml)": "200 ml", "Tarçın (g)": "1 g"},
    "Flat White": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "130 ml"},
    "Cortado": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "30 ml", "Fincan": "1 adet"},
    "Chai Tea Latte": {"Chai Mix (g)": "15 g", "Süt (ml)": "200 ml", "Tarçın (g)": "0.5 g"},
    "Kış Çayı": {"Bitki Mix (g)": "5 g", "Bal (ml)": "10 ml", "Su (ml)": "250 ml", "Limon (dilim)": "1 adet"},
    "Soğuk Çay": {"Çay Özü (ml)": "30 ml", "Su (ml)": "200 ml", "Buz (g)": "100 g", "Şurup (ml)": "10 ml"},
    "Frappe": {"Filtre Kahve Tozu (g)": "10 g", "Süt (ml)": "100 ml", "Buz (g)": "150 g"},
    "Milkshake": {"Süt (ml)": "200 ml", "Dondurma (g)": "100 g", "Şeker (g)": "10 g"},
    "Iced Mocha": {"Espresso Çekirdeği (g)": "18 g", "Süt (ml)": "150 ml", "Çikolata Sosu (ml)": "20 ml", "Buz (g)": "100 g"},
    "Portakal Suyu": {"Portakal (adet)": "3 adet", "Bardak (M)": "1 adet"},
    "Churchill": {"Soda (ml)": "200 ml", "Limon (adet)": "0.5 adet", "Tuz (g)": "1 g"},
    "Frozen": {"Meyve Özü (ml)": "50 ml", "Buz (g)": "200 g", "Şurup (ml)": "20 ml"},
    "San Sebastian": {"Krem Peynir (g)": "60 g", "Yumurta (adet)": "0.5 adet", "Krema (ml)": "40 ml"},
    "Tiramisu": {"Maskarpone (g)": "50 g", "Bisküvi (g)": "30 g", "Espresso Çekirdeği (g)": "5 g"},
    "Brownie": {"Çikolata (g)": "40 g", "Tereyağı (g)": "30 g", "Un (g)": "20 g", "Yumurta (adet)": "0.5 adet"},
    "Havuçlu Tarçınlı Kek": {"Havuç (g)": "30 g", "Un (g)": "40 g", "Tarçın (g)": "2 g", "Ceviz (g)": "5 g"},
    "Sufle": {"Çikolata (g)": "50 g", "Un (g)": "15 g", "Yumurta (adet)": "1 adet"},
    "Çikolatalı Cookie": {"Hamur (g)": "60 g", "Çikolata Parçacığı (g)": "15 g"},
    "Kruvasan": {"Kruvasan Hamuru (g)": "80 g", "Tereyağı (g)": "20 g"},
    "Profiterol": {"Hamur (g)": "30 g", "Krema (g)": "40 g", "Çikolata Sosu (g)": "30 g"},
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
    if(!r.ok) throw new Error();
    const d = await r.json();
    urunler = d.urunler;
    populateSatisSelect(urunler);
  } catch(e) { 
    // Fallback demo verisi
    const demoUrunler = [
      {urun_id:'P001',urun_adi:'Çay'},
      {urun_id:'P002',urun_adi:'Türk Kahvesi'},
      {urun_id:'P003',urun_adi:'Latte'},
      {urun_id:'P004',urun_adi:'Ice Latte'},
      {urun_id:'P005',urun_adi:'Americano'}
    ];
    populateSatisSelect(demoUrunler);
  }
}

async function loadHammaddeSelect() {
  try {
    const r = await fetch(API + '/hammaddeler');
    if(!r.ok) throw new Error();
    const d = await r.json();
    populateStokSelect(d.hammaddeler);
  } catch(e) {
    // Fallback demo verisi
    const demoHammaddeler = [
      {hammadde_id:'H001',hammadde_adi:'Çay Yaprağı'},
      {hammadde_id:'H004',hammadde_adi:'Türk Kahvesi Tozu'},
      {hammadde_id:'H006',hammadde_adi:'Espresso Çekirdeği'},
      {hammadde_id:'H007',hammadde_adi:'Süt'}
    ];
    populateStokSelect(demoHammaddeler);
  }
}

function populateSatisSelect(data) {
  const sUrun = document.getElementById('satisUrun');
  if(!sUrun) return;
  sUrun.innerHTML = data.map(u=>`<option value="${u.urun_id||u.Urun_ID}">${u.urun_adi||u.Urun_Adi}</option>`).join('');
}

function populateStokSelect(data) {
  const sGiris = document.getElementById('stokGirisUrun');
  if(!sGiris) return;
  sGiris.innerHTML = data.map(h=>`<option value="${h.hammadde_id}">${h.hammadde_adi}</option>`).join('');
}

// ── KAYIT ────────────────────────────────────────
async function kaydetSatis() {
  const urunId = document.getElementById('satisUrun').value;
  const adet = parseInt(document.getElementById('satisAdet').value);
  const fiyat = parseFloat(document.getElementById('satisFiyat').value);
  const tarih = document.getElementById('satisTarih').value;

  const body = { tarih, urun_id: urunId, adet, birim_fiyat: fiyat };
  const el = document.getElementById('satisResult');
  
  try {
    const r = await fetch(API+'/satislar/kaydet',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
    });
    if(!r.ok) throw new Error();
    const d = await r.json();
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--green)'; 
        el.textContent='✅ Satış kaydedildi! Toplam: '+(d.toplam_tutar_tl||0)+' TL';
    }
    // GÜNCELLEME: Refresh after sale
    await loadStok();
    await loadFinans();
    renderStokChart();
  } catch(e) {
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--amber)'; 
        el.textContent='⚠️ API bağlantısı yok — demo modunda kayıt simüle edildi.';
    }
  }
  setTimeout(()=>{ if(el) el.style.display='none' },3000);
}

async function kaydetStok() {
  const urunId = document.getElementById('stokGirisUrun').value;
  const miktar = parseInt(document.getElementById('stokMiktar').value);
  const tip = document.getElementById('stokTip').value;
  const tarih = document.getElementById('stokTarih').value;

  const body = { tarih, urun_id: urunId, miktar, islem_tipi: tip };
  const el = document.getElementById('stokResult');
  
  try {
    const r = await fetch(API+'/stok/giris',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
    });
    if(!r.ok) throw new Error();
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--green)'; 
        el.textContent='✅ Stok hareketi kaydedildi!';
    }
    // GÜNCELLEME: Refresh after stock entry
    await loadStok();
    await loadFinans();
    renderStokChart();
  } catch(e) {
    if(el) {
        el.style.display='block'; 
        el.style.color='var(--amber)'; 
        el.textContent='⚠️ API yok — demo modunda simüle edildi.';
    }
  }
  setTimeout(()=>{ if(el) el.style.display='none' },3000);
}

function renderSiparisCards(d) {
  const sList = document.getElementById('sipListesi');
  const uDetay = document.getElementById('uyariDetay');
  if(!sList || !uDetay) return;

  // Hammadde bazlı sipariş önerileri oluştur
  const hammaddeSiparisler = hesaplaHammaddeSiparisler(d.acil_siparisler || []);
  
  if (hammaddeSiparisler.length > 0) {
    sList.innerHTML = `
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">
        ⚙️ <strong>Hammadde siparişleri</strong> — Kahve, süt, bardak gibi malzemeleri sipariş edersiniz, içecek değil.
      </div>` +
      hammaddeSiparisler.map(s => `
        <div class="alert alert-critical" style="border-left: 4px solid var(--red); background: rgba(248,81,73,0.05);">
          <div class="alert-icon">⚡</div>
          <div class="alert-body">
            <div class="alert-title" style="color:var(--red)">${s.hammadde}</div>
            <div class="alert-desc">${s.neden}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">📦 Etkilenen ürünler: ${s.etkilenenUrunler.join(', ')}</div>
          </div>
        </div>`).join('');
  } else if ((d.acil_siparisler || []).length > 0) {
    // Fallback: tarif eşleşmesi yoksa orijinal sipariş listesi
    sList.innerHTML = (d.acil_siparisler || []).map(s => `
      <div class="alert alert-critical" style="border-left: 4px solid var(--red); background: rgba(248,81,73,0.05);">
        <div class="alert-icon">⚡</div>
        <div class="alert-body">
          <div class="alert-title">${s.urun}</div>
          <div class="alert-desc">${s.neden}</div>
        </div>
      </div>`).join('');
  } else {
    sList.innerHTML = '<div style="color:var(--green)">✅ Acil sipariş gerekmez.</div>';
  }
    
  uDetay.innerHTML = (d.acil_siparisler || []).map(s => `
    <div class="alert alert-warn">
      <div class="alert-icon">⚠️</div>
      <div class="alert-body"><div class="alert-title">Stok Risk Analizi</div><div class="alert-desc">${s.urun} pazar verilerine göre azalıyor.</div></div>
    </div>`).join('') || '<div style="color:var(--green)">✅ Kritik uyarı yok.</div>';
}

/**
 * Acil sipariş listesindeki içecekleri hammaddelere dönüştürür.
 * Aynı hammaddeyi kullanan birden fazla içecek varsa birleştirir.
 */
function hesaplaHammaddeSiparisler(acilSiparisler) {
  const hammaddeMap = {}; // { hammadde: { etkilenenUrunler: Set, nedenler: [] } }
  
  acilSiparisler.forEach(s => {
    const urunAdi = s.urun || s.urun_adi;
    const hammaddeler = URUN_HAMMADDE[urunAdi] || [];
    
    if (hammaddeler.length === 0) {
      // Tarif bulunamazsa hammadde adıyla kaydet
      if (!hammaddeMap[urunAdi]) {
        hammaddeMap[urunAdi] = { etkilenenUrunler: new Set([urunAdi]), nedenler: [s.neden] };
      }
      return;
    }
    
    hammaddeler.forEach(h => {
      if (!hammaddeMap[h]) {
        hammaddeMap[h] = { etkilenenUrunler: new Set(), nedenler: [] };
      }
      hammaddeMap[h].etkilenenUrunler.add(urunAdi);
      // Aynı hammaddeyi kullanan diğer etkilenen içecekler
      (HAMMADDE_KULLANIM[h] || []).forEach(etkilenen => {
        // Sadece stokData'da gerçekten var olan ürünleri ekle
        if (stokData.find(u => u.urun_adi === etkilenen)) {
          hammaddeMap[h].etkilenenUrunler.add(etkilenen);
        }
      });
      if (s.neden && !hammaddeMap[h].nedenler.includes(s.neden)) {
        hammaddeMap[h].nedenler.push(s.neden);
      }
    });
  });
  
  return Object.entries(hammaddeMap).map(([hammadde, info]) => ({
    hammadde,
    etkilenenUrunler: [...info.etkilenenUrunler],
    neden: info.nedenler.join('; ') || 'Kritik stok seviyesi',
  }));
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
          await fetch(API+'/satislar/kaydet',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({tarih:row.tarih, urun_id:row.urun_id, adet:parseInt(row.adet), birim_fiyat:parseFloat(row.birim_fiyat||row.fiyat||75)})
          });
        } catch(err){}
      });
      setTimeout(()=>{ el.style.color='var(--green)'; el.textContent='✅ '+rows.length+' satış başarıyla yüklendi!'; loadStok(); loadFinans(); }, 500);
    }
  };
  reader.readAsText(file);
}
