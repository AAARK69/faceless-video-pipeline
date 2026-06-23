"""
Phase 5: YouTube Analytics Feedback Loop
Runs 48h after each upload to pull retention & view data,
and updates topic_performance.json to weight future topic selections.

Usage: python3 src/phase5_analytics.py [video_id]
"""
import os
import sys
import json
from datetime import datetime, timedelta, timezone

def get_api_key():
    """Load Composio API key from .env or mcp_config.json"""
    if os.environ.get("COMPOSIO_API_KEY"):
        return os.environ["COMPOSIO_API_KEY"]
    rootDir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_file = os.path.join(rootDir, ".env")
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith("COMPOSIO_API_KEY="):
                    key = stripped.split("=", 1)[1].strip().strip('"\'')
                    if key:
                        return key
    mcp_config = "/Users/rohankosur/.gemini/antigravity/mcp_config.json"
    if os.path.exists(mcp_config):
        with open(mcp_config, 'r') as f:
            cfg = json.load(f)
            return cfg.get("mcpServers", {}).get("composio", {}).get("headers", {}).get("x-api-key")
    return None

CATEGORY_MAP = {
    "Science & Nature": ["Weather Phenomenon", "Galaxy", "Biome", "Subatomic Particle", "Cloud", "Ocean Zone", "Tectonic Plate", "Star", "Chemical Bond", "Blood Cell"],
    "Psychology": ["Defense Mechanism", "Memory", "Sleep Stage", "Personality Disorder", "Cognitive Bias", "Learning Style", "Emotion", "Introvert", "Phobia", "Dream"],
    "Art & Entertainment": ["Literary Genre", "Movie Trope", "Music Genre", "Visual Art", "Poetry", "Story Arc", "Anime Genre", "Video Game Genre", "Camera Shot", "Villain"],
    "Society & History": ["Government System", "Economic System", "Logical Fallacy", "Historical Era", "Internet Troll", "Social Media", "Generation", "Currency", "Conspiracy", "Religion"],
    "Technology": ["Renewable Energy", "Computer Virus", "Artificial Intelligence", "Bridge Architecture", "Coding Language", "Engine", "Network Topology", "Data Storage", "Rocket", "Clock"],
    "Everyday Life": ["Coffee", "Diet", "Workout", "Bread", "Cheese", "Tea", "House Plant", "Sibling", "Co-Worker", "Commuter"],
    "Language & Communication": ["Figure of Speech", "Punctuation", "Accent", "Love Language", "Nonverbal"],
    "Math & Physics": ["Number", "Geometric Shape", "Physics Law", "Dimension", "Force"],
    "Mythology": ["Mythological Creature", "Greek God", "Urban Legend", "Folklore", "Afterlife"],
    "Abstract & Niche": ["Paradox", "Optical Illusion", "Magic Trick", "Secret Society", "Apocalyptic", "Time Travel", "Extraterrestrial", "Martial Art", "Board Game", "Puzzle"],
    "Earth & Materials": ["Gemstone", "Venomous Snake", "Volcano", "Glacier", "Desert", "Forest", "Evolution", "Symbiosis", "Parasite", "Muscle", "Battery", "Plastic", "Glass", "Metal", "Paper"]
}

def get_category(topic: str) -> str:
    """Match a topic string to its category."""
    for cat, keywords in CATEGORY_MAP.items():
        for kw in keywords:
            if kw.lower() in topic.lower():
                return cat
    return "Other"

