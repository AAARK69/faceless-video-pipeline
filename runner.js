const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

// ──────────────────────────────────────────────────────────────────────────
// DUAL-PASS SCRIPT EDITOR
// Runs after first-pass generation to strip AI filler words and sharpen hooks.
// ──────────────────────────────────────────────────────────────────────────
const FILLER_WORDS = [
    'delve', 'delves', 'delving', 'testament', 'moreover', 'furthermore',
    'crucial', 'crucial to', 'it\'s worth noting', 'dive into', 'diving into',
    'landscape', 'in essence', 'to sum up', 'in summary', 'as we explore',
    'fascinating', 'it is important to note', 'notably', 'certainly',
    'absolutely', 'game-changer', 'game changer', 'at the end of the day',
    'let\'s dive', 'let\'s explore', 'let\'s delve'
];

async function runDualPassEdit(apiKey, scriptObj, isGemini) {
    console.log('[Phase 2 Synthesis] Running dual-pass script editor...');
    const editorPrompt = `You are a strict YouTube script editor. Your job is to clean up an AI-generated script.

RULES (apply all of them):
1. REMOVE these filler words/phrases entirely and rewrite naturally: ${FILLER_WORDS.join(', ')}
2. Rewrite the "intro" so it starts with a punchy QUESTION or bold STATEMENT — not "Welcome" or "Today we". Hook the viewer in the first 5 words.
3. Keep every "concepts" entry detailed, descriptive, and comprehensive (at least 5-6 sentences, 110-120 words per concept). Do not shorten them. 8th-grade reading level. No passive voice.
4. The "outro" must end with a direct question to the viewer (e.g., "Which one surprised you most?").
5. Keep the same JSON structure. Output ONLY raw JSON with no markdown.

Script to edit:
${JSON.stringify(scriptObj, null, 2)}

Output the cleaned script as a raw JSON object with the same keys: { "intro": "...", "concepts": {...}, "outro": "..." }`;

    try {
        if (isGemini) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: editorPrompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });
            if (response.ok) {
                const resJson = await response.json();
                const text = resJson.candidates[0].content.parts[0].text.trim();
                const edited = JSON.parse(text);
                console.log('[Phase 2 Synthesis] Dual-pass edit complete (Gemini).');
                return edited;
            }
        } else {
            const url = 'https://api.anthropic.com/v1/messages';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 1500,
                    messages: [{ role: 'user', content: editorPrompt }]
                })
            });
            if (response.ok) {
                const resJson = await response.json();
                const rawText = resJson.content[0].text.trim()
                    .replace(/^```json/, '').replace(/```$/, '').trim();
                const edited = JSON.parse(rawText);
                console.log('[Phase 2 Synthesis] Dual-pass edit complete (Claude).');
                return edited;
            }
        }
    } catch (e) {
        console.warn(`[Phase 2 Synthesis] Dual-pass editor failed (using first-pass result): ${e.message}`);
    }
    return scriptObj; // Graceful fallback to first-pass result
}

async function sendWebhookAlert({ success, phase, topic, message, errorStack, videoUrl }) {
    const webhookUrls = [
        process.env.DISCORD_WEBHOOK_URL,
        process.env.SLACK_WEBHOOK_URL
    ].filter(Boolean);
    
    if (webhookUrls.length === 0) return; // No webhooks configured
    
    const timestamp = new Date().toISOString();
    const emoji = success ? '✅' : '🚨';
    const status = success ? 'SUCCESS' : 'FAILURE';
    
    for (const url of webhookUrls) {
        try {
            const isSlack = url.includes('hooks.slack.com');
            let body;
            
            if (isSlack) {
                // Slack format
                const text = success
                    ? `${emoji} *Pipeline ${status}* [${timestamp}]\nTopic: \`${topic}\`${videoUrl ? `\nVideo: ${videoUrl}` : ''}`
                    : `${emoji} *Pipeline ${status}* at Phase: \`${phase}\` [${timestamp}]\nTopic: \`${topic || 'unknown'}\`\nError: \`${message}\`\n\`\`\`${(errorStack || '').slice(0, 400)}\`\`\``;
                body = JSON.stringify({ text });
            } else {
                // Discord format
                const content = success
                    ? `${emoji} **Pipeline ${status}** \`${timestamp}\`\n**Topic:** ${topic}${videoUrl ? `\n**Video:** ${videoUrl}` : ''}`
                    : `${emoji} **Pipeline ${status}** at Phase: \`${phase}\` \`${timestamp}\`\n**Topic:** ${topic || 'unknown'}\n**Error:** \`${message}\`\n\`\`\`${(errorStack || '').slice(0, 800)}\`\`\``;
                body = JSON.stringify({ content });
            }
            
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
        } catch (e) {
            console.warn(`[Alert] Failed to send webhook to ${url.slice(0, 40)}...: ${e.message}`);
        }
    }
}

