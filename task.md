# Checklist: Paint Explainer Style Pivot & Video Execution

- `[x]` Support `--skip-ingestion` flag in `runner.js`
- `[x]` Install/use `"Comic Neue"` font from `@remotion/google-fonts` in `Main.tsx`
- `[x]` Design and implement SVG icons for the 14 concept badges in `Main.tsx`
- `[x]` Design and implement SVG stick-figure illustrations for the 14 humor concepts in `Main.tsx` (with fallback illustration)
- `[x]` Update layout transitions in `Main.tsx` (fullscreen 5x3 grid for intro/outro vs explanation detail view)
- `[x]` Style subtitles and active badge positioning in explanation view of `Main.tsx`
- `[x]` Run end-to-end pipeline using `node runner.js --skip-ingestion`
- `[x]` Verify that video renders successfully and review result
- `[x]` Support dynamic topic brainstorming via Gemini API in `phase1_ingestion.js`
- `[x]` Expand the baseline rotating fallback topics list in `phase1_ingestion.js`
- `[x]` Configure selective `script.json` override to allow dynamic script synthesis in regular runs
- `[x]` Cancel the single daily runner schedule and schedule 3-daily cron triggers at optimal times (10 AM, 2 PM, 6 PM)

## Phase 2 Upgrades: Light Theme, Animated Presenter, & Expanded Topics

- `[x]` Implement whiteboard light theme with dotted grid paper background (`Main.tsx`)
- `[x]` Create vector SVG `<Stickman>` presenter component with dynamic bobbing and 4 poses (pointing, celebrating, thinking, idea) (`Main.tsx`)
- `[x]` Update explanation detail layout to side-by-side design: badge on left, presenter on right (`Main.tsx`)
- `[x]` Integrate the 100 topics from user request into topic list (`phase1_ingestion.js`)
- `[x]` Update ingestion prompt to target chosen rotation topic, and code local fallback concept generator (`phase1_ingestion.js`)
- `[x]` Execute validation run on topic "Every Type of Weather Phenomenon Explained" and verify YouTube publishing

