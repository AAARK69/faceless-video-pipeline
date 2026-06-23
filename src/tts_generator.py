import os
import sys
import asyncio
import edge_tts
import ssl
import re
import json

# Bypass macOS Python SSL certificate verification error
ssl._create_default_https_context = ssl._create_unverified_context

from toon_utils import decode_topic_data, encode_timing_with_concepts

async def generate_speech_and_timings(text, output_file, voice="en-US-BrianNeural"):
    """
    Synthesizes speech from text using edge-tts with word boundaries,
    and returns the word timings. Then normalizes and resamples using ffmpeg.
    With robust retries and timeouts for network resilience.
    """
    import subprocess
    print(f"Synthesizing speech with voice {voice} (word boundaries enabled)...")
    
    raw_output_file = output_file + ".raw.mp3"
    words_data = []
    
    # Try up to 3 times to download and capture stream
    for attempt in range(1, 4):
        print(f"TTS stream download attempt {attempt}/3...")
        if os.path.exists(raw_output_file):
            try:
                os.remove(raw_output_file)
            except Exception:
                pass
            
        words_data = []
        try:
            communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
            
            # Use asyncio.wait_for around the stream loop to prevent hangs
            async def run_stream():
                with open(raw_output_file, "wb") as f:
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            f.write(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            start_sec = chunk["offset"] / 10000000.0
                            duration_sec = chunk["duration"] / 10000000.0
                            words_data.append({
                                "word": chunk["text"],
                                "start": round(start_sec, 3),
                                "end": round(start_sec + duration_sec, 3)
                            })
            
            await asyncio.wait_for(run_stream(), timeout=600.0)
            print("TTS download and timing capture completed successfully.")
            break
        except asyncio.TimeoutError:
            print(f"Warning: TTS stream timed out on attempt {attempt}.")
            if attempt == 3:
                raise RuntimeError("Failed to stream speech audio: connection timed out 3 times.")
        except Exception as e:
            print(f"Warning: TTS stream failed on attempt {attempt}: {e}")
            if attempt == 3:
                raise e
            await asyncio.sleep(2)
            
    # Process audio with ffmpeg: convert to 44100Hz, stereo, normalize volume (loudnorm)
    print("Processing voiceover through ffmpeg for broadcast quality...")
    try:
        # Use local node-env bin path or system path for ffmpeg
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", raw_output_file,
            "-ar", "44100", "-ac", "2",
            "-filter:a", "volume=1.8,loudnorm=I=-16:LRA=11:TP=-1.5",
            output_file
        ]
        
        # Merge local bin directory into PATH
        rootDir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        binDir = os.path.join(rootDir, "node-env", "bin")
        env = {**os.environ}
        env["PATH"] = f"{binDir}:{env.get('PATH', '')}"
        
        subprocess.run(ffmpeg_cmd, env=env, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"Speech saved and normalized to {output_file}")
    except Exception as e:
        print(f"Ffmpeg post-processing failed, using raw output instead: {e}")
        import shutil
        shutil.copyfile(raw_output_file, output_file)
    finally:
        if os.path.exists(raw_output_file):
            try:
                os.remove(raw_output_file)
            except Exception:
                pass
                
    return words_data

def clean_word(w):
    """Clean a string for matching."""
    return re.sub(r'[^\w]', '', w.lower()).strip()

