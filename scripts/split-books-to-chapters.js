#!/usr/bin/env node
/**
 * Split Gutenberg book files into individual chapter files
 * 
 * This script reads the 67 book files from data/gutenberg/books/
 * and creates 1,189 chapter files in data/gutenberg/chapters/
 * 
 * Usage: node scripts/split-books-to-chapters.js
 */

const fs = require('fs');
const path = require('path');

const BOOKS_DIR = path.join(__dirname, '..', 'data', 'gutenberg', 'books');
const CHAPTERS_DIR = path.join(__dirname, '..', 'data', 'gutenberg', 'chapters');
const MANIFEST_PATH = path.join(__dirname, '..', 'data', 'gutenberg', 'manifest.json');

// Statistics
let totalBooks = 0;
let totalChapters = 0;
let totalVerses = 0;

/**
 * Create chapter file content
 */
function createChapterFile(bookKey, chapterKey, chapterData, bookMeta) {
    const chapterNumber = parseInt(chapterKey, 10);
    const verses = chapterData.verses || {};
    const verseCount = Object.keys(verses).length;
    const paddedChapter = String(chapterNumber).padStart(3, '0');
    
    totalVerses += verseCount;
    
    return {
        chapter_id: `${bookKey}_${paddedChapter}`,
        chapter_key: chapterKey,
        chapter_number: chapterNumber,
        sort_number: chapterNumber,
        name: String(chapterNumber),
        book_key: bookKey,
        testament: bookMeta.testament,
        section: bookMeta.section,
        verse_count: verseCount,
        verses: verses
    };
}

/**
 * Process a single book file
 */
function processBook(bookFileName) {
    const bookPath = path.join(BOOKS_DIR, bookFileName);
    const bookData = JSON.parse(fs.readFileSync(bookPath, 'utf8'));
    
    const bookKey = bookData.book_key;
    const chapters = bookData.chapters || {};
    const chapterCount = Object.keys(chapters).length;
    
    console.log(`📖 Processing ${bookKey}: ${chapterCount} chapters`);
    
    // Create book directory in chapters folder
    const bookChaptersDir = path.join(CHAPTERS_DIR, bookKey);
    if (!fs.existsSync(bookChaptersDir)) {
        fs.mkdirSync(bookChaptersDir, { recursive: true });
    }
    
    const bookMeta = {
        testament: bookData.testament,
        section: bookData.section
    };
    
    const chapterRefs = {};
    
    // Process each chapter
    for (const [chapterKey, chapterData] of Object.entries(chapters)) {
        const chapterNumber = parseInt(chapterKey, 10);
        const paddedChapter = String(chapterNumber).padStart(3, '0');
        const chapterFileName = `${paddedChapter}.json`;
        const chapterFilePath = path.join(bookChaptersDir, chapterFileName);
        
        // Create chapter file content
        const chapterFileContent = createChapterFile(bookKey, chapterKey, chapterData, bookMeta);
        
        // Write chapter file
        fs.writeFileSync(chapterFilePath, JSON.stringify(chapterFileContent, null, 2));
        
        // Create chapter reference for manifest
        chapterRefs[chapterKey] = {
            sort_number: chapterNumber,
            name: String(chapterNumber),
            _external_file: `data/gutenberg/chapters/${bookKey}/${chapterFileName}`,
            _loaded: false
        };
        
        totalChapters++;
    }
    
    totalBooks++;
    
    return {
        bookKey,
        chapterCount,
        chapterRefs,
        bookMeta
    };
}

/**
 * Update manifest.json with chapter references
 */
function updateManifest(bookResults) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const rootKey = Object.keys(manifest)[0]; // "Gutenberg_Bible"
    const root = manifest[rootKey];
    
    // Update schema version to indicate chapter-level split
    root.display_config.volume_schema_version = "3.0.0";
    root.display_config.volume_data_version = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    root.display_config.structure_type = "split_chapters";
    
    // Process each book result
    for (const result of bookResults) {
        const { bookKey, chapterRefs, bookMeta } = result;
        
        // Find the book in the manifest
        const testamentData = root.testaments[bookMeta.testament];
        if (!testamentData) continue;
        
        const sectionData = testamentData.sections[bookMeta.section];
        if (!sectionData || !sectionData.books) continue;
        
        const bookData = sectionData.books[bookKey];
        if (!bookData) continue;
        
        // Replace _external_file with chapters object
        delete bookData._external_file;
        delete bookData._loaded;
        
        // Add chapter count and chapters with external file refs
        bookData.chapter_count = Object.keys(chapterRefs).length;
        bookData.chapters = chapterRefs;
    }
    
    // Write updated manifest
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`\n✅ Updated manifest.json with chapter references`);
}

/**
 * Main execution
 */
function main() {
    console.log('🔄 Splitting Gutenberg books into chapters...\n');
    
    // Create chapters directory if it doesn't exist
    if (!fs.existsSync(CHAPTERS_DIR)) {
        fs.mkdirSync(CHAPTERS_DIR, { recursive: true });
    }
    
    // Get all book files
    const bookFiles = fs.readdirSync(BOOKS_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${bookFiles.length} book files\n`);
    
    // Process each book
    const bookResults = [];
    for (const bookFile of bookFiles) {
        try {
            const result = processBook(bookFile);
            bookResults.push(result);
        } catch (error) {
            console.error(`❌ Error processing ${bookFile}:`, error.message);
        }
    }
    
    // Update manifest
    updateManifest(bookResults);
    
    // Print summary
    console.log('\n📊 Summary:');
    console.log(`   Books processed: ${totalBooks}`);
    console.log(`   Chapter files created: ${totalChapters}`);
    console.log(`   Total verses: ${totalVerses}`);
    console.log(`\n✅ Done! Chapter files are in data/gutenberg/chapters/`);
}

main();