def load_performance(perf_path: str) -> dict:
    if os.path.exists(perf_path):
        with open(perf_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_performance(perf_path: str, perf: dict):
    with open(perf_path, 'w', encoding='utf-8') as f:
        json.dump(perf, f, indent=2)
    print(f"[Analytics] Saved performance data to {perf_path}")

def update_category_stats(perf: dict, category: str, topic: str, stats: dict):
    """Merge new stats into the performance dict."""
    if category not in perf:
        perf[category] = {"videos": [], "avg_retention": 0.5, "avg_views": 0, "total_count": 0}
    cat = perf[category]
    cat["videos"].append({
        "topic": topic,
        "date": datetime.now(timezone.utc).isoformat(),
        **stats
    })
    # Recalculate averages
    all_retention = [v.get("retention", 0.5) for v in cat["videos"] if "retention" in v]
    all_views = [v.get("views", 0) for v in cat["videos"] if "views" in v]
    cat["avg_retention"] = sum(all_retention) / len(all_retention) if all_retention else 0.5
    cat["avg_views"] = sum(all_views) / len(all_views) if all_views else 0
    cat["total_count"] = len(cat["videos"])
    return perf

def parse_iso8601_duration(duration_str: str) -> int:
    """Matches ISO 8601 duration: PT[hH][mM][sS]"""
    import re
    pattern = re.compile(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?')
    match = pattern.match(duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    seconds = int(match.group(3)) if match.group(3) else 0
    return hours * 3600 + minutes * 60 + seconds

def fetch_analytics(video_id: str, api_key: str) -> dict:
    """Fetch video analytics from YouTube via Composio."""
    try:
        from composio import Composio
        MY_USER_ID = "pg-test-041cee91-75d5-4794-a3f1-ed2ac8741767"
        client = Composio(api_key=api_key, dangerously_skip_version_check=True)
        
        res = client.tools.execute(
            slug="YOUTUBE_GET_VIDEO_DETAILS_BATCH",
            arguments={
                "id": [video_id],
                "parts": ["snippet", "statistics", "contentDetails"]
            },
            user_id=MY_USER_ID,
            dangerously_skip_version_check=True
        )
        
        if res.get("successful") and res.get("data"):
            items = res["data"].get("items", [])
            if items:
                item = items[0]
                stats = item.get("statistics", {})
                content = item.get("contentDetails", {})
                
                views = int(stats.get("viewCount", 0))
                likes = int(stats.get("likeCount", 0))
                comments = int(stats.get("commentCount", 0))
                
                duration_raw = content.get("duration", "PT0S")
                duration_secs = parse_iso8601_duration(duration_raw)
                
                # Estimate average view duration and retention using a heuristic since true retention
                # is not available via standard Data API v3.
                # Average view duration defaults to 70% of video duration, boosted by likes/views ratio.
                retention = 0.70
                if views > 0:
                    like_ratio = likes / views
                    retention = min(0.95, max(0.50, 0.50 + like_ratio * 3.0))
                
                avg_duration = duration_secs * retention
                minutes_watched = (views * avg_duration) / 60.0
                
                return {
                    "views": views,
                    "minutes_watched": round(minutes_watched, 2),
                    "avg_view_duration": round(avg_duration, 1),
                    "subscribers_gained": 0,
                    "retention": round(retention, 3)
                }
    except Exception as e:
        print(f"[Analytics] Could not fetch from YouTube API: {e}")
    
    return {}

def main():
    rootDir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    perf_path = os.path.join(rootDir, "topic_performance.json")
    property_toon = os.path.join(rootDir, "property_data.toon")
    
    # Get video_id from argument or try reading last_video_id.txt
    video_id = sys.argv[1] if len(sys.argv) > 1 else None
    if not video_id:
        last_id_file = os.path.join(rootDir, "last_video_id.txt")
        if os.path.exists(last_id_file):
            with open(last_id_file, 'r') as f:
                video_id = f.read().strip()
    
    if not video_id:
        print("[Analytics] No video_id provided. Pass as argument: python3 src/phase5_analytics.py VIDEO_ID")
        print("[Analytics] Or create last_video_id.txt with the YouTube video ID.")
        sys.exit(1)
    
    print(f"[Analytics] Fetching analytics for video: {video_id}")
    
    # Get current topic
    topic = "Unknown Topic"
    if os.path.exists(property_toon):
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from toon_utils import decode_topic_data
            with open(property_toon, 'r', encoding='utf-8') as f:
                td = decode_topic_data(f.read())
                topic = td.get('topic', 'Unknown Topic')
        except Exception as e:
            print(f"[Analytics] Could not load topic: {e}")
    
    category = get_category(topic)
    print(f"[Analytics] Topic: '{topic}' → Category: '{category}'")
    
    # Load existing performance
    perf = load_performance(perf_path)
    
    # Fetch analytics from YouTube
    api_key = get_api_key()
    stats = {}
    if api_key:
        stats = fetch_analytics(video_id, api_key)
    
    if not stats:
        # Use mock stats for testing when API is unavailable
        print("[Analytics] Using mock stats (no API data available).")
        stats = {"views": 0, "retention": 0.5, "avg_view_duration": 90, "subscribers_gained": 0}
    
    print(f"[Analytics] Stats: {stats}")
    
    # Update performance data
    perf = update_category_stats(perf, category, topic, stats)
    save_performance(perf_path, perf)
    
    # Print summary of category weights
    print("\n[Analytics] Category Performance Summary:")
    for cat, data in sorted(perf.items(), key=lambda x: x[1].get('avg_retention', 0), reverse=True):
        print(f"  {cat}: avg_retention={data.get('avg_retention', 0):.1%}, avg_views={data.get('avg_views', 0):.0f}, videos={data.get('total_count', 0)}")

if __name__ == "__main__":
    main()
