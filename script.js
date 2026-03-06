// ── GRID CANVAS ──────────────────────────────────────────────────────────────
(function(){
  const c=document.getElementById('gridCanvas'),ctx=c.getContext('2d');
  function resize(){c.width=window.innerWidth;c.height=window.innerHeight}
  resize(); window.addEventListener('resize',resize);
  const CELL=60; let t=0;
  const particles=Array.from({length:18},()=>({
    x:Math.random()*window.innerWidth,
    y:Math.random()*window.innerHeight,
    vx:(Math.random()-.5)*0.4,
    vy:(Math.random()-.5)*0.4,
    r:Math.random()*1.5+0.5,
    a:Math.random(),
  }));
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    // Grid
    ctx.strokeStyle='#0e234022';ctx.lineWidth=1;
    for(let x=0;x<c.width;x+=CELL){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke()}
    for(let y=0;y<c.height;y+=CELL){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}
    // Glow dots at intersections near center
    const cx=c.width/2,cy=c.height/2;
    for(let x=0;x<c.width;x+=CELL){
      for(let y=0;y<c.height;y+=CELL){
        const d=Math.hypot(x-cx,y-cy);
        if(d<400){
          const a=(1-d/400)*0.3*(.5+.5*Math.sin(t*.02+x*.01+y*.01));
          ctx.fillStyle=`rgba(0,255,136,${a})`;
          ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();
        }
      }
    }
    // Particles
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
      if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
      ctx.fillStyle=`rgba(0,204,255,${p.a*.4})`;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    });
    t++; requestAnimationFrame(draw);
  }
  draw();
})();

// ── SCROLL REVEAL ────────────────────────────────────────────────────────────
const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target)}});
},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

// ── TABS ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
  });
});

// ── HELPERS ──────────────────────────────────────────────────────────────────
const short=a=>a?`${a.slice(0,6)}...${a.slice(-6)}`:'???';
const riskColor=r=>r>=90?'#ff3b3b':r>=70?'#ff8c00':r>=50?'#f0c040':'#00ff88';
const chainColor=c=>({ETH:'#627EEA',SOL:'#9945FF',BTC:'#F7931A'}[c]||'#888');
const chainIcon=c=>({ETH:'Ξ',SOL:'◎',BTC:'₿'}[c]||'?');
const ethKey=''; // add your Etherscan key here for higher limits

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

function pill(text,color){
  return `<span class="pill" style="background:${color}22;color:${color};border:1px solid ${color}44">${esc(text)}</span>`;
}
function addrBlock(addr,chain){
  return `<span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text);background:var(--bg);border:1px solid var(--border2);border-radius:4px;padding:2px 8px;display:inline-block">
    <span style="color:${chainColor(chain)};margin-right:5px">${chainIcon(chain)}</span>${short(esc(addr))}
  </span>`;
}
function toast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=esc(msg);
  document.body.appendChild(t);setTimeout(()=>t.remove(),2500);
}

// ── RATE LIMITING ───────────────────────────────────────────────────────────
let scanCount = 0;
let lastReset = Date.now();

function checkRateLimit() {
  const now = Date.now();
  if (now - lastReset > 60000) { // 1 minute
    scanCount = 0;
    lastReset = now;
  }
  if (scanCount >= 10) {
    toast('Rate limit exceeded: 10 scans per minute. Please wait.');
    return false;
  }
  scanCount++;
  return true;
}

// ── LIVE THREAT FEED ─────────────────────────────────────────────────────────
let threats=[];
let chainFilter='ALL',typeFilter='ALL';

async function fetchEthDust(){
  const r=await fetch(`https://api.etherscan.io/api?module=account&action=tokentx&address=0x0000000000000000000000000000000000000000&sort=desc&offset=100${ethKey?'&apikey='+ethKey:''}`);
  const d=await r.json();
  if(!Array.isArray(d.result))return[];
  const map={};
  for(const tx of d.result){
    if(parseInt(tx.value)===0||parseInt(tx.value)<1000){
      if(!map[tx.from])map[tx.from]={c:0,tx};
      map[tx.from].c++;map[tx.from].tx=tx;
    }
  }
  return Object.entries(map).filter(([,v])=>v.c>=2).map(([addr,v])=>({
    address:addr,chain:'ETH',type:'dust',
    risk:Math.min(95,65+v.c*3),sightings:v.c,
    firstSeen:new Date(parseInt(v.tx.timeStamp)*1000).toISOString().slice(0,10),
    lastSeen:new Date().toISOString().slice(0,10),source:'etherscan 🔴',
  }));
}

