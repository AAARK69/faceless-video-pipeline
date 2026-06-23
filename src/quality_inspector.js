/**
 * Phase 2.5 — Quality Inspector
 *
 * Runs after TTS synthesis and BEFORE Remotion render.
 * Blocks the pipeline if the video content fails quality checks.
 *
 * Usage (standalone): node src/quality_inspector.js
 * Usage (module):     const { inspect } = require('./src/quality_inspector');
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY RULES
// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER_CONCEPT_PATTERN = /^concept\s*\d+$/i;

const PLACEHOLDER_DESCRIPTION_PATTERNS = [
    /this is a placeholder/i,
    /placeholder explainer/i,
    /concept \d+ of/i,
    /number \d+, concept \d+/i,
];

const FILLER_HOOK_PATTERNS = [
    /^welcome[!,.]?\s/i,
    /^today we (are|will)\s/i,
    /^in this video/i,
    /^hello (everyone|guys)/i,
];

const FILLER_WORDS = [
    'delve', 'delves', 'delving', 'testament', 'moreover', 'furthermore',
    'crucial', "it's worth noting", 'dive into', 'diving into', 'landscape',
    'in essence', 'to sum up', 'in summary', 'game-changer', 'game changer',
    "let's dive", "let's explore", "let's delve", 'notably', 'certainly',
    'absolutely', 'at the end of the day', 'as we explore',
];

const MIN_CONCEPT_WORDS       = 100;  // Minimum words per concept narration (for 10 min videos)
const MIN_UNIQUE_CONCEPT_RATIO = 0.8; // At least 80% of concepts must be unique names
const MIN_TOTAL_SCRIPT_WORDS  = 1400; // Entire script must be at least 1400 words (for 10 min videos)
const MAX_REPETITION_RATIO    = 0.4; // No more than 40% shared bigrams between any two concept narrations

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function words(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
}

function bigrams(wordArr) {
    const bg = new Set();
    for (let i = 0; i < wordArr.length - 1; i++) {
        bg.add(`${wordArr[i]} ${wordArr[i+1]}`);
    }
    return bg;
}

function jaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 0;
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}

function countFillerWords(text) {
    const lower = text.toLowerCase();
    return FILLER_WORDS.filter(fw => lower.includes(fw));
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE INSPECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} propertyData  — decoded topic data ({ topic, concepts[] })
 * @param {object} scriptObj     — { intro, concepts: {name: narration}, outro }
 * @returns {{ pass: boolean, score: number, issues: string[], warnings: string[], report: string }}
 */
