const fs = require('fs');
const path = require('path');
const { encodeTopicData } = require('./toon_utils');

// 100-topic rotation list retrieved from user request
const TOPICS = [
    // Science & Nature
    { topic: "Every Type of Weather Phenomenon Explained", emoji: "⛈️" },
    { topic: "Every Type of Galaxy Explained", emoji: "🌌" },
    { topic: "Every Type of Biome Explained", emoji: "🏜️" },
    { topic: "Every Type of Subatomic Particle Explained", emoji: "⚛️" },
    { topic: "Every Type of Cloud Explained", emoji: "☁️" },
    { topic: "Every Type of Ocean Zone Explained", emoji: "🌊" },
    { topic: "Every Type of Tectonic Plate Boundary Explained", emoji: "🌍" },
    { topic: "Every Type of Star Explained", emoji: "⭐" },
    { topic: "Every Type of Chemical Bond Explained", emoji: "🧪" },
    { topic: "Every Type of Blood Cell Explained", emoji: "🩸" },

    // Psychology & Human Behavior
    { topic: "Every Type of Psychological Defense Mechanism Explained", emoji: "🛡️" },
    { topic: "Every Type of Memory Explained", emoji: "🧠" },
    { topic: "Every Type of Sleep Stage Explained", emoji: "💤" },
    { topic: "Every Type of Personality Disorder Explained", emoji: "🧩" },
    { topic: "Every Type of Cognitive Bias Explained", emoji: "🤯" },
    { topic: "Every Type of Learning Style Explained", emoji: "📚" },
    { topic: "Every Type of Emotion Explained", emoji: "🎭" },
    { topic: "Every Type of Introvert and Extrovert Explained", emoji: "🔋" },
    { topic: "Every Type of Phobia Explained", emoji: "🕷️" },
    { topic: "Every Type of Dream Explained", emoji: "💭" },

    // Art, Media & Entertainment
    { topic: "Every Type of Literary Genre Explained", emoji: "📖" },
    { topic: "Every Type of Movie Trope Explained", emoji: "🎬" },
    { topic: "Every Type of Music Genre Explained", emoji: "🎵" },
    { topic: "Every Type of Visual Art Movement Explained", emoji: "🎨" },
    { topic: "Every Type of Poetry Explained", emoji: "✍️" },
    { topic: "Every Type of Story Arc Explained", emoji: "📉" },
    { topic: "Every Type of Anime Genre Explained", emoji: "🌸" },
    { topic: "Every Type of Video Game Genre Explained", emoji: "🎮" },
    { topic: "Every Type of Camera Shot Explained", emoji: "📷" },
    { topic: "Every Type of Villain Explained", emoji: "🦹" },

    // Society, History & Culture
    { topic: "Every Type of Government System Explained", emoji: "🏛️" },
    { topic: "Every Type of Economic System Explained", emoji: "💰" },
    { topic: "Every Type of Logical Fallacy Explained", emoji: "🚫" },
    { topic: "Every Type of Historical Era Explained", emoji: "⏳" },
    { topic: "Every Type of Internet Troll Explained", emoji: "🧌" },
    { topic: "Every Type of Social Media Platform Explained", emoji: "📱" },
    { topic: "Every Type of Generation Explained", emoji: "👶" },
    { topic: "Every Type of Currency Explained", emoji: "💵" },
    { topic: "Every Type of Conspiracy Theory Explained", emoji: "👽" },
    { topic: "Every Type of Religion Explained", emoji: "🕊️" },

    // Technology & Engineering
    { topic: "Every Type of Renewable Energy Explained", emoji: "☀️" },
    { topic: "Every Type of Computer Virus Explained", emoji: "🦠" },
    { topic: "Every Type of Artificial Intelligence Explained", emoji: "🤖" },
    { topic: "Every Type of Bridge Architecture Explained", emoji: "🌉" },
    { topic: "Every Type of Coding Language Explained", emoji: "💻" },
    { topic: "Every Type of Engine Explained", emoji: "🚗" },
    { topic: "Every Type of Network Topology Explained", emoji: "🌐" },
    { topic: "Every Type of Data Storage Explained", emoji: "💾" },
    { topic: "Every Type of Rocket Explained", emoji: "🚀" },
    { topic: "Every Type of Clock Explained", emoji: "⏱️" },

    // Everyday Life & Hobbies
    { topic: "Every Type of Coffee Drink Explained", emoji: "☕" },
    { topic: "Every Type of Diet Explained", emoji: "🥗" },
    { topic: "Every Type of Workout Explained", emoji: "🏋️" },
    { topic: "Every Type of Bread Explained", emoji: "🍞" },
    { topic: "Every Type of Cheese Explained", emoji: "🧀" },
    { topic: "Every Type of Tea Explained", emoji: "🍵" },
    { topic: "Every Type of House Plant Explained", emoji: "🪴" },
    { topic: "Every Type of Sibling Dynamic Explained", emoji: "👨‍👩‍👧‍👦" },
    { topic: "Every Type of Co-Worker Explained", emoji: "👔" },
    { topic: "Every Type of Commuter Explained", emoji: "🚆" },

    // Language & Communication
    { topic: "Every Type of Figure of Speech Explained", emoji: "🗣️" },
    { topic: "Every Type of Punctuation Mark Explained", emoji: "⁉️" },
    { topic: "Every Type of Accent Explained", emoji: "🗺️" },
    { topic: "Every Type of Love Language Explained", emoji: "❤️" },
    { topic: "Every Type of Nonverbal Communication Explained", emoji: "🤫" },

    // Math & Physics
    { topic: "Every Type of Number Explained", emoji: "🔢" },
    { topic: "Every Type of Geometric Shape Explained", emoji: "🔺" },
    { topic: "Every Type of Physics Law Explained", emoji: "🍎" },
    { topic: "Every Type of Dimension Explained", emoji: "🌌" },
    { topic: "Every Type of Force Explained", emoji: "🧲" },

    // Mythology & Folklore
    { topic: "Every Type of Mythological Creature Explained", emoji: "🐉" },
    { topic: "Every Type of Greek God Explained", emoji: "⚡" },
    { topic: "Every Type of Urban Legend Explained", emoji: "👻" },
    { topic: "Every Type of Folklore Explained", emoji: "🧚" },
    { topic: "Every Type of Afterlife Explained", emoji: "☁️" },

    // Abstract & Niche
    { topic: "Every Type of Paradox Explained", emoji: "🌀" },
    { topic: "Every Type of Optical Illusion Explained", emoji: "😵‍💫" },
    { topic: "Every Type of Magic Trick Explained", emoji: "🎩" },
    { topic: "Every Type of Secret Society Explained", emoji: "👁️" },
    { topic: "Every Type of Apocalyptic Scenario Explained", emoji: "☄️" },
    { topic: "Every Type of Time Travel Theory Explained", emoji: "⏳" },
    { topic: "Every Type of Extraterrestrial Encounter Explained", emoji: "🛸" },
    { topic: "Every Type of Martial Art Explained", emoji: "🥋" },
    { topic: "Every Type of Board Game Mechanic Explained", emoji: "🎲" },
    { topic: "Every Type of Puzzle Explained", emoji: "🧩" },

    // Earth & Materials
    { topic: "Every Type of Gemstone Explained", emoji: "💎" },
    { topic: "Every Type of Venomous Snake Explained", emoji: "🐍" },
    { topic: "Every Type of Volcano Explained", emoji: "🌋" },
    { topic: "Every Type of Glacier Explained", emoji: "🧊" },
    { topic: "Every Type of Desert Explained", emoji: "🐪" },
    { topic: "Every Type of Forest Explained", emoji: "🌲" },
    { topic: "Every Type of Evolution Explained", emoji: "🐒" },
    { topic: "Every Type of Symbiosis Explained", emoji: "🤝" },
    { topic: "Every Type of Parasite Explained", emoji: "🦟" },
    { topic: "Every Type of Muscle Tissue Explained", emoji: "💪" },
    { topic: "Every Type of Battery Explained", emoji: "🔋" },
    { topic: "Every Type of Plastic Explained", emoji: "♻️" },
    { topic: "Every Type of Glass Explained", emoji: "🪟" },
    { topic: "Every Type of Metal Explained", emoji: "⚙️" },
    { topic: "Every Type of Paper Explained", emoji: "📄" }
];