// Combined single-call function: generates concepts + full narration script in ONE Gemini request
// This halves API usage vs calling Phase 1 and Phase 2 separately.
async function generateConceptsAndScriptWithGemini(apiKey, topicName) {
    console.log(`[Phase 2 Synthesis] Generating concepts + script in ONE Gemini call for: "${topicName}"`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    let algoStrategy = "";
    const strategyPath = path.join(__dirname, 'algorithm_strategy.md');
    if (fs.existsSync(strategyPath)) {
        try { algoStrategy = fs.readFileSync(strategyPath, 'utf8').trim(); } catch (e) {}
    }

    const prompt = `You are producing a highly engaging, long-form 10-minute YouTube explainer video titled: "${topicName}".

Your task is to generate the 12 concept definitions, each with exactly 3 sequential scenes (frames of thought), plus the intro and outro in ONE response.

Requirements:
1. Pick 12 real, distinct, interesting sub-types/concepts for this topic.
2. For each concept give: a short name (1-3 words), a single matching emoji, a clean vibrant hex color.
3. Hook Intro: Write a punchy QUESTION or bold STATEMENT starting the intro — do NOT use "Welcome" or "Today we". Hook the viewer in the first 5 words.
4. Concept Explanations: Each of the 12 concepts must have exactly 3 sequential scenes. For each scene, generate:
   - "text": A detailed narration sentence (exactly 33 to 40 words, totaling 100 to 120 words per concept) containing concrete examples and mechanistic details. Conversational (8th-grade reading level), active voice.
   - "sketch": Raw SVG element tags (only <line>, <circle>, <path>, <rect>, <ellipse>, etc. — do NOT output a wrapper <svg> tag) drawing a stickman performing the action described in the scene's text within a 0 to 100 coordinate space. Use a stroke width of 4 and stroke color #1e293b. Keep the drawings simple, clean, and expressive. Make sure the drawings are centered and fit the 100x100 space.
5. CTA Outro: Write an outro that ends with a direct question to the viewer (e.g., "Which one surprised you most?").
6. The entire combined narration script must be at least 1,500 words total.
7. STRICT NEGATIVE CONSTRAINT: Do NOT use any of these filler words/phrases: absolutely, game-changer, game changer, at the end of the day, let's dive, let's explore, let's delve. Strip them or rewrite naturally.
${algoStrategy ? `\nAlgorithm guidelines:\n${algoStrategy}` : ''}

Output ONLY this raw JSON structure, no markdown fences:
{
  "topic": "${topicName}",
  "intro": "Hook question or statement here.",
  "concepts": [
    {
      "name": "Concept Name",
      "emoji": "🔥",
      "color": "#hex",
      "scenes": [
        { "text": "Detailed scene 1 sentence (33-40 words)...", "sketch": "<circle cx=\\"50\\" cy=\\"25\\" r=\\"8\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\" fill=\\"none\\"/><line x1=\\"50\\" y1=\\"33\\" x2=\\"50\\" y2=\\"60\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\"/><line x1=\\"50\\" y1=\\"60\\" x2=\\"35\\" y2=\\"85\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\"/><line x1=\\"50\\" y1=\\"60\\" x2=\\"65\\" y2=\\"85\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\"/>..." },
        { "text": "Detailed scene 2 sentence...", "sketch": "..." },
        { "text": "Detailed scene 3 sentence...", "sketch": "..." }
      ]
    }
  ],
  "outro": "CTA ending with a question?"
}`;

    const delays = [0, 25000, 50000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
            console.warn(`[Phase 2 Synthesis] Wait ${delays[attempt]/1000}s retry (attempt ${attempt + 1})...`);
            await new Promise(r => setTimeout(r, delays[attempt]));
        }
        const responseSchema = {
            type: "object",
            properties: {
                topic: { type: "string" },
                intro: { type: "string" },
                outro: { type: "string" },
                concepts: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            emoji: { type: "string" },
                            color: { type: "string" },
                            scenes: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        text: { type: "string" },
                                        sketch: { type: "string" }
                                    },
                                    required: ["text", "sketch"]
                                }
                            }
                        },
                        required: ["name", "emoji", "color", "scenes"]
                    }
                }
            },
            required: ["topic", "intro", "outro", "concepts"]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: 'application/json',
                    responseSchema
                }
            })
        });
        if (response.ok) {
            const resJson = await response.json();
            const text = resJson.candidates[0].content.parts[0].text.trim();
            const parsed = JSON.parse(text);
            console.log(`[Phase 2 Synthesis] Combined call succeeded — ${parsed.concepts.length} concepts generated.`);
            return parsed; // { topic, intro, concepts[], outro }
        } else if ((response.status === 429 || response.status >= 500) && attempt < delays.length - 1) {
            continue;
        } else {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }
    }
    throw new Error('Gemini API: all retry attempts exhausted');
}

