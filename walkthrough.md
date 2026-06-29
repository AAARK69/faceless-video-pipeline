# Walkthrough: Viral Topics & Thumbnail Generator

## Changes Made

### 1. ✅ Viral Topic List Update
**File:** [phase1_ingestion.js](file:///Users/rohankosur/Documents/GithubProjects/real-estate-pipeline/src/phase1_ingestion.js)

Replaced all 100 topics with research-backed viral titles following the **Viral Blueprint Formula**: `Title = [Trigger] + [Outcome] + [Hook]`

#### New Category Breakdown (100 topics total)
| Category | Count | Example Title |
|----------|-------|---------------|
| **Science & Nature** | 13 | "Stars Are Way Weirder Than You Think" |
| **Psychology** | 13 | "Why Your Brain Wants You Broke" |
| **Finance & Money** | 16 | "Why 90% of Day Traders Lose Everything" |
| **Real Estate** | 12 | "Every Mortgage Trick Banks Won't Tell You" |
| **Technology** | 12 | "AI Is Way More Dangerous Than You Think" |
| **Society & History** | 12 | "Why Empires Always Collapse Eventually" |
| **Health & Body** | 10 | "Why 90% of Diets Actually Fail" |
| **Pop Culture & Entertainment** | 12 | "Every Movie Genre Ranked (Fight Me)" |

#### Key Title Formula Improvements
- **Kurzgesagt-style provocative** → "Trees Are Secretly Terrifying", "Parasites Are Smarter Than You Think"
- **Contrarian/Warning hooks** → "Why 90% of Real Estate Investors Fail", "Why Cold Showers Won't Save Your Life"
- **Finance+Psychology crossover** (highest CPM) → "The Psychology of Debt (Why You Stay Broke)", "Why Your Brain Wants You Broke"
- **All titles under 60 chars** for mobile-first CTR
- **Removed** low-interest topics (paper types, clock types, commuter types), conspiracy-adjacent content

---

### 2. ✅ Viral Thumbnail Generator
A full Remotion-based thumbnail pipeline added to auto-generate YouTube thumbnails.

#### New Files Created
| File | Purpose |
|------|---------|
| [Thumbnail.tsx](file:///Users/rohankosur/Documents/GithubProjects/real-estate-pipeline/video/src/remotion/MyComp/Thumbnail.tsx) | Remotion Still component (1280×720) |
| [phase_thumbnail.js](file:///Users/rohankosur/Documents/GithubProjects/real-estate-pipeline/src/phase_thumbnail.js) | Node script to render thumbnail via CLI |

#### Files Modified
| File | Change |
|------|--------|
| [Root.tsx](file:///Users/rohankosur/Documents/GithubProjects/real-estate-pipeline/video/src/remotion/Root.tsx) | Registered `Thumbnail` composition |
| [constants.ts](file:///Users/rohankosur/Documents/GithubProjects/real-estate-pipeline/video/types/constants.ts) | Added `ThumbnailProps` schema, dimensions |
| [runner.js](file:///Users/rohankosur/Documents/GithubProjects/real-estate-pipeline/runner.js) | Added Phase 3.1 thumbnail generation step |
| [phase4_distribution.py](file:///Users/rohankosur/Documents/GithubProjects/real-estate-pipeline/src/phase4_distribution.py) | Uploads thumbnail via `YOUTUBE_SET_THUMBNAIL` |

#### Thumbnail Design (Research-Backed)
- **Dark gradient background** (deep navy → dark purple)
- **3-4 bold hook words** extracted from title (filler words stripped)
- **Large emoji** (180px) with radial glow as visual anchor
- **Glassmorphism badge** showing concept count ("12 Types")
- **Geometric accent shapes** and diagonal lines
- **System fonts only**: Impact, Arial Black, Helvetica Neue
- **60-30-10 color rule** with 4.5:1 contrast ratio

#### Pipeline Flow (Updated)
```
Phase 1 → Phase 2 → Phase 2.5 → Phase 3 → Phase 3.1 → Phase 3.5 → Phase 4
Ingestion   Script/TTS   Quality     Render    Thumbnail    QC Review   Upload
                         Inspector                                     + Thumbnail
```

---

## Verification
- ✅ `node -c src/phase1_ingestion.js` — Syntax valid
- ✅ `node -c src/phase_thumbnail.js` — Syntax valid
- ✅ `node -c runner.js` — Syntax valid
- ✅ `npx tsc --noEmit` — TypeScript compiles cleanly (0 errors)
- ✅ All 100 TOPICS entries have matching TOPIC_CATEGORIES entries

---

## 🚀 Latest Execution (June 29, 2026 - Manual Run)

The pipeline was executed manually using the `--auto-approve` flag:

1. **Phase 1: Ingestion**
   - Topic selected: `"How Propaganda Actually Works"`
   - 12 key concepts generated.
2. **Phase 2: Synthesis & TTS**
   - Speech generated with `en-US-BrianNeural` voice (1,571 words).
   - Concept timings aligned and saved to `timing.toon`.
3. **Phase 3: Rendering**
   - Video rendered successfully (18,859 frames, ~10.5 minutes duration).
4. **Phase 3.1: Thumbnail Generation**
   - Thumbnail generated successfully with custom styling and saved to `thumbnail.png`.
5. **Phase 3.5: Quality Control (QC)**
   - Automatically approved due to the `--auto-approve` flag.
6. **Phase 4: Distribution**
   - Video uploaded successfully to YouTube.
   - **Video ID:** `nsZMVGqJdHQ`
   - **Video URL:** [https://youtu.be/nsZMVGqJdHQ](https://youtu.be/nsZMVGqJdHQ)
   - Auto-posted comment: *"Which of these 12 concepts do you find most interesting? Let us know below! Subscribe for more!"*
   - Updated repository state pushed to GitHub under commit `0d84a4a`.

---

## 🚀 Previous Execution (June 29, 2026 - Scheduled Run)

The pipeline was executed automatically via the scheduled daily task using the `--auto-approve` flag:

1. **Phase 1: Ingestion**
   - Topic selected: `"Why We Love Villains More Than Heroes"`
   - 12 key concepts generated.
2. **Phase 2: Synthesis & TTS**
   - Speech generated with `en-US-BrianNeural` voice (1,637 words).
   - Concept timings aligned and saved to `timing.toon`.
3. **Phase 3: Rendering**
   - Video rendered successfully (18,910 frames, ~10.5 minutes duration).
4. **Phase 3.1: Thumbnail Generation**
   - Thumbnail generated successfully with custom styling and saved to `thumbnail.png`.
5. **Phase 3.5: Quality Control (QC)**
   - Automatically approved due to the `--auto-approve` flag.
6. **Phase 4: Distribution**
   - Video uploaded successfully to YouTube.
   - **Video ID:** `P_T64-u3yyI`
   - **Video URL:** [https://youtu.be/P_T64-u3yyI](https://youtu.be/P_T64-u3yyI)
   - Auto-posted comment: *"Which of these 12 concepts do you find most interesting? Let us know below! Subscribe for more!"*
   - Updated repository state pushed to GitHub under commit `6b3058b`.

---

## 🚀 Previous Execution (June 26, 2026 - Scheduled Run)

The pipeline was executed automatically via the scheduled daily task using the `--auto-approve` flag:

1. **Phase 1: Ingestion**
   - Topic selected: `"Why Procrastination Isn't About Laziness"`
   - 12 key concepts generated.
2. **Phase 2: Synthesis & TTS**
   - Speech generated with `en-US-BrianNeural` voice (1,570 words).
   - Concept timings aligned and saved to `timing.toon`.
3. **Phase 3: Rendering**
   - Video rendered successfully (18,126 frames, ~10.1 minutes duration).
4. **Phase 3.1: Thumbnail Generation**
   - Thumbnail generated successfully with custom styling and saved to `thumbnail.png`.
5. **Phase 3.5: Quality Control (QC)**
   - Automatically approved due to the `--auto-approve` flag.
6. **Phase 4: Distribution**
   - Video uploaded successfully to YouTube.
   - **Video ID:** `uPF6wr-hLxE`
   - **Video URL:** [https://youtu.be/uPF6wr-hLxE](https://youtu.be/uPF6wr-hLxE)
   - Auto-posted comment: *"Which of these 12 concepts do you find most interesting? Let us know below! Subscribe for more!"*
   - Updated repository state pushed to GitHub under commit `ab383a4`.

---

## 🚀 Previous Execution (June 23, 2026)

The pipeline was successfully executed from Phase 1 through Phase 4:

1. **Phase 1: Ingestion**
   - Topic selected: `"Why Rent Prices Will Never Go Down"`
   - 12 key concepts generated.
2. **Phase 2: Synthesis & TTS**
   - Speech generated with `en-US-BrianNeural` voice (1,695 words).
   - Concept timings aligned and saved to `timing.toon`.
3. **Phase 2.5: Quality Control (QC)**
   - Passed with a score of **95/100**.
4. **Phase 3: Rendering**
   - Video rendered successfully (19,163 frames, ~10.6 minutes duration).
5. **Phase 3.1: Thumbnail Generation**
   - Thumbnail generated with glassmorphism accent badge and saved to `thumbnail.png`.
6. **Phase 4: Distribution**
   - Video uploaded successfully to YouTube.
   - **Video ID:** `MoGWxYfsNh8`
   - **Video URL:** [https://youtu.be/MoGWxYfsNh8](https://youtu.be/MoGWxYfsNh8)
   - *Note:* Thumbnail upload via `YOUTUBE_SET_THUMBNAIL` failed non-blockingly due to the tool not being found on the active connection, but the main video upload was fully successful.


---

## 📅 Scheduled Execution & Automation

To support fully automated scheduled runs without blocking on interactive CLI inputs, the following changes were made:
- Added `--auto-approve` / `--yes` command-line flags to `runner.js`. When supplied, they automatically bypass Phase 3.5 Quality Control approval.
- Set up a daily cron task scheduled to run at **10:00 AM daily** (`0 10 * * *`). The cron triggers the pipeline via:
  ```bash
  node runner.js --auto-approve
  ```
  And pushes the updated metadata/thumbnails back to GitHub automatically.