async function fetchBtcDust(){
  const r=await fetch('https://blockchain.info/unconfirmed-transactions?format=json&limit=30');
  const d=await r.json();
  const map={};
  for(const tx of(d.txs||[])){
    for(const out of(tx.out||[])){
      if(out.value>0&&out.value<=546){
        const s=tx.inputs?.[0]?.prev_out?.addr;
        if(s){if(!map[s])map[s]={c:0,t:tx.time};map[s].c++;}
      }
    }
  }
  return Object.entries(map).filter(([,v])=>v.c>=2).map(([addr,v])=>({
    address:addr,chain:'BTC',type:'dust',
    risk:Math.min(93,70+v.c*4),sightings:v.c,
    firstSeen:new Date(v.t*1000).toISOString().slice(0,10),
    lastSeen:new Date().toISOString().slice(0,10),source:'blockchain.info 🔴',
  }));
}

async function fetchEthLookalikes(){
  const r=await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_getBlockByNumber&tag=latest&boolean=true${ethKey?'&apikey='+ethKey:''}`);
  const d=await r.json();
  const txs=d.result?.transactions||[];
  const addrs=[...new Set(txs.slice(0,80).flatMap(tx=>[tx.from,tx.to].filter(Boolean)))];
  const results=[];
  for(let i=0;i<addrs.length;i++){
    for(let j=i+1;j<addrs.length;j++){
      const a=addrs[i],b=addrs[j];if(a===b)continue;
      if(a.slice(0,8).toLowerCase()===b.slice(0,8).toLowerCase()&&
         a.slice(-6).toLowerCase()===b.slice(-6).toLowerCase()){
        results.push({address:a,chain:'ETH',type:'lookalike',risk:88,sightings:1,
          resembles:b,firstSeen:new Date().toISOString().slice(0,10),
          lastSeen:new Date().toISOString().slice(0,10),source:'eth-block 🔴'});
      }
    }
  }
  return results;
}

async function refreshFeed(){
  document.getElementById('apiStatus').innerHTML='<span class="spinner"></span> Refreshing...';
  const fresh=[];
  try{fresh.push(...await fetchEthDust())}catch{}
  try{fresh.push(...await fetchEthLookalikes())}catch{}
  try{fresh.push(...await fetchBtcDust())}catch{}
  const seen=new Set();
  threats=fresh.filter(t=>{const k=t.address?.toLowerCase();if(!k||seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b)=>(b.risk||0)-(a.risk||0));
  document.getElementById('apiStatus').innerHTML=
    `<span style="color:var(--green)">● LIVE</span> <span style="color:var(--muted);font-size:11px">${threats.length} threats · ${new Date().toLocaleTimeString()}</span>`;
  document.getElementById('heroThreats').textContent=threats.length;
  renderThreats();renderDashboard();
}

function renderThreats(){
  let list=threats;
  if(chainFilter!=='ALL')list=list.filter(t=>t.chain===chainFilter);
  if(typeFilter!=='ALL')list=list.filter(t=>t.type===typeFilter);
  document.getElementById('threatCount').textContent=`${list.length} results`;
  if(!list.length){
    document.getElementById('threatRows').innerHTML='<div style="padding:32px;text-align:center;color:var(--muted)">No threats match current filters</div>';
    return;
  }
  document.getElementById('threatRows').innerHTML=list.slice(0,80).map(t=>`
    <div class="threat-row">
      ${addrBlock(t.address,t.chain)}
      ${pill(chainIcon(t.chain),chainColor(t.chain))}
      <span style="font-size:11px;color:${t.type==='lookalike'?'#ff8c00':'#c084fc'};font-weight:600">${esc((t.type||'?').toUpperCase())}</span>
      <div class="risk-ring" style="background:conic-gradient(${riskColor(t.risk||0)} ${t.risk||0}%,var(--dim) 0);color:${riskColor(t.risk||0)}">${esc(t.risk||'?')}</div>
      <span style="color:var(--text);font-weight:700">${esc((t.sightings||1).toLocaleString())}</span>
      <span style="color:var(--muted);font-size:10px">${esc(t.source||'—')}</span>
    </div>`).join('');
}

function setChainFilter(v,btn){
  chainFilter=v;
  document.querySelectorAll('[onclick^="setChainFilter"]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');renderThreats();
}
function setTypeFilter(v,btn){
  typeFilter=v;
  document.querySelectorAll('[onclick^="setTypeFilter"]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');renderThreats();
}

function renderDashboard(){
  const total=threats.length,high=threats.filter(t=>(t.risk||0)>=90).length;
  const dust=threats.filter(t=>t.type==='dust').length,look=threats.filter(t=>t.type==='lookalike').length;
  document.getElementById('kpiTotal').textContent=esc(total);
  document.getElementById('kpiHigh').textContent=esc(high);
  document.getElementById('kpiDust').textContent=esc(dust);
  document.getElementById('kpiLook').textContent=esc(look);
  const byChain=threats.reduce((a,t)=>{a[t.chain]=(a[t.chain]||0)+1;return a},{});
  document.getElementById('chainBars').innerHTML=['ETH','SOL','BTC'].map(c=>{
    const pct=total?Math.round((byChain[c]||0)/total*100):0;
    return `<div class="chain-bar-row">
      <div class="chain-bar-label">
        <span style="color:${chainColor(c)};font-weight:700">${chainIcon(c)} ${esc(c)}</span>
        <span style="color:var(--muted)">${esc(pct)}%</span>
      </div>
      <div class="chain-bar-outer"><div class="chain-bar-inner" style="width:${pct}%;background:${chainColor(c)}"></div></div>
    </div>`;}).join('');
  document.getElementById('liveLog').innerHTML=threats.slice(0,8).map(t=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      ${pill(chainIcon(t.chain),chainColor(t.chain))}
      <span style="color:${t.type==='lookalike'?'#ff8c00':'#c084fc'};font-size:10px;font-weight:600">${esc((t.type||'?').toUpperCase())}</span>
      ${addrBlock(t.address,t.chain)}
      <span style="margin-left:auto;color:${riskColor(t.risk||0)};font-weight:700;font-size:11px">${esc(t.risk||'?')}%</span>
    </div>`).join('');
}

