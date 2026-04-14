const LOGO = '/assets/logo.png';
// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
let APP_DATA = (window.APP_DATA && typeof window.APP_DATA === 'object') ? window.APP_DATA : {
  stock: [],
  sold: [],
  investors: [],
  monthly: [],
  collections: [],
  deliveries: [],
  financeLog: [],
  expenses: [],
  money_in: [],
  money_out: [],
  serviceRecords: [],
  fines: [],
  receipts: [],
  invoices: [],
  viewings: [],
  staff: [],
  wagePayments: [],
  vehiclePhotos: {},
  workbook: {lastSync:null}
};
window.APP_DATA = APP_DATA;
let stockData = [];
let finLog = [];
let viewings = [];
let collections = [];
let deliveries = [];
let serviceRecords = [];
let fines = [];
let receipts = [];
let staff = [];
let wagePayments = [];
let savedInvoices = [];
let bankTxs = [];
let currentVehicle = null;
let stockFilter = 'all';
let receiptFile = null;
let modalReceiptFile = null;

// Media state declared before init to avoid startup reference errors
var atListings = [];
var igPosts = [];
var vehiclePhotos = {};
var listingDescriptions = {};
var atSettings = {mode:'demo', apiKey:'', dealerId:'', env:'sandbox'};
var igSettings = {mode:'demo', handle:'@mpmotorslondon', appId:'', token:''};
var currentMediaPlate = '';
var currentATListing = null;
var atFilter = 'all';
var igFilter = 'all';

// Demo bank transactions
bankTxs = [
  {id:'tx1', date:'2026-04-05', desc:'HONDA CRV SALE — KU13 FBF', amount:7995, type:'in', matched:true, ref:'INV-001'},
  {id:'tx2', date:'2026-04-04', desc:'COPART UK AUCTION FEES', amount:-406.80, type:'out', matched:false, ref:''},
  {id:'tx3', date:'2026-04-03', desc:'Joseph INVESTOR DEPOSIT', amount:8000, type:'in', matched:true, ref:'Joseph-IN'},
  {id:'tx4', date:'2026-04-02', desc:'AUTOTRADER SUBSCRIPTION', amount:-353.87, type:'out', matched:true, ref:'OVERHEAD'},
  {id:'tx5', date:'2026-04-01', desc:'James — PROFIT PAYOUT', amount:-3500, type:'out', matched:false, ref:''},
  {id:'tx6', date:'2026-03-31', desc:'FIAT 500 SALE — LK15 TJU', amount:6800, type:'in', matched:true, ref:'INV-002'},
  {id:'tx7', date:'2026-03-30', desc:'COPART VEHICLE PURCHASE', amount:-5400, type:'out', matched:false, ref:''},
  {id:'tx8', date:'2026-03-28', desc:'PCN — ULEZ CHARGE VE16TNO', amount:-12.50, type:'out', matched:false, ref:''},
];

// ════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════
function fmt(n) { return '£' + (n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmt0(n) { return '£' + Math.round(n||0).toLocaleString('en-GB'); }
function pc(p) { return p > 0 ? 'var(--green)' : p < 0 ? 'var(--red)' : 'var(--text3)'; }
function dc(d) { return d > 90 ? 'dw' : d > 45 ? 'da' : 'dg'; }
function fmtD(s) { if(!s||s.length<6) return '—'; try { return new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'}); } catch(e) { return s; } }
function fmtDL(s) { if(!s) s=new Date().toISOString().slice(0,10); try { return new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); } catch(e) { return s; } }
function mLabel(m) { return m ? new Date(m).toLocaleDateString('en-GB',{month:'short',year:'2-digit'}) : '—'; }
function normP(p) { return (p||'').replace(/\s/g,'').toUpperCase(); }
function today() { return new Date().toISOString().slice(0,10); }
const CICON = {Parts:'🔧',Labour:'👨‍🔧',Valet:'✨',MOT:'🔍',Transport:'🚛',Fuel:'⛽',Warranty:'🛡️',Fees:'📋','Fixed Overhead':'🏢',Other:'📌'};
const CCLR = {Parts:'var(--blue)',Labour:'var(--purple)',Valet:'var(--cyan)',MOT:'var(--amber)',Transport:'var(--text2)',Fuel:'var(--orange)',Warranty:'var(--green)',Fees:'var(--text3)','Fixed Overhead':'var(--red)',Other:'var(--text3)'};
function escHtml(v){ return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); }
function escJs(v){ return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

// ════════════════════════════════════════════
// NAV
// ════════════════════════════════════════════
function nav(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ni,.mni').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-'+id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  const titles = {dashboard:'Dashboard',stock:'Current Stock',sold:'Sold History',collections:'Collections & Deliveries',servicehistory:'Service Invoices',mot:'MOT Tracker',insurance:'Insurance & SORN',viewings:'Viewings',sellcar:'Investor Invoices',tasks:'Tasks',fines:'Fines & Penalties',expenses:'Finance Log',receipts:'Receipts & AI Scan',banking:'Routes & Planning',invoices:'Investor Invoices',investors:'Investor Budget',wages:'Staff & Wages',vat:'VAT Tracker',reports:'Reports & Analytics',autotrader:'Auto Trader',instagram:'Instagram'};
  document.getElementById('tb-title').textContent = titles[id]||id;
  closeSB(); window.scrollTo(0,0);
  const fns = {stock:renderStock,sold:renderSold,expenses:renderFinance,investors:renderInvestors,reports:renderReports,tasks:renderTasks,mot:renderMOT,insurance:renderInsurance,viewings:renderViewings,fines:renderFines,receipts:renderReceipts,banking:renderBanking,wages:renderWages,vat:renderVAT,collections:renderCollections,invoices:renderInvoiceList,servicehistory:renderServiceHistory,autotrader:renderAutoTrader,instagram:renderInstagram};
  if (fns[id]) fns[id]();
}
function toggleSB() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('soverlay').classList.toggle('open'); }
function closeSB() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('soverlay').classList.remove('open'); }
function openM(id) { const el=document.getElementById('m-'+id); if(el) el.classList.add('open'); }
function closeM(id) { const el=document.getElementById('m-'+id); if(el) el.classList.remove('open'); }
document.querySelectorAll('.moverlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

function filterStock(f,el){stockFilter=f;document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));if(el)el.classList.add('active');renderStock();}
function renderSold() {
  const f=document.getElementById('sold-filter').value;
  const arr=(f?APP_DATA.sold.filter(v=>v.month===f):APP_DATA.sold).slice().sort((a,b)=>(b.date_sold||'').localeCompare(a.date_sold||''));
  document.getElementById('sold-tbody').innerHTML=arr.map((v,i)=>'<tr><td>'+mLabel(v.month)+'</td><td class="tdm">'+v.model+'</td><td><span class="mono">'+v.plate+'</span></td><td>'+fmtD(v.date_acquired)+'</td><td>'+(v.date_sold?fmtD(v.date_sold):'—')+'</td><td>'+(v.source||'—')+'</td><td>'+v.days_in_stock+'d</td><td>'+fmt0(v.total_cost)+'</td><td>'+fmt0(v.sold_price)+'</td><td style="color:'+(v.profit>=0?'var(--green)':'var(--red)')+';font-weight:700">'+fmt(v.profit)+'</td><td>'+(v.investor||'SA')+'</td><td><button class="btn btn-g btn-xs" onclick="showSoldBreakdown('+i+')">Full</button></td></tr>').join('');
}

// ════════════════════════════════════════════
// COLLECTIONS
// ════════════════════════════════════════════
function renderCollections() {
  const incoming = collections.slice().sort((a,b)=>b.days_pending-a.days_pending);
  const outgoing = deliveries.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  document.getElementById('col-stats').innerHTML='<div class="stat blue"><div class="sl">Incoming Cars</div><div class="sv">'+incoming.length+'</div></div><div class="stat amber"><div class="sl">Pending</div><div class="sv">'+incoming.filter(c=>c.status!=='Collected').length+'</div></div><div class="stat green"><div class="sl">Deliveries</div><div class="sv">'+outgoing.length+'</div></div><div class="stat purple"><div class="sl">Grouped Runs</div><div class="sv">'+incoming.filter(c=>(c.linked_vehicles||[]).length).length+'</div></div>';
  document.getElementById('collections-list').innerHTML=incoming.length?incoming.map(c=>'<div class="li"><div class="ldot" style="background:var(--amber)"></div><div class="lc"><div class="lt">'+c.plate+' — '+c.model+'</div><div class="lm">'+(c.addr||'Address needed')+' · Won '+fmtD(c.date_won)+'</div><div class="lv">Pending '+(c.days_pending||0)+' days · '+(c.distance_note||'Distance to be checked')+'</div></div><span class="badge ba">'+c.status+'</span></div>').join(''):'<div style="color:var(--text3);font-size:12px;padding:10px;">No inbound cars</div>';
  document.getElementById('deliveries-list').innerHTML=outgoing.length?outgoing.map(c=>'<div class="li"><div class="ldot" style="background:var(--blue)"></div><div class="lc"><div class="lt">'+c.plate+' — '+c.model+'</div><div class="lm">'+(c.addr||'Address needed')+' · '+fmtD(c.date)+'</div><div class="lv">Driver: '+(c.driver||'TBC')+'</div></div><span class="badge bb">'+c.status+'</span></div>').join(''):'<div style="color:var(--text3);font-size:12px;padding:10px;">No deliveries logged</div>';
  const all = incoming.concat(outgoing);
  document.getElementById('col-tbody').innerHTML=all.map(c=>'<tr><td><span class="badge '+(c.type==='Incoming'?'ba':'bb')+'">'+c.type+'</span></td><td class="tdm">'+c.model+'</td><td><span class="mono">'+c.plate+'</span></td><td>'+(c.type==='Incoming'?fmtD(c.date_won):fmtD(c.date||c.scheduled_date))+'</td><td>'+(c.addr||'—')+'</td><td>'+(c.driver||'—')+'</td><td>'+(c.cost?fmt0(c.cost):'—')+'</td><td>'+(c.status||'Pending')+'<div style="font-size:10px;color:var(--text3);">'+(c.linked_vehicles&&c.linked_vehicles.length?'Linked: '+c.linked_vehicles.join(', '):'')+'</div></td></tr>').join('');
}

// ════════════════════════════════════════════
// SERVICE HISTORY
// ════════════════════════════════════════════
function renderServiceHistory() {
  const all = serviceRecords.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  document.getElementById('service-tbody').innerHTML = all.length ? all.map((r,i)=>'<tr><td class="tdm">'+(r.model||'Unknown')+'</td><td><span class="mono">'+r.plate+'</span></td><td><span class="badge '+(r.type&&r.type.indexOf('Created')>=0?'bo':'bg')+'">'+(r.type||'Invoice')+'</span></td><td>'+fmtD(r.date)+'</td><td>'+(r.miles?Number(r.miles).toLocaleString():'—')+'</td><td>'+(r.ref||('SVC-'+String(i+1).padStart(4,'0')))+'</td><td style="font-size:10.5px;color:var(--text3);">'+escHtml(r.notes||'')+'</td><td><button class="btn btn-g btn-xs" onclick="printServiceInvoice('+i+')">Print</button></td></tr>').join('') : '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px;">No service invoices created yet</td></tr>';
}

// ════════════════════════════════════════════
// MOT TRACKER
// ════════════════════════════════════════════
function renderMOT() {
  const motFilter = document.getElementById('mot-filter') ? document.getElementById('mot-filter').value : 'current';
  let base = [];
  if(motFilter==='sold') base = APP_DATA.sold;
  else if(motFilter==='inbound') base = collections;
  else if(motFilter==='all') base = stockData.concat(collections).concat(APP_DATA.sold.slice(0,20));
  else base = stockData;
  const today2 = new Date();
  const motData = base.map(v => {
    const exp = v.mot_expiry ? new Date(v.mot_expiry) : null;
    const daysLeft = exp ? Math.round((exp-today2)/(1000*60*60*24)) : null;
    return {...v, motExpiry: exp, daysLeft};
  });
  const urgent = motData.filter(v=>v.daysLeft!==null&&v.daysLeft<183);
  document.getElementById('nb-mot').textContent = urgent.length || '0';
  document.getElementById('mot-alerts').innerHTML = '<div class="alert alt-r">⚠️ '+urgent.length+' vehicle(s) under 6 months or already expired.</div><div class="alert alt-b">DVSA token settings are now prepared in the file. Developer still needs to finish the live token exchange and advisory endpoint call.</div>';
  document.getElementById('mot-grid').innerHTML = motData.map(v => {
    const pct = v.daysLeft ? Math.min(100,Math.max(0,(v.daysLeft/365)*100)) : 35;
    const col = v.daysLeft !== null ? (v.daysLeft < 0 ? 'var(--red)' : v.daysLeft < 183 ? 'var(--amber)' : 'var(--green)') : 'var(--text3)';
    const label = v.daysLeft !== null ? (v.daysLeft<0?'Expired':v.daysLeft+' days') : 'Check needed';
    return '<div class="mot-card"><div class="mot-plate">'+(v.plate||'—')+'</div><div class="mot-model">'+(v.model||'Unknown')+'</div><div class="mot-expiry" style="color:'+col+'">'+label+'</div><div style="font-size:10px;color:var(--text3);margin-top:2px;">'+(v.mot_expiry?fmtD(v.mot_expiry):'No MOT date stored')+'</div><div class="mot-bar"><div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:3px;"></div></div><div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;"><button class="btn btn-g btn-xs" onclick="checkDVSA(\''+(v.plate||'')+'\')">DVSA</button>'+(v.needs_mot?'<span class="badge ba">Needs MOT</span>':'')+'</div></div>';
  }).join('');
}
function checkDVSA(plate) { window.open('https://www.gov.uk/check-mot-history?registration='+encodeURIComponent(plate),'_blank'); }
function checkAllMOT() { window.open('https://www.gov.uk/check-mot-history','_blank'); alert('DVSA MOT history opens for each vehicle. To auto-populate via API: register at documentation.history.mot.api.dvsa.gov.uk for your free trade API key.'); }

// ════════════════════════════════════════════
// INSURANCE
// ════════════════════════════════════════════
function renderInsurance() {
  const f = document.getElementById('ins-filter') ? document.getElementById('ins-filter').value : 'current';
  let base = f==='sold' ? APP_DATA.sold.slice(0,20) : f==='inbound' ? collections : f==='all' ? stockData.concat(collections).concat(APP_DATA.sold.slice(0,20)) : stockData;
  document.getElementById('ins-tbody').innerHTML = base.map(v=>'<tr><td class="tdm">'+(v.model||'Unknown')+'</td><td><span class="mono">'+(v.plate||'—')+'</span></td><td style="color:var(--text3)">'+(v.last_ins_check?fmtD(v.last_ins_check):'Not checked')+'</td><td><span class="badge bk">Manual check</span></td><td>'+(v.notes||'—')+'</td><td><button class="btn btn-b btn-xs" onclick="checkIns(\''+(v.plate||'')+'\')">Check</button></td></tr>').join('');
}
function checkInsurance() {
  const plate = document.getElementById('ins-plate').value.trim().toUpperCase();
  if(!plate){alert('Enter a reg plate first.');return;}
  document.getElementById('ins-result').innerHTML = '<div class="alert alt-b">🔍 Opening MIB portal for '+plate+'...<br><br><a href="https://enquiry.navigate.mib.org.uk/checkyourvehicle" target="_blank" class="btn btn-b btn-sm">Open MIB Portal ↗</a><br><br>Note: The MIB API requires a registered account. The portal link above allows manual checking. For API integration, contact MIB to register as a business user.</div>';
  window.open('https://enquiry.navigate.mib.org.uk/checkyourvehicle','_blank');
}
function checkIns(plate) { document.getElementById('ins-plate').value=plate; checkInsurance(); }