function inspect(propertyData, scriptObj) {
    const issues   = [];   // FATAL — will block the pipeline
    const warnings = [];   // Non-fatal — logged but won't block

    // ── 1. Placeholder concept names ─────────────────────────────────────────
    const placeholderConcepts = propertyData.concepts.filter(c =>
        PLACEHOLDER_CONCEPT_PATTERN.test(c.name.trim())
    );
    if (placeholderConcepts.length > 0) {
        issues.push(
            `PLACEHOLDER CONCEPTS: ${placeholderConcepts.length}/${propertyData.concepts.length} concept names are generic placeholders ` +
            `(${placeholderConcepts.slice(0, 3).map(c => `"${c.name}"`).join(', ')}${placeholderConcepts.length > 3 ? '...' : ''}).`
        );
    }

    // ── 2. Unique concept name ratio ─────────────────────────────────────────
    const uniqueNames = new Set(propertyData.concepts.map(c => c.name.toLowerCase().trim()));
    const uniqueRatio = uniqueNames.size / propertyData.concepts.length;
    if (uniqueRatio < MIN_UNIQUE_CONCEPT_RATIO) {
        issues.push(
            `DUPLICATE CONCEPTS: Only ${uniqueNames.size}/${propertyData.concepts.length} concept names are unique (${Math.round(uniqueRatio * 100)}% < required ${MIN_UNIQUE_CONCEPT_RATIO * 100}%).`
        );
    }

    // ── 3. Placeholder narration content ─────────────────────────────────────
    const placeholderNarrations = [];
    Object.entries(scriptObj.concepts || {}).forEach(([name, narration]) => {
        for (const pat of PLACEHOLDER_DESCRIPTION_PATTERNS) {
            if (pat.test(narration)) {
                placeholderNarrations.push(name);
                break;
            }
        }
    });
    if (placeholderNarrations.length > 0) {
        issues.push(
            `PLACEHOLDER NARRATION: ${placeholderNarrations.length} concept(s) have placeholder script text ` +
            `(${placeholderNarrations.slice(0, 3).map(n => `"${n}"`).join(', ')}${placeholderNarrations.length > 3 ? '...' : ''}).`
        );
    }

    // ── 4. Concept narration length ───────────────────────────────────────────
    const shortNarrations = [];
    Object.entries(scriptObj.concepts || {}).forEach(([name, narration]) => {
        if (words(narration).length < MIN_CONCEPT_WORDS) {
            shortNarrations.push(`"${name}" (${words(narration).length} words)`);
        }
    });
    if (shortNarrations.length > 3) {
        issues.push(`SHORT NARRATIONS: ${shortNarrations.length} concepts have fewer than ${MIN_CONCEPT_WORDS} words: ${shortNarrations.slice(0, 4).join(', ')}.`);
    } else if (shortNarrations.length > 0) {
        warnings.push(`Short narrations: ${shortNarrations.join(', ')}.`);
    }

    // ── 5. Total script word count ────────────────────────────────────────────
    const allText = [
        scriptObj.intro || '',
        ...Object.values(scriptObj.concepts || {}),
        scriptObj.outro || ''
    ].join(' ');
    const totalWords = words(allText).length;
    if (totalWords < MIN_TOTAL_SCRIPT_WORDS) {
        issues.push(`SHORT SCRIPT: Total script is only ${totalWords} words (minimum: ${MIN_TOTAL_SCRIPT_WORDS}).`);
    }

    // ── 6. Weak hook detection ─────────────────────────────────────────────────
    const intro = (scriptObj.intro || '').trim();
    for (const pat of FILLER_HOOK_PATTERNS) {
        if (pat.test(intro)) {
            warnings.push(`WEAK HOOK: Intro starts with a generic opener: "${intro.slice(0, 60)}..."`);
            break;
        }
    }

    // ── 7. Outro lacks viewer question ────────────────────────────────────────
    const outro = (scriptObj.outro || '').trim();
    if (!outro.includes('?')) {
        warnings.push(`NO VIEWER QUESTION: Outro doesn't end with a question ("${outro.slice(0, 60)}").`);
    }

    // ── 8. Filler word check ──────────────────────────────────────────────────
    const foundFillers = countFillerWords(allText);
    if (foundFillers.length > 2) {
        warnings.push(`FILLER WORDS: Script contains ${foundFillers.length} filler words: ${foundFillers.slice(0, 5).join(', ')}.`);
    }

    // ── 9. Cross-concept repetition ───────────────────────────────────────────
    const narrations = Object.entries(scriptObj.concepts || {});
    let maxSimilarity = 0;
    let mostSimilarPair = null;
    for (let i = 0; i < narrations.length; i++) {
        for (let j = i + 1; j < narrations.length; j++) {
            const bgA = bigrams(words(narrations[i][1]));
            const bgB = bigrams(words(narrations[j][1]));
            const sim = jaccardSimilarity(bgA, bgB);
            if (sim > maxSimilarity) {
                maxSimilarity = sim;
                mostSimilarPair = [narrations[i][0], narrations[j][0]];
            }
        }
    }
    if (maxSimilarity > MAX_REPETITION_RATIO) {
        warnings.push(
            `HIGH REPETITION: "${mostSimilarPair[0]}" and "${mostSimilarPair[1]}" share ${Math.round(maxSimilarity * 100)}% bigram overlap.`
        );
    }

    // ── 10. Concept count check ───────────────────────────────────────────────
    if (propertyData.concepts.length < 8) {
        issues.push(`TOO FEW CONCEPTS: Only ${propertyData.concepts.length} concepts (minimum 8 required).`);
    }

    // ── Score calculation (0–100) ─────────────────────────────────────────────
    // Start at 100, deduct for issues (-15 each) and warnings (-5 each)
    const score = Math.max(0, 100 - (issues.length * 15) - (warnings.length * 5));
    const pass  = issues.length === 0;

    // ── Build report ──────────────────────────────────────────────────────────
    const statusLine = pass
        ? `✅ PASS (score: ${score}/100)`
        : `❌ FAIL (score: ${score}/100) — ${issues.length} blocking issue(s)`;

    const reportLines = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `[Quality Inspector] Topic: "${propertyData.topic}"`,
        `[Quality Inspector] ${statusLine}`,
        `[Quality Inspector] Total script words: ${totalWords} | Concepts: ${propertyData.concepts.length} | Unique: ${uniqueNames.size}`,
    ];

    if (issues.length > 0) {
        reportLines.push('', '[Quality Inspector] 🚫 BLOCKING ISSUES:');
        issues.forEach((iss, i) => reportLines.push(`  ${i + 1}. ${iss}`));
    }
    if (warnings.length > 0) {
        reportLines.push('', '[Quality Inspector] ⚠️  WARNINGS (non-blocking):');
        warnings.forEach((w, i) => reportLines.push(`  ${i + 1}. ${w}`));
    }
    reportLines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const report = reportLines.join('\n');

    return { pass, score, issues, warnings, report };
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE CLI MODE
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
    const rootDir = path.join(__dirname, '..');
    const { decodeTopicData } = require('./toon_utils');

    const propertyToonPath = path.join(rootDir, 'property_data.toon');
    const scriptJsonPath   = path.join(rootDir, 'script.json');

    if (!fs.existsSync(propertyToonPath)) {
        console.error('[Quality Inspector] ERROR: property_data.toon not found. Run the pipeline first.');
        process.exit(1);
    }
    if (!fs.existsSync(scriptJsonPath)) {
        console.error('[Quality Inspector] ERROR: script.json not found. Run Phase 2 first.');
        process.exit(1);
    }

    const propertyData = decodeTopicData(fs.readFileSync(propertyToonPath, 'utf8'));
    const scriptObj    = JSON.parse(fs.readFileSync(scriptJsonPath, 'utf8'));

    const result = inspect(propertyData, scriptObj);
    console.log(result.report);

    // Write inspection report to disk
    const reportPath = path.join(rootDir, 'quality_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ ...result, report: undefined }, null, 2));
    console.log(`[Quality Inspector] Full report saved to ${reportPath}`);

    process.exit(result.pass ? 0 : 1);
}

module.exports = { inspect };
