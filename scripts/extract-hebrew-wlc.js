#!/usr/bin/env node

/**
 * Extract Hebrew text from Westminster Leningrad Codex (morphhb) XML
 * and add to chapter JSON files
 * 
 * Usage: node extract-hebrew-wlc.js <book> <chapter>
 * Example: node extract-hebrew-wlc.js Gen 1
 */

const fs = require('fs');
const path = require('path');

// Book name mapping from WLC to our BOOK codes
const WLC_TO_BOOK = {
    'Gen': 'GENE', 'Exod': 'EXOD', 'Lev': 'LEVI', 'Num': 'NUMR', 'Deut': 'DEUT',
    'Josh': 'IOSU', 'Judg': 'IUDI', 'Ruth': 'RUTH', '1Sam': 'I_SAM', '2Sam': 'II_SAM',
    '1Kgs': 'I_REG', '2Kgs': 'II_REG', '1Chr': 'I_PAR', '2Chr': 'II_PAR',
    'Ezra': 'EZRA', 'Neh': 'NEHA', 'Esth': 'ESTH', 'Job': 'IOB',
    'Ps': 'PSAL', 'Prov': 'PROV', 'Eccl': 'ECCL', 'Song': 'CANT',
    'Isa': 'ISAI', 'Jer': 'IERE', 'Lam': 'THRE', 'Ezek': 'EZEC', 'Dan': 'DANI',
    'Hos': 'OSEA', 'Joel': 'IOEL', 'Amos': 'AMOS', 'Obad': 'ABDI', 'Jonah': 'IONA',
    'Mic': 'MICH', 'Nah': 'NAHU', 'Hab': 'HABA', 'Zeph': 'SOPH', 'Hag': 'AGGA',
    'Zech': 'ZACH', 'Mal': 'MALA'
};

// Reverse mapping
const BOOK_TO_WLC = Object.fromEntries(
    Object.entries(WLC_TO_BOOK).map(([k, v]) => [v, k])
);

function extractHebrewFromXML(xmlContent, chapter) {
    const verses = {};
    
    // Match verses for this chapter
    // Pattern: <verse osisID="Gen.1.31"> ... </verse>
    const verseRegex = new RegExp(`<verse osisID="[^.]+\\.${chapter}\\.(\\d+)"[^>]*>([\\s\\S]*?)(?=<verse|</chapter)`, 'g');
    
    let match;
    while ((match = verseRegex.exec(xmlContent)) !== null) {
        const verseNum = match[1];
        const verseContent = match[2];
        
        // Extract all word elements and get the Hebrew text
        // Words are in <w> tags, text is between > and </w>
        // The text may have / separating morphemes, we want to join without /
        const wordRegex = /<w[^>]*>([^<]+)<\/w>/g;
        const words = [];
        let wordMatch;
        while ((wordMatch = wordRegex.exec(verseContent)) !== null) {
            // The Hebrew text may have / for morpheme boundaries - remove them
            const word = wordMatch[1].replace(/\//g, '');
            words.push(word);
        }
        
        // Join words with spaces and add sof pasuq if not present
        let hebrewText = words.join(' ');
        if (hebrewText && !hebrewText.endsWith('׃')) {
            hebrewText += '׃';
        }
        
        verses[verseNum] = hebrewText;
    }
    
    return verses;
}

function updateChapterFile(bookCode, chapterNum, hebrewVerses) {
    const chapterPath = path.join(
        __dirname, 
        '..', 
        'data/gutenberg/chapters',
        bookCode,
        `${String(chapterNum).padStart(3, '0')}.json`
    );
    
    if (!fs.existsSync(chapterPath)) {
        console.error(`Chapter file not found: ${chapterPath}`);
        return false;
    }
    
    const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
    let updated = 0;
    
    for (const [verseNum, hebrewText] of Object.entries(hebrewVerses)) {
        if (chapter.verses[verseNum]) {
            chapter.verses[verseNum].hebrew = hebrewText;
            updated++;
        } else {
            console.warn(`Verse ${verseNum} not found in chapter file`);
        }
    }
    
    fs.writeFileSync(chapterPath, JSON.stringify(chapter, null, 2));
    console.log(`Updated ${updated} verses with Hebrew text in ${chapterPath}`);
    return true;
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node extract-hebrew-wlc.js <WLC-book> <chapter>');
    console.log('Example: node extract-hebrew-wlc.js Gen 1');
    console.log('\nWLC book names: Gen, Exod, Lev, Num, Deut, Josh, Judg, Ruth, 1Sam, 2Sam,');
    console.log('                1Kgs, 2Kgs, 1Chr, 2Chr, Ezra, Neh, Esth, Job, Ps, Prov,');
    console.log('                Eccl, Song, Isa, Jer, Lam, Ezek, Dan, Hos, Joel, Amos,');
    console.log('                Obad, Jonah, Mic, Nah, Hab, Zeph, Hag, Zech, Mal');
    process.exit(1);
}

const wlcBook = args[0];
const chapterNum = parseInt(args[1], 10);

if (!WLC_TO_BOOK[wlcBook]) {
    console.error(`Unknown WLC book: ${wlcBook}`);
    process.exit(1);
}

const bookCode = WLC_TO_BOOK[wlcBook];
const xmlPath = path.join(__dirname, '..', 'temp_morphhb/package/wlc', `${wlcBook}.xml`);

if (!fs.existsSync(xmlPath)) {
    console.error(`WLC XML file not found: ${xmlPath}`);
    console.log('Please run: cd wheel && mkdir -p temp_morphhb && cd temp_morphhb && npm pack morphhb && tar -xzf morphhb-*.tgz');
    process.exit(1);
}

console.log(`Extracting Hebrew from ${wlcBook} chapter ${chapterNum}...`);
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const hebrewVerses = extractHebrewFromXML(xmlContent, chapterNum);

console.log(`Found ${Object.keys(hebrewVerses).length} verses`);

if (Object.keys(hebrewVerses).length > 0) {
    // Show first 3 verses as sample
    console.log('\nSample verses:');
    Object.entries(hebrewVerses).slice(0, 3).forEach(([num, text]) => {
        console.log(`  ${num}: ${text}`);
    });
    console.log('');
    
    updateChapterFile(bookCode, chapterNum, hebrewVerses);
} else {
    console.error('No verses extracted!');
}