def align_concepts(words_data, concepts):
    """
    Finds the start and end timestamp of each concept's description
    within the transcribed word list using a sliding window match.
    """
    print("Aligning concepts to transcript...")
    aligned_concepts = []
    
    # Pre-clean transcript words for faster lookup
    clean_trans_words = [clean_word(w['word']) for w in words_data]
    
    # We will search sequentially to avoid backward overlaps
    current_search_start_idx = 0
    
    for c in concepts:
        name = c['name']
        desc = c['description']
        
        # Reconstruct plain text narration if stored as a JSON scenes list
        try:
            scenes = json.loads(desc)
            if isinstance(scenes, list):
                desc_text = " ".join([s.get('text', '') for s in scenes])
            else:
                desc_text = desc
        except Exception:
            desc_text = desc
            
        # Clean target words to search for
        target_words = [clean_word(w) for w in desc_text.split() if clean_word(w)]
        if not target_words:
            aligned_concepts.append({"name": name, "start": 0.0, "end": 0.0})
            continue
            
        best_match_idx = -1
        best_match_score = 0
        best_match_len = 0
        
        # Search range: from current index up to a local window around the expected segment length
        # (optimized to avoid scanning all the way to the end of the 1500+ word transcript)
        window_size = len(target_words)
        search_range_end = min(len(clean_trans_words), current_search_start_idx + window_size + 50)
        
        # We try slight variations in window size (+/- 5 words) to find the best match segment
        for w_len in range(max(1, window_size - 5), window_size + 6):
            for i in range(current_search_start_idx, search_range_end - w_len + 1):
                sub_window = clean_trans_words[i : i + w_len]
                # Calculate match score (intersection / sequence match)
                matches = 0
                for j in range(min(w_len, len(target_words))):
                    if sub_window[j] == target_words[j]:
                        matches += 1
                if matches > best_match_score:
                    best_match_score = matches
                    best_match_idx = i
                    best_match_len = w_len
                    
        # If we found a reasonable match (at least 35% overlap)
        if best_match_score >= max(1, int(len(target_words) * 0.35)):
            start_time = words_data[best_match_idx]['start']
            end_time = words_data[best_match_idx + best_match_len - 1]['end']
            
            # Update search pointer so next concept starts after this one
            current_search_start_idx = best_match_idx + best_match_len
            
            aligned_concepts.append({
                "name": name,
                "start": start_time,
                "end": end_time
            })
            print(f"  Aligned concept '{name}': {start_time}s -> {end_time}s (Match Score: {best_match_score}/{len(target_words)})")
        else:
            # Fallback estimation if match is poor
            fallback_start = words_data[min(current_search_start_idx, len(words_data)-1)]['start'] if words_data else 0.0
            # Assume 8 seconds duration
            fallback_end = fallback_start + 8.0
            aligned_concepts.append({
                "name": name,
                "start": fallback_start,
                "end": fallback_end
            })
            print(f"  Warning: Poor match for '{name}'. Using fallback timeline: {fallback_start}s -> {fallback_end}s")
            # Update index slightly
            if words_data:
                # Find word closest to fallback_end
                for idx, w in enumerate(words_data):
                    if w['start'] >= fallback_end:
                        current_search_start_idx = idx
                        break
                        
    return aligned_concepts

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 tts_generator.py <script_file_or_text>")
        sys.exit(1)
        
    script_arg = sys.argv[1]
    
    # Check if arg is a file or direct text
    if os.path.exists(script_arg):
        with open(script_arg, 'r', encoding='utf-8') as f:
            text = f.read()
    else:
        text = script_arg
        
    text = text.strip()
    print(f"Script Text:\n{text}\n")
    
    rootDir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    voice_mp3 = os.path.join(rootDir, "voice.mp3")
    timing_toon = os.path.join(rootDir, "timing.toon")
    property_toon = os.path.join(rootDir, "property_data.toon")
    
    # Run async TTS and timing capture
    words_data = asyncio.run(generate_speech_and_timings(text, voice_mp3))
    
    print(f"Captured {len(words_data)} word timings natively from Edge-TTS stream.")
    
    # Read concepts from property_data.toon (which stores the topic data)
    concepts = []
    if os.path.exists(property_toon):
        try:
            with open(property_toon, 'r', encoding='utf-8') as f:
                topic_data = decode_topic_data(f.read())
                concepts = topic_data.get('concepts', [])
        except Exception as e:
            print(f"Error decoding topic data: {e}")
            
    # Align concepts
    aligned_concepts = align_concepts(words_data, concepts)
    
    # Save as timing.toon with both sections
    toon_output = encode_timing_with_concepts(aligned_concepts, words_data)
    with open(timing_toon, 'w', encoding='utf-8') as f:
        f.write(toon_output)
    print(f"Timing with aligned concepts saved to {timing_toon}")
    
    print("TTS and Concept Alignment completed successfully!")

if __name__ == "__main__":
    main()