async function generateScriptWithGemini(apiKey, propertyData) {
    console.log("[Phase 2 Synthesis] Generating script via Gemini API...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
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
    let prompt = `Write a highly engaging, detailed, long-form 10-minute conversational narration script for a widescreen YouTube video titled: "${propertyData.topic}".
Here are the 12 concepts to explain:
${conceptsStr}

Requirements:
1. Hook Intro: Write a punchy QUESTION or bold STATEMENT starting the intro — do NOT use "Welcome" or "Today we". Hook the viewer in the first 5 words.
2. Concept Explanations: For each concept, write a DETAILED, deep 5-6 sentence explanation script based on the description provided (at least 110-120 words per concept). Provide concrete examples, mechanistic details, and real-world impacts to satisfy a 10-minute target length. Keep the tone conversational, natural (8th-grade reading level), and use active voice.
3. CTA Outro: Write an outro that ends with a direct question to the viewer (e.g., "Which one surprised you most?").
4. The entire script must be at least 1,500 words total.
5. STRICT NEGATIVE CONSTRAINT: Do NOT use any of these filler words/phrases: absolutely, game-changer, game changer, at the end of the day, let's dive, let's explore, let's delve. Strip them or rewrite naturally.`;

    if (algoStrategy) {
        prompt += `\n\nAdditional Retention and Algorithm Guidelines (YOU MUST STRICTLY FOLLOW THESE):\n${algoStrategy}`;
    }

    prompt += `\n\nOutput the result strictly as a raw JSON object matching the structure below. Do NOT add any extra markdown wraps, code blocks, or comments.
{
  "intro": "Intro text here...",
  "concepts": {
    ${propertyData.concepts.map(c => `"${c.name}": "Detailed 5-6 sentence explanation here (at least 110-120 words) detailing exact mechanisms, examples, and impacts."`).join(',\n    ')}
  },
  "outro": "Outro text here..."
}`;

    // Retry up to 3 times with backoff on rate limit
    const delays = [0, 20000, 40000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
            console.warn(`[Phase 2 Synthesis] Rate limited. Waiting ${delays[attempt]/1000}s before retry (attempt ${attempt+1})...`);
            await new Promise(r => setTimeout(r, delays[attempt]));
        }
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (response.ok) {
            const resJson = await response.json();
            const text = resJson.candidates[0].content.parts[0].text.trim();
            const firstPassScript = JSON.parse(text);
            return firstPassScript;
        } else if (response.status === 429 && attempt < delays.length - 1) {
            continue; // will retry
        } else {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }
    }
    throw new Error('Gemini API: all retry attempts exhausted');
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
    let prompt = `Write a highly engaging, detailed, long-form 10-minute conversational narration script for a widescreen YouTube video titled: "${propertyData.topic}".
Here are the 12 concepts to explain:
${conceptsStr}

Requirements:
1. Hook Intro: Write a punchy QUESTION or bold STATEMENT starting the intro — do NOT use "Welcome" or "Today we". Hook the viewer in the first 5 words.
2. Concept Explanations: Each of the 12 concepts must have exactly 3 sequential scenes. For each scene, generate:
   - "text": A detailed narration sentence (exactly 33 to 40 words, totaling 100 to 120 words per concept) containing concrete examples and mechanistic details. Conversational (8th-grade reading level), active voice.
   - "sketch": Raw SVG element tags (only <line>, <circle>, <path>, <rect>, <ellipse>, etc. — do NOT output a wrapper <svg> tag) drawing a stickman performing the action described in the scene's text within a 0 to 100 coordinate space. Use a stroke width of 4 and stroke color #1e293b. Keep the drawings simple, clean, and expressive. Make sure the drawings are centered and fit the 100x100 space.
3. CTA Outro: Write an outro that ends with a direct question to the viewer (e.g., "Which one surprised you most?").
4. STRICT NEGATIVE CONSTRAINT: Do NOT use any of these filler words/phrases: absolutely, game-changer, game changer, at the end of the day, let's dive, let's explore, let's delve. Strip them or rewrite naturally.`;

    if (algoStrategy) {
        prompt += `\n\nAdditional Retention and Algorithm Guidelines (YOU MUST STRICTLY FOLLOW THESE):\n${algoStrategy}`;
    }

    prompt += `\n\nOutput the result strictly as a raw JSON object matching the structure below. Do NOT wrap it in markdown code blocks like \`\`\`json. Output ONLY the raw JSON string.
{
  "topic": "${propertyData.topic}",
  "intro": "Intro text here...",
  "concepts": [
    {
      "name": "Concept Name",
      "emoji": "🔥",
      "color": "#hex",
      "scenes": [
        { "text": "Detailed scene 1 sentence (33-40 words)...", "sketch": "<circle cx=\\"50\\" cy=\\"25\\" r=\\"8\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\" fill=\\"none\\"/><line x1=\\"50\\" y1=\\"33\\" x2=\\"50\\" y2=\\"60\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\"/><line x1=\\"50\\" y1=\\"60\\" x2=\\"35\\" y2=\\"85\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\"/><line x1=\\"50\\" y1=\\"60\\" x2=\\"65\\" y2=\\"85\\" stroke=\\"#1e293b\\" stroke-width=\\"4\\"/>..." },
        { "text": "Detailed scene 2 sentence...", "sketch": "..." },
        { "text": "Detailed scene 3 sentence...", "sketch": "..." }
      ]
    }
  ],
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
            max_tokens: 2500,
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
    const firstPassScript = JSON.parse(cleanedText);
    return firstPassScript;
}

async function main() {
    console.log("================================================================================");
    console.log(`[Pipeline Runner] Explainer Pipeline Execution Started: ${new Date().toISOString()}`);
    console.log("================================================================================");
    
    const rootDir = __dirname;
    const binDir = path.join(rootDir, 'node-env/bin');
    const envPath = `PATH=${binDir}:$PATH`;
    
    loadEnv(rootDir);
    let currentTopic = 'unknown';
    
    try {
        // --- PHASE 1: INGESTION ---
        console.log("\n--- PHASE 1: INGESTION ---");
        if (process.argv.includes('--skip-ingestion')) {
            console.log("[Phase 1 Ingestion] Skipped due to --skip-ingestion flag.");
        } else {
            const customArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
            const customTopicArg = customArgs.length > 0 ? ` "${customArgs.join(' ')}"` : '';
            const ingestionCmd = `node src/phase1_ingestion.js${customTopicArg}`;
            console.log(`Running Ingestion: ${ingestionCmd}`);
            // Strip GEMINI_API_KEY from phase1 env — concept generation is handled by
            // the combined Phase 2 call in runner.js to avoid double quota usage.
            const phase1Env = { ...process.env, PATH: `${binDir}:${process.env.PATH}` };
            delete phase1Env.GEMINI_API_KEY;
            phase1Env.SKIP_DYNAMIC_INGESTION = 'true';
            execSync(ingestionCmd, { stdio: 'inherit', cwd: rootDir, env: phase1Env });
        }
        
        const propertyToonPath = path.join(rootDir, 'property_data.toon');
        if (!fs.existsSync(propertyToonPath)) {
            throw new Error("Ingestion completed but property_data.toon was not created.");
        }
        
            const propertyContent = fs.readFileSync(propertyToonPath, 'utf8');
        const propertyData = decodeTopicData(propertyContent);
        console.log(`Parsed Ingested Topic: "${propertyData.topic}" with ${propertyData.concepts.length} concepts.`);
        currentTopic = propertyData.topic;
        
        // --- PHASE 2: SYNTHESIS & TTS ---
        console.log("\n--- PHASE 2: SYNTHESIS & TTS ---");
        let scriptObj = null;
        let combined = null;

        const localScriptJsonPath = path.join(rootDir, 'script.json');

        if (process.argv.includes('--skip-ingestion') && fs.existsSync(localScriptJsonPath)) {
            console.log("[Phase 2 Synthesis] Found local script.json with --skip-ingestion. Using it as override.");
            scriptObj = JSON.parse(fs.readFileSync(localScriptJsonPath, 'utf8'));
            
            // Reconstruct propertyData concepts for the pipeline
            propertyData.concepts.forEach(c => {
                const text = scriptObj.concepts[c.name] || c.description;
                // split text into 3 sentences if possible, or just repeat the text
                const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
                // Chunk into 3 parts
                const chunks = [];
                const size = Math.ceil(sentences.length / 3);
                for (let i = 0; i < 3; i++) {
                    const chunkText = sentences.slice(i * size, (i + 1) * size).join(' ').trim() || "...";
                    chunks.push({
                        text: chunkText,
                        sketch: `<circle cx="50" cy="25" r="8" stroke="#1e293b" stroke-width="4" fill="none"/><line x1="50" y1="33" x2="50" y2="60" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="35" y2="85" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="65" y2="85" stroke="#1e293b" stroke-width="4"/>`
                    });
                }
                c.description = JSON.stringify(chunks);
            });

            // Save updated property_data.toon so alignment/rendering phases use actual script content!
            const { encodeTopicData } = require('./src/toon_utils');
            fs.writeFileSync(propertyToonPath, encodeTopicData(propertyData), 'utf8');
            console.log(`[Phase 2 Synthesis] Saved manual script override concepts to property_data.toon.`);
        }
        else if (process.env.GEMINI_API_KEY) {
            combined = await generateConceptsAndScriptWithGemini(process.env.GEMINI_API_KEY, propertyData.topic);
        }
        else if (process.env.ANTHROPIC_API_KEY) {
            combined = await generateScriptWithClaude(process.env.ANTHROPIC_API_KEY, propertyData);
        }
        else {
            console.log("[Phase 2 Synthesis] No API keys or script.json found. Generating fallback template script.");
            combined = {
                topic: propertyData.topic,
                intro: `Let us explore the fascinating world of ${propertyData.topic} today. We will look at exactly twelve key aspects and break down what makes each of them important in the modern landscape. Let's begin our deep explanation now.`,
                concepts: propertyData.concepts.map((c, idx) => {
                    const name = c.name;
                    return {
                        name: name,
                        emoji: c.emoji || "💡",
                        color: c.color || "#3b82f6",
                        scenes: [
                            {
                                text: `Starting with number ${idx + 1}, we have ${name}. This is an extremely crucial concept that has significant relevance and serves as the baseline model for understanding how this entire topic operates in modern scenarios, providing a foundation for all subsequent ideas.`,
                                sketch: `<circle cx="50" cy="25" r="8" stroke="#1e293b" stroke-width="4" fill="none"/><line x1="50" y1="33" x2="50" y2="60" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="35" y2="85" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="65" y2="85" stroke="#1e293b" stroke-width="4"/>`
                            },
                            {
                                text: `Moving forward, we must examine the specific mechanics and structural properties that make ${name} unique when compared to other alternatives. This includes analyzing real world applications, key impacts, and specific case studies that demonstrate its practical effectiveness.`,
                                sketch: `<circle cx="50" cy="25" r="8" stroke="#1e293b" stroke-width="4" fill="none"/><line x1="50" y1="33" x2="50" y2="60" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="35" y2="85" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="65" y2="85" stroke="#1e293b" stroke-width="4"/>`
                            },
                            {
                                text: `Finally, to fully comprehend this element, we look at how experts evaluate its long term sustainability and future growth. This concludes our detailed study of ${name} and leads us directly into our next interesting category.`,
                                sketch: `<circle cx="50" cy="25" r="8" stroke="#1e293b" stroke-width="4" fill="none"/><line x1="50" y1="33" x2="50" y2="60" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="35" y2="85" stroke="#1e293b" stroke-width="4"/><line x1="50" y1="60" x2="65" y2="85" stroke="#1e293b" stroke-width="4"/>`
                            }
                        ]
                    };
                }),
                outro: "Which one of these twelve unique concepts did you find most surprising or educational? Let us know in the comments below!"
            };
        }

        if (combined) {
            scriptObj = {
                intro: combined.intro,
                outro: combined.outro,
                concepts: {}
            };
            combined.concepts.forEach(c => {
                scriptObj.concepts[c.name] = c.scenes.map(s => s.text).join(' ');
            });

            // Overwrite propertyData.concepts with real/fallback ones
            propertyData.concepts = combined.concepts.map(c => ({
                name: c.name,
                emoji: c.emoji,
                color: c.color,
                description: JSON.stringify(c.scenes)
            }));

            // Save updated property_data.toon
            const { encodeTopicData } = require('./src/toon_utils');
            fs.writeFileSync(propertyToonPath, encodeTopicData(propertyData), 'utf8');
            console.log(`[Phase 2 Synthesis] Overwritten property_data.toon with ${propertyData.concepts.length} concepts.`);
        }

        // Save the generated script object to script.json for reference/logging
        fs.writeFileSync(localScriptJsonPath, JSON.stringify(scriptObj, null, 2), 'utf8');

        // Build the combined spoken text for the TTS audio generator
        // Ensure clear sentence boundaries between parts for natural pauses
        const scriptParts = [];
        scriptParts.push(scriptObj.intro);
        
        propertyData.concepts.forEach(c => {
            const narratedScript = scriptObj.concepts[c.name] || `Next, ${c.name}.`;
            scriptParts.push(narratedScript);
        });
        
        scriptParts.push(scriptObj.outro);
        // Strip trailing punctuation, then rejoin with ". " to create distinct sentence-boundary pauses
        const cleanedParts = scriptParts.map(p => p.trim().replace(/[.!?,;:]+$/, ''));
        const fullScriptText = cleanedParts.join('. ') + '.';
        
        console.log(`[Phase 2 Synthesis] Final Script Narration Length: ${fullScriptText.length} chars.`);

        // Write the full script text to a temp file in the scratch folder to avoid passing
        // massive strings via command-line arguments (avoiding shell limits and escaping issues)
        const scratchDir = path.join(rootDir, 'scratch');
        if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
        }
        const tempScriptPath = path.join(scratchDir, 'temp_script.txt');
        fs.writeFileSync(tempScriptPath, fullScriptText, 'utf8');
        
        // Run TTS Generator with the file path
        const ttsCmd = `${envPath} python3 src/tts_generator.py "${tempScriptPath}"`;
        console.log(`Running TTS: ${ttsCmd}`);
        execSync(ttsCmd, { stdio: 'inherit', cwd: rootDir });
        
        // Verify TTS Outputs
        if (!fs.existsSync(path.join(rootDir, 'voice.mp3')) || !fs.existsSync(path.join(rootDir, 'timing.toon'))) {
            throw new Error("TTS generation failed to produce voice.mp3 or timing.toon.");
        }

        // --- PHASE 2.5: QUALITY INSPECTION ---
        console.log("\n--- PHASE 2.5: QUALITY INSPECTION ---");
        const { inspect: inspectQuality } = require('./src/quality_inspector');
        const qualityResult = inspectQuality(propertyData, scriptObj);
        console.log(qualityResult.report);

        // Save report to disk
        fs.writeFileSync(path.join(rootDir, 'quality_report.json'), JSON.stringify({
            pass: qualityResult.pass,
            score: qualityResult.score,
            issues: qualityResult.issues,
            warnings: qualityResult.warnings,
            topic: propertyData.topic,
            timestamp: new Date().toISOString()
        }, null, 2));

        if (!qualityResult.pass) {
            await sendWebhookAlert({
                success: false,
                phase: 'Quality Inspection',
                topic: currentTopic,
                message: `Video blocked by quality inspector (score: ${qualityResult.score}/100). Issues: ${qualityResult.issues.join(' | ')}`,
                errorStack: qualityResult.issues.join('\n')
            });
            throw new Error(
                `[Quality Inspector] Video blocked — ${qualityResult.issues.length} issue(s) detected. ` +
                `Score: ${qualityResult.score}/100. Fix the script and re-run.\n` +
                qualityResult.issues.map((iss, i) => `  ${i+1}. ${iss}`).join('\n')
            );
        }
        console.log(`[Quality Inspector] ✅ Passed with score ${qualityResult.score}/100 — proceeding to render.`);

        // --- PHASE 3: RENDERING ---
        console.log("\n--- PHASE 3: RENDERING ---");
        const renderCmd = `${envPath} node src/phase3_render.js`;
        console.log(`Running Renderer: ${renderCmd}`);
        execSync(renderCmd, { stdio: 'inherit', cwd: rootDir });
        
        if (!fs.existsSync(path.join(rootDir, 'final_video.mp4'))) {
            throw new Error("Render phase completed but final_video.mp4 was not found.");
        }
        
        // --- PHASE 3.1: THUMBNAIL GENERATION ---
        console.log('\n--- PHASE 3.1: THUMBNAIL GENERATION ---');
        try {
            const thumbCmd = `${envPath} node src/phase_thumbnail.js`;
            console.log(`Running Thumbnail Generator: ${thumbCmd}`);
            execSync(thumbCmd, { stdio: 'inherit', cwd: rootDir });
            if (fs.existsSync(path.join(rootDir, 'thumbnail.png'))) {
                console.log('[Phase 3.1] Thumbnail generated successfully.');
            } else {
                console.warn('[Phase 3.1] Thumbnail generation completed but thumbnail.png not found.');
            }
        } catch (thumbErr) {
            console.warn(`[Phase 3.1] Thumbnail generation failed (non-blocking): ${thumbErr.message}`);
        }

        // --- PHASE 3.5: QUALITY CONTROL ---
        if (!process.argv.includes('--skip-distribution')) {
            console.log("\n--- PHASE 3.5: QUALITY CONTROL ---");
            console.log("[Quality Control] Video generated at final_video.mp4.");
            console.log("[Quality Control] Please review the file locally.");
            
            let isApproved = false;
            if (process.argv.includes('--auto-approve') || process.argv.includes('--yes')) {
                console.log("[Quality Control] Auto-approving video (--auto-approve flag set).");
                isApproved = true;
            } else {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise(resolve => {
                    rl.question("[Quality Control] Type 'Y' to approve and proceed to Phase 4 (Distribution), or 'N' to abort: ", resolve);
                });
                rl.close();
                isApproved = answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
            }

            if (!isApproved) {
                console.log("[Quality Control] Video rejected. Aborting upload.");
                console.log("\n================================================================================");
                console.log(`[Pipeline Runner] Execution Aborted by User: ${new Date().toISOString()}`);
                console.log("================================================================================");
                return; // Gracefully exit without crashing
            }
            console.log("[Quality Control] Video approved. Proceeding to distribution...");
        }

        // --- PHASE 4: DISTRIBUTION ---
        if (process.argv.includes('--skip-distribution')) {
            console.log("[Phase 4 Distribution] Skipped due to --skip-distribution flag.");
        } else {
            console.log("\n--- PHASE 4: DISTRIBUTION ---");
            const distCmd = `python3 src/phase4_distribution.py`;
            console.log(`Running Distribution: ${distCmd}`);
            execSync(distCmd, { stdio: 'inherit', cwd: rootDir });
        }
        
        console.log("\n================================================================================");
        console.log(`[Pipeline Runner] Execution Completed Successfully: ${new Date().toISOString()}`);
        console.log("================================================================================");
        await sendWebhookAlert({ success: true, topic: currentTopic });
        
    } catch (err) {
        console.error("\n================================================================================");
        console.error(`[Pipeline Runner] CRITICAL FAILURE: ${err.message}`);
        console.error("================================================================================");
        await sendWebhookAlert({
            success: false,
            phase: 'Pipeline',
            topic: currentTopic,
            message: err.message,
            errorStack: err.stack
        });
        process.exit(1);
    }
}

main();
