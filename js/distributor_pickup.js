// ===== Collections =====
const PICKUP_COLL = 'distributor_pickups';
const DIST_COLL = 'distributors';
const PRODUCT_COLL = 'pricetaglabel';

// ===== 狀態 =====
let allDocs = [], filteredDocs = [];
let distributors = [];
let codeReader = null, videoDevices = [], selectedDeviceId = null, currentDeviceIndex = 0;

// Product cache for typeahead
let productsCache = [];
let prodActiveIndex = -1;

// ===== Navbar =====
fetch('/navbar.html').then(r=>r.text()).then(html=>{
  document.getElementById('navbarContainer').innerHTML = html;
  document.querySelectorAll('.nav-link').forEach(link=>{
    if (link.href.endsWith('distributor-pickup.html')){
      link.classList.add('fw-bold','text-decoration-underline');
    }
  });
});

// ===== 工具 =====
function escapeHtml(str){ return (str||'').replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }

// ===== 分銷商主檔 =====
async function loadDistributors(){
  const snap = await db.collection(DIST_COLL).where('status','in',['ACTIVE', null]).orderBy('name').get().catch(async ()=>{
    const s = await db.collection(DIST_COLL).orderBy('name').get();
    return s;
  });
  distributors = snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

function fillDistributorSelect(selectedId){
  const sel = document.getElementById('distributorSelect');
  sel.innerHTML = '<option value="" disabled selected>— 請選擇分銷商 —</option>' +
    distributors.map(d => `<option value="${d.id}">${escapeHtml(d.name||'')}${d.company? ' · '+escapeHtml(d.company): ''}${d.tel? ' · '+escapeHtml(d.tel): ''}</option>`).join('');
  if (selectedId){ sel.value = selectedId; }
  applyDistributorDetails();
  sel.onchange = applyDistributorDetails;
}

function applyDistributorDetails(){
  const id = document.getElementById('distributorSelect').value;
  const d = distributors.find(x=>x.id===id);
  document.getElementById('distContact').value = d?.contactPerson || '';
  document.getElementById('distTel').value = d?.tel || '';
  document.getElementById('distEmail').value = d?.email || '';
}

// ===== 提貨清單 =====
async function loadData(){
  const snap = await db.collection(PICKUP_COLL).orderBy('createdAt','desc').get();
  allDocs = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  applyFilters();
}

function applyFilters(){
  const q = (document.getElementById('searchInput').value||'').trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const dateFromVal = document.getElementById('dateFrom').value;
  const dateToVal = document.getElementById('dateTo').value;

  filteredDocs = allDocs.filter(rec => {
    if (status !== 'ALL' && (rec.status||'OPEN') !== status) return false;
    if (dateFromVal){
      const from = new Date(dateFromVal+'T00:00:00');
      const rDate = rec.pickupDate ? new Date(rec.pickupDate) : null;
      if (!rDate || rDate < from) return false;
    }
    if (dateToVal){
      const to = new Date(dateToVal+'T23:59:59');
      const rDate = rec.pickupDate ? new Date(rec.pickupDate) : null;
      if (!rDate || rDate > to) return false;
    }
    if (q){
      const pool = [
        rec.distributorName||'', rec.distributorCompany||'', rec.distributorContact||'', rec.distributorPhone||'', rec.distributorEmail||'',
        rec.notes||'',
        ...(Array.isArray(rec.items)? rec.items.map(i=> (i.title||'')+' '+(i.barcode||'')) : [])
      ].join(' ').toLowerCase();
      if (!pool.includes(q)) return false;
    }
    return true;
  });
  renderSummary();
  renderList();
  document.getElementById('clearSearchBtn').style.display = q ? 'inline' : 'none';
}

function renderSummary(){
  const total = filteredDocs.length;
  const open = filteredDocs.filter(x => (x.status||'OPEN')==='OPEN').length;
  const picked = filteredDocs.filter(x => x.status==='PICKED').length;
  const cancelled = filteredDocs.filter(x => x.status==='CANCELLED').length;
  document.getElementById('summaryBar').innerHTML = `
    <span class="me-3"><span class="badge-dot status-open"></span>未提貨：${open}</span>
    <span class="me-3"><span class="badge-dot status-picked"></span>已提貨：${picked}</span>
    <span class="me-3"><span class="badge-dot status-cancel"></span>已取消：${cancelled}</span>
    <span class="text-muted">（共 ${total} 筆）</span>`;
}

function renderList(){
  const container = document.getElementById('listContainer');
  container.innerHTML='';
  if (!filteredDocs.length){ container.innerHTML='<div class="list-group-item text-muted">沒有記錄</div>'; return; }
  filteredDocs.forEach(rec=>{
    const status = rec.status || 'OPEN';
    const badge = status==='OPEN' ? '<span class="badge bg-primary">未提貨</span>' : status==='PICKED' ? '<span class="badge bg-success">已提貨</span>' : '<span class="badge bg-secondary">已取消</span>';
    const dateStr = rec.pickupDate ? new Date(rec.pickupDate).toLocaleDateString('zh-HK') : '-';
    const itemsPreview = Array.isArray(rec.items)&&rec.items.length
      ? rec.items.slice(0,3).map(i=>`<span class="item-chip" title="${escapeHtml(i.title||'')}">${escapeHtml((i.title||'').slice(0,16))}×${i.qty||1}</span>`).join(' ')
      : '<span class="text-muted">（未加入貨品）</span>';
    const html = `
      <div class="list-group-item">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-5">
            <div class="fw-semibold truncate" title="${escapeHtml(rec.distributorName||'')}">${escapeHtml(rec.distributorName||'')}</div>
            <div class="small text-muted truncate" title="${escapeHtml(rec.distributorCompany||'')}">${escapeHtml(rec.distributorCompany||'')}</div>
            <div class="kv">聯絡：${escapeHtml(rec.distributorContact||'-')} · ${escapeHtml(rec.distributorPhone||'-')} · ${escapeHtml(rec.distributorEmail||'-')}</div>
          </div>
          <div class="col-6 col-md-2">
            <div>提貨日期</div>
            <div class="fw-semibold">${dateStr}</div>
          </div>
          <div class="col-6 col-md-2">
            <div>狀態</div>
            <div>${badge}</div>
          </div>
          <div class="col-12 col-md-3">
            <div class="mb-2">${itemsPreview}</div>
            <div class="list-actions">
              <button class="btn btn-sm btn-outline-primary" onclick="openEditPickup('${rec.id}')"><i class="bi bi-pencil"></i> 編輯</button>
              ${status!=='PICKED'? `<button class='btn btn-sm btn-success' onclick="updateStatus('${rec.id}','PICKED')"><i class='bi bi-check2-circle'></i> 設為已提貨</button>`:''}
              ${status!=='OPEN'? `<button class='btn btn-sm btn-outline-primary' onclick="updateStatus('${rec.id}','OPEN')"><i class='bi bi-arrow-counterclockwise'></i> 設為未提貨</button>`:''}
              ${status!=='CANCELLED'? `<button class='btn btn-sm btn-secondary' onclick="updateStatus('${rec.id}','CANCELLED')"><i class='bi bi-x-circle'></i> 取消</button>`:''}
              <button class="btn btn-sm btn-outline-danger" onclick="deletePickup('${rec.id}')"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>
      </div>`;
    const div = document.createElement('div'); div.innerHTML=html; container.appendChild(div.firstElementChild);
  });
}

// ===== 搜尋 =====
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('dateFrom').addEventListener('change', applyFilters);
  document.getElementById('dateTo').addEventListener('change', applyFilters);

  document.getElementById('clearSearchBtn').addEventListener('click', ()=>{
    document.getElementById('searchInput').value=''; applyFilters();
  });

  document.getElementById('btnOpenNew').addEventListener('click', openNewPickup);
  document.getElementById('btnExportCSV').addEventListener('click', exportCSV);

  document.getElementById('pickupForm').addEventListener('submit', savePickup);

  // Scan modal open/close
  document.getElementById('scanModal').addEventListener('shown.bs.modal', startScan);
  document.getElementById('scanModal').addEventListener('hidden.bs.modal', stopScan);
  document.getElementById('btnSwitchCam').addEventListener('click', switchCamera);
  document.getElementById('btnScanClose').addEventListener('click', stopScan);

  init();
});

