/* ═══════════════════════════════════════════════════
   DEINFLUENCER — main.js
   Fixed: "Cannot read properties of null" & Object rendering
   ═══════════════════════════════════════════════════ */

let permissionGranted = false;
let currentData = null;
let screenStream = null;
let cameraStream = null;

/* ── Permission Gate ─────────────────────────────── */
function grantPermission() {
  permissionGranted = true;
  const gate = document.getElementById('permission-gate');
  const analyseSection = document.getElementById('analyse');

  if (!gate || !analyseSection) return;

  gate.style.transition = 'opacity .4s ease';
  gate.style.opacity = '0';
  setTimeout(() => {
    gate.style.display = 'none';
    analyseSection.style.display = 'block';
    analyseSection.style.animation = 'fadeUp .5s ease';
    analyseSection.scrollIntoView({ behavior: 'smooth' });
    loadTrending();
  }, 400);
}

/* ── Example URL fill ────────────────────────────── */
function fillExample(url) {
  const input = document.getElementById('short-url');
  if (input) input.value = url;
}

/* ── Start Scan (URL) ────────────────────────────── */
async function startScan() {
  if (!permissionGranted) { alert('Please grant permission first.'); return; }

  const urlInput = document.getElementById('short-url');
  const url = urlInput ? urlInput.value.trim() : "";
  if (!url) { showError('Please enter a YouTube Shorts URL.'); return; }

  const btn      = document.getElementById('scan-btn');
  const errorBox = document.getElementById('error-box');
  const results  = document.getElementById('results');

  if (!btn) return;

  const btnText  = btn.querySelector('.btn-text');
  const spinner  = btn.querySelector('.btn-spinner');

  // UI: loading state
  if (btnText) btnText.style.display  = 'none';
  if (spinner) spinner.style.display  = 'inline';
  btn.disabled           = true;
  if (errorBox) errorBox.style.display = 'none';
  if (results) results.style.display  = 'none';

  showScanningOverlay();

  try {
    const res  = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Analysis failed');
    }

    currentData = data;
    renderResults(data);
    if (results) {
        results.style.display = 'block';
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  } catch (err) {
    showError(err.message);
  } finally {
    if (btnText) btnText.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
    btn.disabled          = false;
    hideScanningOverlay();
  }
}

/* ── Live Screen Capture ─────────────────────────── */
async function startLiveScan() {
  if (!permissionGranted) { alert('Please grant permission first.'); return; }
  
  const btn = document.getElementById('live-scan-btn');
  const errorBox = document.getElementById('error-box');
  const results = document.getElementById('results');

  if (!btn) return;

  const btnText = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');

  try {
    if (!screenStream) {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { displaySurface: "browser" }, 
        audio: false 
      });
      const video = document.getElementById('screen-video');
      if (video) {
        video.srcObject = screenStream;
        await video.play();
      }
      
      screenStream.getVideoTracks()[0].onended = () => {
        screenStream = null;
      };
    }

    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline';
    btn.disabled = true;
    if (errorBox) errorBox.style.display = 'none';
    if (results) results.style.display = 'none';
    showScanningOverlay();
    
    const stepText = document.getElementById('scan-step-text');
    if(stepText) stepText.textContent = "Capturing frame from live stream...";

    const video = document.getElementById('screen-video');
    const canvas = document.getElementById('screen-canvas');
    if (video && canvas) {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);

        if(stepText) stepText.textContent = "Gemini Vision analyzing product specs & captions...";

        const res = await fetch('/api/analyse-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image }),
        });
        
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Live scan failed');

        currentData = data;
        renderResults(data);
        
        const thumb = document.getElementById('vid-thumb');
        if (thumb) thumb.style.display = 'none';
        
        if (results) {
            results.style.display = 'block';
            results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      screenStream = null; 
    } else {
      showError(err.message);
    }
  } finally {
    if (btnText) btnText.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
    btn.disabled = false;
    hideScanningOverlay();
  }
}

