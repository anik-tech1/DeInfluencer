// DeInfluencer — Options Page Logic
// NOTE: No inline onclick handlers allowed in MV3 extension pages.
// All events are wired here via addEventListener.

function toggleVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + type;
  setTimeout(() => { el.className = 'status'; }, 4000);
}

function saveKeys() {
  const geminiKey = document.getElementById('gemini-key').value.trim();
  const youtubeKey = document.getElementById('yt-key').value.trim();

  if (!geminiKey || !youtubeKey) {
    showStatus('Both API keys are required.', 'error');
    return;
  }

  if (!geminiKey.startsWith('AIza') || !youtubeKey.startsWith('AIza')) {
    showStatus('Keys look invalid — they should start with "AIza…"', 'error');
    return;
  }

  chrome.storage.sync.set({ geminiKey, youtubeKey }, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    showStatus('✓ Keys saved successfully!', 'success');
    updateStatusIndicators(geminiKey, youtubeKey);
  });
}

function clearKeys() {
  chrome.storage.sync.remove(['geminiKey', 'youtubeKey'], () => {
    document.getElementById('gemini-key').value = '';
    document.getElementById('yt-key').value = '';
    showStatus('Keys cleared.', 'success');
    updateStatusIndicators(null, null);
  });
}

function updateStatusIndicators(geminiKey, youtubeKey) {
  const geminiEl = document.getElementById('status-gemini');
  const ytEl = document.getElementById('status-yt');

  if (geminiKey) {
    geminiEl.textContent = '✓ Configured';
    geminiEl.className = 'info-val ok';
  } else {
    geminiEl.textContent = '✗ Missing';
    geminiEl.className = 'info-val missing';
  }

  if (youtubeKey) {
    ytEl.textContent = '✓ Configured';
    ytEl.className = 'info-val ok';
  } else {
    ytEl.textContent = '✗ Missing';
    ytEl.className = 'info-val missing';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Wire buttons — no inline onclick allowed in MV3
  document.getElementById('btn-save').addEventListener('click', saveKeys);
  document.getElementById('btn-clear').addEventListener('click', clearKeys);
  document.getElementById('toggle-gemini').addEventListener('click', function () {
    toggleVis('gemini-key', this);
  });
  document.getElementById('toggle-yt').addEventListener('click', function () {
    toggleVis('yt-key', this);
  });

  // Load saved keys
  chrome.storage.sync.get(['geminiKey', 'youtubeKey'], (data) => {
    if (data.geminiKey) document.getElementById('gemini-key').value = data.geminiKey;
    if (data.youtubeKey) document.getElementById('yt-key').value = data.youtubeKey;
    updateStatusIndicators(data.geminiKey, data.youtubeKey);
  });
});