async function init(){
  await Promise.all([loadDistributors(), preloadProducts()]);
  await loadData();

  // global typeahead listeners (也會在 modal 開啟時重掛)
  const ps = document.getElementById("prodSearch");
  if (ps){
    ps.addEventListener("input", onProdSearchInput);
    ps.addEventListener("keydown", onProdSearchKeydown);
    ps.addEventListener("blur", prodSearchBlur);
  }
}

// ===== CRUD：Modal 開啟/編輯 =====
async function openNewPickup(){
  await Promise.all([loadDistributors(), preloadProducts()]);
  resetForm(false); // 不要預設空白列
  fillDistributorSelect();
  document.getElementById('pickupModalTitle').innerText='新增提貨記錄';
  new bootstrap.Modal(document.getElementById('pickupModal')).show();
  wireProductTypeahead();
}

async function openEditPickup(id){
  await Promise.all([loadDistributors(), preloadProducts()]);
  resetForm(false);
  const doc = await db.collection(PICKUP_COLL).doc(id).get();
  if (!doc.exists){ alert('記錄不存在'); return; }
  const data = doc.data();
  document.getElementById('docId').value = id;
  fillDistributorSelect(data.distributorId);
  // 若 master 已刪除，暫加一個 option
  if (data.distributorId && !distributors.find(d=>d.id===data.distributorId)){
    const sel = document.getElementById('distributorSelect');
    const opt = document.createElement('option');
    opt.value = data.distributorId; opt.textContent = data.distributorName || '(已刪除的分銷商)';
    sel.appendChild(opt); sel.value = data.distributorId; applyDistributorDetails();
  }
  if (data.pickupDate){
    const d = new Date(data.pickupDate); document.getElementById('pickupDate').value = d.toISOString().slice(0,10);
  }
  document.getElementById('status').value = data.status || 'OPEN';
  document.getElementById('notes').value = data.notes || '';

  // 顯示欄位以保存時的資料為準
  document.getElementById('distContact').value = data.distributorContact || '';
  document.getElementById('distTel').value = data.distributorPhone || '';
  document.getElementById('distEmail').value = data.distributorEmail || '';

  const items = Array.isArray(data.items)? data.items:[];
  items.forEach(addItemRowWithData);

  document.getElementById('pickupModalTitle').innerText='編輯提貨記錄';
  new bootstrap.Modal(document.getElementById('pickupModal')).show();
  wireProductTypeahead();
}

