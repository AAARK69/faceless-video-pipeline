const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { decodeTopicData, encodeTopicData } = require('./src/toon_utils');

// Helper to load local .env file
function loadEnv(rootDir) {
    const envFile = path.join(rootDir, '.env');
    if (fs.existsSync(envFile)) {
        try {
            const content = fs.readFileSync(envFile, 'utf8');
            for (const line of content.split('\n')) {
                const stripped = line.trim();
                if (!stripped || stripped.startsWith('#')) continue;
                const match = stripped.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let val = match[2].trim();
                    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
                    process.env[key] = val;
                }
            }
            console.log("[Pipeline Runner] Loaded environment variables from .env");
        } catch (e) {
            console.error(`[Pipeline Runner] Error loading .env: ${e.message}`);
        }
    }
}

async function generateScriptWithGemini(apiKey, propertyData) {
    console.log("[Phase 2 Synthesis] Generating script via Gemini API...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // Load algorithm strategy rules if present
    let algoStrategy = "";
    const strategyPath = path.join(__dirname, 'algorithm_strategy.md');
    if (fs.existsSync(strategyPath)) {
        try {
            algoStrategy = fs.readFileSync(strategyPath, 'utf8').trim();
            console.log("[Phase 2 Synthesis] Loaded algorithm_strategy.md successfully for Gemini.");
        } catch (e) {
            console.error(`[Phase 2 Synthesis] Error reading algorithm_strategy.md: ${e.message}`);
        }
    }

    const conceptsStr = propertyData.concepts.map((c, i) => `${i+1}. ${c.name}: ${c.description}`).join('\n');
    let prompt = `Write a highly engaging, conversational narration script for a widescreen YouTube video titled: "${propertyData.topic}".
Here are the 12 concepts to explain:
${conceptsStr}

Requirements:
1. Write a 5-second curiosity gap hook intro.
2. For each concept, write a conversational 1-2 sentence explanation script based on the description provided. Keep it natural and engaging (8th-grade reading level).
3. Write a brief call-to-action outro.`;

    if (algoStrategy) {
        prompt += `\n\nAdditional Retention and Algorithm Guidelines (YOU MUST STRICTLY FOLLOW THESE):\n${algoStrategy}`;
    }

    prompt += `\n\nOutput the result strictly as a raw JSON object matching the structure below. Do NOT add any extra markdown wraps, code blocks, or comments.
{
  "intro": "Intro text here...",
  "concepts": {
    ${propertyData.concepts.map(c => `"${c.name}": "Explanation here"`).join(',\n    ')}
  },
  "outro": "Outro text here..."
}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const resJson = await response.json();
    const text = resJson.candidates[0].content.parts[0].text.trim();
    return JSON.parse(text);
}

async function generateScriptWithClaude(apiKey, propertyData) {
    console.log("[Phase 2 Synthesis] Generating script via Claude 4.6 (Thinking) API...");
    const url = "https://api.anthropic.com/v1/messages";
    
    // Load algorithm strategy rules if present
    let algoStrategy = "";
    const strategyPath = path.join(__dirname, 'algorithm_strategy.md');
    if (fs.existsSync(strategyPath)) {
        try {
            algoStrategy = fs.readFileSync(strategyPath, 'utf8').trim();
            console.log("[Phase 2 Synthesis] Loaded algorithm_strategy.md successfully for Claude.");
        } catch (e) {
            console.error(`[Phase 2 Synthesis] Error reading algorithm_strategy.md: ${e.message}`);
        }
    }

    const conceptsStr = propertyData.concepts.map((c, i) => `${i+1}. ${c.name}: ${c.description}`).join('\n');
    let prompt = `Write a highly engaging, conversational narration script for a widescreen YouTube video titled: "${propertyData.topic}".
Here are the 12 concepts to explain:
${conceptsStr}

Requirements:
1. Write a 5-second curiosity gap hook intro.
2. For each concept, write a conversational 1-2 sentence explanation script based on the description provided. Keep it natural and engaging (8th-grade reading level).
3. Write a brief call-to-action outro.`;

    if (algoStrategy) {
        prompt += `\n\nAdditional Retention and Algorithm Guidelines (YOU MUST STRICTLY FOLLOW THESE):\n${algoStrategy}`;
    }

    prompt += `\n\nOutput the result strictly as a raw JSON object matching the structure below. Do NOT wrap it in markdown code blocks like \`\`\`json. Output ONLY the raw JSON string.
{
  "intro": "Intro text here...",
  "concepts": {
    ${propertyData.concepts.map(c => `"${c.name}": "Explanation here"`).join(',\n    ')}
  },
  "outro": "Outro text here..."
}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model: "claude-3-5-sonnet-20260602" || "claude-3-5-sonnet-20241022",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
    }

    const resJson = await response.json();
    const text = resJson.content[0].text.trim();
    // Clean potential markdown blocks if Claude wraps it anyway
    const cleanedText = text.replace(/^```json/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanedText);
}