// ════════════════════════════════════════════
// VIEWINGS
// ════════════════════════════════════════════
let calY=new Date().getFullYear(), calM=new Date().getMonth();
function renderViewings() {
  document.getElementById('nb-viewings').textContent = viewings.filter(v=>v.status==='Booked').length;
  const booked=viewings.filter(v=>v.status==='Booked').length;
  const converted=viewings.filter(v=>v.status==='Bought' || v.status==='Deposit Paid').length;
  const noShow=viewings.filter(v=>v.status==='No Show').length;
  const convRate = viewings.length ? Math.round((converted/viewings.length)*100) : 0;
  document.getElementById('viewing-stats').innerHTML=
    '<div class="stat blue"><div class="sl">Total Viewings</div><div class="sv">'+viewings.length+'</div><div class="ss">All time</div></div>'+
    '<div class="stat amber"><div class="sl">Booked</div><div class="sv">'+booked+'</div><div class="ss">Upcoming</div></div>'+
    '<div class="stat green"><div class="sl">Converted</div><div class="sv">'+converted+'</div><div class="ss">Bought or deposit</div></div>'+
    '<div class="stat red"><div class="sl">No Show</div><div class="sv">'+noShow+'</div><div class="ss">'+convRate+'% conversion</div></div>';
  renderCal();
  const upcoming = viewings.filter(v=>v.status==='Booked').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  document.getElementById('viewings-list').innerHTML = upcoming.length ? upcoming.map(v=>'<div class="vc"><div class="vc-time">'+(v.time||'TBC')+'</div><div class="vc-name">'+v.name+'</div><div class="vc-car">'+(v.vehicle||'Vehicle TBC')+'</div><div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;"><span class="badge bb">📅 '+fmtD(v.date)+'</span><span class="badge bk">'+(v.source||'Website')+'</span>'+(v.finance?'<span class="badge ba">Finance '+v.finance+'</span>':'')+(v.delivery?'<span class="badge bc">Delivery '+v.delivery+'</span>':'')+'</div>'+(v.notes?'<div class="vc-note">💬 '+escHtml(v.notes)+'</div>':'')+'</div>').join('') : '<div style="color:var(--text3);font-size:12px;padding:12px;">No upcoming viewings</div>';
  document.getElementById('viewings-tbody').innerHTML=viewings.slice().sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).map(v=>'<tr><td>'+fmtD(v.date)+'</td><td>'+(v.time||'—')+'</td><td class="tdm">'+v.name+'</td><td>'+(v.phone||'—')+'</td><td>'+(v.vehicle||'—')+'</td><td><span class="badge '+(v.status==='Booked'?'bb':v.status==='Bought'?'bg':v.status==='Deposit Paid'?'ba':v.status==='No Show'?'br':'bk')+'">'+v.status+'</span></td><td>'+(v.source||'—')+' · Finance: '+(v.finance||'No')+' · Delivery: '+(v.delivery||'No')+'<div style="font-size:10px;color:var(--text3);">'+escHtml(v.notes||'')+'</div></td><td>'+(v.outcome||v.status||'—')+'</td></tr>').join('');
}
function renderCal() {
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-lbl').textContent=months[calM]+' '+calY;
  const first=new Date(calY,calM,1).getDay();
  const dim=new Date(calY,calM+1,0).getDate();
  const off=(first+6)%7;
  const todayD=new Date();
  const viewingDays=new Set(viewings.filter(v=>{ try{const d=new Date(v.date);return d.getFullYear()===calY&&d.getMonth()===calM;}catch(e){return false;} }).map(v=>new Date(v.date).getDate()));
  let html='';
  for(let i=0;i<off;i++) html+='<div></div>';
  for(let d=1;d<=dim;d++){
    const isToday=d===todayD.getDate()&&calM===todayD.getMonth()&&calY===todayD.getFullYear();
    html+='<div class="cal-day'+(isToday?' today':'')+(viewingDays.has(d)?' has-event':'')+'" onclick="calDayClick('+d+')" title="'+(viewingDays.has(d)?'Viewing booked':'')+'">'+d+'</div>';
  }
  document.getElementById('cal-grid').innerHTML=html;
}
function calPrev(){calM--;if(calM<0){calM=11;calY--;}renderCal();}
function calNext(){calM++;if(calM>11){calM=0;calY++;}renderCal();}
function calDayClick(d){document.getElementById('vw-date').value=calY+'-'+String(calM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');openM('addviewing');}

// ════════════════════════════════════════════
// FINANCE LOG
// ════════════════════════════════════════════
function prefillExp(plate,model){document.getElementById('exp-plate').value=plate;openM('addexpense');}
function exportFinance(){const rows=[['Date','Plate','Model','Description','Category','Amount']];finLog.forEach(e=>rows.push([e.date,e.plate,e.model,e.desc,e.cat,e.amount]));dlCSV(rows,'finance_log.csv');}

// ════════════════════════════════════════════
// RECEIPTS
// ════════════════════════════════════════════
function handleReceiptFile(input) {
  if(!input.files[0]) return;
  receiptFile = input.files[0];
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('receipt-preview-img').src=e.target.result; document.getElementById('receipt-preview').style.display='block'; };
  reader.readAsDataURL(receiptFile);
}
function handleModalReceiptFile(input) {
  if(!input.files[0]) return;
  modalReceiptFile = input.files[0];
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('modal-preview-img').src=e.target.result; document.getElementById('modal-preview').style.display='block'; };
  reader.readAsDataURL(modalReceiptFile);
}
function renderReceipts() {
  const total=receipts.reduce((a,r)=>a+Number(r.amount||0),0);
  const linked=receipts.filter(r=>r.plate);
  document.getElementById('receipt-stats').innerHTML=
    '<div class="stat amber"><div class="sl">Total Receipts</div><div class="sv">'+receipts.length+'</div></div>'+
    '<div class="stat red"><div class="sl">Total Value</div><div class="sv">'+fmt0(total)+'</div></div>'+
    '<div class="stat blue"><div class="sl">Vehicle Linked</div><div class="sv">'+linked.length+'</div></div>'+
    '<div class="stat green"><div class="sl">Unmatched</div><div class="sv">'+receipts.filter(r=>!r.plate).length+'</div></div>';
  document.getElementById('receipts-grid').innerHTML=receipts.length?receipts.map(r=>'<div class="receipt-card"><div class="receipt-thumb">'+(r.img?'<img src="'+r.img+'" alt="Receipt">':'🧾')+'</div><div class="receipt-info"><div class="receipt-title">'+escHtml(r.notes||r.cat||'Receipt')+'</div><div class="receipt-meta">'+(r.plate?'🚗 <strong>'+r.plate+'</strong> · ':'')+(r.model?r.model+' · ':'')+fmtD(r.date)+'<br><span class="badge '+(CCLR[r.cat]?'':'bk')+'" style="background:'+(CCLR[r.cat]||'var(--text3)')+'22;color:'+(CCLR[r.cat]||'var(--text3)')+'">'+(CICON[r.cat]||'💰')+' '+(r.cat||'Other')+'</span>'+(r.vat?'<span class="badge bc" style="margin-left:4px;">VAT '+fmt(r.vat)+'</span>':'')+'</div></div><div style="font-family:\'DM Mono\',monospace;font-size:14px;font-weight:800;color:var(--red);flex-shrink:0;">-'+fmt(r.amount)+'</div></div>').join(''):'<div style="color:var(--text3);font-size:12.5px;text-align:center;padding:22px;">No receipts yet</div>';
}

// ════════════════════════════════════════════
// BANKING
// ════════════════════════════════════════════
function connectBarclays() {
  document.getElementById('bank-accounts').innerHTML='<div class="alert alt-b">🏦 <strong>Barclays Open Banking Setup</strong><br><br>To connect your Barclays account:<br>1. Register at developer.barclays.com/open-banking<br>2. Create an OAuth application<br>3. Implement the Account Information Service (AIS) API for read access<br>4. For payments: implement the Payment Initiation Service (PIS) API<br><br>Your developer will handle this — provide them with your Barclays business account details and this guide. Once connected, live balances and transactions will appear here.<br><br><a href="https://developer.barclays.com/open-banking" target="_blank" class="btn btn-b btn-sm">Barclays Developer Portal ↗</a></div>';
  renderBanking();
}
function renderBanking() {
  const grouped = {};
  collections.forEach(c=>{
    const txt=((c.addr||'')+' '+(c.postcode||'')).toLowerCase();
    const k = /edinburgh|glasgow|iverness|inverness/.test(txt) ? 'Scotland' : /manchester|telford|birmingham/.test(txt) ? 'North' : /enfield|london/.test(txt) ? 'London' : 'Other';
    if(!grouped[k]) grouped[k]=[];
    grouped[k].push(c);
  });
  const filter = document.getElementById('tx-filter') ? document.getElementById('tx-filter').value : '';
  const rows = filter && grouped[filter] ? grouped[filter] : collections;
  document.getElementById('bank-stats').innerHTML = '<div class="stat blue"><div class="sl">Incoming</div><div class="sv">'+collections.length+'</div></div><div class="stat amber"><div class="sl">Pending Days</div><div class="sv">'+collections.reduce((a,c)=>a+Number(c.days_pending||0),0)+'</div></div><div class="stat green"><div class="sl">Regions</div><div class="sv">'+Object.keys(grouped).length+'</div></div><div class="stat purple"><div class="sl">Linked Runs</div><div class="sv">'+collections.filter(c=>(c.linked_vehicles||[]).length).length+'</div></div>';
  document.getElementById('bank-accounts').innerHTML = Object.keys(grouped).map(k=>'<div class="li"><div class="ldot" style="background:var(--blue)"></div><div class="lc"><div class="lt">'+k+'</div><div class="lm">'+grouped[k].length+' car(s)</div></div><span class="badge bb">'+(k==='Scotland'?'Use Edinburgh or Glasgow':'Check route')+'</span></div>').join('');
  document.getElementById('recon-status').innerHTML = collections.length ? collections.map(c=>'<div class="li"><div class="ldot" style="background:var(--amber)"></div><div class="lc"><div class="lt">'+c.plate+' · '+c.model+'</div><div class="lm">'+(c.addr||'Address needed')+' · Pending '+(c.days_pending||0)+' days</div></div><span class="badge ba">'+(c.distance_note||'Map it')+'</span></div>').join('') : '<div style="color:var(--text3);font-size:12px;">No inbound cars.</div>';
  document.getElementById('bank-txs').innerHTML = rows.length ? rows.map(c=>'<div class="bank-tx"><div class="bank-icon" style="background:rgba(59,130,246,.12);">📍</div><div class="bank-desc"><strong>'+c.plate+'</strong> · '+c.model+'<div class="bank-date">'+(c.addr||'Address needed')+' · Won '+fmtD(c.date_won)+'</div></div><div class="bank-amt">'+(c.scheduled_date?fmtD(c.scheduled_date):'TBC')+'</div></div>').join('') : '<div style="padding:12px;color:var(--text3);">No rows for this route filter.</div>';
  document.getElementById('investor-payouts').innerHTML = '<div class="li"><div class="ldot" style="background:var(--green)"></div><div class="lc"><div class="lt">Google Maps autocomplete ready</div><div class="lm">Add your Maps key in the config and bind #col-addr to Places autocomplete.</div></div></div><div class="li"><div class="ldot" style="background:var(--purple)"></div><div class="lc"><div class="lt">Airport shortcut idea</div><div class="lm">Use this screen to compare Scotland pickups and group cars that can be collected in one run.</div></div></div>';
}
function allocateTx(id){const t=bankTxs.find(t=>t.id===id);if(t){t.matched=true;renderBanking();}}
function initiatePayment(name,amount){alert('💳 Payment Initiation (Barclays PIS API)\n\nRecipient: '+name+'\nAmount: '+fmt0(amount)+'\n\nTo enable real payments, implement the Barclays Payment Initiation Service API.\nThis requires FCA authorisation and Barclays consent flows.\n\nYour developer can set this up using: developer.barclays.com');}

// ════════════════════════════════════════════
// INVESTORS
// ════════════════════════════════════════════
function renderInvestors() {
  const tv=APP_DATA.investors.reduce((a,i)=>a+i.total_balance,0);
  const ta=APP_DATA.investors.reduce((a,i)=>a+i.available,0);
  const tp=APP_DATA.investors.reduce((a,i)=>a+i.total_profit,0);
  document.getElementById('inv-summary').innerHTML='Total investor budget <strong>'+fmt0(tv)+'</strong>. Available to deploy <strong>'+fmt0(ta)+'</strong>. Profit recorded <strong>'+fmt0(tp)+'</strong>.';
  document.getElementById('inv-cards').innerHTML=APP_DATA.investors.map(inv=>'<div class="invc"><div class="invc-name">'+inv.name+'</div><div class="irow"><span class="lbl">Budget</span><span class="val">'+fmt0(inv.total_balance)+'</span></div><div class="irow"><span class="lbl">Deployed</span><span class="val">'+fmt0(inv.purchased)+'</span></div><div class="irow"><span class="lbl">Returned</span><span class="val">'+fmt0(inv.capital_returned)+'</span></div><div class="irow"><span class="lbl">Available</span><span class="val" style="color:'+(inv.available<0?'var(--red)':'var(--green)')+'">'+fmt0(inv.available)+'</span></div><div class="prog"><div class="prog-fill" style="width:'+Math.min(100,inv.purchased/(inv.total_balance||1)*100)+'%;background:'+(inv.available<0?'var(--red)':'var(--blue)')+'"></div></div></div>').join('');
  const maxP=Math.max.apply(null,APP_DATA.investors.map(i=>i.total_profit).concat([1]));
  document.getElementById('inv-chart').innerHTML=APP_DATA.investors.map(inv=>'<div class="bc2"><div class="bar" style="height:'+Math.max(3,(inv.total_profit/maxP)*100)+'px;background:var(--blue)"></div><div class="blbl">'+inv.name+'<br>'+fmt0(inv.total_profit)+'</div></div>').join('');
  const assigned = stockData.concat(APP_DATA.sold).filter(v=>v.investor && v.investor!=='SA');
  document.getElementById('inv-vehicle-tbody').innerHTML = assigned.map(v=>'<tr><td>'+v.investor+'</td><td class="tdm">'+v.model+'</td><td><span class="mono">'+v.plate+'</span></td><td>'+fmt0(v.total_cost||0)+'</td><td>'+fmt0(v.sold_price||0)+'</td><td style="color:'+(Number(v.profit||0)>=0?'var(--green)':'var(--red)')+'">'+fmt(Number(v.profit||0))+'</td><td>'+fmt0(Number(v.investor_profit||0))+'</td><td>'+((v.status)||'Current')+'</td></tr>').join('');
}

// ════════════════════════════════════════════
// WAGES
// ════════════════════════════════════════════
function renderWages() {
  const totalPaid=wagePayments.reduce((a,p)=>a+p.amount,0);
  const totalOwed=staff.reduce((a,s)=>a+s.owed,0);
  document.getElementById('wage-stats').innerHTML=
    '<div class="stat blue"><div class="sl">Staff Members</div><div class="sv">'+staff.length+'</div></div>'+
    '<div class="stat red"><div class="sl">Wages Owed</div><div class="sv">'+fmt0(totalOwed)+'</div><div class="ss">Needs paying</div></div>'+
    '<div class="stat green"><div class="sl">Total Paid</div><div class="sv">'+fmt0(totalPaid)+'</div></div>'+
    '<div class="stat amber"><div class="sl">This Month</div><div class="sv">'+fmt0(wagePayments.filter(p=>p.date&&p.date.startsWith(new Date().toISOString().slice(0,7))).reduce((a,p)=>a+p.amount,0))+'</div></div>';
  document.getElementById('staff-grid').innerHTML=staff.map((s,i)=>'<div class="wage-card"><div class="wage-name">'+s.name+'</div><div style="font-size:11px;color:var(--text3);margin-bottom:8px;">'+s.role+' · '+s.payType+' · '+fmt0(s.rate)+'/'+s.payType.toLowerCase()+'</div><div class="irow"><span class="lbl">Owed</span><span class="val" style="color:var(--red)">'+fmt0(s.owed)+'</span></div><div class="irow"><span class="lbl">Total Paid</span><span class="val" style="color:var(--green)">'+fmt0(s.paid)+'</span></div><div style="display:flex;gap:5px;margin-top:8px;"><button class="btn btn-green btn-xs" onclick="openPayModal('+i+')">Pay Now</button><button class="btn btn-amber btn-xs" onclick="addOwed('+i+')">+ Owed</button></div></div>').join('');
  const wpSel=document.getElementById('wp-staff');if(wpSel)wpSel.innerHTML=staff.map(s=>'<option>'+s.name+'</option>').join('');
  document.getElementById('wage-tbody').innerHTML=wagePayments.length?wagePayments.map(p=>'<tr><td class="tdm">'+p.name+'</td><td>'+fmtD(p.date)+'</td><td style="font-weight:700;color:var(--green)">'+fmt(p.amount)+'</td><td>'+p.period+'</td><td>'+p.method+'</td><td style="color:var(--text3);font-size:11px;">'+p.notes+'</td></tr>').join(''):'<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px;">No payments logged</td></tr>';
}
function openPayModal(i){document.getElementById('wp-staff').selectedIndex=i;document.getElementById('wp-date').value=today();openM('logpayment');}

// ════════════════════════════════════════════
// VAT
// ════════════════════════════════════════════
function renderVAT() {
  const VAT_RATE = 0.20;
  const sales = APP_DATA.sold.filter(v=>v.sold_price>0);
  const outputVAT = sales.reduce((a,v)=>a+(v.sold_price/6),0); // margin scheme approx
  const inputVAT = finLog.filter(e=>e.cat!=='Fuel'&&e.amount>0).reduce((a,e)=>a+(e.amount*VAT_RATE/1.2),0);
  const netVAT = outputVAT - inputVAT;
  document.getElementById('vat-stats').innerHTML=
    '<div class="stat red"><div class="sl">Output VAT (Sales)</div><div class="sv">'+fmt0(outputVAT)+'</div><div class="ss">Margin scheme est.</div></div>'+
    '<div class="stat green"><div class="sl">Input VAT (Purchases)</div><div class="sv">'+fmt0(inputVAT)+'</div><div class="ss">Reclaimable</div></div>'+
    '<div class="stat amber"><div class="sl">Net VAT Owed</div><div class="sv">'+fmt0(netVAT)+'</div><div class="ss">HMRC estimate</div></div>'+
    '<div class="stat blue"><div class="sl">Current Quarter</div><div class="sv">Q'+Math.ceil((new Date().getMonth()+1)/3)+'</div><div class="ss">'+new Date().getFullYear()+'</div></div>'+
    '<div class="stat bk" style="background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:13px 15px;"><div class="sl">Note</div><div style="font-size:11px;color:var(--text3);margin-top:4px;line-height:1.5;">Used car dealers typically use the VAT Margin Scheme. Always verify figures with your accountant before HMRC submission.</div></div>';
  document.getElementById('vat-output').innerHTML=sales.slice(0,10).map(v=>'<div class="irow" style="padding:6px 0;border-bottom:1px solid var(--border);"><span class="lbl">'+v.model+' · '+v.plate+'</span><span class="val" style="color:var(--amber)">'+fmt(v.sold_price/6)+'</span></div>').join('');
  document.getElementById('vat-input').innerHTML=finLog.slice(0,10).map(e=>'<div class="irow" style="padding:6px 0;border-bottom:1px solid var(--border);"><span class="lbl">'+(e.plate?e.plate+' · ':'')+e.desc+'</span><span class="val" style="color:var(--green)">'+fmt(e.amount*VAT_RATE/1.2)+'</span></div>').join('');
  document.getElementById('vat-quarter').innerHTML='<div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:14px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;">Q'+Math.ceil((new Date().getMonth()+1)/3)+' '+new Date().getFullYear()+' Estimate</div><div class="irow" style="padding:6px 0;"><span class="lbl">Output Tax (VAT on sales)</span><span class="val">'+fmt(outputVAT)+'</span></div><div class="irow" style="padding:6px 0;"><span class="lbl">Input Tax (VAT on costs)</span><span class="val" style="color:var(--green)">'+fmt(inputVAT)+'</span></div><div style="height:1px;background:var(--border);margin:8px 0;"></div><div class="irow" style="padding:6px 0;"><span style="font-weight:800;font-size:13px;">Net VAT due to HMRC</span><span style="font-weight:800;font-size:15px;color:var(--amber);font-family:\'DM Mono\',monospace;">'+fmt(netVAT)+'</span></div></div>';
}

