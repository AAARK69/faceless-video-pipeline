import os
import sys
import asyncio
import edge_tts
import ssl
import re

# Bypass macOS Python SSL certificate verification error
ssl._create_default_https_context = ssl._create_unverified_context

import whisper_timestamped as whisper
from toon_utils import decode_topic_data, encode_timing_with_concepts

async def generate_speech(text, output_file, voice="en-US-BrianNeural"):
    """
    Synthesizes speech from text using edge-tts.
    """
    print(f"Synthesizing speech with voice {voice}...")
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)
    print(f"Speech saved to {output_file}")

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
        
        # Clean target words to search for
        target_words = [clean_word(w) for w in desc.split() if clean_word(w)]
        if not target_words:
            aligned_concepts.append({"name": name, "start": 0.0, "end": 0.0})
            continue
            
        best_match_idx = -1
        best_match_score = 0
        best_match_len = 0
        
        # We slide a window of size similar to target_words starting from current_search_start_idx
        window_size = len(target_words)
        # Search range: from current index up to the end of the audio track
        search_range_end = len(clean_trans_words)
        
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

def transcribe_speech(audio_file, output_toon_file, property_toon_file):
    """
    Transcribes audio using whisper-timestamped to get word-level timestamps,
    then aligns concepts to the audio track.
    """
    print("Loading whisper model (tiny)...")
    model = whisper.load_model("tiny", device="cpu")
    
    print("Transcribing audio for word-level timestamps...")
    audio = whisper.load_audio(audio_file)
    result = whisper.transcribe(model, audio, language="en")
    
    words_data = []
    for segment in result.get('segments', []):
        for w in segment.get('words', []):
            words_data.append({
                "word": w['text'].strip(),
                "start": round(w['start'], 3),
                "end": round(w['end'], 3)
            })
            
    print(f"Extracted {len(words_data)} words with timestamps.")
    
    # Read concepts from property_data.toon (which stores the topic data)
    concepts = []
    if os.path.exists(property_toon_file):
        try:
            with open(property_toon_file, 'r', encoding='utf-8') as f:
                topic_data = decode_topic_data(f.read())
                concepts = topic_data.get('concepts', [])
        except Exception as e:
            print(f"Error decoding topic data: {e}")
            
    # Align concepts
    aligned_concepts = align_concepts(words_data, concepts)
    
    # Save as timing.toon with both sections
    toon_output = encode_timing_with_concepts(aligned_concepts, words_data)
    with open(output_toon_file, 'w', encoding='utf-8') as f:
        f.write(toon_output)
    print(f"Timing with aligned concepts saved to {output_toon_file}")

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
    
    # Run async TTS
    asyncio.run(generate_speech(text, voice_mp3))
    
    # Run whisper alignment
    transcribe_speech(voice_mp3, timing_toon, property_toon)
    
    print("TTS and Concept Alignment completed successfully!")

if __name__ == "__main__":
    main()