async function main() {
    console.log("================================================================================");
    console.log(`[Pipeline Runner] Explainer Pipeline Execution Started: ${new Date().toISOString()}`);
    console.log("================================================================================");
    
    const rootDir = __dirname;
    const binDir = path.join(rootDir, 'node-env/bin');
    const envPath = `PATH=${binDir}:$PATH`;
    
    loadEnv(rootDir);
    
    try {
        // --- PHASE 1: INGESTION ---
        console.log("\n--- PHASE 1: INGESTION ---");
        if (process.argv.includes('--skip-ingestion')) {
            console.log("[Phase 1 Ingestion] Skipped due to --skip-ingestion flag.");
        } else {
            const ingestionCmd = `node src/phase1_ingestion.js`;
            console.log(`Running Ingestion: ${ingestionCmd}`);
            execSync(ingestionCmd, { stdio: 'inherit', cwd: rootDir, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` } });
        }
        
        const propertyToonPath = path.join(rootDir, 'property_data.toon');
        if (!fs.existsSync(propertyToonPath)) {
            throw new Error("Ingestion completed but property_data.toon was not created.");
        }
        
        const propertyContent = fs.readFileSync(propertyToonPath, 'utf8');
        const propertyData = decodeTopicData(propertyContent);
        console.log(`Parsed Ingested Topic: "${propertyData.topic}" with ${propertyData.concepts.length} concepts.`);
        
        // --- PHASE 2: SYNTHESIS & TTS ---
        console.log("\n--- PHASE 2: SYNTHESIS & TTS ---");
        let scriptObj = null;
        
        // 1. Try to read script.json if provided as manual override for custom runs
        const localScriptJsonPath = path.join(rootDir, 'script.json');
        if (process.argv.includes('--skip-ingestion') && fs.existsSync(localScriptJsonPath)) {
            console.log("[Phase 2 Synthesis] Found local script.json with --skip-ingestion. Using it as override.");
            scriptObj = JSON.parse(fs.readFileSync(localScriptJsonPath, 'utf8'));
        } 
        // 2. Try Claude API (as required by system constraints)
        else if (process.env.ANTHROPIC_API_KEY) {
            scriptObj = await generateScriptWithClaude(process.env.ANTHROPIC_API_KEY, propertyData);
        }
        // 3. Try Gemini API
        else if (process.env.GEMINI_API_KEY) {
            scriptObj = await generateScriptWithGemini(process.env.GEMINI_API_KEY, propertyData);
        }
        // 4. Default dynamic template fallback
        else {
            console.log("[Phase 2 Synthesis] No API keys or script.json found. Generating fallback template script.");
            scriptObj = {
                intro: `Welcome! Today we are explaining every single concept of: ${propertyData.topic}. Let's begin.`,
                concepts: {},
                outro: "Which one of these concepts was your favorite? Let us know in the comments below!"
            };
            propertyData.concepts.forEach((c, idx) => {
                scriptObj.concepts[c.name] = `Number ${idx + 1}, ${c.name}. ${c.description}`;
            });
        }
        
        // Save the generated script object to script.json for reference/logging
        fs.writeFileSync(localScriptJsonPath, JSON.stringify(scriptObj, null, 2), 'utf8');
        
        // Build the combined spoken text for the TTS audio generator
        // Ensure clear sentence boundaries between parts for natural pauses
        const scriptParts = [];
        scriptParts.push(scriptObj.intro);
        
        // Match synthesized scripts back to concepts list in propertyData
        propertyData.concepts.forEach(c => {
            const narratedScript = scriptObj.concepts[c.name] || `Next, ${c.name}. ${c.description}`;
            c.description = narratedScript; // update description with the actual narrated text
            scriptParts.push(narratedScript);
        });
        
        scriptParts.push(scriptObj.outro);
        // Strip trailing punctuation, then rejoin with ". " to create distinct sentence-boundary pauses
        const cleanedParts = scriptParts.map(p => p.trim().replace(/[.!?,;:]+$/, ''));
        const fullScriptText = cleanedParts.join('. ') + '.';
        
        // Write the updated property_data.toon with the actual narrated scripts
        // (so that tts_generator.py can use them for exact alignment!)
        const updatedToon = encodeTopicData(propertyData);
        fs.writeFileSync(propertyToonPath, updatedToon, 'utf8');
        
        console.log(`[Phase 2 Synthesis] Final Script Narration Length: ${fullScriptText.length} chars.`);
        
        // Run TTS Generator
        const ttsCmd = `${envPath} python3 src/tts_generator.py "${fullScriptText.replace(/"/g, '\\"')}"`;
        console.log(`Running TTS: ${ttsCmd}`);
        execSync(ttsCmd, { stdio: 'inherit', cwd: rootDir });
        
        // Verify TTS Outputs
        if (!fs.existsSync(path.join(rootDir, 'voice.mp3')) || !fs.existsSync(path.join(rootDir, 'timing.toon'))) {
            throw new Error("TTS generation failed to produce voice.mp3 or timing.toon.");
        }
        
        // --- PHASE 3: RENDERING ---
        console.log("\n--- PHASE 3: RENDERING ---");
        const renderCmd = `${envPath} node src/phase3_render.js`;
        console.log(`Running Renderer: ${renderCmd}`);
        execSync(renderCmd, { stdio: 'inherit', cwd: rootDir });
        
        if (!fs.existsSync(path.join(rootDir, 'final_video.mp4'))) {
            throw new Error("Render phase completed but final_video.mp4 was not found.");
        }
        
        // --- PHASE 4: DISTRIBUTION ---
        console.log("\n--- PHASE 4: DISTRIBUTION ---");
        const distCmd = `python3 src/phase4_distribution.py`;
        console.log(`Running Distribution: ${distCmd}`);
        execSync(distCmd, { stdio: 'inherit', cwd: rootDir });
        
        console.log("\n================================================================================");
        console.log(`[Pipeline Runner] Execution Completed Successfully: ${new Date().toISOString()}`);
        console.log("================================================================================");
        
    } catch (err) {
        console.error("\n================================================================================");
        console.error(`[Pipeline Runner] CRITICAL FAILURE: ${err.message}`);
        console.error("================================================================================");
        process.exit(1);
    }
}

main();
