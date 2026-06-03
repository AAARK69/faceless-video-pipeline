const fs = require('fs');

function encodePropertyData(data) {
    const lines = [];
    lines.push(`price: ${data.price || ''}`);
    lines.push(`location: ${data.location || ''}`);
    const desc = (data.description || '').replace(/\n/g, ' ');
    lines.push(`description: ${desc}`);
    
    const images = data.images || [];
    lines.push(`images[${images.length}]:`);
    for (const img of images) {
        lines.push(`  ${img}`);
    }
    return lines.join('\n');
}

function decodePropertyData(toonStr) {
    const data = {
        price: '',
        location: '',
        description: '',
        images: []
    };
    const lines = toonStr.split('\n');
    let inImages = false;
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        if (inImages) {
            if (line.startsWith('  ')) {
                data.images.push(line.trim());
                continue;
            } else {
                inImages = false;
            }
        }
        
        const match = line.match(/^([a-zA-Z0-9_]+)(?:\[\d+\])?:?\s*(.*)$/);
        if (match) {
            const key = match[1];
            const val = match[2];
            if (key === 'price') {
                data.price = val.trim();
            } else if (key === 'location') {
                data.location = val.trim();
            } else if (key === 'description') {
                data.description = val.trim();
            } else if (key === 'images') {
                inImages = true;
            }
        }
    }
    return data;
}

function encodeTimingData(words) {
    const lines = [];
    lines.push(`words[${words.length}]{word,start,end}:`);
    for (const w of words) {
        const word = (w.word || '').replace(/,/g, '');
        const start = w.start || 0;
        const end = w.end || 0;
        lines.push(`  ${word},${start},${end}`);
    }
    return lines.join('\n');
}

function decodeTimingData(toonStr) {
    const words = [];
    const lines = toonStr.split('\n');
    for (const line of lines) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('words[')) continue;
        const parts = stripped.split(',');
        if (parts.length >= 3) {
            words.push({
                word: parts[0].trim(),
                start: parseFloat(parts[1].trim()),
                end: parseFloat(parts[2].trim())
            });
        }
    }
    return words;
}

function encodeTopicData(data) {
    const lines = [];
    lines.push(`topic: ${data.topic || ''}`);
    const concepts = data.concepts || [];
    lines.push(`concepts[${concepts.length}]:`);
    for (const c of concepts) {
        const desc = (c.description || '').replace(/\n/g, ' ').replace(/\|/g, '');
        lines.push(`  ${c.name}|${c.emoji}|${c.color}|${desc}`);
    }
    return lines.join('\n');
}

function decodeTopicData(toonStr) {
    const data = {
        topic: '',
        concepts: []
    };
    const lines = toonStr.split('\n');
    let inConcepts = false;
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        if (inConcepts) {
            if (line.startsWith('  ')) {
                const parts = line.trim().split('|');
                if (parts.length >= 4) {
                    data.concepts.push({
                        name: parts[0].trim(),
                        emoji: parts[1].trim(),
                        color: parts[2].trim(),
                        description: parts[3].trim()
                    });
                }
                continue;
            } else {
                inConcepts = false;
            }
        }
        
        const match = line.match(/^([a-zA-Z0-9_]+)(?:\[\d+\])?:?\s*(.*)$/);
        if (match) {
            const key = match[1];
            const val = match[2];
            if (key === 'topic') {
                data.topic = val.trim();
            } else if (key === 'concepts') {
                inConcepts = true;
            }
        }
    }
    return data;
}

function encodeTimingWithConcepts(concepts, words) {
    const lines = [];
    lines.push(`concepts[${concepts.length}]{name,start,end}:`);
    for (const c of concepts) {
        const name = (c.name || '').replace(/,/g, '');
        lines.push(`  ${name},${c.start || 0},${c.end || 0}`);
    }
    lines.push(`words[${words.length}]{word,start,end}:`);
    for (const w of words) {
        const word = (w.word || '').replace(/,/g, '');
        lines.push(`  ${word},${w.start || 0},${w.end || 0}`);
    }
    return lines.join('\n');
}

function decodeTimingWithConcepts(toonStr) {
    const concepts = [];
    const words = [];
    const lines = toonStr.split('\n');
    let inConcepts = false;
    let inWords = false;
    
    for (const line of lines) {
        const stripped = line.trim();
        if (!stripped) continue;
        if (stripped.startsWith('concepts[')) {
            inConcepts = true;
            inWords = false;
            continue;
        }
        if (stripped.startsWith('words[')) {
            inConcepts = false;
            inWords = true;
            continue;
        }
        
        const parts = stripped.split(',');
        if (parts.length >= 3) {
            if (inConcepts) {
                concepts.push({
                    name: parts[0].trim(),
                    start: parseFloat(parts[1].trim()),
                    end: parseFloat(parts[2].trim())
                });
            } else if (inWords) {
                words.push({
                    word: parts[0].trim(),
                    start: parseFloat(parts[1].trim()),
                    end: parseFloat(parts[2].trim())
                });
            }
        }
    }
    return { concepts, words };
}

module.exports = {
    encodePropertyData,
    decodePropertyData,
    encodeTimingData,
    decodeTimingData,
    encodeTopicData,
    decodeTopicData,
    encodeTimingWithConcepts,
    decodeTimingWithConcepts
};