function resetForm(addDefaultRow = false){
  document.getElementById('pickupForm').reset();
  document.getElementById('docId').value='';
  document.getElementById('itemsTbody').innerHTML='';
  if (addDefaultRow) addItemRow();
  const ps = document.getElementById('prodSearch');
  const pr = document.getElementById('prodResults');
  if (ps) ps.value = '';
  if (pr) { pr.innerHTML=''; pr.style.display='none'; }
}

// ===== Items table (name & barcode locked; photo thumbnail; no change-photo btn) =====
function addItemRow(){ addItemRowWithData({ title:'', barcode:'', qty:1, imageUrl:'' }); }

function addItemRowWithData(item){
  const tr = document.createElement('tr');
  const img = escapeHtml(item.imageUrl || '');
  tr.innerHTML = `
    <td>
      <input name="title" type="text" class="form-control form-control-sm form-control-locked" placeholder="名稱（由搜尋/掃碼帶入）" value="${escapeHtml(item.title||'')}" readonly />
    </td>
    <td>
      <input name="barcode" type="text" class="form-control form-control-sm form-control-locked" placeholder="條碼（由搜尋/掃碼帶入）" value="${escapeHtml(item.barcode||'')}" readonly />
    </td>
    <td style="max-width:110px">
      <input name="qty" type="number" min="1" class="form-control form-control-sm" value="${item.qty||1}" />
    </td>
    <td class="text-center">
      <a href="${img || '#'}" target="_blank" tabindex="-1" ${img ? '' : 'class="disabled"'} title="開新視窗查看">
        <img src="${img || '/images/truly_favicon_o1.png'}" class="thumb-48 border rounded" alt="img" onerror="this.src='/images/truly_favicon_o1.png'">
      </a>
      <input name="imageUrl" type="hidden" value="${img}">
    </td>
    <td>
      <button class="btn btn-sm btn-outline-danger" type="button" onclick="this.closest('tr').remove()"><i class="bi bi-x"></i></button>
    </td>`;
  document.getElementById('itemsTbody').appendChild(tr);
}