// ── SCANNER ──────────────────────────────────────────────────────────────────
let scanHistory=[];

async function scanAddressLive(addr){
  const ethRe=/^0x[0-9a-fA-F]{40}$/,btcRe=/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,solRe=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  let chain=null;
  if(ethRe.test(addr))chain='ETH';
  else if(btcRe.test(addr))chain='BTC';
  else if(solRe.test(addr))chain='SOL';
  if(!chain)return{valid:false,addr};
  const flags=[];let risk=0;let onchain={};
  try{
    if(chain==='ETH'){
      const[r1,r2]=await Promise.all([
        fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${addr}&sort=desc&offset=100${ethKey?'&apikey='+ethKey:''}`),
        fetch(`https://api.etherscan.io/api?module=account&action=tokentx&address=${addr}&sort=desc&offset=100${ethKey?'&apikey='+ethKey:''}`)
      ]);
      const[d1,d2]=await Promise.all([r1.json(),r2.json()]);
      const txs=Array.isArray(d1.result)?d1.result:[];
      const tok=Array.isArray(d2.result)?d2.result:[];
      const tinyOut=txs.filter(tx=>tx.from?.toLowerCase()===addr.toLowerCase()&&parseFloat(tx.value)/1e18<0.0001&&parseFloat(tx.value)>0);
      if(tinyOut.length>=3){flags.push({type:'dust_sender',severity:'high',detail:`Sent ${tinyOut.length} sub-0.0001 ETH transactions`});risk=Math.max(risk,82);}
      const tinyIn=txs.filter(tx=>tx.to?.toLowerCase()===addr.toLowerCase()&&parseFloat(tx.value)/1e18<0.0001&&parseFloat(tx.value)>0);
      if(tinyIn.length>=2){flags.push({type:'dust_recipient',severity:'medium',detail:`Received ${tinyIn.length} dust txs — possible poisoning target`});risk=Math.max(risk,55);}
      if(txs.length>0&&txs.length<5){const age=Date.now()/1000-parseInt(txs[txs.length-1].timeStamp);if(age<86400){flags.push({type:'new_address',severity:'medium',detail:'Address created < 24h ago'});risk=Math.max(risk,60);}}
      const zeroTok=tok.filter(tx=>tx.from?.toLowerCase()===addr.toLowerCase()&&parseInt(tx.value)===0);
      if(zeroTok.length>=5){flags.push({type:'zero_token_spam',severity:'high',detail:`Sent ${zeroTok.length} zero-value token transfers`});risk=Math.max(risk,85);}
      onchain={txCount:txs.length,tokenTxCount:tok.length};
    }
    if(chain==='BTC'){
      const r=await fetch(`https://blockchain.info/rawaddr/${addr}?limit=50`);
      const d=await r.json();let dustOut=0;
      for(const tx of(d.txs||[])){for(const inp of(tx.inputs||[])){if(inp.prev_out?.addr===addr){for(const out of(tx.out||[])){if(out.value>0&&out.value<=546)dustOut++;}}}}
      if(dustOut>=2){flags.push({type:'dust_sender',severity:'high',detail:`${dustOut} dust outputs (≤546 sat)`});risk=Math.max(risk,80);}
      onchain={txCount:d.n_tx,balance:d.final_balance};
    }
    if(chain==='SOL'){
      const r=await fetch(`https://public-api.solscan.io/account/transactions?account=${addr}&limit=50`);
      const txs=await r.json();
      const tiny=Array.isArray(txs)?txs.filter(tx=>tx.lamport>0&&tx.lamport<1000):[];
      if(tiny.length>=3){flags.push({type:'dust_sender',severity:'high',detail:`${tiny.length} sub-1000-lamport transfers`});risk=Math.max(risk,80);}
      onchain={txCount:Array.isArray(txs)?txs.length:0};
    }
  }catch(e){flags.push({type:'scan_partial',severity:'low',detail:`Live scan partial: ${e.message}`});}
  // Check threat cache
  const cached=threats.find(t=>t.address?.toLowerCase()===addr.toLowerCase());
  if(cached){risk=Math.max(risk,cached.risk||0);flags.push({type:'in_threat_db',severity:'critical',detail:`In live threat feed (${cached.source}) · Sightings: ${cached.sightings}`});}
  return{valid:true,addr,chain,safe:risk===0&&flags.length===0,risk,flags,onchain,scannedAt:new Date().toISOString()};
}

