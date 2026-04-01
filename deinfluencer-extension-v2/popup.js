// DeInfluencer — Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-yt').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.youtube.com/shorts/' });
  });

  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.sync.get(['geminiKey', 'youtubeKey'], (data) => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    if (data.geminiKey && data.youtubeKey) {
      dot.className = 'dot dot-green';
      text.textContent = 'Ready! Open any YouTube Short to start analysis.';
    } else {
      dot.className = 'dot dot-red';
      text.textContent = 'API keys not configured. Click "Configure API Keys" to set them up.';
    }
  });
});
