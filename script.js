/* ============================================
   TITCH OTC — script.js
   Full functionality: orders, admin, reviews
   ============================================ */

// ===== DEFAULT ADMIN SETTINGS =====
const DEFAULT_SETTINGS = {
  buyRate: 168.50,
  sellRate: 164.00,
  mpesa: '+254 700 000 000',
  trc20: 'TXYZAbcDefGhiJklMnoPqrStUvWxYz1234',
  binanceUid: '123456789',
  okxUid: '987654321',
  bybitUid: '112233445',
  adminUser: 'admin',
  adminPass: 'titch2024'
};

// ===== STATE =====
let settings = JSON.parse(localStorage.getItem('titchSettings')) || { ...DEFAULT_SETTINGS };
let orders = JSON.parse(localStorage.getItem('titchOrders')) || [];
let reviews = JSON.parse(localStorage.getItem('titchReviews')) || getDefaultReviews();
let sellSelectedExchange = '';
let buySelectedExchange = '';
let sellPayoutMethod = 'mpesa';
let selectedStars = 0;
let adminLoggedIn = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  updateRateDisplays();
  renderReviews();
  setupStarInput();
  loadOrdersList();
  // populate admin fields
  loadAdminSettings();
});

// ===== PAGE NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'track') loadOrdersList();
  if (page === 'admin') {
    if (adminLoggedIn) showAdminDash();
    else showAdminLogin();
  }
}

