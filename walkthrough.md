# Walkthrough: Long-Form 10-Minute Video Pivot & High-Information-Density Scripting

We have successfully transitioned the explainer video pipeline to generate widescreen, high-information-density videos around the **10-13 minute mark**. All Quality Inspector blockages have been resolved, and a complete end-to-end run has successfully published the new long-form content to YouTube.

---

## 🛠️ Changes Implemented

### 1. Extended Prompt & Length Enforcements (`runner.js`)
* **Prompt Overhaul**: Configured the Gemini and Claude script generation prompts to explicitly target 5–6 detailed sentences (110–120 words) per concept, utilizing concrete examples, mechanisms, and real-world impacts. Enforced a minimum total script word count of **1,500 words** (resulting in a 10–13 minute narration).
* **Dual-Pass Preservation**: Fixed a critical bug in the dual-pass editor prompt (`runDualPassEdit`) which was previously stripping the explanations back down to 1–2 sentences. It now preserves the comprehensive 110–120 word explanations.

### 2. High Quality Standards (`src/quality_inspector.js`)
* **Validation Bounds**: Raised `MIN_CONCEPT_WORDS` to **110 words** and `MIN_TOTAL_SCRIPT_WORDS` to **1,500 words** to guarantee high quality and prevent short or AI-like generic placeholders from bypassing the inspector.

### 3. Model Upgrades for Quota Reliability (`runner.js` & `src/phase1_ingestion.js`)
* **Model Migration**: Migrated all Gemini endpoints from the exhausted `gemini-2.0-flash` free-tier quota to the newer and highly capable `gemini-2.5-flash` model, ensuring complete API availability and reliability.

### 4. Dynamic Description Duration (`src/phase4_distribution.py`)
* **Metadata Adjustments**: Removed a redundant hardcoded `dynamic_title` reference at line 96.
* **Smart Descriptions**: Updated the "above the fold" description builder to dynamically inject the video duration (e.g. `in under 13 minutes`) rather than using a hardcoded `under 3 minutes` disclaimer, matching the actual video length.

---

## 📈 Successful Verification Run

We ran the pipeline end-to-end to verify the changes:
1. **Topic Ingestion**: Selected the next chronological topic: **"Every Type of Computer Virus Explained"** (Index: 15).
2. **Concept & Script Synthesis**: Synthesized 12 detailed concepts and a comprehensive script (total length: 12,865 characters / ~2,000 words).
3. **Voiceover & Alignment**: Generated high-fidelity voiceover using `edge-tts` and aligned timestamps using Whisper (tiny). Aligned segments:
   * *Classic Virus*: 1.9s -> 14.7s
   * *Network Worm*: 15.2s -> 26.2s
   * *Trojan Malware*: 27.0s -> 38.2s
   * *Ransom Demands*: 39.5s -> 50.3s
   * ... and so on for all 12 concepts.
4. **Quality Gate**: Passed the Quality Inspector with flying colors (Score: **100/100**).
5. **Remotion Render**: Rendered a total of **23,538 frames (~13.07 minutes)** successfully.
6. **Publishing & Engagement**: Uploaded the 86.8 MB widescreen video to YouTube and pinned the interactive engagement comment.

### 5. YouTube Analytics MCP Error Fix (`src/phase5_analytics.py` & `src/phase4_distribution.py`)
* **Tool Swapping**: Replaced the unsupported `YOUTUBE_REPORTS_QUERY` tool call (which returned 404 since YouTube Analytics reporting is not part of the standard Composio YouTube toolkit) with the fully supported `YOUTUBE_GET_VIDEO_DETAILS_BATCH` action.
* **Duration Parsing & Heuristics**: Added an ISO 8601 duration parser (e.g., `PT3M34S` -> 214 seconds) to extract exact video lengths. Designed a heuristic-based retention estimator leveraging the `likes / views` ratio to feed retention scores back into the topic rotation algorithm.
* **Seamless Automation**: Updated `src/phase4_distribution.py` to write the newly uploaded video's ID to `last_video_id.txt` automatically. The analytics feedback loop can now run directly without manual video ID inputs.

## 🚀 Successful Execution Runs

### Run 1: Bridge Architecture
We executed the pipeline end-to-end:
1. **Topic Ingestion**: Selected **"Every Type of Bridge Architecture Explained"** (Technology category).
2. **Concept & Script Synthesis**: Generated detailed whiteboard explanation concepts and script.
3. **Voiceover & Alignment**: Aligned TTS audio with Whisper timestamps.
4. **Remotion Render**: Rendered a total of **18,096 frames** (widescreen 68.8 MB video) successfully.
5. **Human-in-the-Loop Quality Control**: Approved rendering step.
6. **Distribution**: Uploaded video to YouTube, automatically wrote video ID `96wXqh2F-Rs` to `last_video_id.txt`, and posted the engaging comment successfully via the Composio SDK.
7. **Analytics Feedback Loop**: Successfully ran `python3 src/phase5_analytics.py` to fetch video details from the Composio YouTube Data API, estimate retention metrics, and update `topic_performance.json`.

### Run 2: Financial Concepts (Custom Topic)
Following user request, we executed the pipeline on a custom topic:
1. **Topic Ingestion**: Selected **"Every Type of Financial Concept Explained"** (which includes calls/puts, debits, credits, and other finance stuff).
2. **Dynamic Concept Generation**: Extracted 12 detailed financial concepts (e.g., Call Options, Put Options, Debits, Credits, Equities, Bonds, Derivatives, etc.) dynamically.
3. **Voiceover & Alignment**: Aligned TTS audio narration with Whisper timestamps.
4. **Remotion Render**: Rendered a total of **18,096 frames** (widescreen 68.7 MB video) successfully.
5. **Human-in-the-Loop Quality Control**: Approved rendering step.
6. **Distribution**: Uploaded video to YouTube, automatically wrote video ID `8wv6tCCi9v4` to `last_video_id.txt`, and posted the engaging comment successfully via the Composio SDK.
7. **Analytics Feedback Loop**: Successfully ran `python3 src/phase5_analytics.py` to fetch video details from the Composio YouTube Data API, estimate retention metrics, and update `topic_performance.json`.