/* ── Web Camera Capture Viewport ─────────────────── */
async function openCamera() {
  if (!permissionGranted) { alert('Please grant permission first.'); return; }
  
  const btn = document.getElementById('camera-scan-btn');
  const btnText = btn ? btn.querySelector('.btn-text') : null;
  const spinner = btn ? btn.querySelector('.btn-spinner') : null;

  try {
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline';
    if (btn) btn.disabled = true;

    if (!cameraStream) {
      cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: false 
      });
    }

    const video = document.getElementById('camera-video');
    if (video) {
        video.srcObject = cameraStream;
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve);
          };
        });
    }
    
    const capBtns = document.getElementById('capture-buttons');
    const camView = document.getElementById('camera-viewport');
    if (capBtns) capBtns.style.display = 'none';
    if (camView) camView.style.display = 'flex';
    
    document.querySelectorAll('#results, #error-box').forEach(el => el.style.display = 'none');

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      cameraStream = null;
    } else {
      showError(err.message);
    }
  } finally {
    if (btnText) btnText.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
    if (btn) btn.disabled = false;
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const camView = document.getElementById('camera-viewport');
  const capBtns = document.getElementById('capture-buttons');
  if (camView) camView.style.display = 'none';
  if (capBtns) capBtns.style.display = 'flex';
}