function updateCalc() {
  if(!currentVehicle)return;
  const sale=parseFloat(document.getElementById('sell-price').value)||0;
  const cost=currentVehicle.total_cost||0;
  const profit=sale-cost;
  const pct=parseFloat(document.getElementById('sell-share').value)||30;
  const invP=profit*pct/100;
  document.getElementById('c-sale').textContent=sale?fmt(sale):'—';
  document.getElementById('c-cost').textContent=fmt(cost);
  document.getElementById('c-profit').textContent=sale?fmt(profit):'—';
  document.getElementById('c-profit').style.color=profit>=0?'var(--green)':'var(--red)';
  document.getElementById('c-inv').textContent=sale?fmt(invP):'—';
  document.getElementById('c-pct').textContent=pct;
}
function prefillSell(plate){nav('sellcar',document.querySelector('[onclick*=sellcar]'));setTimeout(()=>{document.getElementById('sell-reg').value=plate;searchReg(plate);},120);}
function quickSell(plate){prefillSell(plate);}
function printInv(){
  const content=document.getElementById('invoice-render').innerHTML;
  const w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><title>SA Motors (TRIAL TASK) Invoice</title><style>body{font-family:Arial,sans-serif;margin:20px;background:#fff;}.inv-wrap{max-width:800px;margin:0 auto;font-size:12px;color:#111;line-height:1.5;}.inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;}.inv-logo-img{height:62px;object-fit:contain;}.inv-big-title{font-size:38px;font-weight:200;color:#333;letter-spacing:3px;margin-bottom:6px;}.inv-addr-text{font-size:10.5px;color:#444;line-height:1.8;margin-top:6px;}.inv-meta-block{text-align:right;font-size:11.5px;line-height:2;}.inv-table{width:100%;border-collapse:collapse;margin-bottom:13px;}th{background:#f0f0f0;padding:8px 11px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border:1px solid #ccc;text-align:left;}td{padding:7px 11px;border:1px solid #ddd;font-size:11.5px;color:#222;}.row-total td{background:#e8e8e8;font-weight:800;font-size:12.5px;}.row-profit td{background:#111;color:#fff;font-weight:800;font-size:13px;}.row-investor td{background:#1a3a1a;color:#4ade80;font-weight:800;font-size:12.5px;}.inv-footer{text-align:center;font-size:10px;color:#888;margin-top:14px;border-top:1px solid #ddd;padding-top:11px;line-height:1.8;}@media print{body{margin:0;}}</style></head><body>'+content+'</body></html>');
  w.document.close();setTimeout(()=>w.print(),500);
}
function renderInvoiceList(){
  document.getElementById('inv-list').innerHTML=savedInvoices.length?savedInvoices.map((inv,i)=>'<div class="li"><div class="lc"><div class="lt">'+inv.invNum+' · '+inv.model+'</div><div class="lm">'+inv.plate+' · '+fmtD(inv.saleDate)+' · Sale: '+fmt0(inv.sale)+'</div><div style="display:flex;gap:5px;margin-top:4px;"><span class="badge bg">Profit: '+fmt0(inv.profit)+'</span><span class="badge bp">'+inv.investor+': '+fmt0(inv.invP)+'</span></div></div><div style="display:flex;gap:4px;flex-direction:column;"><button class="btn btn-g btn-xs" onclick="reView('+i+')">View</button><button class="btn btn-p btn-xs" onclick="rePrint('+i+')">PDF</button></div></div>').join(''):'<div style="color:var(--text3);font-size:12.5px;text-align:center;padding:22px;">No invoices yet — use <strong>Sell a Car</strong> to generate one.</div>';
}
function reView(i){nav('sellcar',document.querySelector('[onclick*=sellcar]'));setTimeout(()=>{document.getElementById('invoice-render').innerHTML=savedInvoices[i].html;document.getElementById('invoice-output').style.display='block';document.getElementById('invoice-output').scrollIntoView({behavior:'smooth'});},120);}
function rePrint(i){const w=window.open('','_blank');w.document.write('<!DOCTYPE html><html><head><title>SA Motors (TRIAL TASK) Invoice</title><style>body{font-family:Arial,sans-serif;margin:20px;}.inv-wrap{max-width:800px;margin:0 auto;font-size:12px;color:#111;line-height:1.5;}.inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;}.inv-logo-img{height:62px;object-fit:contain;}.inv-big-title{font-size:38px;font-weight:200;color:#333;letter-spacing:3px;margin-bottom:6px;}.inv-addr-text{font-size:10.5px;color:#444;line-height:1.8;margin-top:6px;}.inv-meta-block{text-align:right;font-size:11.5px;line-height:2;}.inv-table{width:100%;border-collapse:collapse;margin-bottom:13px;}th{background:#f0f0f0;padding:8px 11px;font-size:10.5px;font-weight:700;text-transform:uppercase;border:1px solid #ccc;text-align:left;}td{padding:7px 11px;border:1px solid #ddd;font-size:11.5px;}.row-total td{background:#e8e8e8;font-weight:800;}.row-profit td{background:#111;color:#fff;font-weight:800;font-size:13px;}.row-investor td{background:#1a3a1a;color:#4ade80;font-weight:800;}.inv-footer{text-align:center;font-size:10px;color:#888;margin-top:14px;border-top:1px solid #ddd;padding-top:11px;line-height:1.8;}@media print{body{margin:0;}}</style></head><body>'+savedInvoices[i].html+'</body></html>');w.document.close();setTimeout(()=>w.print(),500);}

// ════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════
function renderTasks(){
  const nl=stockData.filter(v=>v.notes&&v.notes.toLowerCase().indexOf('not listed')>=0&&v.days_in_stock>5);
  document.getElementById('tasks-nl').innerHTML=nl.length?nl.map(v=>'<div class="li"><div class="ldot" style="background:var(--amber)"></div><div class="lc"><div class="lt">List — '+v.model+'</div><div class="lm">'+v.notes+'</div><div class="lv">🚗 '+v.plate+' · '+v.days_in_stock+'d</div></div><span class="badge '+(v.days_in_stock>30?'br':'ba')+'">'+(v.days_in_stock>30?'Urgent':'Pending')+'</span></div>').join(''):'<div style="color:var(--text3);font-size:12px;padding:10px;">All good</div>';
  const ag=stockData.filter(v=>v.days_in_stock>45).sort((a,b)=>b.days_in_stock-a.days_in_stock);
  document.getElementById('tasks-age').innerHTML=ag.length?ag.map(v=>'<div class="li"><div class="ldot" style="background:'+(v.days_in_stock>90?'var(--red)':'var(--amber)')+'"></div><div class="lc"><div class="lt">Price Review — '+v.model+'</div><div class="lm">'+v.days_in_stock+' days · Cost: '+fmt0(v.total_cost)+'</div><div class="lv">🚗 '+v.plate+'</div></div><span class="badge '+(v.days_in_stock>90?'br':'ba')+'">'+v.days_in_stock+'d</span></div>').join(''):'<div style="color:var(--text3);font-size:12px;padding:10px;">All moving well</div>';
}
function addTask(){const t=document.getElementById('t-title').value.trim();if(!t){alert('Enter a task.');return;}const pr=document.getElementById('t-pri').value;const ct=document.getElementById('custom-tasks');ct.innerHTML='<div class="li"><div class="ldot" style="background:'+(pr==='Urgent'?'var(--red)':pr==='High'?'var(--amber)':'var(--blue)')+'"></div><div class="lc"><div class="lt">'+t+'</div><div class="lm">'+(document.getElementById('t-date').value||'No due date')+' · '+pr+'</div></div><span class="badge ba">'+pr+'</span></div>'+ct.innerHTML;closeM('addtask');['t-title','t-date','t-notes'].forEach(id=>document.getElementById(id).value='');}

// ════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════
// ════════════════════════════════════════════
// MISC
// ════════════════════════════════════════════
function handleSearch(q){
  if(!q||q.length<2)return;
  q=q.toLowerCase();
  const currentMatch = stockData.find(v =>
    (v.stock_id || '').toLowerCase().indexOf(q) >= 0
    || (v.plate || '').toLowerCase().indexOf(q) >= 0
    || (v.model || '').toLowerCase().indexOf(q) >= 0
  );
  if(currentMatch){
    nav('stock',document.querySelector('[onclick*=stock]'));
    return;
  }
  const soldMatch = (APP_DATA.sold || []).find(v =>
    (v.stock_id || '').toLowerCase().indexOf(q) >= 0
    || (v.plate || '').toLowerCase().indexOf(q) >= 0
    || (v.model || '').toLowerCase().indexOf(q) >= 0
  );
  if(soldMatch) nav('sold',document.querySelector('[onclick*=sold]'));
}
function exportStock(){const rows=[['Plate','Model','Investor','Total Cost','Days','Status','Notes']];stockData.forEach(v=>rows.push([v.plate,v.model,v.investor,v.total_cost,v.days_in_stock,v.status,v.notes]));dlCSV(rows,'stock.csv');}
function exportSold(){const rows=[['Month','Plate','Model','Cost','Sold','Profit','Investor']];APP_DATA.sold.forEach(v=>rows.push([v.month,v.plate,v.model,v.total_cost,v.sold_price,v.profit,v.investor]));dlCSV(rows,'sold.csv');}
function dlCSV(rows,name){const csv=rows.map(r=>r.map(c=>'"'+(c||'').toString().replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=name;a.click();}
function showSoldBreakdown(i){
  const v = APP_DATA.sold[i];
  if(!v) return;
  alert(v.model+'\n'+v.plate+'\n\nDate acquired: '+fmtD(v.date_acquired)+'\nDate sold: '+(v.date_sold?fmtD(v.date_sold):'—')+'\nSource: '+(v.source||'—')+'\nPlatform: '+(v.platform||'—')+'\nCost in: '+fmt(v.total_cost||0)+'\nSold: '+fmt(v.sold_price||0)+'\nProfit: '+fmt(v.profit||0)+'\nInvestor: '+(v.investor||'SA')+'\nInvestor share: '+fmt(v.investor_profit||0)+'\nMP share: '+fmt(v.mp_profit||0));
}
function printServiceInvoice(i){
  const r = serviceRecords[i];
  if(!r) return;
  const w=window.open('','_blank');
  const content = '<html><head><title>Service Invoice</title><style>body{font-family:Arial;padding:20px;} .box{max-width:800px;margin:auto;border:1px solid #ddd;padding:24px;} h1{margin:0 0 14px 0;} table{width:100%;border-collapse:collapse;margin-top:16px;} td,th{border:1px solid #ddd;padding:8px;text-align:left;}</style></head><body><div class="box"><img src="'+LOGO+'" style="height:50px"><h1>Service Invoice</h1><p><strong>Vehicle:</strong> '+r.model+' · '+r.plate+'<br><strong>Date:</strong> '+fmtD(r.date)+'<br><strong>Mileage:</strong> '+(r.miles||'—')+'<br><strong>Invoice Ref:</strong> '+(r.ref||'—')+'</p><table><tr><th>Type</th><th>Notes</th></tr><tr><td>'+(r.type||'Service')+'</td><td>'+(r.notes||'')+'</td></tr></table></div></body></html>';
  w.document.write(content); w.document.close();
}
const DVSA_CONFIG = {clientId:'', clientSecret:'', apiKey:'', scope:'https://tapi.dvsa.gov.uk/.default', tokenUrl:'https://login.microsoftonline.com/a455b827-244f-4c97-b5b4-ce5d13b4d00c/oauth2/v2.0/token'};
const GOOGLE_MAPS_CONFIG = {apiKey:'', autocompleteEnabled:false};
// ════════════════════════════════════════════
// DATA MODELS — AT & INSTAGRAM
// ════════════════════════════════════════════
const AT_DEFAULT_HASHTAGS = '#usedcars #london #mpmotors #carsofinstagram #ukcar #forsale #dealership';
const PHOTO_ORDER_TEMPLATE = ['front-angle','front','side','rear-angle','rear','dashboard','front-seats','rear-seats','mileage','screen','service-history','wheels','boot','engine-bay','damage','keys'];
const PHOTO_TAG_LABELS = {'front-angle':'Front Angle','front':'Front','side':'Side','rear-angle':'Rear Angle','rear':'Rear','dashboard':'Dashboard','front-seats':'Front Seats','rear-seats':'Rear Seats','mileage':'Mileage','screen':'Screen','service-history':'Service History','wheels':'Wheels','boot':'Boot','engine-bay':'Engine Bay','damage':'Damage','keys':'Keys'};

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function atStatusLabel(s) {
  return {not_started:'Not Started',draft:'Draft',needs_review:'Needs Review',ready:'Ready',live:'Live ✓',failed:'Failed'}[s]||s;
}
function igStatusLabel(s) { return {draft:'Draft',scheduled:'Scheduled',posted:'Posted ✓',failed:'Failed'}[s]||s; }
function updateNavBadges() {
  const at=document.getElementById('nb-at');
  const ig=document.getElementById('nb-ig');
  if(at) at.textContent = atListings.filter(l=>l.status==='draft'||l.status==='needs_review').length || '0';
  if(ig) ig.textContent = igPosts.filter(p=>p.status==='draft').length || '0';
}
function setInner(id, html){ const el=document.getElementById(id); if(el) el.innerHTML = html; }
function setText(id, text){ const el=document.getElementById(id); if(el) el.textContent = text; }
function populateATNewSelect() {
  const sel = document.getElementById('at-new-plate');
  if(!sel) return;
  sel.innerHTML = stockData.map(v=>'<option value="'+v.plate+'">'+v.model+' · '+v.plate+' ('+v.stock_id+')</option>').join('');
}
function populateIGNewSelect() {
  const sel = document.getElementById('ig-new-plate');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Select vehicle —</option>'+stockData.map(v=>'<option value="'+v.plate+'">'+v.model+' · '+v.plate+' ('+v.stock_id+')</option>').join('');
}

// ─────────────────────────────────────────────
// AUTO TRADER — SETTINGS
// ─────────────────────────────────────────────
function saveATSettings() {
  atSettings = {mode:document.getElementById('at-mode').value, apiKey:document.getElementById('at-apikey').value, dealerId:document.getElementById('at-dealerid').value, env:document.getElementById('at-env').value};
  saveToStorage();
  closeM('at-settings');
  renderAutoTrader();
}
function connectAutoTrader() {
  if(atSettings.mode==='demo') {
    document.getElementById('at-conn-label').innerHTML = '· <span class="badge bg">Demo Mode Active</span>';
    alert('Demo mode: Auto Trader integration is simulated locally. All actions update listing status in real time.');
  } else {
    document.getElementById('at-conn-label').innerHTML = '· <span class="badge ba">Connecting...</span>';
    setTimeout(()=>{ document.getElementById('at-conn-label').innerHTML = '· <span class="badge br">API key required — check settings</span>'; },1500);
  }
}

// ─────────────────────────────────────────────
// AUTO TRADER — CORE FUNCTIONS
// ─────────────────────────────────────────────
function mapVehicleToATPayload(v, listing) {
  return {plate:v.plate, make:(v.model||'').split(' ')[0], model:(v.model||'').split(' ').slice(1).join(' '), year:v.year||new Date().getFullYear()-2, price:listing.price||v.total_cost, mileage:listing.mileage||0, colour:v.colour||'', fuel:v.fuel||'Petrol', transmission:v.transmission||'Manual', description:listing.description||'', title:listing.title||v.model};
}
function generateATDescription(v, listing) {
  const miles = listing.mileage ? listing.mileage.toLocaleString()+'miles' : 'mileage to be confirmed';
  const price = listing.price ? '£'+listing.price.toLocaleString() : 'priced to sell';
  const hist = (listingDescriptions[normP(v.plate)]||{}).specItems ? 'with a confirmed spec list' : '';
  const pics = vehiclePhotos[normP(v.plate)]||[];
  const photoNote = pics.length>0 ? pics.length+' photos included.' : '';
  return `${v.model} — ${price}

A great example of the ${v.model}, presented in excellent condition and ready to drive away. This car has covered ${miles} and has been carefully prepared by our team here at SA Motors (TRIAL TASK) London.

The car has been thoroughly inspected and is presented clean inside and out. ${hist ? 'It comes '+hist+'.' : ''} Full details are available — don't hesitate to call or message us.

${photoNote}

All our vehicles come with a thorough pre-sale inspection. Part exchange welcome. Finance subject to status. Call us on 07440 603950 or visit us at 64 Nile Street, London N1 7SR.

SA Motors (TRIAL TASK) — Reg. 15699982`;
}
function generateATTitle(v, listing) {
  const year = listing.year || (v.month ? v.month.slice(0,4) : new Date().getFullYear()-2);
  return year+' '+v.model+(listing.mileage?' · '+Math.round(listing.mileage/1000)+'k Miles':'')+(listing.price?' · £'+listing.price.toLocaleString():'');
}
function buildSpecListForAT(v) {
  const base = ['Air Conditioning','Central Locking','Electric Windows','Alloy Wheels','Bluetooth','DAB Radio','USB Connectivity','Parking Sensors'];
  const stored = (listingDescriptions[normP(v.plate)]||{}).specItems || [];
  if(stored.length) return stored;
  return base.map(s=>({label:s, confirmed:false, uncertain:true}));
}

async function createAutoTraderListing(plate, price, mileage) {
  if(atSettings.mode==='demo') {
    await new Promise(r=>setTimeout(r,600));
    return {success:true, listingId:'AT-DEMO-'+Date.now()};
  }
  const resp = await fetch(atSettings.env==='production'?'https://api.autotrader.co.uk/v1/listings':'https://api-sandbox.autotrader.co.uk/v1/listings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+atSettings.apiKey},body:JSON.stringify({plate,price,mileage,dealerId:atSettings.dealerId})});
  return resp.json();
}
async function updateAutoTraderListing(listingId, payload) {
  if(atSettings.mode==='demo') { await new Promise(r=>setTimeout(r,400)); return {success:true}; }
  const url = (atSettings.env==='production'?'https://api.autotrader.co.uk':'https://api-sandbox.autotrader.co.uk')+'/v1/listings/'+listingId;
  const resp = await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+atSettings.apiKey},body:JSON.stringify(payload)});
  return resp.json();
}
async function uploadAutoTraderPhotos(listingId, photos) {
  if(atSettings.mode==='demo') { await new Promise(r=>setTimeout(r,800)); return {success:true, uploaded:photos.length}; }
  return {success:false, error:'Live API not configured'};
}
async function publishAutoTraderListing(listingId) {
  if(atSettings.mode==='demo') { await new Promise(r=>setTimeout(r,500)); return {success:true}; }
  const url = (atSettings.env==='production'?'https://api.autotrader.co.uk':'https://api-sandbox.autotrader.co.uk')+'/v1/listings/'+listingId+'/publish';
  const resp = await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+atSettings.apiKey}});
  return resp.json();
}

