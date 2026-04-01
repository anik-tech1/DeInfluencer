// DeInfluencer — Content Script
// Injects a floating "Analyze" button on YouTube Shorts pages.
// Results appear in a draggable floating panel.

(function () {
  'use strict';

  let currentVideoId = null;
  let panelOpen = false;
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;

  function injectFAB() {
    if (document.getElementById('deinf-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'deinf-fab';
    fab.title = 'Analyze with DeInfluencer';
    fab.innerHTML = '<span class="deinf-fab-icon">🛡</span><span class="deinf-fab-label">Analyze</span>';
    fab.addEventListener('click', onFabClick);
    document.body.appendChild(fab);
  }

  function removeFAB() {
    const fab = document.getElementById('deinf-fab');
    if (fab) fab.remove();
  }

  function injectPanel() {
    if (document.getElementById('deinf-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'deinf-panel';
    panel.innerHTML = `
      <div id="deinf-panel-header">
        <div class="deinf-panel-logo">
          <span>🛡</span>
          <span class="deinf-panel-title">DeInfluencer</span>
        </div>
        <div class="deinf-panel-actions">
          <button id="deinf-reanalyze" class="deinf-hdr-btn" title="Re-analyze">↺</button>
          <button id="deinf-close" class="deinf-hdr-btn" title="Close">✕</button>
        </div>
      </div>
      <div id="deinf-panel-body">
        <div id="deinf-state-loading" class="deinf-state">
          <div class="deinf-spinner"></div>
          <p id="deinf-loading-text">Fetching video data…</p>
        </div>
        <div id="deinf-state-error" class="deinf-state" style="display:none">
          <div class="deinf-err-icon">⚠</div>
          <p id="deinf-error-text"></p>
          <button class="deinf-outline-btn" id="deinf-open-settings">Open Settings</button>
        </div>
        <div id="deinf-state-result" style="display:none">
          <div id="deinf-verdict"></div>
          <div id="deinf-trust"></div>
          <div id="deinf-products"></div>
          <div id="deinf-tactics"></div>
          <div id="deinf-advice"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.style.right = '24px';
    panel.style.top = '80px';

    document.getElementById('deinf-panel-header').addEventListener('mousedown', startDrag);
    document.getElementById('deinf-close').addEventListener('click', closePanel);
    document.getElementById('deinf-reanalyze').addEventListener('click', () => {
      if (currentVideoId) runAnalysis(currentVideoId);
    });
    document.getElementById('deinf-open-settings').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });
  }

  function startDrag(e) {
    if (e.target.classList.contains('deinf-hdr-btn')) return;
    isDragging = true;
    const panel = document.getElementById('deinf-panel');
    const rect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    panel.style.transition = 'none';
    e.preventDefault();
  }

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const panel = document.getElementById('deinf-panel');
    if (!panel) return;
    panel.style.left = Math.max(0, e.clientX - dragOffsetX) + 'px';
    panel.style.top = Math.max(0, e.clientY - dragOffsetY) + 'px';
    panel.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => { isDragging = false; });

  function openPanel() {
    injectPanel();
    const panel = document.getElementById('deinf-panel');
    panel.style.display = 'flex';
    requestAnimationFrame(() => { panel.style.opacity = '1'; panel.style.transform = 'scale(1) translateY(0)'; });
    panelOpen = true;
  }

  function closePanel() {
    const panel = document.getElementById('deinf-panel');
    if (!panel) return;
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.95) translateY(8px)';
    setTimeout(() => { if (panel) panel.style.display = 'none'; }, 200);
    panelOpen = false;
  }

  function onFabClick() {
    if (!currentVideoId) return;
    if (panelOpen) { closePanel(); return; }
    openPanel();
    runAnalysis(currentVideoId);
  }

  function showState(name) {
    ['loading','error','result'].forEach(s => {
      const el = document.getElementById('deinf-state-' + s);
      if (el) el.style.display = s === name ? (s === 'result' ? 'block' : 'flex') : 'none';
    });
  }

  function showError(msg) {
    const el = document.getElementById('deinf-error-text');
    if (el) el.textContent = msg;
    showState('error');
  }

  function scoreColor(n) {
    if (n >= 70) return '#22c55e';
    if (n >= 50) return '#f59e0b';
    if (n >= 30) return '#f97316';
    return '#ef4444';
  }

  function verdictColor(c) {
    return {green:'#22c55e',yellow:'#f59e0b',orange:'#f97316',red:'#ef4444'}[c] || '#6b7280';
  }

  function renderResults(data) {
    const { analysis, video } = data;
    const inf = analysis.influencer || {};
    const overall = analysis.overall || {};
    const products = analysis.products || [];
    const tactics = analysis.manipulation_tactics || [];

    const score = inf.trust_score ?? 50;
    const sColor = scoreColor(score);
    const vColor = verdictColor(overall.verdict_color);

    document.getElementById('deinf-verdict').innerHTML = `
      <div class="deinf-verdict-banner" style="border-color:${vColor};background:${vColor}18">
        <span class="deinf-verdict-label" style="color:${vColor}">${overall.verdict || '—'}</span>
        <p class="deinf-verdict-sum">${overall.summary || ''}</p>
      </div>`;

    const redF = (inf.red_flags||[]).map(f=>'<li>🚩 '+f+'</li>').join('');
    const greenF = (inf.green_flags||[]).map(f=>'<li>✅ '+f+'</li>').join('');

    document.getElementById('deinf-trust').innerHTML = `
      <div class="deinf-section">
        <div class="deinf-sec-title">Influencer Trust</div>
        <div class="deinf-trust-row">
          <div class="deinf-ring">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#ffffff12" stroke-width="4"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke="${sColor}" stroke-width="4"
                stroke-dasharray="${(score/100)*113} 113" stroke-linecap="round" transform="rotate(-90 22 22)"/>
            </svg>
            <span style="color:${sColor}">${score}</span>
          </div>
          <div class="deinf-trust-info">
            <div class="deinf-ch-name">${inf.name || video.channel || '—'}</div>
            <span class="deinf-badge" style="background:${sColor}22;color:${sColor}">${inf.trust_label||'—'}</span>
            <div class="deinf-niche">${inf.expertise_area||''}</div>
          </div>
        </div>
        <p class="deinf-reasoning">${inf.trust_reasoning||''}</p>
        ${redF||greenF?'<ul class="deinf-flags">'+redF+greenF+'</ul>':''}
        <div class="deinf-disc-row">
          <span class="deinf-tiny">Disclosure</span>
          <div class="deinf-track"><div class="deinf-fill" style="width:${inf.disclosure_score||0}%;background:${scoreColor(inf.disclosure_score||0)}"></div></div>
          <span class="deinf-tiny">${inf.disclosure_score??'?'}/100</span>
        </div>
      </div>`;

    if (products.length) {
      const vs={Verified:'#22c55e',Plausible:'#84cc16',Unverified:'#f59e0b',Misleading:'#f97316',False:'#ef4444'};
      document.getElementById('deinf-products').innerHTML = `
        <div class="deinf-section">
          <div class="deinf-sec-title">Products (${products.length})</div>
          ${products.map(p=>`
            <div class="deinf-prod">
              <div class="deinf-prod-top"><b>${p.name||'?'}</b><span class="deinf-cat">${p.category||''}</span></div>
              ${p.claim?'<p class="deinf-claim">"'+p.claim+'"</p>':''}
              <div class="deinf-vrow" style="color:${vs[p.claim_verdict]||'#6b7280'}">${p.claim_verdict||'—'} · ${p.claim_score??'?'}/100 · Science: ${p.scientific_backing||'?'}</div>
              ${(p.alternatives||[]).length?'<div class="deinf-alts">Alt: '+p.alternatives.join(', ')+'</div>':''}
            </div>`).join('')}
        </div>`;
    } else document.getElementById('deinf-products').innerHTML = '';

    if (tactics.length) {
      const sc={LOW:'#84cc16',MEDIUM:'#f59e0b',HIGH:'#ef4444'};
      document.getElementById('deinf-tactics').innerHTML = `
        <div class="deinf-section">
          <div class="deinf-sec-title">Manipulation Tactics (${tactics.length})</div>
          ${tactics.map(t=>`
            <div class="deinf-tactic">
              <div class="deinf-dot" style="background:${sc[t.severity]||'#6b7280'}"></div>
              <div class="deinf-tac-body">
                <div class="deinf-tac-name">${t.tactic}</div>
                <div class="deinf-tac-desc">${t.description||''}</div>
              </div>
              <span class="deinf-sev" style="color:${sc[t.severity]||'#6b7280'}">${t.severity||''}</span>
            </div>`).join('')}
        </div>`;
    } else document.getElementById('deinf-tactics').innerHTML = '';

    document.getElementById('deinf-advice').innerHTML = `
      <div class="deinf-section deinf-advice-sec">
        <div class="deinf-sec-title">💡 Consumer Advice</div>
        <p>${overall.consumer_advice||'—'}</p>
      </div>`;

    showState('result');
  }

  function runAnalysis(videoId) {
    showState('loading');
    document.getElementById('deinf-loading-text').textContent = 'Fetching video data…';
    setTimeout(() => {
      const el = document.getElementById('deinf-loading-text');
      if (el) el.textContent = 'Calling Gemini AI…';
    }, 1800);
    chrome.runtime.sendMessage({type:'ANALYZE_VIDEO', videoId}, (res) => {
      if (chrome.runtime.lastError) { showError(chrome.runtime.lastError.message); return; }
      if (!res.success) { showError(res.error || 'Analysis failed.'); return; }
      renderResults(res.data);
    });
  }

  function extractShortsId(url) {
    const m = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function onUrlChange() {
    const videoId = extractShortsId(location.href);
    if (videoId) {
      if (videoId !== currentVideoId) {
        currentVideoId = videoId;
        if (panelOpen) closePanel();
      }
      injectFAB();
    } else {
      currentVideoId = null;
      removeFAB();
      closePanel();
    }
  }

  const orig = {push: history.pushState.bind(history), replace: history.replaceState.bind(history)};
  history.pushState = (...a) => { orig.push(...a); setTimeout(onUrlChange, 150); };
  history.replaceState = (...a) => { orig.replace(...a); setTimeout(onUrlChange, 150); };
  window.addEventListener('popstate', () => setTimeout(onUrlChange, 150));

  let lastHref = location.href;
  new MutationObserver(() => {
    if (location.href !== lastHref) { lastHref = location.href; setTimeout(onUrlChange, 150); }
  }).observe(document, {subtree:true, childList:true});

  onUrlChange();
})();
