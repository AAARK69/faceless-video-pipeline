/**
 * Phase 3.1: Thumbnail Generation
 *
 * Reads property_data.toon, extracts topic metadata,
 * renders a Remotion Still (Thumbnail composition),
 * and outputs thumbnail.png to the project root.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { decodeTopicData } = require('./toon_utils');

const rootDir = path.dirname(__dirname);
const videoDir = path.join(rootDir, 'video');
const publicDir = path.join(videoDir, 'public');
const propertyToon = path.join(rootDir, 'property_data.toon');

function run() {
    console.log('[Phase 3.1 Thumbnail] Starting thumbnail generation...');

    // 1. Read property_data.toon
    if (!fs.existsSync(propertyToon)) {
        throw new Error(`[Phase 3.1 Thumbnail] property_data.toon not found at: ${propertyToon}`);
    }
    const toonStr = fs.readFileSync(propertyToon, 'utf8');
    const topicData = decodeTopicData(toonStr);

    // 2. Extract metadata
    const topic = topicData.topic || 'Every Type Explained';
    const concepts = topicData.concepts || [];
    const firstConcept = concepts[0] || { emoji: '🎯', color: '#6b21a8' };
    const emoji = firstConcept.emoji || '🎯';
    const accentColor = firstConcept.color || '#6b21a8';
    const conceptNames = concepts.map((c) => c.name).filter(Boolean);

    console.log(`[Phase 3.1 Thumbnail] Topic: "${topic}"`);
    console.log(`[Phase 3.1 Thumbnail] Emoji: ${emoji} | Accent: ${accentColor} | Concepts: ${conceptNames.length}`);

    // 3. Write props JSON
    const props = { topic, emoji, accentColor, conceptNames };
    const propsPath = path.join(publicDir, 'thumbnail_props.json');
    fs.writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
    console.log(`[Phase 3.1 Thumbnail] Wrote props to ${propsPath}`);

    // 4. Render the still using Remotion CLI
    const outputPath = path.join(videoDir, 'thumbnail.png');
    const renderCmd = `PATH=${rootDir}/node-env/bin:$PATH npx remotion still Thumbnail "${outputPath}" --props="${propsPath}"`;
    console.log(`[Phase 3.1 Thumbnail] Running: ${renderCmd}`);

    execSync(renderCmd, { cwd: videoDir, stdio: 'inherit' });

    // 5. Copy to project root
    const finalPath = path.join(rootDir, 'thumbnail.png');
    if (fs.existsSync(outputPath)) {
        fs.copyFileSync(outputPath, finalPath);
        console.log(`[Phase 3.1 Thumbnail] ✅ Thumbnail saved to ${finalPath}`);
    } else {
        throw new Error(`[Phase 3.1 Thumbnail] Render completed but output not found at ${outputPath}`);
    }
}

// Only execute directly if run from CLI
if (require.main === module) {
    run();
}

module.exports = { run };