// ===== HAMBURGER =====
function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ===== TAB SWITCH (How It Works) =====
function switchTab(id) {
  document.querySelectorAll('.hiw-grid').forEach(g => g.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

// ===== RATES =====
function updateRateDisplays() {
  // Load tiered rates
  const tiers = JSON.parse(localStorage.getItem('titchTiers')) || [
    {label:'1-5',buy:165,sell:160},
    {label:'6-11',buy:166,sell:161},
    {label:'12-18',buy:167,sell:162},
    {label:'19-30',buy:168,sell:163},
    {label:'31+',buy:169,sell:164}
  ];

  // Update tiered rate table on homepage
  for (let i = 1; i <= 5; i++) {
    const t = tiers[i-1];
    const buyEl = document.getElementById('t'+i+'buy');
    const sellEl = document.getElementById('t'+i+'sell');
    if (buyEl) buyEl.textContent = t.buy ? 'KES ' + t.buy.toFixed(2) : '—';
    if (sellEl) sellEl.textContent = t.sell ? 'KES ' + t.sell.toFixed(2) : '—';
  }

  // Hero card — show tier 1 and tier 5
  ['hT1buy','hT1sell','hT5buy','hT5sell'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const tierIdx = i < 2 ? 0 : 4;
    const isBuy = i % 2 === 0;
    const val = isBuy ? tiers[tierIdx].buy : tiers[tierIdx].sell;
    el.textContent = val ? val.toFixed(2) : '—';
  });

  // Fallback for sell/buy form calcs (use mid-tier)
  settings.buyRate = tiers[2].buy || 167;
  settings.sellRate = tiers[2].sell || 162;

  // Form rate displays
  if (document.getElementById('sellRateDisplay')) document.getElementById('sellRateDisplay').textContent = settings.sellRate.toFixed(2);
  if (document.getElementById('buyRateDisplay')) document.getElementById('buyRateDisplay').textContent = settings.buyRate.toFixed(2);

  // Admin payment fields
  if (document.getElementById('adminMpesaDisplay')) document.getElementById('adminMpesaDisplay').value = settings.mpesa;
  if (document.getElementById('adminTrc20Display')) document.getElementById('adminTrc20Display').value = settings.trc20;

  // Daily update banner
  loadDailyUpdate();
}

function loadDailyUpdate() {
  const updates = JSON.parse(localStorage.getItem('titchUpdates')) || [];
  const banner = document.getElementById('dailyUpdateBanner');
  if (!banner) return;
  if (updates.length) {
    const latest = updates[0];
    document.getElementById('dailyUpdateText').textContent = latest.text;
    document.getElementById('dailyUpdateTime').textContent = latest.time;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

// ===== EXCHANGE SELECTION =====
function selectExchange(el, type) {
  const picker = el.closest('.exchange-picker');
  picker.querySelectorAll('.ep-option').forEach(e => e.classList.remove('active'));
  el.classList.add('active');

  if (type === 'sell') {
    sellSelectedExchange = el.dataset.val;
    // Show/hide UID row
    const isExternal = sellSelectedExchange === 'External Wallet';
    document.getElementById('uidRow').style.display = isExternal ? 'none' : 'block';
    document.getElementById('uidLabel').textContent = sellSelectedExchange;
    // Set UID value
    const uid = getUidForExchange(sellSelectedExchange);
    if (document.getElementById('adminUidDisplay')) document.getElementById('adminUidDisplay').value = uid;
  } else {
    buySelectedExchange = el.dataset.val;
    const label = buySelectedExchange === 'External Wallet' ? 'TRC20 Wallet Address' : buySelectedExchange + ' UID / Wallet Address';
    document.getElementById('buyWalletLabel').textContent = label;
  }
}

function getUidForExchange(exchange) {
  if (exchange === 'Binance') return settings.binanceUid;
  if (exchange === 'OKX') return settings.okxUid;
  if (exchange === 'Bybit') return settings.bybitUid;
  return '';
}

// ===== PAYOUT METHOD =====
function selectPayout(method) {
  sellPayoutMethod = method;
  document.getElementById('payMpesa').classList.toggle('active', method === 'mpesa');
  document.getElementById('payBank').classList.toggle('active', method === 'bank');
  document.getElementById('mpesaFields').classList.toggle('hidden', method !== 'mpesa');
  document.getElementById('bankFields').classList.toggle('hidden', method !== 'bank');
}

// ===== SELL FLOW =====
function sellNext1() {
  // Validate
  if (!sellSelectedExchange) { showToast('Please select an exchange / wallet'); return; }
  if (sellPayoutMethod === 'mpesa') {
    if (!document.getElementById('sellFullName').value.trim()) { showToast('Please enter your full name'); return; }
    if (!document.getElementById('sellPhone').value.trim()) { showToast('Please enter your phone number'); return; }
  } else {
    if (!document.getElementById('sellBankFullName').value.trim()) { showToast('Please enter your full name'); return; }
    if (!document.getElementById('sellBankName').value.trim()) { showToast('Please enter bank name'); return; }
    if (!document.getElementById('sellAccNum').value.trim()) { showToast('Please enter account number'); return; }
  }

  setFsi('fsi', 2);
  showSellStep(2);
  document.getElementById('sellRateDisplay').textContent = settings.sellRate.toFixed(2);
}

function sellBack1() { setFsi('fsi', 1); showSellStep(1); }

function sellNext2() {
  const amt = parseFloat(document.getElementById('sellUsdt').value);
  if (!amt || amt <= 0) { showToast('Please enter a valid USDT amount'); return; }
  setFsi('fsi', 3);
  showSellStep(3);

  // Set receive details
  document.getElementById('adminTrc20Display').value = settings.trc20;
  const uid = getUidForExchange(sellSelectedExchange);
  document.getElementById('adminUidDisplay').value = uid;
  document.getElementById('uidRow').style.display = sellSelectedExchange === 'External Wallet' ? 'none' : 'block';
  document.getElementById('uidLabel').textContent = sellSelectedExchange;
}

function sellBack2() { setFsi('fsi', 2); showSellStep(2); }

function submitSell() {
  const fileInput = document.getElementById('sellProofFile');
  if (!fileInput.files.length) { showToast('Please upload your screenshot proof'); return; }

  const txId = generateTxId('SELL');
  const order = {
    id: txId,
    type: 'sell',
    exchange: sellSelectedExchange,
    payout: sellPayoutMethod,
    name: sellPayoutMethod === 'mpesa' ? document.getElementById('sellFullName').value : document.getElementById('sellBankFullName').value,
    phone: sellPayoutMethod === 'mpesa' ? document.getElementById('sellPhone').value : '',
    bank: sellPayoutMethod === 'bank' ? document.getElementById('sellBankName').value : '',
    accNum: sellPayoutMethod === 'bank' ? document.getElementById('sellAccNum').value : '',
    usdt: parseFloat(document.getElementById('sellUsdt').value),
    kes: parseFloat(document.getElementById('sellKesResult').textContent.replace('KES ', '')),
    status: 'pending',
    date: new Date().toLocaleString(),
    proofName: fileInput.files[0].name
  };

  orders.unshift(order);
  saveOrders();
  document.getElementById('sellTxId').value = txId;
  showSellStep('success');
  showToast('Order submitted successfully!');
  resetSellForm();
}

function showSellStep(step) {
  document.querySelectorAll('#sellFormCard .form-step').forEach(s => s.classList.add('hidden'));
  if (step === 'success') {
    document.getElementById('sellSuccess').classList.remove('hidden');
  } else {
    document.getElementById('sellStep' + step).classList.remove('hidden');
  }
}

function resetSellForm() {
  sellSelectedExchange = '';
  sellPayoutMethod = 'mpesa';
}

function calcSell() {
  const usdt = parseFloat(document.getElementById('sellUsdt').value) || 0;
  const kes = (usdt * settings.sellRate).toFixed(2);
  document.getElementById('sellKesResult').textContent = 'KES ' + parseFloat(kes).toLocaleString('en-KE', { minimumFractionDigits: 2 });
}

// ===== BUY FLOW =====
function buyNext1() {
  if (!buySelectedExchange) { showToast('Please select an exchange / wallet'); return; }
  const addr = document.getElementById('buyWalletAddr').value.trim();
  const confirm = document.getElementById('buyWalletConfirm').value.trim();
  if (!addr) { showToast('Please enter your wallet address or UID'); return; }
  if (addr !== confirm) { showToast('Addresses do not match — please confirm again'); return; }

  setBFsi(2);
  showBuyStep(2);
  document.getElementById('buyRateDisplay').textContent = settings.buyRate.toFixed(2);
}

function buyBack1() { setBFsi(1); showBuyStep(1); }

function buyNext2() {
  const kesInput = document.getElementById('buyKes');
  const usdtInput = document.getElementById('buyUsdt');
  const val = parseFloat(kesInput.style.display === 'none' || document.getElementById('kesInputGroup').classList.contains('hidden')
    ? usdtInput.value : kesInput.value);
  if (!val || val <= 0) { showToast('Please enter a valid amount'); return; }

  setBFsi(3);
  showBuyStep(3);

  // Set exact amount
  const isKes = !document.getElementById('kesInputGroup').classList.contains('hidden');
  const kesAmt = isKes ? parseFloat(kesInput.value) : parseFloat(usdtInput.value) * settings.buyRate;
  document.getElementById('buyExactAmount').value = 'KES ' + kesAmt.toLocaleString('en-KE', { minimumFractionDigits: 2 });
  document.getElementById('adminMpesaDisplay').value = settings.mpesa;
}

function buyBack2() { setBFsi(2); showBuyStep(2); }

function submitBuy() {
  const fileInput = document.getElementById('buyProofFile');
  if (!fileInput.files.length) { showToast('Please upload your M-Pesa screenshot'); return; }

  const isKes = !document.getElementById('kesInputGroup').classList.contains('hidden');
  const kesAmt = isKes
    ? parseFloat(document.getElementById('buyKes').value)
    : parseFloat(document.getElementById('buyUsdt').value) * settings.buyRate;
  const usdtAmt = isKes
    ? parseFloat(document.getElementById('buyKes').value) / settings.buyRate
    : parseFloat(document.getElementById('buyUsdt').value);

  const txId = generateTxId('BUY');
  const order = {
    id: txId,
    type: 'buy',
    exchange: buySelectedExchange,
    walletAddr: document.getElementById('buyWalletAddr').value.trim(),
    kes: kesAmt,
    usdt: usdtAmt.toFixed(4),
    status: 'pending',
    date: new Date().toLocaleString(),
    proofName: fileInput.files[0].name
  };

  orders.unshift(order);
  saveOrders();
  document.getElementById('buyTxId').value = txId;
  showBuyStep('success');
  showToast('Order submitted successfully!');
}

function showBuyStep(step) {
  document.querySelectorAll('#buyFormCard .form-step').forEach(s => s.classList.add('hidden'));
  if (step === 'success') {
    document.getElementById('buySuccess').classList.remove('hidden');
  } else {
    document.getElementById('buyStep' + step).classList.remove('hidden');
  }
}

function selectBuyInput(type) {
  document.getElementById('inputKes').classList.toggle('active', type === 'kes');
  document.getElementById('inputUsdt').classList.toggle('active', type === 'usdt');
  document.getElementById('kesInputGroup').classList.toggle('hidden', type !== 'kes');
  document.getElementById('usdtInputGroup').classList.toggle('hidden', type !== 'usdt');
  if (type === 'kes') {
    document.getElementById('buyCalcLabel').textContent = 'You will receive';
    document.getElementById('buyResult').textContent = '0.00 USDT';
  } else {
    document.getElementById('buyCalcLabel').textContent = 'You will pay';
    document.getElementById('buyResult').textContent = 'KES 0.00';
  }
}

function calcBuyFromKes() {
  const kes = parseFloat(document.getElementById('buyKes').value) || 0;
  const usdt = (kes / settings.buyRate).toFixed(4);
  document.getElementById('buyResult').textContent = usdt + ' USDT';
}

function calcBuyFromUsdt() {
  const usdt = parseFloat(document.getElementById('buyUsdt').value) || 0;
  const kes = (usdt * settings.buyRate).toFixed(2);
  document.getElementById('buyResult').textContent = 'KES ' + parseFloat(kes).toLocaleString('en-KE', { minimumFractionDigits: 2 });
}

// ===== FORM STEP INDICATOR HELPERS =====
function setFsi(prefix, step) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(prefix + i);
    if (el) el.classList.toggle('active', i === step);
  }
}

function setBFsi(step) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('bfsi' + i);
    if (el) el.classList.toggle('active', i === step);
  }
}