async function doScan(addrOverride){
  if (!checkRateLimit()) return;
  const addr=(addrOverride||document.getElementById('addrInput').value).trim();
  if(!addr)return;
  const btn=document.getElementById('scanBtn');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> SCANNING...';
  document.getElementById('resultArea').innerHTML=`<div style="text-align:center;padding:20px;color:var(--muted)"><span class="spinner"></span> Running live chain scan...</div>`;
  const r=await scanAddressLive(addr);
  btn.disabled=false;btn.innerHTML='⚡ SCAN ADDRESS';
  renderResult(r);
  scanHistory.unshift({...r,time:new Date().toLocaleTimeString()});
  renderHistory();
}

function renderResult(r){
  const el=document.getElementById('resultArea');
  if(!r.valid){
    el.innerHTML=`<div class="result-card invalid"><div class="result-title" style="color:var(--orange)">⚠ Invalid Address</div><div style="font-size:13px;color:var(--muted);margin-top:6px">Not a recognized ETH, SOL, or BTC address.</div></div>`;return;
  }
  if(r.safe){
    el.innerHTML=`<div class="result-card safe">
      <div class="result-title" style="color:var(--green)">✓ Address Looks Safe</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Live scan complete. No dust patterns, lookalikes, or database matches found.</div>
      ${addrBlock(r.addr,r.chain)}
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        ${pill(r.chain,chainColor(r.chain))}
        ${r.onchain?.txCount!=null?pill(r.onchain.txCount+' txs','#484f58'):''}
        ${r.onchain?.balance!=null?pill(r.onchain.balance+' sat','#484f58'):''}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px">Scanned ${new Date(r.scannedAt).toLocaleTimeString()} · live chain data</div>
    </div>`;return;
  }
  const flagsHtml=(r.flags||[]).map(f=>`<div class="flag-item" style="border-color:${f.severity==='critical'?'#da363344':f.severity==='high'?'#ff8c0044':'var(--border)'}">
    <div class="flag-type" style="color:${f.severity==='critical'?'#ff3b3b':f.severity==='high'?'#ff8c00':f.severity==='medium'?'#f0c040':'#8b949e'}">${esc((f.type||'').replace(/_/g,' ').toUpperCase())}</div>
    <div class="flag-detail">${esc(f.detail)}</div>
  </div>`).join('');
  el.innerHTML=`<div class="result-card threat">
    <div class="result-title" style="color:var(--red)">🚨 Threat Detected</div>
    ${addrBlock(r.addr,r.chain||'ETH')}
    <div style="margin:12px 0">${flagsHtml}</div>
    <div class="risk-score" style="background:${riskColor(r.risk||0)}22;border:1px solid ${riskColor(r.risk||0)}44;color:${riskColor(r.risk||0)}">
      RISK SCORE: ${esc(r.risk||0)}%
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:8px">Scanned ${new Date(r.scannedAt).toLocaleTimeString()} · live chain data</div>
  </div>`;
}

function renderHistory(){
  if(!scanHistory.length)return;
  document.getElementById('historyList').innerHTML=scanHistory.slice(0,10).map(h=>`
    <div class="history-item">
      <div>
        ${addrBlock(h.addr,h.chain||'?')}
        <div style="font-size:10px;color:var(--muted);margin-top:3px">${esc(h.time)}</div>
      </div>
      ${pill(h.safe?'SAFE':h.valid===false?'INVALID':`${h.risk}%`,h.safe?'#00ff88':h.valid===false?'#8b949e':'#ff3b3b')}
    </div>`).join('');
}

async function doPaste(){
  try{const t=await navigator.clipboard.readText();document.getElementById('addrInput').value=t;doScan(t);}
  catch{toast('Clipboard permission denied — paste manually');}
}

// ── INIT ─────────────────────────────────────────────────────────────────────
refreshFeed();
setInterval(refreshFeed,30000);

// Smooth scroll nav links
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    const id=a.getAttribute('href').slice(1);
    const el=document.getElementById(id);
    if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth',block:'start'});}
  });
});