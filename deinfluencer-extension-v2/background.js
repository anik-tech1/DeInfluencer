// DeInfluencer — Background Service Worker
// Handles API calls to YouTube Data API v3 and Gemini AI

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (message.type === 'ANALYZE_VIDEO') {
    analyzeVideo(message.videoId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'GET_KEYS') {
    chrome.storage.sync.get(['geminiKey', 'youtubeKey'], (data) => {
      sendResponse(data);
    });
    return true;
  }
});

async function getKeys() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['geminiKey', 'youtubeKey'], resolve);
  });
}

async function analyzeVideo(videoId) {
  const { geminiKey, youtubeKey } = await getKeys();
  if (!geminiKey || !youtubeKey) {
    throw new Error('API keys not configured. Click the extension icon to set them up.');
  }

  // 1. Fetch video details from YouTube API
  const videoData = await fetchVideoDetails(videoId, youtubeKey);
  if (!videoData) throw new Error('Video not found or is private.');

  // 2. Fetch channel info
  const channelData = await fetchChannelInfo(videoData.channelId, youtubeKey);

  // 3. Analyze with Gemini
  const analysis = await analyzeWithGemini(videoData, channelData, geminiKey);

  return { video: videoData, channel: channelData, analysis };
}

async function fetchVideoDetails(videoId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  const snip = item.snippet || {};
  const stats = item.statistics || {};

  return {
    videoId,
    title: snip.title || '',
    description: (snip.description || '').slice(0, 2000),
    channel: snip.channelTitle || '',
    channelId: snip.channelId || '',
    published: snip.publishedAt || '',
    tags: snip.tags || [],
    thumbnail: (snip.thumbnails?.high || snip.thumbnails?.medium || snip.thumbnails?.default || {}).url || '',
    views: stats.viewCount || '0',
    likes: stats.likeCount || '0',
    comments: stats.commentCount || '0',
  };
}

async function fetchChannelInfo(channelId, apiKey) {
  if (!channelId) return {};
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.items || data.items.length === 0) return {};

  const item = data.items[0];
  const snip = item.snippet || {};
  const stats = item.statistics || {};

  return {
    name: snip.title || '',
    description: (snip.description || '').slice(0, 1000),
    country: snip.country || 'Unknown',
    created: snip.publishedAt || '',
    subscribers: stats.subscriberCount || '0',
    totalViews: stats.viewCount || '0',
    videoCount: stats.videoCount || '0',
  };
}

async function analyzeWithGemini(vd, cd, apiKey) {
  const prompt = buildPrompt(vd, cd);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
      })
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Gemini API error');
  }

  let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  raw = raw.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON from the response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse AI response as JSON');
  }
}

function buildPrompt(vd, cd) {
  return `You are DeInfluencer AI — a rigorous, evidence-based media analyst.
Analyse the following YouTube Short content and return ONLY valid JSON (no markdown, no code fences).

VIDEO DATA:
Title: ${vd.title}
Channel: ${vd.channel}
Description: ${vd.description}
Tags: ${vd.tags.join(', ')}
Views: ${vd.views} | Likes: ${vd.likes} | Comments: ${vd.comments}

CHANNEL DATA:
Subscribers: ${cd.subscribers} | Total Views: ${cd.totalViews}
Country: ${cd.country} | Created: ${cd.created}
Channel Bio: ${cd.description}

Return this exact JSON structure:
{
  "influencer": {
    "name": "<channel name>",
    "trust_score": <0-100 integer>,
    "trust_label": "<Highly Trustworthy|Trustworthy|Neutral|Suspicious|Untrustworthy>",
    "trust_reasoning": "<2-3 sentence explanation>",
    "red_flags": ["<flag1>","<flag2>"],
    "green_flags": ["<flag1>"],
    "expertise_area": "<their niche>",
    "content_style": "<promotional|educational|mixed|entertainment>",
    "disclosure_score": <0-100>,
    "disclosure_note": "<do they disclose paid partnerships?>"
  },
  "products": [
    {
      "name": "<product name>",
      "category": "<skincare|tech|food|supplement|fashion|other>",
      "claim": "<exact claim made>",
      "claim_verdict": "<Verified|Plausible|Unverified|Misleading|False>",
      "claim_score": <0-100>,
      "scientific_backing": "<strong|moderate|weak|none>",
      "alternatives": ["<alt1>","<alt2>"]
    }
  ],
  "manipulation_tactics": [
    {
      "tactic": "<tactic name>",
      "severity": "<LOW|MEDIUM|HIGH>",
      "description": "<brief description>"
    }
  ],
  "overall": {
    "verdict": "<SAFE TO TRUST|USE CAUTION|DO YOUR OWN RESEARCH|LIKELY MISLEADING|AVOID>",
    "verdict_color": "<green|yellow|orange|red>",
    "summary": "<3-4 sentence overall assessment>",
    "consumer_advice": "<specific actionable advice>"
  }
}`;
}
