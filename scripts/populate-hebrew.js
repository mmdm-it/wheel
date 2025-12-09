#!/usr/bin/env node

/**
 * Populate Hebrew text from Westminster Leningrad Codex (WLC) into chapter JSON files
 * 
 * Source: OpenScriptures morphhb (CC BY 4.0, text is public domain)
 * https://github.com/openscriptures/morphhb
 * 
 * Usage: node populate-hebrew.js [book] [chapter]
 *   node populate-hebrew.js              # All books
 *   node populate-hebrew.js Gen          # All Genesis chapters
 *   node populate-hebrew.js Gen 1        # Genesis chapter 1 only
 */

const fs = require('fs');
const path = require('path');

// WLC book names to our BOOK codes mapping
// Corrected based on actual directory names in data/gutenberg/chapters/
const WLC_TO_BOOK = {
    'Gen': 'GENE', 'Exod': 'EXO', 'Lev': 'LEVI', 'Num': 'NUME', 'Deut': 'DEUT',
    'Josh': 'IOSU', 'Judg': 'IUDI', 'Ruth': 'RUTH', '1Sam': 'I_SAM', '2Sam': 'II_SAM',
    '1Kgs': 'III_REG', '2Kgs': 'IV_REG', '1Chr': 'I_PARA', '2Chr': 'II_PARA',
    'Ezra': 'ESDR', 'Neh': 'NEHE', 'Esth': 'ESTH', 'Job': 'IOB',
    'Ps': 'PSAL', 'Prov': 'PROV', 'Eccl': 'ECCLE', 'Song': 'CANT',
    'Isa': 'ISA', 'Jer': 'IERE', 'Lam': 'LAME', 'Ezek': 'EZE', 'Dan': 'DAN',
    'Hos': 'OSE', 'Joel': 'IOEL', 'Amos': 'AMO', 'Obad': 'ABDI', 'Jonah': 'IONA',
    'Mic': 'MICH', 'Nah': 'NAHU', 'Hab': 'HAB', 'Zeph': 'SOPH', 'Hag': 'AGGE',
    'Zech': 'ZACH', 'Mal': 'MALA'
};

// Reverse mapping
const BOOK_TO_WLC = Object.fromEntries(
    Object.entries(WLC_TO_BOOK).map(([k, v]) => [v, k])
);

const SOURCES_DIR = path.join(__dirname, '..', 'sources/hebrew/wlc');
const CHAPTERS_DIR = path.join(__dirname, '..', 'data/gutenberg/chapters');

/**
 * Extract Hebrew verses from WLC XML for a specific chapter
 */
function extractHebrewFromXML(xmlContent, chapter) {
    const verses = {};
    
    // Match verses for this chapter
    // Pattern: <verse osisID="Gen.1.31"> ... </verse> or content until next verse
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
        
        if (hebrewText) {
            verses[verseNum] = hebrewText;
        }
    }
    
    return verses;
}

/**
 * Get all chapter numbers from a WLC XML file
 */
function getChaptersFromXML(xmlContent) {
    const chapters = new Set();
    const chapterRegex = /<chapter osisID="[^.]+\.(\d+)"/g;
    let match;
    while ((match = chapterRegex.exec(xmlContent)) !== null) {
        chapters.add(parseInt(match[1], 10));
    }
    return Array.from(chapters).sort((a, b) => a - b);
}

/**
 * Update a chapter JSON file with Hebrew text
 */
function updateChapterFile(bookCode, chapterNum, hebrewVerses) {
    const chapterPath = path.join(
        CHAPTERS_DIR,
        bookCode,
        `${String(chapterNum).padStart(3, '0')}.json`
    );
    
    if (!fs.existsSync(chapterPath)) {
        console.warn(`  ⚠️  Chapter file not found: ${chapterPath}`);
        return { updated: 0, missing: 0 };
    }
    
    const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
    let updated = 0;
    let missing = 0;
    
    for (const [verseNum, hebrewText] of Object.entries(hebrewVerses)) {
        if (chapter.verses[verseNum]) {
            chapter.verses[verseNum].hebrew = hebrewText;
            updated++;
        } else {
            missing++;
        }
    }
    
    fs.writeFileSync(chapterPath, JSON.stringify(chapter, null, 2));
    return { updated, missing };
}

/**
 * Process a single book
 */
function processBook(wlcBook, specificChapter = null) {
    const bookCode = WLC_TO_BOOK[wlcBook];
    if (!bookCode) {
        console.error(`Unknown WLC book: ${wlcBook}`);
        return { chapters: 0, verses: 0 };
    }
    
    const xmlPath = path.join(SOURCES_DIR, `${wlcBook}.xml`);
    if (!fs.existsSync(xmlPath)) {
        console.error(`WLC XML file not found: ${xmlPath}`);
        return { chapters: 0, verses: 0 };
    }
    
    console.log(`\n📖 Processing ${wlcBook} → ${bookCode}`);
    
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    const chapters = specificChapter ? [specificChapter] : getChaptersFromXML(xmlContent);
    
    let totalVerses = 0;
    let totalChapters = 0;
    
    for (const chapterNum of chapters) {
        const hebrewVerses = extractHebrewFromXML(xmlContent, chapterNum);
        const verseCount = Object.keys(hebrewVerses).length;
        
        if (verseCount > 0) {
            const result = updateChapterFile(bookCode, chapterNum, hebrewVerses);
            totalVerses += result.updated;
            totalChapters++;
            console.log(`  Chapter ${chapterNum}: ${result.updated} verses updated`);
        }
    }
    
    return { chapters: totalChapters, verses: totalVerses };
}

/**
 * Process all books
 */
function processAllBooks() {
    const xmlFiles = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith('.xml') && f !== 'VerseMap.xml');
    
    let grandTotalChapters = 0;
    let grandTotalVerses = 0;
    
    for (const xmlFile of xmlFiles) {
        const wlcBook = xmlFile.replace('.xml', '');
        const result = processBook(wlcBook);
        grandTotalChapters += result.chapters;
        grandTotalVerses += result.verses;
    }
    
    return { chapters: grandTotalChapters, verses: grandTotalVerses };
}

// Main execution
const args = process.argv.slice(2);

console.log('═══════════════════════════════════════════════════════');
console.log('  Hebrew Population Script - Westminster Leningrad Codex');
console.log('═══════════════════════════════════════════════════════');
console.log(`Source: ${SOURCES_DIR}`);
console.log(`Target: ${CHAPTERS_DIR}`);

let result;

if (args.length === 0) {
    // Process all books
    console.log('\n🔄 Processing ALL books...');
    result = processAllBooks();
} else if (args.length === 1) {
    // Process specific book (all chapters)
    result = processBook(args[0]);
} else if (args.length === 2) {
    // Process specific book and chapter
    result = processBook(args[0], parseInt(args[1], 10));
} else {
    console.log('Usage: node populate-hebrew.js [book] [chapter]');
    console.log('  node populate-hebrew.js              # All books');
    console.log('  node populate-hebrew.js Gen          # All Genesis chapters');
    console.log('  node populate-hebrew.js Gen 1        # Genesis chapter 1 only');
    process.exit(1);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`✅ Complete: ${result.chapters} chapters, ${result.verses} verses updated`);
console.log('═══════════════════════════════════════════════════════');