function collectItems(){
  return Array.from(document.querySelectorAll('#itemsTbody tr')).map(r=>{
    const title = r.querySelector('input[name="title"]');
    const barcode = r.querySelector('input[name="barcode"]');
    const qty = r.querySelector('input[name="qty"]');
    const imageUrl = r.querySelector('input[name="imageUrl"]');
    return {
      title: title.value.trim(),
      barcode: barcode.value.trim(),
      qty: Math.max(1, parseInt(qty.value,10)||1),
      imageUrl: imageUrl.value.trim()
    };
  }).filter(i=> i.title || i.barcode);
}

// ===== Save / Delete / Status =====
async function savePickup(e){
  e.preventDefault();
  const id = document.getElementById('docId').value;
  const selId = document.getElementById('distributorSelect').value;
  const d = distributors.find(x=>x.id===selId);
  if (!d){ alert('請選擇分銷商'); return; }
  const payload = {
    distributorId: selId,
    distributorName: d.name || '',
    distributorCompany: d.company || '',
    distributorContact: d.contactPerson || '',
    distributorPhone: d.tel || '',
    distributorEmail: d.email || '',
    pickupDate: document.getElementById('pickupDate').value ? new Date(document.getElementById('pickupDate').value).toISOString() : null,
    status: document.getElementById('status').value,
    notes: document.getElementById('notes').value.trim(),
    items: collectItems(),
    updatedAt: new Date().toISOString()
  };
  if (!payload.pickupDate){ alert('請填寫提貨日期'); return; }
  if (id){
    await db.collection(PICKUP_COLL).doc(id).set(payload,{ merge:true });
  } else {
    payload.createdAt = new Date().toISOString();
    const ref = await db.collection(PICKUP_COLL).add(payload);
    document.getElementById('docId').value = ref.id;
  }
  bootstrap.Modal.getInstance(document.getElementById('pickupModal')).hide();
  await loadData();
}

async function deletePickup(id){
  if (!confirm('確定刪除這筆記錄？')) return;
  await db.collection(PICKUP_COLL).doc(id).delete();
  await loadData();
}
async function updateStatus(id, s){
  await db.collection(PICKUP_COLL).doc(id).set({ status:s, updatedAt:new Date().toISOString() },{ merge:true });
  await loadData();
}