async function captureAndAnalyseCamera() {
  const btn = document.getElementById('snap-btn');
  if (!btn) return;
  
  const btnText = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  const errorBox = document.getElementById('error-box');
  const results = document.getElementById('results');

  try {
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline';
    btn.disabled = true;
    if (errorBox) errorBox.style.display = 'none';
    if (results) results.style.display = 'none';
    showScanningOverlay();
    
    const stepText = document.getElementById('scan-step-text');
    if(stepText) stepText.textContent = "Snapping photo from camera feed...";

    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('screen-canvas');
    if (video && canvas) {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        closeCamera();

        if(stepText) stepText.textContent = "Gemini Vision analyzing physical product...";

        const res = await fetch('/api/analyse-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image }),
        });
        
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Camera scan failed');

        currentData = data;
        renderResults(data);
        
        const thumb = document.getElementById('vid-thumb');
        if (thumb) thumb.style.display = 'none';
        
        if (results) {
            results.style.display = 'block';
            results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

  } catch (err) {
    showError(err.message);
  } finally {
    if (btnText) btnText.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
    btn.disabled = false;
    hideScanningOverlay();
  }
}

/* ── Scanning Overlay ────────────────────────────── */
let overlayEl = null;
const scanSteps = [
  'Fetching video metadata…',
  'Pulling channel statistics…',
  'Scanning product claims…',
  'Running Gemini AI analysis…',
  'Cross-referencing company data…',
  'Compiling truth report…',
];
let stepIdx = 0, stepInterval = null;

function showScanningOverlay() {
  const container = document.querySelector('.input-wrap');
  if (!container) return;
  
  overlayEl = document.createElement('div');
  overlayEl.id = 'scanning-overlay';
  overlayEl.className = 'scanning-overlay';
  overlayEl.innerHTML = `
    <div class="scanning-dots">⬛ ⬛ ⬛</div>
    <div class="scanning-step" id="scan-step-text">${scanSteps[0]}</div>
    <div class="progress-bar" style="margin:1rem auto;max-width:300px">
      <div class="progress-fill" id="scan-progress"></div>
    </div>
  `;
  container.after(overlayEl);
  stepIdx = 0;
  stepInterval = setInterval(advanceScanStep, 900);
}

function advanceScanStep() {
  stepIdx = Math.min(stepIdx + 1, scanSteps.length - 1);
  const el = document.getElementById('scan-step-text');
  const bar = document.getElementById('scan-progress');
  if (el && !el.textContent.includes('Capturing') && !el.textContent.includes('Vision') && !el.textContent.includes('Snapping')) {
      el.textContent = scanSteps[stepIdx];
  }
  if (bar) bar.style.width = `${Math.round((stepIdx / (scanSteps.length-1)) * 100)}%`;
}

function hideScanningOverlay() {
  clearInterval(stepInterval);
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
}

function showError(msg) {
  const box = document.getElementById('error-box');
  if (box) {
      box.textContent = '⚠ ' + msg;
      box.style.display = 'block';
  }
}

/* ── Render All Results ──────────────────────────── */
function renderResults(data) {
  const { video, channel, analysis } = data;
  const inf  = analysis.influencer || {};
  const ovr  = analysis.overall    || {};
  const prods = analysis.products  || [];
  const comps = analysis.companies || [];

  let parsedTrust = parseInt(inf.trust_score, 10);
  if (isNaN(parsedTrust) || parsedTrust === 0) {
      let total = 0, count = 0;
      prods.forEach(p => {
          let pScore = parseInt(p.claim_score, 10);
          if (!isNaN(pScore) && pScore > 0) { total += pScore; count++; }
      });
      inf.trust_score = count > 0 ? Math.round(total / count) : 50;
  } else {
      inf.trust_score = parsedTrust;
  }

  renderVideoCard(video);
  renderVerdictBanner(inf, ovr);
  renderInfluencerTab(inf, channel);
  renderProductsTab(prods);
  renderCompaniesTab(comps);
  renderAdviceTab(ovr, inf);
  showTab('influencer');
}

/* ── Video Card ──────────────────────────────────── */
function renderVideoCard(v) {
  const thumb = document.getElementById('vid-thumb');
  if (thumb && v.thumbnail) {
      thumb.src = v.thumbnail;
      thumb.style.display = 'block';
  }
  const channelEl = document.getElementById('vid-channel');
  const titleEl = document.getElementById('vid-title');
  const viewsEl = document.getElementById('vid-views');
  const likesEl = document.getElementById('vid-likes');
  const commsEl = document.getElementById('vid-comments');

  if (channelEl) channelEl.textContent = v.channel || '';
  if (titleEl) titleEl.textContent = v.title || '';
  if (viewsEl) viewsEl.textContent = `👁 ${fmt(v.views)} views`;
  if (likesEl) likesEl.textContent = `♥ ${fmt(v.likes)} likes`;
  if (commsEl) commsEl.textContent = `💬 ${fmt(v.comments)} comments`;
  
  const link = document.getElementById('vid-link');
  if (link) {
      if (v.video_id) {
          link.href = `https://www.youtube.com/watch?v=${v.video_id}`;
          link.style.display = 'inline-block';
      } else {
          link.style.display = 'none';
      }
  }
}

/* ── Verdict Banner ──────────────────────────────── */
function renderVerdictBanner(inf, ovr) {
  const color   = ovr.verdict_color || 'yellow';
  const banner  = document.getElementById('verdict-banner');
  if (banner) banner.className = `verdict-banner ${color}`;

  const mainEl = document.getElementById('verdict-main');
  const sumEl = document.getElementById('verdict-summary');
  if (mainEl) mainEl.textContent = ovr.verdict || '—';
  if (sumEl) sumEl.textContent = ovr.summary || '';

  const score    = inf.trust_score || 0;
  const ringEl   = document.getElementById('trust-ring');
  const ringScore = document.getElementById('ring-score');
  
  if (ringScore) ringScore.textContent = score;
  if (ringEl) {
      const circumference = 314;
      const offset = circumference - (score / 100) * circumference;
      ringEl.style.color = scoreColor(score);
      setTimeout(() => {
        ringEl.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
        ringEl.style.strokeDashoffset = offset;
      }, 100);
  }
}

/* ── Influencer Tab ──────────────────────────────── */
function renderInfluencerTab(inf, channel) {
  const ts  = inf.trust_score || 0;
  const tEl = document.getElementById('inf-trust-score');
  if (tEl) {
      tEl.textContent = ts + '/100';
      tEl.className = 'ic-value large ' + scoreClass(ts);
  }

  const lblEl = document.getElementById('inf-trust-label');
  const styEl = document.getElementById('inf-style');
  const expEl = document.getElementById('inf-expertise');
  if (lblEl) lblEl.textContent = inf.trust_label || '';
  if (styEl) styEl.textContent = inf.content_style || '—';
  if (expEl) expEl.textContent = inf.expertise_area || '—';

  const ds  = inf.disclosure_score || 0;
  const dEl = document.getElementById('inf-disclosure');
  if (dEl) {
      dEl.textContent = ds + '/100';
      dEl.className = 'ic-value large ' + scoreClass(ds);
  }
  
  const dntEl = document.getElementById('inf-disclosure-note');
  const rsnEl = document.getElementById('inf-reasoning');
  if (dntEl) dntEl.textContent = inf.disclosure_note || '';
  if (rsnEl) rsnEl.textContent = inf.trust_reasoning || '';

  const redList   = document.getElementById('red-flags');
  const greenList = document.getElementById('green-flags');
  if (redList) {
      redList.innerHTML = '';
      (inf.red_flags || []).forEach(f => { const li=document.createElement('li'); li.textContent=f; redList.appendChild(li); });
  }
  if (greenList) {
      greenList.innerHTML = '';
      (inf.green_flags||[]).forEach(f => { const li=document.createElement('li'); li.textContent=f; greenList.appendChild(li); });
  }

  const statsRow = document.getElementById('channel-stats');
  if (statsRow) {
      statsRow.innerHTML = '';
      if (channel) {
        const stats = [
          [fmt(channel.subscribers), 'SUBSCRIBERS'],
          [fmt(channel.total_views), 'TOTAL VIEWS'],
          [fmt(channel.video_count), 'VIDEOS'],
          [channel.country || '?', 'COUNTRY'],
        ];
        stats.forEach(([n, l]) => {
          statsRow.innerHTML += `<div class="ch-stat"><span class="ch-stat-n">${n}</span><span class="ch-stat-l">${l}</span></div>`;
        });
      }
  }
}

/* ── Products Tab ────────────────────────────────── */
function renderProductsTab(prods) {
  const list = document.getElementById('products-list');
  if (!list) return;
  list.innerHTML = '';

  if (!prods.length) {
    list.innerHTML = '<p style="color:var(--muted);padding:1rem">No products detected in this Short.</p>';
    return;
  }

  prods.forEach(p => {
    const cs = p.claim_score || 0;
    const sciColors = { strong:'var(--green)', moderate:'var(--yellow)', weak:'var(--orange)', none:'var(--accent2)' };
    
    // 1. Safe extraction of Arrays
    const rawSpecs = p.specs_mentioned || p.specs_written_on_product || [];
    const rawMissing = p.missing_specs || [];
    const rawAlts = p.alternatives || [];

    const safeSpecs = Array.isArray(rawSpecs) ? rawSpecs : [rawSpecs];
    const safeMissing = Array.isArray(rawMissing) ? rawMissing : [rawMissing];
    const safeAlts = Array.isArray(rawAlts) ? rawAlts : [rawAlts];

    // 2. Map HTML, safely stringifying if the model passed objects
    const specsHTML = safeSpecs.map(s => {
        const text = typeof s === 'object' && s !== null ? (s.name || JSON.stringify(s)) : String(s);
        return `<span class="spec-tag">${esc(text)}</span>`;
    }).join('');
    
    const missingHTML = safeMissing.map(s => {
        const text = typeof s === 'object' && s !== null ? (s.name || JSON.stringify(s)) : String(s);
        return `<span class="missing-tag">Missing: ${esc(text)}</span>`;
    }).join('');
    
    const altsHTML = safeAlts.map(a => {
        let altText = "Alternative";
        if (typeof a === 'string') altText = a;
        else if (typeof a === 'object' && a !== null) altText = a.name || a.product || JSON.stringify(a);
        return `<span class="spec-tag" style="background:rgba(59,232,160,.1);color:var(--green)">${esc(altText)}</span>`;
    }).join('');

    // 3. Handle Claim/Overview 
    const descText = p.claim || p.overview || '';
    const descHTML = descText ? `<div class="product-claim">"${esc(descText)}"</div>` : '';

    // 4. Safe fallbacks so it doesn't show '—'
    const sciBacking = p.scientific_backing || 'Visual Scan (N/A)';
    const priceTrans = p.price_transparency || 'Visual Scan (N/A)';

    list.innerHTML += `
      <div class="product-card">
        <div class="product-header">
          <div><div class="product-name">${esc(p.name||'Unknown Product')}</div><span class="product-category">${esc(p.category||'other')}</span></div>
          <div style="text-align:right"><div style="font-family:var(--font-disp);font-size:2rem;${scoreInline(cs)}">${cs}/100</div><div style="font-size:.65rem;color:var(--muted)">Claim Score</div></div>
        </div>
        ${descHTML}
        <span class="claim-verdict claim-${(p.claim_verdict||'Unverified').replace(/\s/g,'')}">${verdictIcon(p.claim_verdict)} ${esc(p.claim_verdict||'Unverified')}</span>
        <div class="product-meta-grid">
          <div class="pmeta"><div class="pmeta-label">Scientific Backing</div><div class="pmeta-value" style="color:${sciColors[p.scientific_backing]||'var(--muted)'}">${esc(sciBacking)}</div></div>
          <div class="pmeta"><div class="pmeta-label">Price Transparency</div><div class="pmeta-value">${esc(priceTrans)}</div></div>
        </div>
        ${specsHTML ? `<div class="pmeta-label" style="margin-bottom:.4rem">Specs Detected</div><div class="specs-row">${specsHTML}</div>` : ''}
        ${missingHTML ? `<div class="pmeta-label" style="margin:.6rem 0 .4rem">Missing Specs</div><div class="specs-row">${missingHTML}</div>` : ''}
        ${altsHTML ? `<div class="pmeta-label" style="margin:.6rem 0 .4rem">Alternatives</div><div class="specs-row">${altsHTML}</div>` : ''}
      </div>`;
  });
}

/* ── Companies Tab ───────────────────────────────── */
function renderCompaniesTab(comps) {
  const list = document.getElementById('companies-list');
  if (!list) return;
  list.innerHTML = '';

  if (!comps.length) {
    list.innerHTML = '<p style="color:var(--muted);padding:1rem">No companies detected in this Short.</p>';
    return;
  }

  comps.forEach(c => {
    const rs = c.reputation_score || 0;
    const issuesHTML  = (c.known_issues||[]).map(i=>`<li>⚠ ${esc(i)}</li>`).join('');
    const posHTML     = (c.positive_notes||[]).map(n=>`<li>✓ ${esc(n)}</li>`).join('');

    list.innerHTML += `
      <div class="company-card">
        <div class="company-score-wrap"><div class="company-score" style="${scoreInline(rs)}">${rs}</div><div class="company-score-label">Rep<br/>Score</div></div>
        <div class="company-info"><div class="company-name">${esc(c.name||'Unknown Company')}</div><span class="company-rep-label rep-${(c.reputation_label||'Unknown').replace(/\s/g,'')}">${esc(c.reputation_label||'Unknown')}</span><div style="font-size:.72rem;color:var(--muted);margin-bottom:.8rem">Relationship: <strong style="color:var(--text)">${esc(c.relationship_to_influencer||'unclear')}</strong></div><div class="company-notes">${issuesHTML ? `<div class="cn-col"><div class="cn-title">Known Issues</div><ul>${issuesHTML}</ul></div>` : ''}${posHTML ? `<div class="cn-col"><div class="cn-title">Positive Notes</div><ul>${posHTML}</ul></div>` : ''}</div></div>
      </div>`;
  });
}

/* ── Advice Tab ──────────────────────────────────── */
function renderAdviceTab(ovr, inf) {
  const adviceEl = document.getElementById('consumer-advice');
  if (adviceEl) adviceEl.textContent = ovr.consumer_advice || '';

  const fcDiv = document.getElementById('factcheck-links');
  if (fcDiv) {
      fcDiv.innerHTML = '';
      (ovr.fact_check_links || []).forEach(term => {
        const btn = document.createElement('a');
        btn.className = 'fc-link';
        btn.textContent = '🔍 ' + term;
        btn.href = `https://www.google.com/search?q=${encodeURIComponent(term)}`;
        btn.target = '_blank';
        fcDiv.appendChild(btn);
      });
  }

  const histEl = document.getElementById('history-note');
  if (histEl) {
    if (inf.historical_accuracy && inf.historical_accuracy !== 'Unknown for live capture') {
      histEl.textContent = '📜 ' + inf.historical_accuracy;
      histEl.style.display = 'block';
    } else {
      histEl.style.display = 'none';
    }
  }
}

/* ── Tabs ────────────────────────────────────────── */
function showTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');
  
  const btns = document.querySelectorAll('.tab-btn');
  const tabMap = ['influencer','products','companies','advice'];
  const idx = tabMap.indexOf(tab);
  if (btns[idx]) btns[idx].classList.add('active');
}