// ─────────────────────────────────────────────
// AUTO TRADER — UI
// ─────────────────────────────────────────────
function filterAT(f,el) {
  atFilter=f;
  document.querySelectorAll('#page-autotrader .tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  renderAutoTrader();
}
function renderAutoTrader() {
  const live=atListings.filter(l=>l.status==='live').length;
  const draft=atListings.filter(l=>l.status==='draft').length;
  const ready=atListings.filter(l=>l.status==='ready').length;
  const review=atListings.filter(l=>l.status==='needs_review').length;
  const noListing=stockData.filter(v=>!atListings.find(l=>normP(l.plate)===normP(v.plate))).length;
  document.getElementById('at-stats').innerHTML=
    '<div class="stat green"><div class="sl">Live</div><div class="sv">'+live+'</div><div class="si">✓</div></div>'+
    '<div class="stat blue"><div class="sl">Drafts</div><div class="sv">'+draft+'</div></div>'+
    '<div class="stat purple"><div class="sl">Ready</div><div class="sv">'+ready+'</div></div>'+
    '<div class="stat amber"><div class="sl">Needs Review</div><div class="sv">'+review+'</div></div>'+
    '<div class="stat red"><div class="sl">No Listing</div><div class="sv">'+noListing+'</div></div>';
  document.getElementById('at-conn-label').innerHTML = '· <span class="badge '+(atSettings.mode==='demo'?'bg':'ba')+'">'+(atSettings.mode==='demo'?'Demo Mode':'Mode: '+atSettings.mode)+'</span>';

  let shown = atFilter==='all' ? atListings : atListings.filter(l=>l.status===atFilter);
  // Also show stock vehicles with no listing when filter is all or not_started
  let html = '';
  if(atFilter==='all') {
    const noList = stockData.filter(v=>!atListings.find(l=>normP(l.plate)===normP(v.plate)));
    noList.forEach(v=>{
      html += renderATCard({plate:v.plate, model:v.model, status:'not_started', price:0, mileage:0, title:'', description:'', specItems:[], photoIds:[], errors:[], id:null}, v);
    });
  }
  shown.forEach(l=>{
    const v=findCurrentStock(l.plate)||{model:l.model||l.plate,plate:l.plate};
    html += renderATCard(l, v);
  });
  document.getElementById('at-listing-grid').innerHTML = html || '<div style="color:var(--text3);text-align:center;padding:30px;font-size:13px;">No listings in this view</div>';
  updateNavBadges();
}
function renderATCard(l, v) {
  const pics = vehiclePhotos[normP(l.plate)]||[];
  const desc = listingDescriptions[normP(l.plate)]||{};
  const checks = [
    {ok:!!l.title, label:'Title'},
    {ok:!!l.description||!!desc.body, label:'Description'},
    {ok:l.price>0, label:'Price'},
    {ok:l.mileage>0, label:'Mileage'},
    {ok:pics.length>0, label:'Photos'},
    {ok:!!(desc.specItems&&desc.specItems.some(s=>s.confirmed)), label:'Spec'},
  ];
  const readyCount = checks.filter(c=>c.ok).length;
  const checkHtml = checks.map(c=>`<span class="badge ${c.ok?'bg':'br'}" style="font-size:9px;">${c.label}</span>`).join(' ');
  const statusCls = {not_started:'at-none',draft:'at-draft',needs_review:'at-review',ready:'at-ready',live:'at-live',failed:'at-failed'}[l.status]||'at-none';
  const safePlate = escJs(l.plate);
  const safeModel = escJs(v.model||l.plate);
  let actions = '';
  if(l.status==='not_started') actions += `<button class="btn btn-p btn-sm" onclick="openATEdit('${safePlate}')">+ Start Listing</button>`;
  if(l.status==='draft' || l.status==='needs_review') actions += `<button class="btn btn-b btn-sm" onclick="openATEdit('${safePlate}')">✏️ Edit</button><button class="btn btn-g btn-sm" onclick="atMarkReady('${safePlate}')">✓ Mark Ready</button>`;
  if(l.status==='ready') actions += `<button class="btn btn-b btn-sm" onclick="openATEdit('${safePlate}')">✏️ Edit</button><button class="btn btn-green btn-sm" onclick="atPublish('${safePlate}')">🚀 Publish</button>`;
  if(l.status==='live') actions += `<button class="btn btn-g btn-sm" onclick="openATEdit('${safePlate}')">✏️ Edit</button><span class="badge bg">Live on Auto Trader</span>`;
  actions += `<button class="btn btn-g btn-sm" onclick="openMediaManager('${safePlate}','${safeModel}')">📷 Photos</button><button class="btn btn-amber btn-sm" onclick="openIGFromStock('${safePlate}')">📱 IG Post</button>`;
  return `<div class="listing-card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;"><div style="flex:1;"><div class="listing-card-plate">${escHtml(l.plate)}</div><div class="listing-card-model">${escHtml(l.title||v.model||l.plate)}</div><div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:7px;"><span class="at-status ${statusCls}">${atStatusLabel(l.status)}</span>${l.price?`<span class="badge bb">£${l.price.toLocaleString()}</span>`:''}${l.mileage?`<span class="badge bk">${l.mileage.toLocaleString()}mi</span>`:''}<span class="badge bk">📷 ${pics.length}</span></div><div style="display:flex;gap:4px;flex-wrap:wrap;">${checkHtml}</div></div><div style="text-align:right;flex-shrink:0;font-size:11px;color:var(--text3);">${readyCount}/${checks.length} ready</div></div><div class="listing-actions">${actions}</div></div>`;
}

function createATListing() {
  const plate = document.getElementById('at-new-plate').value;
  const price = parseFloat(document.getElementById('at-new-price').value)||0;
  const mileage = parseFloat(document.getElementById('at-new-miles').value)||0;
  if(!plate) { alert('Select a vehicle.'); return; }
  const existing = findATListing(plate);
  if(existing) { alert('Listing already exists for '+plate+'. Click Edit to update it.'); closeM('at-new'); openATEdit(plate); return; }
  const v = findCurrentStock(plate);
  const newL = {id:'AT-'+Date.now(), plate:v ? v.plate : plate, model:v?v.model:'', title:'', description:'', price, mileage, status:'draft', specItems:[], photoIds:[], errors:[], approved:false, lastSyncedAt:null, publishUrl:''};
  atListings.push(newL);
  saveToStorage();
  closeM('at-new');
  renderAutoTrader();
  updateNavBadges();
  setTimeout(()=>openATEdit(newL.plate), 200);
}
function openATFromStock(plate) {
  const existing = findATListing(plate);
  if(existing) { openATEdit(plate); }
  else { document.getElementById('at-new-plate').value = plate; openM('at-new'); }
}
function openATEdit(plate) {
  const v = findCurrentStock(plate);
  let l = findATListing(plate);
  if(!l && v) {
    l = {id:'AT-'+Date.now(), plate:v.plate, model:v.model, title:'', description:'', price:0, mileage:0, status:'draft', specItems:[], photoIds:[], errors:[], approved:false, lastSyncedAt:null, publishUrl:''};
    atListings.push(l);
    saveToStorage();
  }
  if(!l) return;
  currentATListing = l;
  document.getElementById('at-edit-title').textContent = (v?v.model:l.plate)+' — Edit Listing';
  document.getElementById('at-edit-sub').textContent = l.plate + ' · Status: ' + atStatusLabel(l.status);
  showATStep('details');
  openM('at-edit');
}
function showATStep(step) {
  const steps = ['details','desc','spec','photos','publish'];
  steps.forEach(s=>{ document.getElementById('step-'+s).className = 'step'+(s===step?' active':''); });
  const l = currentATListing;
  const plate = l ? l.plate : '';
  const v = l ? findCurrentStock(plate) : null;
  const pics = vehiclePhotos[normP(plate)]||[];
  const desc = listingDescriptions[normP(plate)]||{};
  const bodyEl = document.getElementById('at-edit-body');
  if(!l || !bodyEl) return;

  if(step==='details') {
    bodyEl.innerHTML = `
      <div class="g2">
        <div class="fg"><label class="fl">Listing Title</label><input class="fi" id="at-f-title" value="${escHtml(l.title||'')}" placeholder="Year Make Model · Miles · Price"></div>
        <div class="fg"><label class="fl">Asking Price (£)</label><input class="fi" type="number" id="at-f-price" value="${l.price||''}"></div>
      </div>
      <div class="g2">
        <div class="fg"><label class="fl">Mileage</label><input class="fi" type="number" id="at-f-miles" value="${l.mileage||''}"></div>
        <div class="fg"><label class="fl">Year</label><input class="fi" type="number" id="at-f-year" value="${l.year||''}"></div>
      </div>
      <div class="g2">
        <div class="fg"><label class="fl">Colour</label><input class="fi" id="at-f-colour" value="${escHtml(l.colour||'')}" placeholder="e.g. Midnight Black"></div>
        <div class="fg"><label class="fl">Fuel Type</label><select class="fs" id="at-f-fuel">${['Petrol','Diesel','Hybrid','Electric'].map(x=>`<option ${l.fuel===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="g2">
        <div class="fg"><label class="fl">Transmission</label><select class="fs" id="at-f-trans">${['Manual','Automatic','Semi-Auto'].map(x=>`<option ${l.transmission===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="fg"><label class="fl">Body Type</label><select class="fs" id="at-f-body">${['Hatchback','Saloon','Estate','SUV','MPV','Coupe','Convertible','Van'].map(x=>`<option ${l.body===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      <div style="display:flex;gap:7px;justify-content:flex-end;margin-top:10px;">
        <button class="btn btn-g" onclick="showATStep('desc')">Next: Description →</button>
        <button class="btn btn-p" onclick="saveATDetails()">Save Details</button>
      </div>`;
    return;
  }

  if(step==='desc') {
    const body = l.description || desc.body || (v ? generateATDescription(v,l) : '');
    const title = l.title || generateATTitle(v||{model:plate,month:''},l);
    bodyEl.innerHTML = `
      <div class="fg"><label class="fl">Title</label><input class="fi" id="at-f-title2" value="${escHtml(title)}"></div>
      <div class="fg"><label class="fl">Description</label><textarea class="fta" id="at-f-desc" style="min-height:220px;">${body}</textarea></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;">
        <button class="btn btn-g btn-sm" onclick="atRegenDesc()">✨ Regenerate</button>
        <button class="btn btn-amber btn-sm" onclick="atApproveDesc()">✓ Approve Description</button>
        ${desc.approved?'<span class="badge bg">✓ Approved</span>':'<span class="badge ba">Not yet approved</span>'}
      </div>
      <div style="display:flex;gap:7px;justify-content:flex-end;">
        <button class="btn btn-g" onclick="showATStep('details')">← Back</button>
        <button class="btn btn-g" onclick="showATStep('spec')">Next: Spec →</button>
        <button class="btn btn-p" onclick="saveATDesc()">Save Description</button>
      </div>`;
    return;
  }

  if(step==='spec') {
    const specs = desc.specItems && desc.specItems.length ? desc.specItems : buildSpecListForAT(v||{});
    bodyEl.innerHTML = `
      <div id="spec-list-edit">${specs.map((s,i)=>`<div class="spec-item"><input class="spec-cb" type="checkbox" ${s.confirmed?'checked':''} onchange="toggleSpecConfirmed(${i},this.checked)"><div class="spec-label">${escHtml(s.label||s)}</div>${s.uncertain?'<span class="spec-uncertain">Needs confirming</span>':''}</div>`).join('')}</div>
      <div class="fg" style="margin-top:10px;"><label class="fl">Add custom spec item</label><div style="display:flex;gap:7px;"><input class="fi" id="spec-custom" placeholder="e.g. Panoramic Roof"><button class="btn btn-g btn-sm" onclick="addCustomSpec()">+ Add</button></div></div>
      <div style="display:flex;gap:7px;justify-content:flex-end;">
        <button class="btn btn-g" onclick="showATStep('desc')">← Back</button>
        <button class="btn btn-g" onclick="showATStep('photos')">Next: Photos →</button>
        <button class="btn btn-p" onclick="saveATSpec()">Save Spec</button>
      </div>`;
    window._currentATSpecs = specs;
    return;
  }

  if(step==='photos') {
    bodyEl.innerHTML = `
      <div class="ch"><div class="ct">Photos (${pics.length})<br><span style="font-size:10px;color:var(--text3);">Cover photo shown first. Click order to set as cover. Auto order sorts by preferred sequence.</span></div><div style="display:flex;gap:5px;"><button class="btn btn-g btn-sm" onclick="document.getElementById('at-photo-input').click()">+ Add</button><button class="btn btn-amber btn-sm" onclick="autoOrderPhotos()">🔁 Auto Order</button><button class="btn btn-b btn-sm" onclick="atUploadPhotos()">📤 Push to AT</button></div></div>
      <input type="file" id="at-photo-input" accept="image/*" multiple style="display:none" onchange="handleATPhotoUpload(this)">
      <div class="photo-grid" id="at-photo-grid">${renderPhotoGrid(plate)}${pics.length===0?`<div class="ph-empty" onclick="document.getElementById('at-photo-input').click()"><div style="font-size:28px;">📷</div><div>Add photos</div></div>`:''}</div>
      <div style="display:flex;gap:7px;justify-content:flex-end;margin-top:10px;">
        <button class="btn btn-g" onclick="showATStep('spec')">← Back</button>
        <button class="btn btn-g" onclick="showATStep('publish')">Next: Publish →</button>
      </div>`;
    return;
  }

  const checks = [
    {ok:!!l.title, label:'Title added', fix:`showATStep('details')`},
    {ok:!!(l.description || desc.body), label:'Description ready', fix:`showATStep('desc')`},
    {ok:l.price>0, label:'Price added', fix:`showATStep('details')`},
    {ok:l.mileage>0, label:'Mileage added', fix:`showATStep('details')`},
    {ok:pics.length>0, label:'Photos uploaded', fix:`showATStep('photos')`},
    {ok:!!(desc.specItems&&desc.specItems.some(s=>s.confirmed)), label:'Spec confirmed', fix:`showATStep('spec')`},
  ];
  const allOk = checks.every(c=>c.ok);
  bodyEl.innerHTML = `
    <div class="aip"><div class="ailabel">🚀 Publish Readiness</div><div class="aitext">Complete the items below before pushing this vehicle live to Auto Trader.</div></div>
    <div>${checks.map(c=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);"><span style="font-size:16px;">${c.ok?'✅':'❌'}</span><span style="flex:1;font-size:12.5px;color:${c.ok?'var(--text)':'var(--text2)'}">${c.label}</span>${c.ok?'':`<button class="btn btn-g btn-xs" onclick="${c.fix}">Fix</button>`}</div>`).join('')}</div>
    <div style="margin-top:12px;">${allOk?`<button class="btn btn-p" style="width:100%;padding:12px;font-size:14px;" onclick="atPublish('${escJs(plate)}')">🚀 Publish to Auto Trader</button>`:`<div class="alert alt-a">⚠️ Complete the checklist above before publishing.</div><button class="btn btn-amber" style="width:100%;padding:11px;" onclick="atMarkReady('${escJs(plate)}')">Mark as Ready</button>`}</div>
    <div style="display:flex;gap:7px;justify-content:flex-end;margin-top:10px;"><button class="btn btn-g" onclick="showATStep('photos')">← Back</button></div>`;
}
function saveATDetails() {
  if(!currentATListing) return;
  currentATListing.title = document.getElementById('at-f-title').value;
  currentATListing.price = parseFloat(document.getElementById('at-f-price').value)||0;
  currentATListing.mileage = parseFloat(document.getElementById('at-f-miles').value)||0;
  currentATListing.year = parseInt(document.getElementById('at-f-year').value)||0;
  currentATListing.colour = document.getElementById('at-f-colour').value;
  currentATListing.fuel = document.getElementById('at-f-fuel').value;
  currentATListing.transmission = document.getElementById('at-f-trans').value;
  currentATListing.status = 'draft';
  saveToStorage();
  showATStep('desc');
}
function saveATDesc() {
  if(!currentATListing) return;
  const plate = currentATListing.plate;
  const title = document.getElementById('at-f-title2').value;
  const body = document.getElementById('at-f-desc').value;
  currentATListing.title = title;
  currentATListing.description = body;
  if(!listingDescriptions[normP(plate)]) listingDescriptions[normP(plate)] = {};
  listingDescriptions[normP(plate)].body = body;
  listingDescriptions[normP(plate)].title = title;
  currentATListing.status = 'needs_review';
  saveToStorage();
  alert('Description saved.');
}
function atApproveDesc() {
  const plate = currentATListing ? currentATListing.plate : '';
  const body = document.getElementById('at-f-desc').value;
  if(!listingDescriptions[normP(plate)]) listingDescriptions[normP(plate)] = {};
  listingDescriptions[normP(plate)].body = body;
  listingDescriptions[normP(plate)].approved = true;
  if(currentATListing) { currentATListing.description = body; currentATListing.status = 'needs_review'; }
  saveToStorage();
  showATStep('desc');
}
function atRegenDesc() {
  const plate = currentATListing ? currentATListing.plate : '';
  const v = findCurrentStock(plate);
  if(!v) return;
  document.getElementById('at-f-desc').value = generateATDescription(v, currentATListing);
}
function toggleSpecConfirmed(idx, checked) {
  if(window._currentATSpecs && window._currentATSpecs[idx] !== undefined) {
    window._currentATSpecs[idx].confirmed = checked;
  }
}
function saveATSpec() {
  const plate = currentATListing ? currentATListing.plate : '';
  const items = [];
  document.querySelectorAll('#spec-list-edit .spec-item').forEach((row,i)=>{
    const cb = row.querySelector('.spec-cb');
    const lbl = row.querySelector('.spec-label');
    if(lbl) items.push({label:lbl.textContent, confirmed:cb?cb.checked:false, uncertain:false});
  });
  if(!listingDescriptions[normP(plate)]) listingDescriptions[normP(plate)] = {};
  listingDescriptions[normP(plate)].specItems = items;
  if(currentATListing) currentATListing.specItems = items;
  saveToStorage();
  alert('Spec saved ('+items.filter(s=>s.confirmed).length+' confirmed items).');
}
function addCustomSpec() {
  const val = document.getElementById('spec-custom').value.trim();
  if(!val) return;
  const list = document.getElementById('spec-list-edit');
  const i = list.children.length;
  const div = document.createElement('div');
  div.className = 'spec-item';
  div.innerHTML = '<input type="checkbox" class="spec-cb" id="spec-'+i+'" checked><label class="spec-label" for="spec-'+i+'">'+val+'</label>';
  list.appendChild(div);
  document.getElementById('spec-custom').value = '';
}
async function atUploadPhotos() {
  const plate = currentATListing ? currentATListing.plate : '';
  const pics = vehiclePhotos[normP(plate)]||[];
  if(!pics.length) { alert('No photos to upload.'); return; }
  const btn = event.target;
  btn.textContent = '⏳ Uploading...';
  btn.disabled = true;
  const res = await uploadAutoTraderPhotos(currentATListing.id, pics);
  btn.disabled = false;
  if(res.success) {
    pics.forEach(p=>p.atUploaded=true);
    vehiclePhotos[normP(plate)] = pics;
    saveToStorage();
    btn.textContent = '✅ '+pics.length+' uploaded';
    btn.style.background = 'var(--green)';
  } else {
    btn.textContent = '📤 Push to AT';
    alert('Upload failed: '+( res.error||'unknown error'));
  }
}
async function atMarkReady(plate) {
  const l = findATListing(plate);
  if(!l) return;
  l.status = 'ready';
  l.lastSyncedAt = new Date().toISOString();
  saveToStorage();
  renderAutoTrader();
  if(document.getElementById('m-at-edit').classList.contains('open')) { document.getElementById('at-edit-sub').textContent = plate+' · Status: '+atStatusLabel(l.status); showATStep('publish'); }
}
async function atPublish(plate) {
  const l = findATListing(plate);
  if(!l) return;
  const btn = event.target;
  const origText = btn.textContent;
  btn.textContent = '⏳ Publishing...';
  btn.disabled = true;
  const res = await publishAutoTraderListing(l.id);
  btn.disabled = false;
  if(res.success) {
    l.status = 'live';
    l.publishUrl = atSettings.mode==='demo' ? 'https://www.autotrader.co.uk/car-details/demo-'+l.id : '';
    l.lastSyncedAt = new Date().toISOString();
    saveToStorage();
    renderAutoTrader();
    btn.textContent = '✅ Live!';
    btn.style.background = 'var(--green)';
    if(document.getElementById('m-at-edit').classList.contains('open')) showATStep('publish');
  } else {
    btn.textContent = origText;
    l.status = 'failed';
    saveToStorage();
    alert('Publish failed. Check API settings.');
  }
}

// ─────────────────────────────────────────────
// INSTAGRAM — SETTINGS & CONNECT
// ─────────────────────────────────────────────
function saveIGSettings() {
  igSettings = {mode:document.getElementById('ig-mode').value, handle:document.getElementById('ig-handle').value, appId:document.getElementById('ig-appid').value, token:document.getElementById('ig-token').value};
  saveToStorage();
  closeM('ig-settings');
  renderInstagram();
}
function connectInstagram() {
  if(igSettings.mode==='demo') {
    document.getElementById('ig-conn-label').innerHTML = '· <span class="badge bg">Demo Mode Active</span>';
    alert('Demo mode: Instagram posts are tracked locally. Connect Meta API for live posting.');
  } else {
    const authUrl = 'https://www.facebook.com/v18.0/dialog/oauth?client_id='+igSettings.appId+'&redirect_uri='+encodeURIComponent(window.location.href)+'&scope=instagram_basic,instagram_content_publish,pages_show_list';
    if(igSettings.appId) window.open(authUrl,'_blank');
    else alert('Enter your Meta App ID in Instagram settings first.');
  }
}

// ─────────────────────────────────────────────
// INSTAGRAM — CORE
// ─────────────────────────────────────────────
function generateInstagramCaption(v, listing) {
  const price = listing && listing.price ? '£'+listing.price.toLocaleString() : '';
  const mileage = listing && listing.mileage ? listing.mileage.toLocaleString()+' miles' : '';
  const parts = [
    '🚗 '+(v.model||''),
    price ? '💰 '+price : '',
    mileage ? '📍 '+mileage : '',
    '',
    'Ready to drive away, pristine condition.',
    'Call or DM us to arrange a viewing.',
    '📍 SA Motors (TRIAL TASK) London, 64 Nile Street, London N1',
    '📞 07440 603950'
  ].filter(Boolean);
  return parts.join('\n');
}
function generateInstagramHashtags(v) {
  const make = (v.model||'').split(' ')[0].toLowerCase().replace(/\s/g,'');
  return [AT_DEFAULT_HASHTAGS, '#'+make, '#londondealer', '#mpmotor'].filter(Boolean).join(' ');
}

async function postVehicleToInstagram(postData) {
  if(igSettings.mode==='demo') {
    await new Promise(r=>setTimeout(r,900));
    return {success:true, postId:'IG-DEMO-'+Date.now()};
  }
  // Real Graph API call would go here
  return {success:false, error:'Live API not configured. Add Meta access token in settings.'};
}

// ─────────────────────────────────────────────
// INSTAGRAM — UI
// ─────────────────────────────────────────────
function filterIG(f,el) {
  igFilter=f;
  document.querySelectorAll('#page-instagram .tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  renderInstagram();
}
function renderInstagram() {
  const posted = igPosts.filter(p=>p.status==='posted');
  const drafts = igPosts.filter(p=>p.status==='draft');
  const sched = igPosts.filter(p=>p.status==='scheduled');
  const thisWeek = igPosts.filter(p=>p.status==='posted'&&p.postedAt&&(new Date()-new Date(p.postedAt))<7*864e5);
  document.getElementById('ig-conn-label').innerHTML='· <span class="badge '+(igSettings.mode==='demo'?'bg':'ba')+'">'+(igSettings.mode==='demo'?'Demo Mode':igSettings.handle||'Not connected')+'</span>';
  document.getElementById('ig-stats').innerHTML=
    '<div class="stat green"><div class="sl">Posted</div><div class="sv">'+posted.length+'</div></div>'+
    '<div class="stat amber"><div class="sl">Drafts</div><div class="sv">'+drafts.length+'</div></div>'+
    '<div class="stat blue"><div class="sl">Scheduled</div><div class="sv">'+sched.length+'</div></div>'+
    '<div class="stat purple"><div class="sl">This Week</div><div class="sv">'+thisWeek.length+'</div></div>';
  let shown = igFilter==='all'?igPosts:igPosts.filter(p=>p.status===igFilter);
  document.getElementById('ig-post-grid').innerHTML = shown.length ? shown.map(p=>renderIGCard(p)).join('') : '<div style="color:var(--text3);text-align:center;padding:30px;font-size:13px;">No posts in this view</div>';
  updateNavBadges();
}
function renderIGCard(p) {
  const v = findCurrentStock(p.plate)||{model:p.plate,plate:p.plate};
  const pics = (p.photoIds||[]).map(id=>(vehiclePhotos[normP(p.plate)]||[]).find(ph=>ph.id===id)).filter(Boolean);
  const statusCls = {draft:'ig-draft',scheduled:'ba',posted:'ig-posted',failed:'br'}[p.status]||'bk';
  const safeId = escJs(p.id);
  return `<div class="ig-post-card" style="margin-bottom:8px;"><div class="ig-thumb">${pics[0]&&pics[0].url?`<img src="${pics[0].url}" alt="">`:'📷'}${pics.length>1?`<div class="ig-count">+${pics.length}</div>`:''}</div><div style="flex:1;"><div style="font-size:13px;font-weight:700;margin-bottom:2px;">${escHtml(v.model)}</div><div style="font-size:10.5px;color:var(--text3);margin-bottom:5px;font-family:'DM Mono',monospace;">${escHtml(p.plate)}</div><span class="badge ${statusCls}" style="margin-bottom:6px;">${igStatusLabel(p.status)}</span>${p.status==='draft'?` <span class="badge bb" style="margin-bottom:6px;">${escHtml(p.type||'')}</span>`:''}<div style="font-size:11px;color:var(--text3);margin-top:4px;white-space:pre-wrap;max-height:48px;overflow:hidden;">${escHtml((p.caption||'').slice(0,100))}</div></div><div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;"><button class="btn btn-b btn-xs" onclick="editIGPost('${safeId}')">Edit</button>${p.status==='draft'?`<button class="btn btn-p btn-xs" onclick="publishIGPost('${safeId}')">Post</button>`:''}<button class="btn btn-red btn-xs" onclick="deleteIGPost('${safeId}')">Del</button></div></div>`;
}
function igSelectVehicle(plate) {
  if(!plate) { document.getElementById('ig-photo-picker').innerHTML=''; return; }
  const v = findCurrentStock(plate);
  const pics = vehiclePhotos[normP(plate)]||[];
  const atL = findATListing(plate);
  if(v) {
    const suggested = generateInstagramCaption(v, atL);
    if(!document.getElementById('ig-new-caption').value) document.getElementById('ig-new-caption').value = suggested;
    if(!document.getElementById('ig-new-hashtags').value) document.getElementById('ig-new-hashtags').value = generateInstagramHashtags(v);
  }
  const picker = document.getElementById('ig-photo-picker');
  if(!pics.length) {
    picker.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:10px;">No photos for this vehicle yet. <button class="btn btn-g btn-xs" onclick="closeM('ig-new');openMediaManager('${escJs(plate)}','${escJs(v?v.model:plate)}')">Add Photos</button></div>`;
    return;
  }
  picker.innerHTML = pics.map(ph=>`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px;border-radius:6px;border:1px solid var(--border);background:var(--s2);"><input type="checkbox" checked style="accent-color:var(--accent);width:14px;height:14px;" data-photo-id="${ph.id}">${ph.url?`<img src="${ph.url}" style="width:48px;height:36px;object-fit:cover;border-radius:4px;">`:`<div style="width:48px;height:36px;background:var(--s3);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">📷</div>`}<div style="flex:1;"><div style="font-size:11px;font-weight:600;">${escHtml(PHOTO_TAG_LABELS[ph.tag]||ph.tag||'Photo')}</div>${ph.cover?'<span class="badge ba" style="font-size:9px;">Cover</span>':''}</div></label>`).join('');
}
function igGenCaption() {
  const plate = document.getElementById('ig-new-plate').value;
  const v = findCurrentStock(plate);
  if(!v) return;
  const atL = findATListing(plate);
  document.getElementById('ig-new-caption').value = generateInstagramCaption(v,atL);
}
function igUseATDesc() {
  const plate = document.getElementById('ig-new-plate').value;
  const desc = listingDescriptions[normP(plate)];
  if(desc && desc.body) {
    const short = desc.body.split('\n\n')[0] + '\n\nCall 07440 603950 or visit us at 64 Nile Street, London N1 7SR.';
    document.getElementById('ig-new-caption').value = short.slice(0,2200);
  } else {
    alert('No Auto Trader description for this vehicle yet. Create one first.');
  }
}
function saveIGDraft() {
  const plate = document.getElementById('ig-new-plate').value;
  if(!plate) { alert('Select a vehicle.'); return; }
  const picks = [...document.querySelectorAll('#ig-photo-picker input[type=checkbox]:checked')].map(cb=>cb.dataset.photoId).filter(Boolean);
  const atL = findATListing(plate);
  const post = {id:'IG-'+Date.now(), vehicleId:plate, plate, caption:document.getElementById('ig-new-caption').value, hashtags:document.getElementById('ig-new-hashtags').value, photoIds:picks, status:'draft', type:document.getElementById('ig-new-type').value, createdAt:new Date().toISOString(), scheduledAt:document.getElementById('ig-new-schedule').value||null, postedAt:null, linkedListingId:atL?atL.id:null};
  igPosts.unshift(post);
  saveToStorage();
  closeM('ig-new');
  renderInstagram();
  updateNavBadges();
}
async function postToInstagram() {
  const plate = document.getElementById('ig-new-plate').value;
  if(!plate) { alert('Select a vehicle.'); return; }
  const btn = event.target;
  btn.textContent = '⏳ Posting...';
  btn.disabled = true;
  const picks = [...document.querySelectorAll('#ig-photo-picker input[type=checkbox]:checked')].map(cb=>cb.dataset.photoId).filter(Boolean);
  const atL = findATListing(plate);
  const caption = document.getElementById('ig-new-caption').value;
  const hashtags = document.getElementById('ig-new-hashtags').value;
  const res = await postVehicleToInstagram({plate, caption, hashtags, photoIds:picks});
  if(res.success) {
    const post = {id:'IG-'+Date.now(), vehicleId:plate, plate, caption, hashtags, photoIds:picks, status:'posted', type:document.getElementById('ig-new-type').value, createdAt:new Date().toISOString(), scheduledAt:null, postedAt:new Date().toISOString(), linkedListingId:atL?atL.id:null, externalId:res.postId||''};
    igPosts.unshift(post);
    saveToStorage();
    closeM('ig-new');
    renderInstagram();
    updateNavBadges();
    btn.disabled = false;
    alert('✅ Posted to Instagram'+(igSettings.mode==='demo'?' (demo)':'')+'!');
  } else {
    btn.textContent = '📱 Post Now';
    btn.disabled = false;
    alert('Post failed: '+(res.error||'unknown error'));
  }
}
function openIGFromStock(plate) {
  const v = findCurrentStock(plate);
  if(!v) return;
  populateIGNewSelect();
  setTimeout(()=>{
    document.getElementById('ig-new-plate').value = v.plate;
    igSelectVehicle(v.plate);
    openM('ig-new');
  },50);
}
function editIGPost(id) {
  const p = igPosts.find(p=>p.id===id);
  if(!p) return;
  populateIGNewSelect();
  setTimeout(()=>{
    document.getElementById('ig-new-plate').value = p.plate;
    document.getElementById('ig-new-caption').value = p.caption||'';
    document.getElementById('ig-new-hashtags').value = p.hashtags||'';
    igSelectVehicle(p.plate);
    openM('ig-new');
  },50);
}
function publishIGPost(id) {
  const p = igPosts.find(p=>p.id===id);
  if(!p) return;
  if(igSettings.mode==='demo') {
    p.status = 'posted';
    p.postedAt = new Date().toISOString();
    saveToStorage();
    renderInstagram();
    updateNavBadges();
  } else {
    alert('Connect Meta API in settings to publish live posts.');
  }
}
function deleteIGPost(id) {
  if(!confirm('Delete this post?')) return;
  igPosts = igPosts.filter(p=>p.id!==id);
  saveToStorage();
  renderInstagram();
  updateNavBadges();
}

// ─────────────────────────────────────────────
// PHOTO / MEDIA MANAGER
// ─────────────────────────────────────────────
function openMediaManager(plate, model) {
  currentMediaPlate = plate;
  setText('media-title', model + ' — Media');
  setText('media-sub', plate);
  refreshMediaModal();
  openM('media');
}
function refreshMediaModal() {
  const plate = currentMediaPlate;
  const pics = vehiclePhotos[normP(plate)]||[];
  setText('media-photo-count', '('+pics.length+')');
  setInner('media-photo-grid', renderPhotoGrid(plate) + (pics.length<20?`<div class="ph-empty" onclick="document.getElementById('media-file-input').click()"><div style="font-size:22px;">+</div><div>Add photo</div></div>`:''));
  const atL = atListings.find(l=>normP(l.plate)===normP(plate));
  const igP = igPosts.filter(p=>normP(p.plate)===normP(plate));
  const atUploaded = pics.filter(p=>p.atUploaded).length;
  setInner('media-listing-status',
    `<div class="irow" style="padding:6px 0;"><span class="lbl">AT Status</span><span class="val"><span class="at-status ${atL?'at-'+atL.status:'at-none'}">${atL?atStatusLabel(atL.status):'No listing'}</span></span></div>`+
    `<div class="irow" style="padding:6px 0;"><span class="lbl">AT Photos</span><span class="val">${atUploaded} / ${pics.length} pushed</span></div>`+
    `<div class="irow" style="padding:6px 0;"><span class="lbl">IG Posts</span><span class="val">${igP.length} post${igP.length!==1?'s':''} (${igP.filter(p=>p.status==='posted').length} live)</span></div>`+
    `<div class="irow" style="padding:6px 0;"><span class="lbl">Cover Photo</span><span class="val">${pics.find(p=>p.cover)?'✓ Set':'⚠️ Not set'}</span></div>`);
  setInner('media-quick-actions',
    `<button class="btn btn-b" style="width:100%;" onclick="openATFromStock('${escJs(plate)}')">🌐 Auto Trader Listing</button>`+
    `<button class="btn btn-amber" style="width:100%;" onclick="closeM('media');openIGFromStock('${escJs(plate)}')">📱 Post to Instagram</button>`+
    `<button class="btn btn-g" style="width:100%;" onclick="autoOrderPhotos()">🔁 Auto Order Photos</button>`+
    `<button class="btn btn-g" style="width:100%;" onclick="document.getElementById('media-file-input').click()">+ Add More Photos</button>`);
}
function setCoverPhoto(np, idx) {
  const pics = vehiclePhotos[np];
  if(!pics) return;
  pics.forEach((p,i)=>p.cover=(i===idx));
  vehiclePhotos[np] = pics;
  saveToStorage();
  if(currentMediaPlate && normP(currentMediaPlate)===np) refreshMediaModal();
  if(currentATListing && normP(currentATListing.plate)===np) setInner('at-photo-grid', renderPhotoGrid(currentATListing.plate));
}
function setPhotoTag(np, idx, tag) {
  const pics = vehiclePhotos[np];
  if(!pics||!pics[idx]) return;
  pics[idx].tag = tag;
  vehiclePhotos[np] = pics;
  saveToStorage();
}
function autoOrderPhotos() {
  const np = currentATListing ? normP(currentATListing.plate) : (currentMediaPlate ? normP(currentMediaPlate) : '');
  if(!np) return;
  const pics = vehiclePhotos[np]||[];
  // Sort by tag order template
  pics.sort((a,b)=>{
    const ai = PHOTO_ORDER_TEMPLATE.indexOf(a.tag);
    const bi = PHOTO_ORDER_TEMPLATE.indexOf(b.tag);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });
  pics.forEach((p,i)=>p.order=i);
  vehiclePhotos[np] = pics;
  saveToStorage();
  if(currentATListing && normP(currentATListing.plate)===np) setInner('at-photo-grid', renderPhotoGrid(currentATListing.plate));
  if(currentMediaPlate && normP(currentMediaPlate)===np) refreshMediaModal();
}
let dragSrcIdx = null;
function dragPhotoStart(e, idx) { dragSrcIdx = idx; e.dataTransfer.effectAllowed = 'move'; }
function dragPhotoDrop(e, idx) {
  e.preventDefault();
  const np = currentATListing ? normP(currentATListing.plate) : (currentMediaPlate ? normP(currentMediaPlate) : '');
  if(!np || dragSrcIdx===null || dragSrcIdx===idx) return;
  const pics = vehiclePhotos[np]||[];
  const moved = pics.splice(dragSrcIdx,1)[0];
  pics.splice(idx,0,moved);
  pics.forEach((p,i)=>{p.order=i; p.cover=(i===0);});
  vehiclePhotos[np] = pics;
  saveToStorage();
  if(currentATListing && normP(currentATListing.plate)===np) setInner('at-photo-grid', renderPhotoGrid(currentATListing.plate));
  if(currentMediaPlate && normP(currentMediaPlate)===np) refreshMediaModal();
  dragSrcIdx = null;
}



// =============================================================================
// DEALEROS v4 — DEVELOPER NOTES
// =============================================================================
// WHAT WAS FIXED IN v4:
//   1. APP_DATA.collections was undefined — collections array injected from workbook
//   2. APP_DATA.money_in was undefined — money_in array injected from workbook
//   3. APP_DATA.money_out was undefined — money_out array injected from workbook
//   4. Duplicate id="wp-staff" on wage payment modal select — deduplicated
//   5. toggleSpecConfirmed() was called but never defined — function added
//   6. #spec-list-edit was queried but never assigned — id added to spec wrapper div
//   7. Version label updated from DealerOS v3 to DealerOS v4
//
// ASSUMPTIONS:
//   - collections data sourced from the 'Collection' sheet (5 active rows, Apr 2026)
//   - money_in seeded from 'Money in' sheet (Mar-Apr 2026 vehicle sales)
//   - money_out seeded from 'Money out' sheet (Mar-Apr 2026 overheads)
//   - SOR (Sale or Return) sheet exists in workbook but has no app section yet — needs new module
//   - Investor Car Expense sheet merged into general expense log (no separate UI currently)
//   - Per-car cost breakdowns (individual car sheets) captured in recon_cost field only
//   - Plate is used as stock primary key; stock_id field reserved for future backend UUID
//
// EXCEL SYNC STUBS (future backend):
//   - exportToExcelFormat() below maps APP_DATA to workbook column names
//   - When a sync API exists, POST this object to /api/sync endpoint
//
// FILE LINKING STUBS (future backend):
//   - vehiclePhotos[plate] = [base64 strings] — replace with CDN URLs when hosted
//   - listingDescriptions[plate].invoicePath = '' — add invoice file path when available
//   - SOR tracking needs: sor_owner, sor_price, sor_start_date, sor_end_date fields
//
// STILL NEEDS BACKEND/HOSTING:
//   - File upload endpoint for photos and invoices (currently base64 in localStorage)
//   - Excel live-sync API (read/write to Master_Spreadsheet.xlsx)
//   - Barclays Open Banking OAuth for Routes & Planning bank feed
//   - DVSA MOT API token (currently using public check URL only)
//   - Meta/Instagram Graph API credentials for IG posting
//   - Google Maps Places API key for collection route planning
// =============================================================================

function exportToExcelFormat() {
  // Maps APP_DATA fields to workbook column names for future Excel sync
  return {
    // Sold Stock sheet columns: Month, Date Acquired, Number Plate, Make & Model,
    // MP/Investor Name, Total Cost, Sold, Part Ex, Profit Share, Total Profit,
    // Investor Profit, MP Profit, Date Listed, Date Sold, Days to Sell, Platform,
    // Invoice Number, Customer Name, Contact, Warranty, AutoGuard Number
    sold_stock: APP_DATA.sold.map(v => ({
      'Month': v.month,
      'Date Acquired': v.date_acquired,
      'Number Plate': v.plate,
      'Make & Model': v.model,
      'MP/Investor Name': v.investor,
      'Total Cost': v.total_cost,
      'Sold': v.sold_price,
      'Total Profit': v.profit,
      'Date Sold': v.date_sold,
      'Days to Sell': v.days_in_stock,
      'Platform': v.platform,
      'Invoice Number': v.invoice_number,
      'Customer Name': v.customer_name,
      'Warranty': v.warranty,
      'AutoGuard Number': v.autoguard
    })),
    // Stock Data sheet columns: Month, Date Acquired, Plate Number, Make & Model,
    // Investor/MP, Source, PX Value, Price, Reconditioning, Total Cost, Status
    stock_data: APP_DATA.stock.map(v => ({
      'Month': v.month,
      'Date Acquired': v.date_acquired,
      'Plate Number': v.plate,
      'Make & Model': v.model,
      'Investor/MP': v.investor,
      'Source': v.source,
      'Price': v.purchase_price,
      'Reconditioning': v.recon_cost,
      'Total Cost': v.total_cost,
      'Status': v.status,
      'Notes': v.notes
    })),
    // Investor Budget sheet columns: Investors, Initial Balance, Capital Returned,
    // Total Balance, Purchased, Total Profit, Available
    investor_budget: APP_DATA.investors.map(i => ({
      'Investors': i.name,
      'Initial Balance': i.initial_balance,
      'Capital Returned': i.capital_returned,
      'Total Balance': i.total_balance,
      'Purchased': i.purchased,
      'Total Profit (since Nov-25)': i.total_profit,
      'Available': i.available
    })),
    // Collection sheet columns: Source, Date Won, Plate Number, Make & Model,
    // Location, Post Code, How Far?, Collection Date, Number, Additional notes
    collections: (APP_DATA.collections||[]).map(c => ({
      'Source': c.source,
      'Date Won': c.date_won,
      'Plate Number': c.plate,
      'Make & Model': c.model,
      'Location': c.addr,
      'Collection Date': c.collection_date||'',
      'Additional notes': c.notes
    })),
    // Expense sheet columns: Month, Date, Category, From, Amount, Payment Method, Paid By, Notes
    expenses: APP_DATA.expenses.map(e => ({
      'Month': e.month,
      'Category': e.category,
      'From': e.from,
      'Amount': e.amount,
      'Paid By': e.paid_by,
      'Notes': e.notes
    })),
    money_in: (APP_DATA.money_in||[]).map(e => ({
      'Month': e.month,
      'Date': e.date,
      'Category': e.category,
      'Amount': e.amount,
      'Reg': e.plate||'',
      'Notes': e.notes
    })),
    money_out: (APP_DATA.money_out||[]).map(e => ({
      'Month': e.month,
      'Date': e.date,
      'Category': e.category,
      'Amount': e.amount,
      'Notes': e.notes
    }))
  };
}

// File linking stubs — replace paths with real URLs when backend is available
function getVehicleFilePaths(plate) {
  const np = normP(plate);
  return {
    photos: vehiclePhotos[np] || [],         // future: CDN URL array
    invoice: (listingDescriptions[np]||{}).invoicePath || null,  // future: hosted PDF path
    // Add when SOR module is built:
    // sor_agreement: (listingDescriptions[np]||{}).sorAgreementPath || null
  };
}

// =============================================================================
// BACKEND TAKEOVER ADAPTER
// =============================================================================
function emptyBootstrapState() {
  return {
    stock: [],
    sold: [],
    investors: [],
    monthly: [],
    collections: [],
    deliveries: [],
    financeLog: [],
    serviceRecords: [],
    fines: [],
    receipts: [],
    invoices: [],
    viewings: [],
    staff: [],
    wagePayments: [],
    vehiclePhotos: {},
    workbook: {lastSync:null}
  };
}

function normalizeAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function clearFields(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function showActionError(action, error) {
  console.error(action, error);
  alert(action + ' failed: ' + (error && error.message ? error.message : String(error)));
}

async function apiFetch(path, options) {
  const init = Object.assign({method:'GET'}, options || {});
  if (init.body && !(init.body instanceof FormData) && typeof init.body !== 'string') {
    init.headers = Object.assign({}, init.headers || {}, {'Content-Type':'application/json'});
    init.body = JSON.stringify(init.body);
  }
  const response = await fetch('/api' + path, init);
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (_error) {
    payload = raw;
  }
  if (!response.ok) {
    throw new Error((payload && payload.error) || ('Request failed (' + response.status + ')'));
  }
  return payload;
}

function findV(value) {
  const needle = String(value || '').trim();
  if (!needle) return null;
  const normalized = normP(needle);
  return stockData.find(v => v.stock_id === needle || normP(v.plate) === normalized)
    || (APP_DATA.sold || []).find(v => v.stock_id === needle || normP(v.plate) === normalized)
    || null;
}

function findCurrentStock(value) {
  const needle = String(value || '').trim();
  if (!needle) return null;
  const normalized = normP(needle);
  return stockData.find(v => v.stock_id === needle || normP(v.plate) === normalized) || null;
}

function findSoldVehicle(value) {
  const needle = String(value || '').trim();
  if (!needle) return null;
  const normalized = normP(needle);
  return (APP_DATA.sold || []).find(v => v.stock_id === needle || normP(v.plate) === normalized) || null;
}

function findATListing(value) {
  const vehicle = findV(value);
  const normalized = normP(vehicle ? vehicle.plate : value);
  return atListings.find(listing => normP(listing.plate) === normalized) || null;
}

function resolveVehicleOrThrow(value, requiredMessage) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const vehicle = findV(raw);
  if (!vehicle) {
    throw new Error(requiredMessage || ('Unknown vehicle reference: ' + raw));
  }
  return vehicle;
}

function applyBootstrapState(state) {
  const merged = Object.assign(emptyBootstrapState(), state || {});
  APP_DATA = merged;
  window.APP_DATA = merged;
  stockData = (merged.stock || []).map(v => Object.assign({}, v));
  finLog = (merged.financeLog || []).map(entry => ({
    id: entry.id,
    expense_id: entry.id,
    stock_id: entry.stock_id || '',
    date: entry.date || '',
    plate: entry.plate || '',
    model: entry.model || '',
    desc: entry.desc || entry.description || '',
    cat: entry.cat || entry.category || 'Other',
    amount: normalizeAmount(entry.amount),
    direction: entry.direction || 'out',
    entry_type: entry.entry_type || 'expense',
    source_label: entry.source_label || '',
    notes: entry.notes || ''
  }));
  collections = (merged.collections || []).map(row => Object.assign({}, row, {
    linked_vehicles: row.linked_vehicles || row.linked_stock_ids || []
  }));
  deliveries = (merged.deliveries || []).map(row => Object.assign({}, row, {
    linked_vehicles: row.linked_vehicles || row.linked_stock_ids || []
  }));
  serviceRecords = (merged.serviceRecords || []).map(row => Object.assign({}, row));
  fines = (merged.fines || []).map(row => Object.assign({}, row, {
    ref: row.ref || row.reference || ''
  }));
  receipts = (merged.receipts || []).map(row => Object.assign({}, row));
  viewings = (merged.viewings || []).map(row => Object.assign({}, row));
  staff = (merged.staff || []).map(row => Object.assign({}, row));
  const staffById = Object.fromEntries(staff.map(row => [row.id, row.name]));
  wagePayments = (merged.wagePayments || []).map(row => Object.assign({}, row, {
    name: row.name || staffById[row.staff_id] || 'Unknown'
  }));
  savedInvoices = (merged.invoices || []).map(row => Object.assign({}, row));
  vehiclePhotos = Object.assign({}, merged.vehiclePhotos || {});
}

function populateSelect(selectId, options, blankLabel) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const html = [];
  if (blankLabel !== undefined) {
    html.push('<option value="">' + escHtml(blankLabel) + '</option>');
  }
  options.forEach(option => {
    html.push('<option value="' + escHtml(option.value) + '">' + escHtml(option.label) + '</option>');
  });
  select.innerHTML = html.join('');
}

function populateCoreSelects() {
  const soldMonths = [...new Set((APP_DATA.sold || []).map(v => v.month).filter(Boolean))].sort().reverse();
  populateSelect('sold-filter', soldMonths.map(month => ({value:month, label:mLabel(month)})), 'All Months');
  populateSelect(
    'vw-vehicle',
    stockData.map(vehicle => ({value:vehicle.plate, label:(vehicle.model || vehicle.plate) + ' · ' + vehicle.plate + ' (' + vehicle.stock_id + ')'})),
    '— Select from stock —'
  );
  const investorNames = ['MP'].concat((APP_DATA.investors || []).map(inv => inv.name)).filter((name, index, arr) => arr.indexOf(name) === index);
  populateSelect('nv-investor', investorNames.map(name => ({value:name, label:name})));
  populateSelect('sell-investor', investorNames.map(name => ({value:name, label:name})));
  populateATNewSelect();
  populateIGNewSelect();
  updateNavBadges();
}

function renderAllPages() {
  renderDashboard();
  renderStock();
  renderSold();
  renderCollections();
  renderServiceHistory();
  renderMOT();
  renderInsurance();
  renderViewings();
  renderFinance();
  renderReceipts();
  renderInvestors();
  renderWages();
  renderVAT();
  renderReports();
  renderBanking();
  renderInvoiceList();
}

async function refreshAppState(options) {
  const quiet = Boolean(options && options.quiet);
  try {
    const state = await apiFetch('/bootstrap');
    applyBootstrapState(state);
    populateCoreSelects();
    renderAllPages();
    return state;
  } catch (error) {
    if (!quiet) {
      showActionError('Loading dealership data', error);
    }
    throw error;
  }
}

function saveToStorage() {
  try {
    localStorage.setItem('dealeros_at', JSON.stringify(atListings));
    localStorage.setItem('dealeros_ig', JSON.stringify(igPosts));
    localStorage.setItem('dealeros_descs', JSON.stringify(listingDescriptions));
    localStorage.setItem('dealeros_at_settings', JSON.stringify(atSettings));
    localStorage.setItem('dealeros_ig_settings', JSON.stringify(igSettings));
  } catch(e) {
    console.warn('Storage save failed:', e);
  }
}

function loadFromStorage() {
  try {
    atListings = JSON.parse(localStorage.getItem('dealeros_at')||'[]');
    igPosts = JSON.parse(localStorage.getItem('dealeros_ig')||'[]');
    listingDescriptions = JSON.parse(localStorage.getItem('dealeros_descs')||'{}');
    const ats = JSON.parse(localStorage.getItem('dealeros_at_settings')||'null');
    if(ats) atSettings = ats;
    const igs = JSON.parse(localStorage.getItem('dealeros_ig_settings')||'null');
    if(igs) igSettings = igs;
  } catch(e) {
    console.warn('Storage load failed:', e);
  }
}

function financeSignedAmount(entry) {
  return entry.direction === 'in' ? normalizeAmount(entry.amount) : -normalizeAmount(entry.amount);
}

function renderDashboard() {
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const monthly = APP_DATA.monthly || [];
  const latestMonth = monthly.length ? monthly[monthly.length - 1] : {label:'No monthly data', gross_profit:0, cars_sold:0};
  const allProfit = (APP_DATA.sold || []).reduce((sum, vehicle) => sum + normalizeAmount(vehicle.profit), 0);
  const longStock = stockData.filter(vehicle => normalizeAmount(vehicle.days_in_stock) > 60).length;
  const pendingFines = fines.filter(fine => fine.status !== 'Paid').reduce((sum, fine) => sum + normalizeAmount(fine.amount), 0);
  const soldCount = (APP_DATA.sold || []).length;
  document.getElementById('dash-stats').innerHTML =
    '<div class="stat blue"><div class="sl">In Stock</div><div class="sv">' + stockData.length + '</div><div class="ss">' + stockData.filter(v=>String(v.status || '').toLowerCase().indexOf('live') >= 0).length + ' live</div><div class="si">🚗</div></div>' +
    '<div class="stat green"><div class="sl">' + escHtml(latestMonth.label || 'Latest Month') + ' Profit</div><div class="sv">' + fmt0(latestMonth.gross_profit || 0) + '</div><div class="ss">' + (latestMonth.cars_sold || 0) + ' cars sold</div><div class="si">💰</div></div>' +
    '<div class="stat amber"><div class="sl">60+ Days</div><div class="sv">' + longStock + '</div><div class="ss">Need pricing review</div><div class="si">⏱️</div></div>' +
    '<div class="stat purple"><div class="sl">Sold Vehicles</div><div class="sv">' + soldCount + '</div><div class="ss">All-time sold history</div><div class="si">📈</div></div>' +
    '<div class="stat red"><div class="sl">Unpaid Fines</div><div class="sv">' + fmt0(pendingFines) + '</div><div class="ss">' + fines.filter(fine => fine.status !== 'Paid').length + ' outstanding</div><div class="si">⚠️</div></div>';

  const alerts = [];
  if (longStock > 0) alerts.push('<div class="alert alt-r">⚠️ <strong>' + longStock + ' vehicles</strong> have been in stock for more than 60 days.</div>');
  if (pendingFines > 0) alerts.push('<div class="alert alt-a">⚠️ <strong>' + fmt0(pendingFines) + '</strong> in fines is still outstanding.</div>');
  if (APP_DATA.workbook && APP_DATA.workbook.lastSync) {
    const workbookSyncStatus = String(APP_DATA.workbook.lastSync.status || 'unknown').toLowerCase();
    const workbookSyncLabel = ({
      success: 'success',
      warning: 'completed with non-blocking warnings',
      failed: 'failed'
    })[workbookSyncStatus] || String(APP_DATA.workbook.lastSync.status || 'unknown');
    alerts.push('<div class="alert alt-b">📘 Workbook sync: <strong>' + escHtml(workbookSyncLabel) + '</strong> · ' + fmtD(APP_DATA.workbook.lastSync.completed_at || APP_DATA.workbook.lastSync.started_at || '') + '</div>');
  } else {
    alerts.push('<div class="alert alt-b">📘 Workbook sync is available locally through the backend import/export commands.</div>');
  }
  document.getElementById('dash-alerts').innerHTML = alerts.join('');

  if (monthly.length) {
    const maxProfit = Math.max.apply(null, monthly.map(row => Math.abs(normalizeAmount(row.gross_profit))).concat([1]));
    document.getElementById('profit-chart').innerHTML = monthly.map(row => {
      const profit = normalizeAmount(row.gross_profit);
      const height = Math.max(3, Math.abs(profit) / maxProfit * 100);
      const color = profit < 0 ? 'var(--red)' : profit > 0 ? 'var(--green)' : 'var(--text3)';
      return '<div class="bc2"><div class="bar" style="height:' + height + 'px;background:' + color + '"></div><div class="blbl">' + escHtml(row.label || row.month || '—') + '</div></div>';
    }).join('');
  } else {
    document.getElementById('profit-chart').innerHTML = '<div style="color:var(--text3);font-size:12px;padding:18px;">No monthly sales data yet.</div>';
  }

  const stockByAge = stockData.slice().sort((left, right) => normalizeAmount(right.days_in_stock) - normalizeAmount(left.days_in_stock));
  document.getElementById('days-list').innerHTML = stockByAge.length ? stockByAge.map(vehicle => {
    const age = normalizeAmount(vehicle.days_in_stock);
    return '<div class="li"><div class="ldot" style="background:' + (age > 90 ? 'var(--red)' : age > 45 ? 'var(--amber)' : 'var(--green)') + '"></div><div class="lc"><div class="lt">' + escHtml(vehicle.model || vehicle.stock_id) + '</div><div class="lm mono">' + escHtml(vehicle.plate || vehicle.stock_id) + '</div></div><span class="' + dc(age) + '">' + age + 'd</span></div>';
  }).join('') : '<div style="color:var(--text3);font-size:12px;padding:10px;">No current stock loaded.</div>';

  const topSales = (APP_DATA.sold || []).filter(vehicle => normalizeAmount(vehicle.profit) > 0).slice().sort((left, right) => normalizeAmount(right.profit) - normalizeAmount(left.profit)).slice(0, 7);
  const topProfit = topSales.length ? normalizeAmount(topSales[0].profit) : 1;
  document.getElementById('top-profit').innerHTML = topSales.length ? topSales.map(vehicle => '<div class="pbar"><div style="flex:1"><div style="font-size:12px;font-weight:600">' + escHtml(vehicle.model || vehicle.stock_id) + '</div><div style="font-size:10px;color:var(--text3)">' + escHtml(vehicle.plate || vehicle.stock_id) + '</div></div><div class="ptrack"><div class="pfill" style="width:' + (normalizeAmount(vehicle.profit) / topProfit * 100) + '%;background:var(--green)"></div></div><div style="font-family:\'DM Mono\',monospace;font-size:11.5px;font-weight:700;color:var(--green);min-width:58px;text-align:right">' + fmt0(vehicle.profit || 0) + '</div></div>').join('') : '<div style="color:var(--text3);font-size:12px;padding:10px;">No profitable sold vehicles yet.</div>';

  const atLive = atListings.filter(listing=>listing.status==='live').length;
  const atDraft = atListings.filter(listing=>listing.status==='draft'||listing.status==='needs_review').length;
  const atReady = atListings.filter(listing=>listing.status==='ready').length;
  const igPosted = igPosts.filter(post=>post.status==='posted'&&post.postedAt&&post.postedAt.startsWith(new Date().toISOString().slice(0,7))).length;
  const igDraft = igPosts.filter(post=>post.status==='draft').length;
  const missingPhotos = stockData.filter(vehicle=>!(vehiclePhotos[normP(vehicle.plate)]||[]).length).length;
  const missingDesc = stockData.filter(vehicle=>!atListings.find(listing=>normP(listing.plate)===normP(vehicle.plate)&&listing.description)).length;
  document.getElementById('dash-media-widgets').innerHTML =
    '<div class="card" style="margin-bottom:13px;"><div class="ch"><div class="ct">📢 Listings &amp; Social Status</div><div style="display:flex;gap:6px;"><button class="btn btn-g btn-xs" onclick="nav(\'autotrader\',document.querySelector(\'[onclick*=autotrader]\'))">Auto Trader →</button><button class="btn btn-g btn-xs" onclick="nav(\'instagram\',document.querySelector(\'[onclick*=instagram]\'))">Instagram →</button></div></div><div class="g4"><div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:10px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--green)">' + atLive + '</div><div style="font-size:9.5px;color:var(--text3)">AT Live</div></div><div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:10px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--blue2)">' + atDraft + '</div><div style="font-size:9.5px;color:var(--text3)">AT Drafts</div></div><div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:10px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--purple)">' + atReady + '</div><div style="font-size:9.5px;color:var(--text3)">AT Ready</div></div><div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:10px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--orange)">' + igPosted + '</div><div style="font-size:9.5px;color:var(--text3)">IG This Month</div></div></div><div class="div"></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><span class="badge ' + (missingPhotos>0?'br':'bg') + '">' + (missingPhotos>0?'⚠️ '+missingPhotos+' missing photos':'✓ All photos present') + '</span><span class="badge ' + (missingDesc>0?'ba':'bg') + '">' + (missingDesc>0?'⚠️ '+missingDesc+' missing descriptions':'✓ All descriptions present') + '</span><span class="badge ' + (igDraft>0?'bo':'bk') + '">' + igDraft + ' IG drafts</span></div></div>';

  const deployable = (APP_DATA.investors || []).reduce((sum, investor) => sum + normalizeAmount(investor.available), 0);
  document.getElementById('dash-ai').innerHTML = '<div class="ailabel">✨ Snapshot</div><div class="aitext"><strong>' + stockData.length + ' in stock</strong>, <strong>' + soldCount + ' sold</strong>, <strong>' + fmt0(allProfit) + '</strong> gross profit recorded, and <strong>' + fmt0(deployable) + '</strong> currently available across investor balances.</div>';
}

function renderStock() {
  let filtered = stockData.slice();
  if(stockFilter==='website') filtered = filtered.filter(vehicle => vehicle.website_listed);
  else if(stockFilter==='autotrader') filtered = filtered.filter(vehicle => vehicle.autotrader_listed);
  else if(stockFilter==='needs') filtered = filtered.filter(vehicle => !(vehicle.website_listed || vehicle.autotrader_listed) || (vehicle.todo || []).length > 1);
  else if(stockFilter==='ready') filtered = filtered.filter(vehicle => (vehicle.todo || []).includes('List live') || /ready to list/i.test(vehicle.status || ''));
  document.getElementById('stock-count').textContent='· ' + filtered.length + ' vehicles';
  document.getElementById('nb-stock').textContent = stockData.length;
  document.getElementById('stock-tbody').innerHTML = filtered.map(vehicle => {
    const todo = (vehicle.todo || []).map(item => '<span class="badge bk" style="margin:1px;">' + escHtml(item) + '</span>').join('') || '<span class="badge bg">Nothing left</span>';
    return '<tr><td class="tdm">' + escHtml(vehicle.model) + '<div style="font-size:10px;color:var(--text3);">' + fmtD(vehicle.date_acquired) + ' · ' + escHtml(vehicle.stock_id || '') + '</div></td><td><span class="mono">' + escHtml(vehicle.plate) + '</span></td><td>' + escHtml(vehicle.source || '—') + '</td><td>' + escHtml(vehicle.investor || 'SA') + '</td><td style="font-weight:700">' + fmt0(vehicle.total_cost) + '</td><td>' + normalizeAmount(vehicle.days_in_stock) + 'd</td><td><span class="badge ' + (vehicle.website_listed?'bg':'bk') + '">' + (vehicle.website_listed?'Listed':'Not live') + '</span></td><td><span class="badge ' + (vehicle.autotrader_listed?'bb':'bk') + '">' + (vehicle.autotrader_listed?'Listed':'Not live') + '</span></td><td>' + todo + '<div style="font-size:10px;color:var(--text3);margin-top:4px;">' + escHtml(vehicle.status || '') + '</div></td><td><div style="display:flex;gap:4px;flex-wrap:wrap;"><button class="btn btn-g btn-xs" onclick="openMediaManager(\'' + escJs(vehicle.plate) + '\',\'' + escJs(vehicle.model || vehicle.stock_id || vehicle.plate) + '\')">📷</button><button class="btn btn-b btn-xs" onclick="nav(\'autotrader\',document.querySelector(\'[onclick*=autotrader]\'))">AT</button><button class="btn btn-amber btn-xs" onclick="editVehicle(\'' + escJs(vehicle.stock_id) + '\')">Edit</button><button class="btn btn-g btn-xs" onclick="openStockBreakdown(\'' + escJs(vehicle.stock_id || vehicle.plate) + '\')">View</button></div></td></tr>';
  }).join('');
}

async function editVehicle(stockId) {
  const vehicle = findV(stockId);
  if (!vehicle || !vehicle.stock_id) return;
  const plate = prompt('Registration plate', vehicle.plate || '');
  if (plate === null) return;
  const model = prompt('Make & model', vehicle.model || '');
  if (model === null) return;
  const source = prompt('Source', vehicle.source || '');
  if (source === null) return;
  const purchasePrice = prompt('Purchase price (£)', String(normalizeAmount(vehicle.purchase_price)));
  if (purchasePrice === null) return;
  const reconCost = prompt('Recon cost (£)', String(normalizeAmount(vehicle.recon_cost)));
  if (reconCost === null) return;
  const status = prompt('Status', vehicle.status || 'In Stock');
  if (status === null) return;
  const notes = prompt('Notes', vehicle.notes || '');
  if (notes === null) return;
  try {
    const purchase = normalizeAmount(purchasePrice);
    const recon = normalizeAmount(reconCost);
    await apiFetch('/vehicles/' + encodeURIComponent(vehicle.stock_id), {
      method:'PUT',
      body:{
        plate,
        model,
        source,
        purchase_price:purchase,
        recon_cost:recon,
        total_cost:purchase + recon,
        status,
        notes
      }
    });
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Updating vehicle', error);
  }
}

function renderReports() {
  const monthly = APP_DATA.monthly || [];
  const sold = APP_DATA.sold || [];
  const select = document.getElementById('report-month');
  if (select && select.children.length <= 1) {
    monthly.forEach(row => {
      const option = document.createElement('option');
      option.value = row.month;
      option.textContent = row.label;
      select.appendChild(option);
    });
  }
  const filter = select ? select.value : 'all';
  const filteredMonth = filter === 'all' ? null : monthly.find(row => row.month === filter);
  const totalSold = filteredMonth ? normalizeAmount(filteredMonth.cars_sold) : monthly.reduce((sum, row) => sum + normalizeAmount(row.cars_sold), 0);
  const totalGrossProfit = filteredMonth ? normalizeAmount(filteredMonth.gross_profit) : monthly.reduce((sum, row) => sum + normalizeAmount(row.gross_profit), 0);
  const totalNetProfit = filteredMonth ? normalizeAmount(filteredMonth.net_profit) : monthly.reduce((sum, row) => sum + normalizeAmount(row.net_profit), 0);
  const totalRevenue = filteredMonth ? normalizeAmount(filteredMonth.revenue) : monthly.reduce((sum, row) => sum + normalizeAmount(row.revenue), 0);
  document.getElementById('report-kpis').innerHTML =
    '<div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:11px;text-align:center;"><div style="font-size:19px;font-weight:800;color:var(--green)">' + totalSold + '</div><div style="font-size:9.5px;color:var(--text3)">Cars Sold</div></div>' +
    '<div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:11px;text-align:center;"><div style="font-size:19px;font-weight:800;color:var(--blue2)">' + fmt0(totalRevenue) + '</div><div style="font-size:9.5px;color:var(--text3)">Revenue</div></div>' +
    '<div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:11px;text-align:center;"><div style="font-size:19px;font-weight:800;color:var(--green)">' + fmt0(totalGrossProfit) + '</div><div style="font-size:9.5px;color:var(--text3)">Gross Profit</div></div>' +
    '<div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:11px;text-align:center;"><div style="font-size:19px;font-weight:800;color:' + (totalNetProfit>=0?'var(--green)':'var(--red)') + '">' + fmt0(totalNetProfit) + '</div><div style="font-size:9.5px;color:var(--text3)">Net Profit</div></div>' +
    '<div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--rs);padding:11px;text-align:center;"><div style="font-size:19px;font-weight:800;color:var(--amber)">' + fmt0(totalSold>0?totalGrossProfit/totalSold:0) + '</div><div style="font-size:9.5px;color:var(--text3)">Avg/Car</div></div>';

  if (monthly.length) {
    const bestMonth = monthly.slice().sort((left, right) => normalizeAmount(right.gross_profit) - normalizeAmount(left.gross_profit))[0];
    document.getElementById('report-ai').innerHTML = '<div class="ailabel">✨ Trading Summary</div><div class="aitext"><strong>' + fmt0(totalGrossProfit) + '</strong> gross profit is recorded for the selected range. Best month on file: <strong>' + escHtml(bestMonth.label || bestMonth.month) + '</strong> with <strong>' + fmt0(bestMonth.gross_profit || 0) + '</strong> across <strong>' + normalizeAmount(bestMonth.cars_sold) + '</strong> sales.</div>';
    const maxGross = Math.max.apply(null, monthly.map(row => Math.abs(normalizeAmount(row.gross_profit))).concat([1]));
    document.getElementById('report-chart').innerHTML = monthly.map(row => {
      const gross = normalizeAmount(row.gross_profit);
      return '<div class="bc2"><div class="bar" style="height:' + Math.max(3, Math.abs(gross) / maxGross * 100) + 'px;background:' + (gross < 0 ? 'var(--red)' : gross > 0 ? 'var(--green)' : 'var(--text3)') + '"></div><div class="blbl">' + escHtml(row.label || row.month || '—') + '</div></div>';
    }).join('');
  } else {
    document.getElementById('report-ai').innerHTML = '<div class="ailabel">✨ Trading Summary</div><div class="aitext">Reports will fill in once sales and finance rows are imported or recorded locally.</div>';
    document.getElementById('report-chart').innerHTML = '<div style="color:var(--text3);font-size:12px;padding:18px;">No monthly trading data available yet.</div>';
  }

  const topSold = sold.slice().sort((left, right) => normalizeAmount(right.profit) - normalizeAmount(left.profit)).slice(0, 15);
  const maxProfit = Math.max.apply(null, topSold.map(vehicle => Math.abs(normalizeAmount(vehicle.profit))).concat([1]));
  document.getElementById('report-bars').innerHTML = topSold.length ? topSold.map(vehicle => {
    const profit = normalizeAmount(vehicle.profit);
    return '<div class="pbar"><div style="flex:1"><div style="font-size:11.5px;font-weight:600">' + escHtml(vehicle.model || vehicle.stock_id) + '</div><div style="font-size:10px;color:var(--text3)">' + escHtml(vehicle.plate || vehicle.stock_id) + '</div></div><div class="ptrack"><div class="pfill" style="width:' + (Math.abs(profit) / maxProfit * 100) + '%;background:' + (profit >= 0 ? 'var(--green)' : 'var(--red)') + '"></div></div><div style="font-family:\'DM Mono\',monospace;font-size:11px;font-weight:700;color:' + (profit >= 0 ? 'var(--green)' : 'var(--red)') + ';min-width:56px;text-align:right">' + fmt0(profit) + '</div></div>';
  }).join('') : '<div style="color:var(--text3);font-size:12px;padding:10px;">No sold vehicles to report yet.</div>';

  document.getElementById('recommendations').innerHTML = '<div class="li"><div class="lc"><div class="lm">' + escHtml('This delivery prioritises the core dealership workflow, stock_id-based cross-module linking, local file storage, workbook sync, and smoke-test coverage.') + '</div></div></div>';
}

function renderFinance() {
  const filterEl = document.getElementById('fin-filter');
  const filter = filterEl ? filterEl.value : '';
  const data = filter ? finLog.filter(entry => entry.cat === filter) : finLog;
  const moneyIn = finLog.filter(entry => entry.direction === 'in').reduce((sum, entry) => sum + normalizeAmount(entry.amount), 0);
  const moneyOut = finLog.filter(entry => entry.direction !== 'in').reduce((sum, entry) => sum + normalizeAmount(entry.amount), 0);
  const vehicleCosts = finLog.filter(entry => entry.direction !== 'in' && entry.stock_id).reduce((sum, entry) => sum + normalizeAmount(entry.amount), 0);
  const generalCosts = finLog.filter(entry => entry.direction !== 'in' && !entry.stock_id).reduce((sum, entry) => sum + normalizeAmount(entry.amount), 0);
  document.getElementById('fin-count').textContent = '· ' + data.length + ' entries';
  document.getElementById('fin-stats').innerHTML =
    '<div class="stat green"><div class="sl">Money In</div><div class="sv">' + fmt0(moneyIn) + '</div><div class="ss">Sales / receipts in</div></div>' +
    '<div class="stat red"><div class="sl">Money Out</div><div class="sv">' + fmt0(moneyOut) + '</div><div class="ss">All logged costs</div></div>' +
    '<div class="stat amber"><div class="sl">Vehicle Costs</div><div class="sv">' + fmt0(vehicleCosts) + '</div><div class="ss">Linked to stock_id</div></div>' +
    '<div class="stat blue"><div class="sl">General Overheads</div><div class="sv">' + fmt0(generalCosts) + '</div><div class="ss">Not vehicle-linked</div></div>';
  document.getElementById('finance-log').innerHTML = data.length ? data.map(entry => {
    const signed = financeSignedAmount(entry);
    const label = (signed >= 0 ? '+' : '-') + fmt(Math.abs(signed));
    const color = signed >= 0 ? 'var(--green)' : 'var(--red)';
    return '<div class="fin-row"><div class="fin-date">' + fmtD(entry.date) + '</div><div class="fin-plate">' + escHtml(entry.plate || '—') + '</div><div class="fin-desc">' + (entry.model?'<span style="color:var(--text3);font-size:10px">' + escHtml(entry.model) + ' · </span>':'') + escHtml(entry.desc || '') + (entry.source_label?'<div style="font-size:10px;color:var(--text3)">' + escHtml(entry.source_label) + '</div>':'') + '</div><span class="badge" style="background:' + (CCLR[entry.cat]||'var(--text3)') + '22;color:' + (CCLR[entry.cat]||'var(--text3)') + ';font-size:9.5px;">' + (CICON[entry.cat]||'💰') + ' ' + escHtml(entry.cat) + '</span><div class="fin-amt" style="color:' + color + '">' + label + '</div></div>';
  }).join('') : '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px;">No entries yet</div>';
}

async function addVehicle() {
  const plate = document.getElementById('nv-plate').value.trim().toUpperCase();
  const model = document.getElementById('nv-model').value.trim();
  if(!plate || !model) {
    alert('Enter plate and model.');
    return;
  }
  try {
    const created = await apiFetch('/vehicles', {
      method:'POST',
      body:{
        plate,
        model,
        source:document.getElementById('nv-source').value,
        investor_name:document.getElementById('nv-investor').value === 'MP' ? 'SA' : document.getElementById('nv-investor').value,
        purchase_price:normalizeAmount(document.getElementById('nv-price').value),
        recon_cost:normalizeAmount(document.getElementById('nv-recon').value),
        notes:document.getElementById('nv-notes').value,
        date_acquired:today()
      }
    });
    closeM('addvehicle');
    clearFields(['nv-plate','nv-model','nv-price','nv-recon','nv-notes']);
    await refreshAppState({quiet:true});
    alert('Added ' + created.model + ' (' + created.plate + ') as ' + created.stock_id + '. Vehicle folders were created on disk.');
  } catch (error) {
    showActionError('Adding vehicle', error);
  }
}

async function quickLog() {
  const plate = document.getElementById('ql-plate').value.trim().toUpperCase();
  const desc = document.getElementById('ql-desc').value.trim();
  const amount = normalizeAmount(document.getElementById('ql-amount').value);
  if(!desc || !amount) {
    alert('Enter description and amount.');
    return;
  }
  try {
    const vehicle = plate ? resolveVehicleOrThrow(plate) : null;
    await apiFetch('/expenses', {
      method:'POST',
      body:{
        stock_id: vehicle ? vehicle.stock_id : '',
        plate: vehicle ? vehicle.plate : '',
        category: document.getElementById('ql-cat').value,
        description: desc,
        amount,
        date: today()
      }
    });
    clearFields(['ql-plate','ql-desc','ql-amount']);
    await refreshAppState({quiet:true});
    const button = document.getElementById('ql-btn');
    if (button) {
      button.textContent = '✓ Done!';
      button.style.background = 'var(--green)';
      setTimeout(() => {
        button.textContent = '+ Log';
        button.style.background = '';
      }, 1500);
    }
  } catch (error) {
    showActionError('Logging expense', error);
  }
}

async function logExpModal() {
  const plate = document.getElementById('exp-plate').value.trim().toUpperCase();
  const desc = document.getElementById('exp-desc').value.trim();
  const amount = normalizeAmount(document.getElementById('exp-amount').value);
  if(!desc || !amount) {
    alert('Enter description and amount.');
    return;
  }
  try {
    const vehicle = plate ? resolveVehicleOrThrow(plate) : null;
    await apiFetch('/expenses', {
      method:'POST',
      body:{
        stock_id: vehicle ? vehicle.stock_id : '',
        plate: vehicle ? vehicle.plate : '',
        category: document.getElementById('exp-cat').value,
        description: desc,
        amount,
        date: document.getElementById('exp-date').value || today()
      }
    });
    closeM('addexpense');
    clearFields(['exp-plate','exp-desc','exp-amount']);
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Logging expense', error);
  }
}

async function addViewing() {
  const name = document.getElementById('vw-name').value.trim();
  const date = document.getElementById('vw-date').value;
  if(!name || !date) {
    alert('Please enter customer name and date.');
    return;
  }
  try {
    const vehiclePlate = document.getElementById('vw-vehicle').value;
    const vehicle = vehiclePlate ? resolveVehicleOrThrow(vehiclePlate) : null;
    await apiFetch('/viewings', {
      method:'POST',
      body:{
        stock_id: vehicle ? vehicle.stock_id : '',
        plate: vehicle ? vehicle.plate : '',
        customer_name:name,
        phone:document.getElementById('vw-phone').value,
        date,
        time:document.getElementById('vw-time').value,
        notes:document.getElementById('vw-notes').value,
        source:document.getElementById('vw-source').value,
        finance:document.getElementById('vw-finance').value,
        delivery:document.getElementById('vw-delivery').value
      }
    });
    closeM('addviewing');
    clearFields(['vw-name','vw-phone','vw-date','vw-time','vw-notes']);
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Adding viewing', error);
  }
}

async function updateViewingStatus(i, status) {
  const viewing = typeof i === 'number' ? viewings[i] : viewings.find(row => row.id === i);
  if(!viewing) return;
  try {
    await apiFetch('/viewings/' + encodeURIComponent(viewing.id) + '/status', {
      method:'PATCH',
      body:{status}
    });
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Updating viewing', error);
  }
}

function renderFines() {
  const total=fines.reduce((a,f)=>a+normalizeAmount(f.amount),0);
  const paid=fines.filter(f=>f.status==='Paid').reduce((a,f)=>a+normalizeAmount(f.amount),0);
  const unpaid=fines.filter(f=>f.status!=='Paid').reduce((a,f)=>a+normalizeAmount(f.amount),0);
  document.getElementById('nb-fines').textContent=fines.filter(f=>f.status!=='Paid').length||'0';
  document.getElementById('fine-stats').innerHTML=
    '<div class="stat red"><div class="sl">Total Fines</div><div class="sv">'+fines.length+'</div><div class="si">⚠️</div></div>'+
    '<div class="stat red"><div class="sl">Total Value</div><div class="sv">'+fmt0(total)+'</div></div>'+
    '<div class="stat amber"><div class="sl">Outstanding</div><div class="sv">'+fmt0(unpaid)+'</div></div>'+
    '<div class="stat green"><div class="sl">Paid</div><div class="sv">'+fmt0(paid)+'</div></div>';
  document.getElementById('fine-tbody').innerHTML=fines.length?fines.map((f,i)=>'<tr><td>'+fmtD(f.date)+'</td><td><span class="mono">'+escHtml(f.plate)+'</span></td><td>'+escHtml(f.type)+'</td><td style="font-weight:700;color:var(--red)">'+fmt(f.amount)+'</td><td>'+fmtD(f.due)+'</td><td><span class="badge '+(f.status==='Paid'?'bg':f.status==='Appealing'?'bb':'br')+'">'+escHtml(f.status)+'</span></td><td style="font-size:10px;font-family:\'DM Mono\',monospace;">'+escHtml(f.ref || '')+'</td><td style="font-size:10.5px;color:var(--text3);">'+escHtml(f.notes || '')+'</td><td><div style="display:flex;gap:3px;"><button class="btn btn-green btn-xs" onclick="markFinePaid('+i+')">✓ Paid</button><button class="btn btn-b btn-xs" onclick="appealFine('+i+')">Appeal</button></div></td></tr>').join(''):'<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px;">No fines logged</td></tr>';
}

async function addFine() {
  const plate = document.getElementById('fn-plate').value.trim().toUpperCase();
  if(!plate) {
    alert('Enter the vehicle plate.');
    return;
  }
  try {
    const vehicle = resolveVehicleOrThrow(plate);
    await apiFetch('/fines', {
      method:'POST',
      body:{
        stock_id: vehicle.stock_id,
        plate: vehicle.plate,
        type: document.getElementById('fn-type').value,
        date: document.getElementById('fn-date').value || today(),
        amount: normalizeAmount(document.getElementById('fn-amount').value),
        due: document.getElementById('fn-due').value,
        ref: document.getElementById('fn-ref').value,
        notes: document.getElementById('fn-notes').value
      }
    });
    closeM('addfine');
    clearFields(['fn-plate','fn-amount','fn-ref','fn-notes']);
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Adding fine', error);
  }
}

async function markFinePaid(i) {
  const fine = fines[i];
  if(!fine) return;
  try {
    await apiFetch('/fines/' + encodeURIComponent(fine.id) + '/status', {
      method:'PATCH',
      body:{status:'Paid'}
    });
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Updating fine', error);
  }
}

async function appealFine(i) {
  const fine = fines[i];
  if(!fine) return;
  try {
    await apiFetch('/fines/' + encodeURIComponent(fine.id) + '/status', {
      method:'PATCH',
      body:{status:'Appealing'}
    });
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Updating fine', error);
  }
}

async function addCollection() {
  const plate = document.getElementById('col-plate').value.trim().toUpperCase();
  if(!plate) {
    alert('Enter a vehicle plate.');
    return;
  }
  try {
    const vehicle = resolveVehicleOrThrow(plate);
    const linkedRefs = (document.getElementById('col-link').value || '').split(',').map(value => value.trim()).filter(Boolean);
    const linkedVehicles = linkedRefs.map(value => resolveVehicleOrThrow(value, 'Unknown linked vehicle: ' + value));
    await apiFetch('/collections', {
      method:'POST',
      body:{
        stock_id: vehicle.stock_id,
        plate: vehicle.plate,
        type: document.getElementById('col-type').value === 'Delivery' ? 'Delivery' : 'Incoming',
        date_won: document.getElementById('col-won').value || today(),
        scheduled_date: document.getElementById('col-date').value || '',
        date: document.getElementById('col-date').value || '',
        driver: document.getElementById('col-driver').value,
        addr: document.getElementById('col-addr').value,
        cost: normalizeAmount(document.getElementById('col-cost').value),
        status: document.getElementById('col-status').value,
        notes: document.getElementById('col-notes').value,
        linked_vehicle_refs: linkedVehicles.map(item => item.stock_id)
      }
    });
    closeM('addcollection');
    clearFields(['col-plate','col-driver','col-link','col-addr','col-cost','col-notes']);
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Adding collection or delivery', error);
  }
}

async function addService() {
  const plate = document.getElementById('svc-plate').value.trim().toUpperCase();
  if(!plate) {
    alert('Enter a vehicle plate.');
    return;
  }
  try {
    const vehicle = resolveVehicleOrThrow(plate);
    const formData = new FormData();
    formData.append('stock_id', vehicle.stock_id);
    formData.append('plate', vehicle.plate);
    formData.append('type', document.getElementById('svc-type').value);
    formData.append('date', document.getElementById('svc-date').value || today());
    formData.append('miles', document.getElementById('svc-miles').value || '0');
    formData.append('stamps', document.getElementById('svc-stamps').value || '0');
    formData.append('notes', document.getElementById('svc-notes').value);
    const file = document.getElementById('svc-photo').files[0];
    if (file) formData.append('file', file);
    await apiFetch('/service-records', {method:'POST', body:formData});
    closeM('addservice');
    clearFields(['svc-plate','svc-date','svc-miles','svc-stamps','svc-notes']);
    const serviceFile = document.getElementById('svc-photo');
    if (serviceFile) serviceFile.value = '';
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Adding service history entry', error);
  }
}

async function processReceipt() {
  const plate = document.getElementById('r-plate').value.trim().toUpperCase();
  const amount = normalizeAmount(document.getElementById('r-amount').value);
  if(!plate && !amount) {
    alert('Enter a reg plate and/or amount.');
    return;
  }
  const button = document.getElementById('receipt-btn');
  try {
    if (button) {
      button.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;"></span> Saving...';
    }
    const vehicle = plate ? resolveVehicleOrThrow(plate) : null;
    const formData = new FormData();
    if (vehicle) {
      formData.append('stock_id', vehicle.stock_id);
      formData.append('plate', vehicle.plate);
    }
    formData.append('amount', String(amount));
    formData.append('category', document.getElementById('r-cat').value);
    formData.append('notes', document.getElementById('r-notes').value);
    formData.append('date', today());
    if (receiptFile) formData.append('file', receiptFile);
    await apiFetch('/receipts', {method:'POST', body:formData});
    clearFields(['r-plate','r-notes','r-amount']);
    document.getElementById('receipt-preview').style.display='none';
    receiptFile = null;
    await refreshAppState({quiet:true});
    alert('Receipt saved and linked successfully.');
  } catch (error) {
    showActionError('Saving receipt', error);
  } finally {
    if (button) button.innerHTML = '✨ Process Receipt';
  }
}

async function saveModalReceipt() {
  const plate = document.getElementById('mr-plate').value.trim().toUpperCase();
  const amount = normalizeAmount(document.getElementById('mr-amount').value);
  if(!amount) {
    alert('Please enter an amount.');
    return;
  }
  try {
    const vehicle = plate ? resolveVehicleOrThrow(plate) : null;
    const formData = new FormData();
    if (vehicle) {
      formData.append('stock_id', vehicle.stock_id);
      formData.append('plate', vehicle.plate);
    }
    formData.append('amount', String(amount));
    formData.append('category', document.getElementById('mr-cat').value);
    formData.append('notes', document.getElementById('mr-notes').value);
    formData.append('date', today());
    if (modalReceiptFile) formData.append('file', modalReceiptFile);
    await apiFetch('/receipts', {method:'POST', body:formData});
    closeM('addreceipt');
    modalReceiptFile = null;
    clearFields(['mr-plate','mr-amount','mr-notes']);
    document.getElementById('modal-preview').style.display='none';
    const modalFileInput = document.getElementById('modal-receipt-file');
    if (modalFileInput) modalFileInput.value = '';
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Saving receipt', error);
  }
}

function searchReg(val) {
  const input = val.trim().toUpperCase();
  if(input.length < 3) return;
  const vehicle = findCurrentStock(input);
  const soldVehicle = !vehicle ? findSoldVehicle(input) : null;
  if(!vehicle) {
    currentVehicle = null;
    document.getElementById('reg-result').style.display='none';
    document.getElementById('sell-form').style.display='none';
    document.getElementById('invoice-output').style.display='none';
    if (soldVehicle) {
      alert((soldVehicle.model || soldVehicle.stock_id) + ' is already in sold history.');
    }
    return;
  }
  currentVehicle = vehicle;
  document.getElementById('rr-model').textContent = vehicle.model;
  document.getElementById('rr-plate').textContent = vehicle.plate;
  document.getElementById('rr-cost').textContent = fmt0(vehicle.total_cost || 0);
  document.getElementById('rr-investor').textContent = vehicle.investor || 'SA';
  document.getElementById('rr-source').textContent = vehicle.source || '—';
  document.getElementById('rr-days').textContent = normalizeAmount(vehicle.days_in_stock) + ' days';
  const vehicleCosts = finLog.filter(entry => entry.stock_id === vehicle.stock_id && entry.direction !== 'in');
  document.getElementById('rr-costs').innerHTML = vehicleCosts.length ? '<div style="margin-top:8px;font-size:9.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Logged costs</div>' + vehicleCosts.map(entry => '<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0;border-bottom:1px solid var(--border)"><span>' + (CICON[entry.cat] || '💰') + ' ' + escHtml(entry.desc) + '</span><span style="font-weight:700;color:var(--amber)">-' + fmt(entry.amount) + '</span></div>').join('') : '';
  const sellInvestor = document.getElementById('sell-investor');
  if (sellInvestor) {
    for(let i = 0; i < sellInvestor.options.length; i += 1) {
      if(sellInvestor.options[i].value === (vehicle.investor || 'SA')) {
        sellInvestor.selectedIndex = i;
        break;
      }
    }
  }
  document.getElementById('sell-date').value = today();
  document.getElementById('reg-result').style.display='block';
  document.getElementById('sell-form').style.display='block';
  document.getElementById('invoice-output').style.display='none';
  updateCalc();
}

function openStockBreakdown(reference) {
  const vehicle = findV(reference);
  if(!vehicle) return;
  alert(
    (vehicle.model || vehicle.stock_id) + '\n' +
    (vehicle.plate || '—') + '\n\n' +
    'Stock ID: ' + (vehicle.stock_id || '—') + '\n' +
    'Source: ' + (vehicle.source || '—') + '\n' +
    'Investor: ' + (vehicle.investor || 'SA') + '\n' +
    'Date acquired: ' + fmtD(vehicle.date_acquired) + '\n' +
    'Purchase: ' + fmt(vehicle.purchase_price || 0) + '\n' +
    'Recon: ' + fmt(vehicle.recon_cost || 0) + '\n' +
    'Total cost: ' + fmt(vehicle.total_cost || 0) + '\n\n' +
    'Status: ' + (vehicle.status || 'In Stock') + '\n' +
    'Notes: ' + (vehicle.notes || '—')
  );
}

async function generateInvoice() {
  if(!currentVehicle) {
    alert('Search for a current stock vehicle first.');
    return;
  }
  const soldPrice = normalizeAmount(document.getElementById('sell-price').value);
  if(!soldPrice) {
    alert('Enter the sale price.');
    return;
  }
  try {
    const result = await apiFetch('/vehicles/' + encodeURIComponent(currentVehicle.stock_id) + '/sell', {
      method:'POST',
      body:{
        sold_price:soldPrice,
        sale_date:document.getElementById('sell-date').value || today(),
        investor_name:document.getElementById('sell-investor').value === 'MP' ? 'SA' : document.getElementById('sell-investor').value,
        investor_profit_share_pct:normalizeAmount(document.getElementById('sell-share').value)
      }
    });
    document.getElementById('invoice-render').innerHTML = result.invoice.html_content;
    document.getElementById('invoice-output').style.display = 'block';
    document.getElementById('invoice-output').scrollIntoView({behavior:'smooth'});
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Selling vehicle', error);
  }
}

async function uploadVehiclePhotos(vehicle, files) {
  const formData = new FormData();
  formData.append('category', 'Photos');
  [...files].forEach(file => formData.append('files', file));
  await apiFetch('/vehicles/' + encodeURIComponent(vehicle.stock_id) + '/files', {
    method:'POST',
    body:formData
  });
}

async function handleMediaUpload(input) {
  try {
    const plate = currentMediaPlate;
    if(!plate || !input.files.length) return;
    const vehicle = resolveVehicleOrThrow(plate);
    await uploadVehiclePhotos(vehicle, input.files);
    input.value = '';
    await refreshAppState({quiet:true});
    refreshMediaModal();
  } catch (error) {
    showActionError('Uploading media', error);
  }
}

async function handleATPhotoUpload(input) {
  try {
    const plate = currentATListing ? currentATListing.plate : '';
    if(!plate || !input.files.length) return;
    const vehicle = resolveVehicleOrThrow(plate);
    await uploadVehiclePhotos(vehicle, input.files);
    input.value = '';
    await refreshAppState({quiet:true});
    setInner('at-photo-grid', renderPhotoGrid(plate));
    if (currentMediaPlate && normP(currentMediaPlate) === normP(plate)) refreshMediaModal();
  } catch (error) {
    showActionError('Uploading Auto Trader photos', error);
  }
}

function renderPhotoGrid(plate) {
  const np = normP(plate);
  const pics = vehiclePhotos[np]||[];
  return pics.map((ph,i)=>`<div class="photo-card${ph.cover?' cover':''}${ph.selected?' selected':''}" ondragstart="dragPhotoStart(event,${i})" ondragover="event.preventDefault()" ondrop="dragPhotoDrop(event,${i})" draggable="true">${ph.url?`<img src="${ph.url}" alt="${escHtml(ph.tag||'')}" onerror="this.style.display='none'">`:`<div style="width:100%;height:100%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:22px;">📷</div>`}<div class="ph-overlay"><select class="ph-tag" style="background:rgba(0,0,0,.7);border:none;color:#fff;font-size:9px;font-weight:700;cursor:pointer;border-radius:4px;padding:1px 3px;" onchange="setPhotoTag('${np}',${i},this.value)">${PHOTO_ORDER_TEMPLATE.map(t=>`<option value="${t}" ${ph.tag===t?'selected':''}>${PHOTO_TAG_LABELS[t]}</option>`).join('')}</select><button class="ph-cover-btn" onclick="setCoverPhoto('${np}',${i})">${ph.cover?'★ Cover':'☆ Set Cover'}</button></div><div class="ph-order">${i+1}</div></div>`).join('');
}

function deletePhoto() {
  alert('Photo deletion is intentionally disabled in this reviewer build so files on disk cannot drift silently.');
}

async function addStaff() {
  const name = document.getElementById('st-name').value.trim();
  if(!name) {
    alert('Enter a name.');
    return;
  }
  try {
    await apiFetch('/staff', {
      method:'POST',
      body:{
        name,
        role:document.getElementById('st-role').value,
        payType:document.getElementById('st-paytype').value,
        rate:normalizeAmount(document.getElementById('st-rate').value),
        phone:document.getElementById('st-phone').value
      }
    });
    closeM('addstaff');
    clearFields(['st-name','st-role','st-rate','st-phone']);
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Adding staff member', error);
  }
}

async function addOwed(i) {
  const member = staff[i];
  if(!member) return;
  const amount = parseFloat(prompt('Amount owed to ' + member.name + ' (£):'));
  if(!(amount > 0)) return;
  try {
    await apiFetch('/staff/' + encodeURIComponent(member.id) + '/owed', {
      method:'POST',
      body:{amount}
    });
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Adjusting wages owed', error);
  }
}

async function logPayment() {
  const staffName = document.getElementById('wp-staff').value;
  const amount = normalizeAmount(document.getElementById('wp-amount').value);
  if(!amount) {
    alert('Enter amount.');
    return;
  }
  const member = staff.find(row => row.name === staffName);
  if(!member) {
    alert('Select a staff member first.');
    return;
  }
  try {
    await apiFetch('/wage-payments', {
      method:'POST',
      body:{
        staff_id:member.id,
        amount,
        date:document.getElementById('wp-date').value || today(),
        period:document.getElementById('wp-period').value,
        method:document.getElementById('wp-method').value
      }
    });
    closeM('logpayment');
    clearFields(['wp-amount','wp-period']);
    await refreshAppState({quiet:true});
  } catch (error) {
    showActionError('Logging wage payment', error);
  }
}

function editInvestorBudget() {
  alert('Investor balances are derived from the workbook import and current sold/stock positions in this build. Edit the workbook or extend the backend before changing them manually.');
}

document.addEventListener('DOMContentLoaded', async function() {
  const sidebarLogo = document.getElementById('sidebar-logo');
  const dashLogo = document.getElementById('dash-logo');
  if (sidebarLogo) sidebarLogo.src = LOGO;
  if (dashLogo) dashLogo.src = LOGO;

  ['exp-date','vw-date','wp-date','fn-date','fn-due','col-date','col-won','sell-date'].forEach(id => {
    const element = document.getElementById(id);
    if (element && !element.value) element.value = today();
  });

  loadFromStorage();

  try {
    await refreshAppState({quiet:true});
  } catch (error) {
    console.error('Initial backend bootstrap failed', error);
    populateCoreSelects();
    renderAllPages();
  }
});
