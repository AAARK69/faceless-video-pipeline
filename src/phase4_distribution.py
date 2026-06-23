import os
import sys
import json
from composio import Composio
from composio.client.enums import Action, App
from toon_utils import decode_topic_data, decode_timing_with_concepts

# Your specific test connection ID
MY_USER_ID = "pg-test-041cee91-75d5-4794-a3f1-ed2ac8741767"

def get_api_key():
    if os.environ.get("COMPOSIO_API_KEY"):
        return os.environ["COMPOSIO_API_KEY"]
    rootDir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_file = os.path.join(rootDir, ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    stripped = line.strip()
                    if stripped.startswith("COMPOSIO_API_KEY="):
                        key = stripped.split("=", 1)[1].strip()
                        if key.startswith(('"', "'")) and key.endswith(('"', "'")):
                            key = key[1:-1]
                        return key
        except Exception as e:
            print(f"Error reading .env: {e}")
    mcp_config = "/Users/rohankosur/.gemini/antigravity/mcp_config.json"
    if os.path.exists(mcp_config):
        try:
            with open(mcp_config, 'r') as f:
                cfg = json.load(f)
                key = cfg.get("mcpServers", {}).get("composio", {}).get("headers", {}).get("x-api-key")
                if key:
                    return key
        except Exception as e:
            print(f"Error reading mcp_config.json: {e}")
    return None

def get_connection_status(client):
    try:
        res = client.connected_accounts.list(toolkit_slugs=["youtube"])
        for conn in res.items:
            if conn.toolkit.slug == "youtube" and conn.status == "ACTIVE":
                return True
        return False
    except Exception:
        return False

def initiate_youtube_connection(client):
    print("Initiating YouTube connection link...")
    try:
        configs = client.auth_configs.list(toolkit_slug="youtube")
        if not configs or len(configs.items) == 0:
            print("Error: No auth config found.")
            sys.exit(1)
        auth_config_id = configs.items[0].id
        connection = client.connected_accounts.link(user_id=MY_USER_ID, auth_config_id=auth_config_id)
        print(f"\nPlease authorize here: {connection.redirect_url}")
        sys.exit(0)
    except Exception as e:
        print(f"Failed: {e}")
        sys.exit(1)

def format_timestamp(sec):
    m = int(sec // 60)
    s = int(sec % 60)
    return f"{m:02d}:{s:02d}"

def main():
    rootDir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    video_path = os.path.join(rootDir, "final_video.mp4")
    timing_toon = os.path.join(rootDir, "timing.toon")
    property_toon = os.path.join(rootDir, "property_data.toon")
    
    # Initialize Composio
    api_key = get_api_key()
    client = Composio(
        api_key=api_key,
        dangerously_skip_version_check=True,
        dangerously_allow_auto_upload_download_files=True,
        file_upload_dirs=[rootDir]
    )
    
    # Check connection specifically for our user_id
    if not get_connection_status(client):
        initiate_youtube_connection(client)
    
    # Read actual topic from property_data.toon
    topic_data = {}
    if os.path.exists(property_toon):
        with open(property_toon, 'r', encoding='utf-8') as f:
            topic_data = decode_topic_data(f.read())
    
    topic = topic_data.get('topic', 'Every Type of Concept Explained')
    
    # Build dynamic tags from first 5 concept names
    concept_names = [c.get('name', '') for c in topic_data.get('concepts', []) if c.get('name')]
    tag_concepts = [name.lower() for name in concept_names[:5]]
    dynamic_tags = tag_concepts + ["education", "explanation"]
        
    # Generate metadata
    timing_concepts = []
    timing_data = {}
    if os.path.exists(timing_toon):
        with open(timing_toon, 'r', encoding='utf-8') as f:
            timing_data = decode_timing_with_concepts(f.read())
            timing_concepts = timing_data.get('concepts', [])
            
    # Calculate duration in minutes dynamically to build the title
    words = timing_data.get('words', []) if timing_data else []
    duration_min = 0
    if words:
        total_duration = words[-1].get('end', 0.0)
        duration_min = int(total_duration // 60)
        dynamic_title = f"{topic} in under {duration_min + 1} Minutes! 📚"
    else:
        dynamic_title = f"{topic} Explained! 📚"
    
    # 1. Above the Fold summary (2-3 sentences containing the main keyword)
    duration_str = f"under {duration_min + 1} minutes" if words else "a comprehensive breakdown"
    above_the_fold = (
        f"Discover and explore the fascinating concepts behind {topic}! "
        f"In this quick, high-retention guide, we explain everything you need to know about {topic} in {duration_str}. "
        f"Perfect for quick learning, exam revision, or feeding your daily curiosity.\n\n"
    )
    
    # 2. Timestamps / Chapters
    timestamp_lines = ["TIMESTAMPS:", "00:00 Introduction"]
    for c in timing_concepts:
        timestamp_lines.append(f"{format_timestamp(c.get('start', 0.0))} {c.get('name', '')}")
    timestamps_section = "\n".join(timestamp_lines) + "\n\n"
    
    # 3. Key Takeaways / Bulleted summary for AI citation engines
    takeaway_lines = ["KEY TAKEAWAYS & CONCEPTS EXPLAINED:"]
    for c in topic_data.get('concepts', []):
        if c.get('name') and c.get('description'):
            desc = c.get('description', '')
            if len(desc) > 180:
                desc = desc[:175].strip() + "..."
            takeaway_lines.append(f"• {c.get('name')}: {desc}")
    takeaways_section = "\n".join(takeaway_lines) + "\n\n"
    
    # 4. Ecosystem Links & CTAs
    ecosystem_section = (
        "🔗 ECOSYSTEM & USEFUL LINKS:\n"
        "• Subscribe for daily explanations: https://youtube.com/@everytypeexplained\n"
        "• Watch the full Science & Nature playlist: https://youtube.com/playlist?list=everytypeexplained\n"
        "• Join our community and vote on next topics in the comments!"
    )
    
    description = above_the_fold + timestamps_section + takeaways_section + ecosystem_section
    
    thumbnail_path = os.path.join(rootDir, "thumbnail.png")
    
    payload = {
        "title": dynamic_title,
        "description": description,
        "tags": dynamic_tags,
        "categoryId": "27",
        "privacyStatus": "public",
        "videoFile": video_path,
        "thumbnailFile": thumbnail_path if os.path.exists(thumbnail_path) else None
    }
    
    try:
        res = client.tools.execute(
            slug="YOUTUBE_MULTIPART_UPLOAD_VIDEO",
            arguments=payload,
            user_id=MY_USER_ID,
            dangerously_skip_version_check=True
        )
        if not res.get("successful"):
            print(f"Upload failed: {res.get('error') or 'Unknown error'}")
            sys.exit(1)
            
        print("Upload success!")
        
        # Set custom thumbnail if available
        response_data_raw = res.get("data", {}).get("video")
        if response_data_raw and os.path.exists(thumbnail_path):
            upload_video_id = response_data_raw.get("id")
            if upload_video_id:
                try:
                    thumb_res = client.tools.execute(
                        slug="YOUTUBE_SET_THUMBNAIL",
                        arguments={
                            "videoId": upload_video_id,
                            "thumbnailFile": thumbnail_path
                        },
                        user_id=MY_USER_ID,
                        dangerously_skip_version_check=True
                    )
                    if thumb_res.get("successful"):
                        print(f"Thumbnail set successfully for video {upload_video_id}")
                    else:
                        print(f"Failed to set thumbnail: {thumb_res.get('error') or 'Unknown error'}")
                except Exception as thumb_err:
                    print(f"Thumbnail upload failed (non-blocking): {thumb_err}")
        
        # Post engaging comment
        response_data = res.get("data", {}).get("video")
        if response_data:
            video_id = response_data.get("id")
            if video_id:
                try:
                    last_id_file = os.path.join(rootDir, "last_video_id.txt")
                    with open(last_id_file, 'w', encoding='utf-8') as f:
                        f.write(video_id)
                    print(f"Saved uploaded video ID ({video_id}) to last_video_id.txt")
                except Exception as e:
                    print(f"Could not save video ID to last_video_id.txt: {e}")
            snippet = response_data.get("snippet", {})
            channel_id = snippet.get("channelId")
            
            if video_id and channel_id:
                num_concepts = len(timing_concepts)
                if num_concepts > 0:
                    comment_text = f"Which of these {num_concepts} concepts do you find most interesting? Let us know below! Subscribe for more!"
                else:
                    comment_text = "Which of the concepts in the video did you find most interesting? Let us know below! Subscribe for more!"
                
                comment_payload = {
                    "videoId": video_id,
                    "channelId": channel_id,
                    "textOriginal": comment_text
                }
                
                print(f"Posting comment: '{comment_text}'")
                comment_res = client.tools.execute(
                    slug="YOUTUBE_POST_COMMENT",
                    arguments=comment_payload,
                    user_id=MY_USER_ID,
                    dangerously_skip_version_check=True
                )
                if comment_res.get("successful"):
                    print("Comment posted successfully!")
                else:
                    print(f"Failed to post comment: {comment_res.get('error') or 'Unknown error'}")
            else:
                print("Could not retrieve video ID or channel ID from response to post comment.")
        else:
            print(f"Could not retrieve response_data from response to post comment. Response: {res}")
            
    except Exception as e:
        print(f"Upload execution error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