/* ── Load Trending ───────────────────────────────── */
async function loadTrending() {
  const grid = document.getElementById('trending-grid');
  if (!grid) return;
  try {
    const res  = await fetch('/api/trending-shorts');
    const data = await res.json();
    grid.innerHTML = '';
    if (!data.items || !data.items.length) {
      grid.innerHTML = '<p style="color:var(--muted)">Could not load trending videos.</p>';
      return;
    }
    data.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'trending-card glass-panel';
      card.innerHTML = `
        <img src="${esc(item.thumbnail)}" alt="${esc(item.title)}" loading="lazy"/>
        <div class="tc-body">
          <div class="tc-channel">${esc(item.channel)}</div>
          <div class="tc-title">${esc(item.title)}</div>
          <div class="tc-views">👁 ${fmt(item.views)} views</div>
        </div>
        <button class="tc-analyse-btn" onclick="analyseFromTrending('${item.id}')">ANALYSE THIS →</button>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--muted);font-size:.85rem">Trending feed unavailable.</p>`;
  }
}

function analyseFromTrending(id) {
  const input = document.getElementById('short-url');
  if (input) input.value = `https://www.youtube.com/watch?v=${id}`;
  const analyse = document.getElementById('analyse');
  if (analyse) analyse.scrollIntoView({ behavior: 'smooth' });
  setTimeout(startScan, 400);
}

/* ── Helpers ─────────────────────────────────────── */
function fmt(n) {
  const num = parseInt(n, 10) || 0;
  if (num >= 1e9) return (num/1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num/1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num/1e3).toFixed(1) + 'K';
  return num.toString();
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function scoreClass(s) {
  if (s >= 75) return 'score-high';
  if (s >= 50) return 'score-mid';
  if (s >= 30) return 'score-low';
  return 'score-danger';
}

function scoreColor(s) {
  if (s >= 75) return 'var(--green)';
  if (s >= 50) return 'var(--yellow)';
  if (s >= 30) return 'var(--orange)';
  return 'var(--accent2)';
}

function scoreInline(s) { return `color:${scoreColor(s)}`; }

function verdictIcon(v) {
  const map = { 'Verified': '✅', 'Plausible': '⚡', 'Unverified': '❓', 'Misleading': '⚠️', 'False': '❌' };
  return map[v] || '❓';
}

/* ── Init ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => { 
  const shortUrlInput = document.getElementById('short-url');
  if (shortUrlInput) {
    shortUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') startScan(); });
  }

  setTimeout(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.classList.add('hidden'); 
      setTimeout(() => loader.remove(), 800); 
    }
  }, 1800);
});