// ===== FILE UPLOAD =====
function fileSelected(input, labelId) {
  const label = document.getElementById(labelId);
  if (input.files.length) {
    label.textContent = '✓ ' + input.files[0].name;
    label.style.color = 'var(--green)';
  }
}

// ===== COPY TO CLIPBOARD =====
function copyField(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => showToast('Copied to clipboard!')).catch(() => {
    el.select();
    document.execCommand('copy');
    showToast('Copied!');
  });
}

// ===== TRACK ORDER =====
function trackOrder() {
  const query = document.getElementById('trackInput').value.trim();
  if (!query) { showToast('Please enter a Transaction ID or phone number'); return; }

  const order = orders.find(o =>
    o.id.toLowerCase() === query.toLowerCase() ||
    (o.phone && o.phone === query)
  );

  const resultEl = document.getElementById('trackResult');
  if (!order) {
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `<p style="color:var(--text2);text-align:center;padding:20px">No order found for "<strong>${escapeHtml(query)}</strong>"</p>`;
    return;
  }

  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
      <strong style="color:var(--green);font-family:'Syne',sans-serif">${order.id}</strong>
      <span class="status-badge ${order.status}">${statusLabel(order.status)}</span>
    </div>
    <div class="tr-row"><span class="tr-label">Type</span><span class="tr-val">${order.type === 'buy' ? '🟢 Buy Crypto' : '🔴 Sell Crypto'}</span></div>
    <div class="tr-row"><span class="tr-label">Exchange</span><span class="tr-val">${order.exchange}</span></div>
    <div class="tr-row"><span class="tr-label">USDT Amount</span><span class="tr-val">${order.usdt} USDT</span></div>
    <div class="tr-row"><span class="tr-label">KES Amount</span><span class="tr-val">KES ${parseFloat(order.kes).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span></div>
    ${order.phone ? `<div class="tr-row"><span class="tr-label">Phone</span><span class="tr-val">${order.phone}</span></div>` : ''}
    <div class="tr-row"><span class="tr-label">Submitted</span><span class="tr-val">${order.date}</span></div>
  `;
}

// ===== ORDER LIST =====
function loadOrdersList() {
  const el = document.getElementById('ordersList');
  if (!el) return;
  if (!orders.length) {
    el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px">No orders found.</p>';
    return;
  }
  el.innerHTML = orders.slice(0, 10).map(o => `
    <div class="order-item" onclick="showOrderDetail('${o.id}')">
      <div class="oi-header">
        <span class="oi-id">${o.id}</span>
        <span class="status-badge ${o.status}">${statusLabel(o.status)}</span>
      </div>
      <div class="oi-details">${o.type.toUpperCase()} · ${o.exchange} · ${o.usdt} USDT · ${o.date}</div>
    </div>
  `).join('');
}

function showOrderDetail(id) {
  document.getElementById('trackInput').value = id;
  trackOrder();
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

// ===== REVIEWS =====
function setupStarInput() {
  const stars = document.querySelectorAll('#starInput .fa-star');
  stars.forEach((star, i) => {
    star.addEventListener('click', () => {
      selectedStars = i + 1;
      stars.forEach((s, j) => s.classList.toggle('active', j < selectedStars));
    });
    star.addEventListener('mouseover', () => {
      stars.forEach((s, j) => s.classList.toggle('active', j <= i));
    });
    star.addEventListener('mouseout', () => {
      stars.forEach((s, j) => s.classList.toggle('active', j < selectedStars));
    });
  });
}

function submitReview() {
  if (!selectedStars) { showToast('Please select a star rating'); return; }
  const text = document.getElementById('reviewText').value.trim();
  if (!text) { showToast('Please write your review'); return; }

  const review = {
    id: Date.now(),
    name: document.getElementById('reviewName').value.trim() || 'Anonymous',
    stars: selectedStars,
    text,
    date: new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }),
    visible: true
  };

  reviews.unshift(review);
  saveReviews();
  renderReviews();

  document.getElementById('reviewName').value = '';
  document.getElementById('reviewText').value = '';
  selectedStars = 0;
  document.querySelectorAll('#starInput .fa-star').forEach(s => s.classList.remove('active'));
  showToast('Thank you for your review!');
}

function renderReviews() {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  const visible = reviews.filter(r => r.visible !== false);
  if (!visible.length) {
    grid.innerHTML = '<p style="color:var(--text3)">No reviews yet. Be the first!</p>';
    return;
  }
  grid.innerHTML = visible.slice(0, 6).map(r => `
    <div class="review-card">
      <div class="review-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <p class="review-text">${escapeHtml(r.text)}</p>
      <span class="review-name">— ${escapeHtml(r.name)} · ${r.date}</span>
    </div>
  `).join('');
}

// ===== ADMIN =====
function showAdminLogin() {
  document.getElementById('adminLogin').classList.remove('hidden');
  document.getElementById('adminDash').classList.add('hidden');
}

function showAdminDash() {
  document.getElementById('adminLogin').classList.add('hidden');
  document.getElementById('adminDash').classList.remove('hidden');
  loadAdminSettings();
  renderAdminOrders('all');
  renderAdminReviews();
}

function adminLogin() {
  const user = document.getElementById('adminUser').value;
  const pass = document.getElementById('adminPass').value;
  const errEl = document.getElementById('adminErr');

  if (user === settings.adminUser && pass === settings.adminPass) {
    adminLoggedIn = true;
    errEl.classList.add('hidden');
    showAdminDash();
  } else {
    errEl.classList.remove('hidden');
  }
}

function adminLogout() {
  adminLoggedIn = false;
  showAdminLogin();
}

function loadAdminSettings() {
  const fields = ['buyRate', 'sellRate', 'mpesa', 'trc20', 'binanceUid', 'okxUid', 'bybitUid'];
  fields.forEach(f => {
    const el = document.getElementById('admin' + capitalize(f));
    if (el) el.value = settings[f];
  });
}

function saveSettings() {
  settings.buyRate = parseFloat(document.getElementById('adminBuyRate').value) || settings.buyRate;
  settings.sellRate = parseFloat(document.getElementById('adminSellRate').value) || settings.sellRate;
  settings.mpesa = document.getElementById('adminMpesa').value || settings.mpesa;
  settings.trc20 = document.getElementById('adminTrc20').value || settings.trc20;
  settings.binanceUid = document.getElementById('adminBinanceUid').value || settings.binanceUid;
  settings.okxUid = document.getElementById('adminOkxUid').value || settings.okxUid;
  settings.bybitUid = document.getElementById('adminBybitUid').value || settings.bybitUid;

  localStorage.setItem('titchSettings', JSON.stringify(settings));
  updateRateDisplays();

  const saved = document.getElementById('settingsSaved');
  saved.classList.remove('hidden');
  setTimeout(() => saved.classList.add('hidden'), 3000);
  showToast('Settings saved!');
}

function renderAdminOrders(filter) {
  const el = document.getElementById('adminOrdersList');
  if (!el) return;
  let filtered = orders;
  if (filter !== 'all') filtered = orders.filter(o => o.status === filter);

  if (!filtered.length) {
    el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px">No orders found.</p>';
    return;
  }

  el.innerHTML = filtered.map(o => `
    <div class="admin-order-card" id="aoc-${o.id}">
      <div class="aoc-header">
        <span class="aoc-id">${o.id}</span>
        <span class="aoc-type ${o.type}">${o.type.toUpperCase()}</span>
        <span class="status-badge ${o.status}">${statusLabel(o.status)}</span>
        <span style="font-size:0.78rem;color:var(--text3)">${o.date}</span>
      </div>
      <div class="aoc-details">
        <div class="aoc-detail"><span>Exchange</span><strong>${o.exchange}</strong></div>
        <div class="aoc-detail"><span>USDT</span><strong>${o.usdt} USDT</strong></div>
        <div class="aoc-detail"><span>KES</span><strong>KES ${parseFloat(o.kes).toLocaleString('en-KE', {minimumFractionDigits:2})}</strong></div>
        ${o.name ? `<div class="aoc-detail"><span>Name</span><strong>${escapeHtml(o.name)}</strong></div>` : ''}
        ${o.phone ? `<div class="aoc-detail"><span>Phone</span><strong>${o.phone}</strong></div>` : ''}
        ${o.bank ? `<div class="aoc-detail"><span>Bank</span><strong>${escapeHtml(o.bank)}</strong></div>` : ''}
        ${o.accNum ? `<div class="aoc-detail"><span>Account</span><strong>${o.accNum}</strong></div>` : ''}
        ${o.walletAddr ? `<div class="aoc-detail"><span>Wallet/UID</span><strong style="word-break:break-all">${escapeHtml(o.walletAddr)}</strong></div>` : ''}
        <div class="aoc-detail"><span>Proof</span><strong>📎 ${escapeHtml(o.proofName || 'N/A')}</strong></div>
      </div>
      <div class="aoc-actions">
        <button class="action-btn process" onclick="updateOrderStatus('${o.id}', 'processing')">Mark Processing</button>
        <button class="action-btn approve" onclick="updateOrderStatus('${o.id}', 'completed')">Mark Completed</button>
        <button class="action-btn reject" onclick="updateOrderStatus('${o.id}', 'rejected')">Reject</button>
      </div>
    </div>
  `).join('');
}

function updateOrderStatus(id, status) {
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    saveOrders();
    renderAdminOrders('all');
    showToast('Order updated to ' + status);
  }
}

function filterOrders(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAdminOrders(filter);
}

function renderAdminReviews() {
  const el = document.getElementById('adminReviewsList');
  if (!el) return;
  if (!reviews.length) {
    el.innerHTML = '<p style="color:var(--text3)">No reviews yet.</p>';
    return;
  }
  el.innerHTML = reviews.map(r => `
    <div class="admin-order-card" style="margin-bottom:10px">
      <div class="aoc-header">
        <strong style="color:#fff">${escapeHtml(r.name)}</strong>
        <span style="color:#f0b90b">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</span>
        <span style="font-size:0.78rem;color:var(--text3)">${r.date}</span>
      </div>
      <p style="font-size:0.88rem;color:var(--text2);margin-bottom:12px">${escapeHtml(r.text)}</p>
      <button class="action-btn ${r.visible === false ? 'approve' : 'reject'}" onclick="toggleReview(${r.id})">
        ${r.visible === false ? 'Show Review' : 'Hide Review'}
      </button>
    </div>
  `).join('');
}

function toggleReview(id) {
  const review = reviews.find(r => r.id === id);
  if (review) {
    review.visible = review.visible === false ? true : false;
    saveReviews();
    renderAdminReviews();
    renderReviews();
  }
}

// ===== STORAGE =====
function saveOrders() { localStorage.setItem('titchOrders', JSON.stringify(orders)); }
function saveReviews() { localStorage.setItem('titchReviews', JSON.stringify(reviews)); }

// ===== UTILS =====
function generateTxId(type) {
  const rand = Math.random().toString(36).substr(2, 8).toUpperCase();
  return `TTC-${type}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function statusLabel(status) {
  const map = { pending: '● Pending', processing: '● Processing', completed: '✓ Completed', rejected: '✕ Rejected' };
  return map[status] || status;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function getDefaultReviews() {
  return [
    { id: 1, name: 'James M.', stars: 5, text: 'Super fast! Sent USDT and received M-Pesa within 20 minutes. Highly recommend TITCH OTC!', date: 'Jan 15, 2024', visible: true },
    { id: 2, name: 'Aisha K.', stars: 5, text: 'Very reliable service. I\'ve used them 5 times already and every transaction went smoothly.', date: 'Jan 22, 2024', visible: true },
    { id: 3, name: 'Brian O.', stars: 5, text: 'Best OTC in Nairobi. Competitive rates and fast processing. Will keep using this service!', date: 'Feb 3, 2024', visible: true }
  ];
}

// ===== NAVBAR SCROLL EFFECT =====
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 20) {
    navbar.style.background = 'rgba(8,11,16,0.97)';
  } else {
    navbar.style.background = 'rgba(8,11,16,0.85)';
  }
});
