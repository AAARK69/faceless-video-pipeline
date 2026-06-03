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
        
    # Generate metadata
    timing_concepts = []
    if os.path.exists(timing_toon):
        with open(timing_toon, 'r', encoding='utf-8') as f:
            timing_data = decode_timing_with_concepts(f.read())
            timing_concepts = timing_data.get('concepts', [])
    
    desc_lines = ["TIMESTAMPS:", "00:00 - Introduction"]
    for c in timing_concepts:
        desc_lines.append(f"{format_timestamp(c.get('start', 0.0))} - {c.get('name', '')}")
    description = "\n".join(desc_lines)
    
    payload = {
        "title": "Every Type of Humor Explained in under 3 minutes! 🧠",
        "description": description,
        "tags": ["education", "explanation", "psychology", "concept", "logic"],
        "categoryId": "27",
        "privacyStatus": "public",
        "videoFile": video_path
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
        
        # Post engaging comment
        response_data = res.get("data", {}).get("video")
        if response_data:
            video_id = response_data.get("id")
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