// Helper to parse .env file parameters
function loadEnv(rootDir) {
    const envFile = path.join(rootDir, '.env');
    if (fs.existsSync(envFile)) {
        try {
            const content = fs.readFileSync(envFile, 'utf8');
            for (const line of content.split('\n')) {
                const stripped = line.strip ? line.strip() : line.trim();
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
        } catch (e) {
            console.error("Error reading .env file:", e);
        }
    }
}

// Generate fallback concepts locally if Gemini key is missing
function generateFallbackConcepts(topicObj) {
    const defaultColors = [
        "#ef4444", "#3b82f6", "#10b981", "#f59e0b",
        "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
        "#14b8a6", "#111827", "#d946ef", "#eab308"
    ];
    const defaultEmojis = ["💡", "⚡", "🔍", "🧠", "🎯", "🌟", "🔮", "🛡️", "🌍", "⚙️", "🧪", "📊"];
    
    const concepts = [];
    for (let i = 0; i < 12; i++) {
        concepts.push({
            name: `Concept ${i + 1}`,
            emoji: defaultEmojis[i % defaultEmojis.length],
            color: defaultColors[i % defaultColors.length],
            description: `This is a placeholder explainer about concept ${i + 1} of ${topicObj.topic}.`
        });
    }
    
    return {
        topic: topicObj.topic,
        concepts: concepts
    };
}

async function scrape() {
    console.log("[Phase 1 Ingestion] Starting Conceptual Explainer Ingestion...");
    const rootDir = path.join(__dirname, '..');
    loadEnv(rootDir);
    
    // 1. Manage Topic Index for rotation
    const indexFile = path.join(__dirname, 'topic_index.txt');
    let topicIndex = 0;
    if (fs.existsSync(indexFile)) {
        try {
            topicIndex = parseInt(fs.readFileSync(indexFile, 'utf8').trim(), 10) || 0;
        } catch (e) {
            topicIndex = 0;
        }
    }
    
    // Pick the rotating fallback topic based on index
    const topicObj = TOPICS[topicIndex % TOPICS.length];
    console.log(`[Phase 1 Ingestion] Rotating Fallback Topic: "${topicObj.topic}" (Index: ${topicIndex})`);
    
    // Increment index and save for next execution run
    topicIndex++;
    fs.writeFileSync(indexFile, topicIndex.toString(), 'utf8');
    
    let result = null;
    
    // 2. Try to query Gemini API to fetch dynamic and customized sub-concepts if API key is present
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
        console.log(`[Phase 1 Ingestion] Gemini API key found. Generating concepts for "${topicObj.topic}" dynamically...`);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
            
            // Query Gemini to generate sub-concepts for the selected topic
            const prompt = `For the educational topic: "${topicObj.topic}", please generate exactly 12 interesting, distinct, and highly engaging sub-concepts or sub-types.
For each concept, provide:
1. Short Name (1-3 words, representing the concept name, e.g. "Gaslighting", "Confirmation Bias")
2. A single matching emoji
3. A clean vibrant hex color (e.g. #3b82f6, #ef4444)
4. A highly engaging, simple explanation/definition (exactly 1 sentence, 10-15 words).

Output the result strictly as a valid JSON object matching the following structure. Do NOT include markdown code fences or other text.
{
  "topic": "${topicObj.topic}",
  "concepts": [
    { "name": "Concept Name", "emoji": "🙄", "color": "#hex", "description": "Engaging explanation." }
  ]
}`;
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
                const parsed = JSON.parse(text);
                if (parsed.topic && Array.isArray(parsed.concepts) && parsed.concepts.length === 12) {
                    result = parsed;
                    console.log(`[Phase 1 Ingestion] Successfully generated dynamic topic: "${result.topic}" via Gemini!`);
                } else {
                    console.warn("[Phase 1 Ingestion] Gemini returned incorrect concepts count. Falling back to placeholder generation.");
                }
            } else {
                console.warn(`[Phase 1 Ingestion] Gemini request failed: ${response.statusText}. Falling back to placeholder generation.`);
            }
        } catch (e) {
            console.error("[Phase 1 Ingestion] Failed to generate concepts via API. Falling back to placeholder generation.", e);
        }
    } else {
        console.log("[Phase 1 Ingestion] No Gemini API key. Generating placeholder default concepts.");
    }
    
    // Generate fallback concepts if remote call failed or was skipped
    if (!result) {
        result = generateFallbackConcepts(topicObj);
    }
    
    // Save to topic_data.toon and property_data.toon (for compatibility)
    const toonOutput = encodeTopicData(result);
    const topicToonPath = path.join(rootDir, 'topic_data.toon');
    const propertyToonPath = path.join(rootDir, 'property_data.toon');
    
    fs.writeFileSync(topicToonPath, toonOutput, 'utf8');
    fs.writeFileSync(propertyToonPath, toonOutput, 'utf8');
    
    console.log(`[Phase 1 Ingestion] Successfully saved payload to ${topicToonPath} and ${propertyToonPath}`);
    console.log("[Phase 1 Ingestion] Concepts generated:", result.concepts.map(c => c.name));
}

scrape();