// ===== Product Typeahead (pricetaglabel) =====
async function preloadProducts() {
  const snap = await db.collection(PRODUCT_COLL).get();
  productsCache = snap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id,
      Title: x.Title || "",
      ProductNameEng: x.ProductNameEng || x.Title || "",
      ProductNameChi: x.ProductNameChi || "",
      Barcode: String(x.Barcode || "").trim(),
      ImageURL: x["Image URL"] || ""
    };
  });
}
function normalize(s){ return String(s||"").toLowerCase(); }
function filterProducts(term) {
  if (!term || term.length < 2) return [];
  const t = normalize(term);
  const out = [];
  for (const p of productsCache) {
    if (
      normalize(p.ProductNameEng).includes(t) ||
      normalize(p.ProductNameChi).includes(t) ||
      normalize(p.Title).includes(t) ||
      normalize(p.Barcode).includes(t)
    ) {
      out.push(p);
      if (out.length >= 30) break;
    }
  }
  return out;
}
function showProdResults(list) {
  const box = document.getElementById("prodResults");
  if (!list.length) { hideProdResults(); return; }
  prodActiveIndex = -1;
  box.innerHTML = list.map((p, i)=>`
    <div class="prod-item" data-idx="${i}">
      <div class="d-flex align-items-start gap-2">
        <img src="${p.ImageURL || '/images/truly_favicon_o1.png'}" class="thumb-48 border rounded" alt="">
        <div class="flex-grow-1">
          <div class="fw-semibold">${escapeHtml(p.ProductNameEng || p.Title)}</div>
          <div class="text-muted small">${escapeHtml(p.ProductNameChi || "")}</div>
          <div class="small"><span class="badge bg-light text-dark prod-badge">條碼: ${escapeHtml(p.Barcode||'-')}</span></div>
        </div>
      </div>
    </div>
  `).join("");
  box.style.display = "block";
  [...box.querySelectorAll(".prod-item")].forEach(el=>{
    el.addEventListener("click", ()=>{
      const idx = Number(el.dataset.idx);
      chooseProduct(list[idx]);
    });
  });
}
function hideProdResults() {
  const box = document.getElementById("prodResults");
  box.style.display = "none";
  box.innerHTML = "";
  prodActiveIndex = -1;
}
function chooseProduct(p) {
  if (!p) return;
  addItemRowWithData({
    title: p.ProductNameEng || p.Title || "",
    barcode: p.Barcode || "",
    qty: 1,
    imageUrl: p.ImageURL || ""
  });
  const ps = document.getElementById("prodSearch");
  ps.value = "";
  hideProdResults();
  setTimeout(()=>{
    const rows = document.querySelectorAll('#itemsTbody tr');
    const last = rows[rows.length-1];
    if (!last) return;
    const qty = last.querySelector('input[name="qty"]');
    if (qty) qty.focus();
  }, 60);
}
function debounce(fn, wait=150){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }
const onProdSearchInput = debounce(()=>{
  const term = document.getElementById("prodSearch").value.trim();
  showProdResults(filterProducts(term));
}, 200);
function onProdSearchKeydown(e) {
  const box = document.getElementById("prodResults");
  if (box.style.display !== "block") return;
  const items = [...box.querySelectorAll(".prod-item")];
  if (!items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    prodActiveIndex = (e.key === "ArrowDown")
      ? (prodActiveIndex + 1) % items.length
      : (prodActiveIndex - 1 + items.length) % items.length;
    items.forEach((el,i)=> el.classList.toggle("active", i===prodActiveIndex));
    items[prodActiveIndex].scrollIntoView({block:"nearest"});
  } else if (e.key === "Enter") {
    e.preventDefault();
    const list = filterProducts(document.getElementById("prodSearch").value.trim());
    if (list.length && prodActiveIndex >= 0) chooseProduct(list[prodActiveIndex]);
  } else if (e.key === "Escape") {
    hideProdResults();
  }
}
function prodSearchBlur(){ setTimeout(()=> hideProdResults(), 150); }
function wireProductTypeahead(){
  const ps = document.getElementById("prodSearch");
  if (!ps) return;
  ps.removeEventListener("input", onProdSearchInput);
  ps.removeEventListener("keydown", onProdSearchKeydown);
  ps.removeEventListener("blur", prodSearchBlur);
  ps.addEventListener("input", onProdSearchInput);
  ps.addEventListener("keydown", onProdSearchKeydown);
  ps.addEventListener("blur", prodSearchBlur);
}

