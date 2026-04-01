import os, re, json, requests, base64
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from googleapiclient.discovery import build
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY  = "your-api-key"
YOUTUBE_API_KEY = "your-youtube-api-key"
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")

def extract_video_id(url):
    patterns = [
        r"(?:youtube\.com/shorts/|youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m: return m.group(1)
    return None

def fetch_video_details(video_id):
    yt = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    r  = yt.videos().list(part="snippet,statistics,contentDetails", id=video_id).execute()
    if not r.get("items"): return {}
    item  = r["items"][0]
    snip  = item.get("snippet", {})
    stats = item.get("statistics", {})
    return {
        "video_id": video_id,
        "title": snip.get("title",""),
        "description": snip.get("description","")[:2000],
        "channel": snip.get("channelTitle",""),
        "channel_id": snip.get("channelId",""),
        "published": snip.get("publishedAt",""),
        "tags": snip.get("tags",[]),
        "thumbnail": snip.get("thumbnails",{}).get("high",{}).get("url",""),
        "views": stats.get("viewCount","0"),
        "likes": stats.get("likeCount","0"),
        "comments": stats.get("commentCount","0"),
    }

def fetch_channel_info(channel_id):
    yt = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    r  = yt.channels().list(part="snippet,statistics", id=channel_id).execute()
    if not r.get("items"): return {}
    item  = r["items"][0]
    snip  = item.get("snippet", {})
    stats = item.get("statistics", {})
    return {
        "name": snip.get("title",""),
        "description": snip.get("description","")[:1000],
        "country": snip.get("country","Unknown"),
        "created": snip.get("publishedAt",""),
        "subscribers": stats.get("subscriberCount","0"),
        "total_views": stats.get("viewCount","0"),
        "video_count": stats.get("videoCount","0"),
    }

ANALYSIS_PROMPT = """
You are DeInfluencer AI — a rigorous, evidence-based media analyst.
Analyse the following YouTube Short content and return ONLY valid JSON (no markdown, no code fences).

VIDEO DATA:
Title: {title}
Channel: {channel}
Description: {description}
Tags: {tags}
Views: {views} | Likes: {likes} | Comments: {comments}

CHANNEL DATA:
Subscribers: {subscribers} | Total Views: {total_views}
Country: {country} | Created: {created}
Channel Bio: {channel_bio}

Return this exact JSON structure:
{{
  "influencer": {{
    "name": "<channel name>",
    "trust_score": <0-100 integer>,
    "trust_label": "<Highly Trustworthy|Trustworthy|Neutral|Suspicious|Untrustworthy>",
    "trust_reasoning": "<2-3 sentence explanation>",
    "red_flags": ["<flag1>","<flag2>"],
    "green_flags": ["<flag1>","<flag2>"],
    "expertise_area": "<their niche>",
    "content_style": "<promotional|educational|mixed|entertainment>",
    "disclosure_score": <0-100>,
    "disclosure_note": "<do they disclose paid partnerships?>",
    "historical_accuracy": "<based on available data>"
  }},
  "products": [
    {{
      "name": "<product name>",
      "category": "<skincare|tech|food|supplement|fashion|other>",
      "claim": "<exact claim made>",
      "claim_verdict": "<Verified|Plausible|Unverified|Misleading|False>",
      "claim_score": <0-100>,
      "scientific_backing": "<strong|moderate|weak|none>",
      "price_transparency": "<mentioned|vague|hidden|not mentioned>",
      "specs_mentioned": ["<spec1>"],
      "missing_specs": ["<spec1>"],
      "alternatives": ["<alt1>","<alt2>"],
      "customer_reviews_summary": "<Search your knowledge base for real customer reviews of this specific product. Summarize what real users actually say about it, including common praises and frequent complaints.>"
    }}
  ],
  "companies": [
    {{
      "name": "<company name>",
      "reputation_score": <0-100>,
      "reputation_label": "<Reputable|Established|Unknown|Questionable|Avoid>",
      "known_issues": ["<issue1>"],
      "positive_notes": ["<note1>"],
      "relationship_to_influencer": "<organic|paid|unclear|affiliate>"
    }}
  ],
  "overall": {{
    "verdict": "<SAFE TO TRUST|USE CAUTION|DO YOUR OWN RESEARCH|LIKELY MISLEADING|AVOID>",
    "verdict_color": "<green|yellow|orange|red>",
    "summary": "<3-4 sentence overall assessment>",
    "consumer_advice": "<specific actionable advice>",
    "fact_check_links": ["<search term 1>","<search term 2>"]
  }}
}}
"""

FRAME_ANALYSIS_PROMPT = """
You are an expert product and visual analyst.
Analyze this screenshot from a camera feed or video.
Extract any visible text (specs written on the product, brand names), identify the product being shown, and evaluate it based on visual cues and general knowledge.

Return ONLY valid JSON using this exact structure (do NOT include an influencer section):
{
  "products": [
    {
      "name": "<product name>",
      "category": "<skincare|tech|etc>",
      "overview": "<Explain exactly how the product is, its build quality, and your overall impression>",
      "reviews_sentiment": "<Summarize how good the reviews typically are for this product, include common praises/complaints>",
      "specs_written_on_product": ["<spec 1 directly visible or known>", "<spec 2>"],
      "alternatives": [
        {
          "name": "<Alternative Product 1>",
          "reason": "<Why it is a good alternative>"
        },
        {
          "name": "<Alternative Product 2>",
          "reason": "<Why it is a good alternative>"
        }
      ]
    }
  ],
  "companies": [
    {
      "name": "<company name if visible>",
      "reputation_score": 85,
      "reputation_label": "<Reputable|Established|Unknown|Questionable|Avoid>"
    }
  ],
  "overall": {
    "verdict": "<SAFE TO BUY|RESEARCH MORE|AVOID>",
    "verdict_color": "<green|yellow|orange|red>",
    "summary": "<Overall visual assessment of the product>",
    "consumer_advice": "<actionable advice>"
  }
}
"""

def analyse_with_gemini(vd, cd):
    prompt = ANALYSIS_PROMPT.format(
        title=vd.get("title",""), channel=vd.get("channel",""),
        description=vd.get("description",""), tags=", ".join(vd.get("tags",[])),
        views=vd.get("views","0"), likes=vd.get("likes","0"), comments=vd.get("comments","0"),
        subscribers=cd.get("subscribers","0"), total_views=cd.get("total_views","0"),
        country=cd.get("country","Unknown"), created=cd.get("created",""),
        channel_bio=cd.get("description",""),
    )
    response = model.generate_content(prompt)
    raw = response.text.strip()
    raw = re.sub(r"^```json\s*","",raw); raw = re.sub(r"```$","",raw)
    return json.loads(raw)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/analyse", methods=["POST"])
def analyse():
    body = request.get_json(force=True)
    url  = (body.get("url") or "").strip()
    if not url: return jsonify({"error":"No URL provided"}), 400
    vid = extract_video_id(url)
    if not vid: return jsonify({"error":"Could not extract video ID"}), 400
    try:
        vd = fetch_video_details(vid)
        cd = fetch_channel_info(vd.get("channel_id",""))
    except Exception as e:
        return jsonify({"error":f"YouTube API error: {e}"}), 500
    if not vd: return jsonify({"error":"Video not found or private"}), 404
    try:
        analysis = analyse_with_gemini(vd, cd)
    except Exception as e:
        return jsonify({"error":f"Gemini API error: {e}"}), 500
    return jsonify({"video":vd,"channel":cd,"analysis":analysis,
                    "analysed_at":datetime.now(timezone.utc).isoformat()})

@app.route("/api/analyse-frame", methods=["POST"])
def analyse_frame():
    body = request.get_json(force=True)
    image_data = body.get("image", "")
    if not image_data: 
        return jsonify({"error": "No image provided"}), 400

    # Decode base64 image from frontend
    if "," in image_data:
        image_data = image_data.split(",")[1]
    
    try:
        image_bytes = base64.b64decode(image_data)
        image_parts = [{"mime_type": "image/jpeg", "data": image_bytes}]
        
        # Send image + prompt to Gemini
        response = model.generate_content([FRAME_ANALYSIS_PROMPT, image_parts[0]])
        raw = response.text.strip()
        raw = re.sub(r"^```json\s*","",raw); raw = re.sub(r"```$","",raw)
        analysis = json.loads(raw)
        
        # Create placeholder video/channel data since we don't have the YouTube URL
        vd = {"title": "Live Visual Capture", "channel": "Live Feed", "views": "N/A", "likes": "N/A", "comments": "N/A"}
        cd = {"subscribers": "N/A", "total_views": "N/A", "country": "Unknown"}
        
        return jsonify({"video": vd, "channel": cd, "analysis": analysis, "analysed_at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        return jsonify({"error": f"Live Scan error: {e}"}), 500

@app.route("/api/trending-shorts", methods=["GET"])
def trending_shorts():
    try:
        yt = build("youtube","v3",developerKey=YOUTUBE_API_KEY)
        r  = yt.videos().list(part="snippet,statistics",chart="mostPopular",
                              videoCategoryId="22",maxResults=6,regionCode="IN").execute()
        items=[]
        for item in r.get("items",[]):
            snip=item.get("snippet",{}); stats=item.get("statistics",{})
            items.append({"id":item["id"],"title":snip.get("title",""),
                          "channel":snip.get("channelTitle",""),
                          "thumbnail":snip.get("thumbnails",{}).get("medium",{}).get("url",""),
                          "views":stats.get("viewCount","0")})
        return jsonify({"items":items})
    except Exception as e:
        return jsonify({"error":str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)
