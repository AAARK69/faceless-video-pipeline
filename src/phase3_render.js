const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { decodeTopicData, decodeTimingWithConcepts } = require('./toon_utils');

function run() {
    console.log("[Phase 3 Render] Starting explainer video rendering process...");
    
    const rootDir = path.join(__dirname, '..');
    const propertyToonPath = path.join(rootDir, 'property_data.toon');
    const timingToonPath = path.join(rootDir, 'timing.toon');
    const voiceMp3Path = path.join(rootDir, 'voice.mp3');
    
    if (!fs.existsSync(propertyToonPath) || !fs.existsSync(timingToonPath) || !fs.existsSync(voiceMp3Path)) {
        throw new Error("Missing required phase inputs: property_data.toon (topic_data.toon), timing.toon, or voice.mp3");
    }
    
    // 1. Read and parse TOON files
    console.log("[Phase 3 Render] Parsing TOON files...");
    const topicData = decodeTopicData(fs.readFileSync(propertyToonPath, 'utf8'));
    const timingData = decodeTimingWithConcepts(fs.readFileSync(timingToonPath, 'utf8'));
    
    console.log(`[Phase 3 Render] Concept count: ${topicData.concepts.length}`);
    console.log(`[Phase 3 Render] Aligned concept timings: ${timingData.concepts.length}`);
    console.log(`[Phase 3 Render] Transcript word count: ${timingData.words.length}`);
    
    // 2. Query audio duration using ffprobe
    console.log("[Phase 3 Render] Querying voice.mp3 duration using ffprobe...");
    const ffprobeCmd = `PATH=${rootDir}/node-env/bin:$PATH ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceMp3Path}"`;
    let durationSeconds = 120.0;
    try {
        const stdout = execSync(ffprobeCmd).toString().trim();
        durationSeconds = parseFloat(stdout);
        console.log(`[Phase 3 Render] Audio duration: ${durationSeconds} seconds`);
    } catch (err) {
        console.warn("[Phase 3 Render] Failed to query duration using ffprobe, defaulting to 120.0 seconds.", err.message);
    }
    
    const fps = 30;
    const durationInFrames = Math.ceil(durationSeconds * fps);
    console.log(`[Phase 3 Render] Video frames to render: ${durationInFrames} (${durationInFrames / fps}s)`);
    
    // 3. Copy voice.mp3 into the Remotion public directory
    const publicDir = path.join(rootDir, 'video/public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const destVoicePath = path.join(publicDir, 'voice.mp3');
    fs.copyFileSync(voiceMp3Path, destVoicePath);
    console.log(`[Phase 3 Render] Copied audio to ${destVoicePath}`);

    // 3.5. Ensure bgm.mp3 and click.mp3 are present in public directory
    const bgmPath = path.join(publicDir, 'bgm.mp3');
    const clickPath = path.join(publicDir, 'click.mp3');
    if (!fs.existsSync(bgmPath)) {
        console.log("[Phase 3 Render] Downloading missing bgm.mp3...");
        try {
            execSync(`curl -sL -o "${bgmPath}" https://archive.org/download/DWK312/Centz_-_10_-_Memory_Box.mp3`);
            console.log("[Phase 3 Render] Downloaded bgm.mp3 successfully.");
        } catch (e) {
            console.warn("[Phase 3 Render] Failed to download bgm.mp3 automatically:", e.message);
        }
    }
    if (!fs.existsSync(clickPath)) {
        console.log("[Phase 3 Render] Downloading missing click.mp3...");
        try {
            execSync(`curl -sL -o "${clickPath}" https://raw.githubusercontent.com/IonDen/ion.sound/master/sounds/button_click.mp3`);
            console.log("[Phase 3 Render] Downloaded click.mp3 successfully.");
        } catch (e) {
            console.warn("[Phase 3 Render] Failed to download click.mp3 automatically:", e.message);
        }
    }
    
    // 4. Combine concept timings with concept details (emoji, color, description)
    const items = timingData.concepts.map(tc => {
        const matchingConcept = topicData.concepts.find(c => c.name.toLowerCase() === tc.name.toLowerCase()) || {};
        return {
            name: tc.name,
            start: tc.start,
            end: tc.end,
            emoji: matchingConcept.emoji || "💡",
            color: matchingConcept.color || "#3b82f6",
            description: matchingConcept.description || ""
        };
    });
    
    // 5. Create inputs JSON for Remotion hydration
    const inputs = {
        topic: topicData.topic,
        items: items,
        audioUrl: "/voice.mp3",
        bgmUrl: "/bgm.mp3",
        sfxUrl: "/click.mp3",
        words: timingData.words
    };
    
    const inputsJsonPath = path.join(publicDir, 'inputs.json');
    fs.writeFileSync(inputsJsonPath, JSON.stringify(inputs, null, 2), 'utf8');
    console.log(`[Phase 3 Render] Wrote inputs JSON to ${inputsJsonPath}`);
    
    // 6. Run headless Remotion render command
    console.log("[Phase 3 Render] Executing Remotion headless render...");
    const outputVideoPath = path.join(rootDir, 'final_video.mp4');
    
    // Execute remotion render using the local Node binary path
    const renderCmd = `PATH=${rootDir}/node-env/bin:$PATH npx remotion render MyComp "${outputVideoPath}" --props="${inputsJsonPath}" --duration=${durationInFrames}`;
    console.log(`[Phase 3 Render] Running: ${renderCmd}`);
    
    try {
        execSync(renderCmd, { 
            cwd: path.join(rootDir, 'video'),
            stdio: 'inherit' 
        });
        console.log(`[Phase 3 Render] Video rendered successfully: ${outputVideoPath}`);
    } catch (err) {
        console.error("[Phase 3 Render] Remotion render execution failed!", err);
        throw err;
    }
}

// Only execute directly if run from CLI
if (require.main === module) {
    run();
}

module.exports = { run };