// ===== 掃碼加入貨品 =====
async function startScan(){
  const video = document.getElementById('qr-video');
  codeReader = new ZXing.BrowserMultiFormatReader();
  videoDevices = await codeReader.listVideoInputDevices();
  if (!videoDevices.length){ alert('未偵測到相機'); return; }
  if (selectedDeviceId===null){
    const back = videoDevices.find(d=>/back|rear|environment/i.test(d.label));
    selectedDeviceId = (back&&back.deviceId) || videoDevices[0].deviceId;
    currentDeviceIndex = videoDevices.findIndex(d=>d.deviceId===selectedDeviceId);
  }
  try {
    await codeReader.decodeFromVideoDevice(selectedDeviceId, video, async (result, err) => {
      if (result){
        const code=result.getText();
        await handleScannedCode(code);
        stopScan();
        bootstrap.Modal.getInstance(document.getElementById('scanModal')).hide();
      }
    });
  } catch(e){ alert('鏡頭錯誤：'+e); stopScan(); }
}

async function handleScannedCode(barcode){
  try {
    const q = await db.collection(PRODUCT_COLL).where('Barcode','==',barcode).limit(1).get();
    let title='', imageUrl='';
    if (!q.empty){
      const d=q.docs[0].data();
      title=d.ProductNameEng || d.Title || '';
      imageUrl=d["Image URL"] || '';
    }
    addItemRowWithData({ title: title||'', barcode, qty:1, imageUrl });
  } catch(e){
    addItemRowWithData({ title:'', barcode, qty:1, imageUrl:'' });
  }
}

async function switchCamera(){
  if (!videoDevices.length) return;
  currentDeviceIndex=(currentDeviceIndex+1)%videoDevices.length;
  selectedDeviceId=videoDevices[currentDeviceIndex].deviceId;
  if (codeReader){ await codeReader.reset(); }
  setTimeout(startScan,200);
}
function stopScan(){ if (codeReader){ codeReader.reset(); codeReader=null; } }

// ===== 匯出 CSV =====
function exportCSV(){
  const rows=[[ 'ID','分銷商','公司','聯絡人','電話','電郵','提貨日期','狀態','備註','品項明細','建立時間','更新時間' ]];
  filteredDocs.forEach(r=>{
    const itemsText=(r.items||[]).map(i=>`${(i.title||'').replace(/,/g,' ')} x${i.qty||1} [${i.barcode||''}]`).join(' | ');
    rows.push([
      r.id,
      r.distributorName||'', r.distributorCompany||'', r.distributorContact||'', r.distributorPhone||'', r.distributorEmail||'',
      r.pickupDate||'', r.status||'', (r.notes||'').replace(/\n/g,' '), itemsText, r.createdAt||'', r.updatedAt||''
    ]);
  });
  const csv = rows.map(arr=>arr.map(c=>`"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{ type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`distributor_pickups_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// 讓 date 欄位在有值時隱藏內嵌提示
function syncDatePlaceholder(el){
  const wrap = el.closest('.date-wrap');
  if (!wrap) return;
  if (el.value) wrap.classList.add('has-value');
  else wrap.classList.remove('has-value');
}

['dateFrom','dateTo'].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  // 初始同步（如果有預設值）
  syncDatePlaceholder(el);
  // 變更時同步
  el.addEventListener('change', ()=>syncDatePlaceholder(el));
  el.addEventListener('input',  ()=>syncDatePlaceholder(el));
  // 亦可選：輸入框點擊時直接打開原生日期選擇器
  el.addEventListener('focus', ()=>{ if (el.showPicker) try{ el.showPicker(); }catch(e){} });
});

// ===== 初始化 =====
async function preloadProducts() { /* defined above; kept for order */ }

window.openNewPickup = openNewPickup;
window.openEditPickup = openEditPickup;
window.updateStatus = updateStatus;
window.deletePickup = deletePickup;
window.switchCamera = switchCamera;
window.exportCSV = exportCSV;
