import axios from 'axios';
import { load as cheerioLoad } from 'cheerio';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import pLimit from 'p-limit';
import { fileURLToPath } from 'url';

// === CONFIGURATION ===
// Resolve paths relative to THIS file to avoid "directory not found" errors
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../'); // Adjust if your folder structure differs

const CONFIG = {
    BASE_URL: "https://en.onepiece-cardgame.com",
    PATHS: {
        IMAGES: path.join(PROJECT_ROOT, 'public/cards'),
        DATA: path.join(PROJECT_ROOT, 'src/assets'),
    },
    CONCURRENCY: 5,
    FORCE_REFRESH: false,
};

// === UTILS ===
const loadJSON = (filename, defaultValue) => {
    try {
        const filePath = path.join(CONFIG.PATHS.DATA, filename);
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.warn(`⚠️ Could not load ${filename}, starting fresh.`);
        return defaultValue;
    }
};

const saveJSON = (filename, data) => {
    const filePath = path.join(CONFIG.PATHS.DATA, filename);
    if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${filename}`);
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// === CORE SCRAPER ===

const run = async () => {
    console.time("Scrape Duration");
    console.log(`🚀 Starting Scraper...`);
    console.log(`📂 Data Dir: ${CONFIG.PATHS.DATA}`);
    console.log(`📂 Image Dir: ${CONFIG.PATHS.IMAGES}`);

    // 1. Load Local State
    let allCards = loadJSON('allCardsArray.json', []);
    const metadata = loadJSON('scraper_metadata.json', { completedSets: [] });

    // === FIX 1: AUTO-PURGE OLD DATA ===
    // If data exists but is missing 'baseId' (new schema) or has old-style IDs, wipe it.
    if (allCards.length > 0) {
        const sample = allCards[0];
        if (!sample.baseId || !sample.imageFileName) {
            console.log('🧹 Old data schema detected. Purging to prevent errors...');
            allCards = [];
            metadata.completedSets = []; // Reset metadata too just to be safe
        }
    }

    // Create map for deduplication
    const cardMap = new Map(allCards.map(c => [c.id, c]));

    // 2. Fetch Series List
    console.log('📡 Fetching Series List...');
    const seriesMap = await fetchSeriesList();

    // 3. Process Each Series
    for (const [seriesId, seriesCode] of Object.entries(seriesMap)) {

        if (!CONFIG.FORCE_REFRESH && metadata.completedSets.includes(seriesCode)) {
            console.log(`⏩ Skipping ${seriesCode} (Already Completed)`);
            continue;
        }

        console.log(`\n🔍 Scanning Series: ${seriesCode} (${seriesId})`);

        // Fetch HTML and Parse Cards
        const cardsInSet = await fetchCardsFromSeries(seriesId, seriesCode);

        if (cardsInSet.length === 0) {
            console.warn(`⚠️ No cards found for ${seriesCode}.`);
            continue;
        }

        // Merge into map
        let newCardsCount = 0;
        for (const card of cardsInSet) {
            // We overwrite to ensure we get the latest schema
            if (!cardMap.has(card.id) || CONFIG.FORCE_REFRESH) {
                newCardsCount++;
            }
            cardMap.set(card.id, card);
        }
        console.log(`   Found ${cardsInSet.length} cards. (${newCardsCount} new/updated)`);

        // Mark set as complete
        if (!metadata.completedSets.includes(seriesCode)) {
            metadata.completedSets.push(seriesCode);
        }

        await sleep(1000);
    }

    // 4. Save Data
    const finalArray = Array.from(cardMap.values());
    saveJSON('allCardsArray.json', finalArray);
    saveJSON('scraper_metadata.json', metadata);

    // 5. Download Images
    if (finalArray.length > 0) {
        await downloadImages(finalArray);
    } else {
        console.log('⚠️ No cards to process.');
    }

    console.log(`\n✅ Job Complete!`);
    console.timeEnd("Scrape Duration");
};

const fetchSeriesList = async () => {
    try {
        const { data } = await axios.get(`${CONFIG.BASE_URL}/cardlist`);
        const $ = cheerioLoad(data);
        const map = {};

        $('#series option').each((_, el) => {
            const val = $(el).val();
            if (!val) return;

            let name = $(el).text();
            const match = name.match(/\[(.*?)\]/);
            const code = match ? match[1] : name;

            // Normalize promo codes
            const normalizedCode = val === '569901' ? 'P' : val === '569801' ? 'LP' : code;
            map[val] = normalizedCode;
        });
        return map;
    } catch (e) {
        console.error("❌ Failed to fetch series list:", e.message);
        return {};
    }
};

const fetchCardsFromSeries = async (seriesId, seriesCode) => {
    try {
        const { data } = await axios.get(`${CONFIG.BASE_URL}/cardlist?series=${seriesId}`);
        const $ = cheerioLoad(data);
        const cards = [];

        $('.modalCol').each((_, el) => {
            const $el = $(el);

            const name = $el.find('.cardName').text();
            const infoText = $el.find('.infoCol').text();
            const [rawId, rarity, type] = infoText.split('|').map(s => s.trim());

            const fullImgUrl = $el.find('.frontCol img').attr('data-src') || "";
            // Ensure we have a string before split
            const imgFileName = fullImgUrl.includes('/')
                ? fullImgUrl.split('/').pop().split('?')[0]
                : `${rawId}.png`; // Fallback if URL is weird

            const pMatch = imgFileName.match(/_(p\d+)\.png$/);
            const isParallel = !!pMatch;
            const parallelId = isParallel ? `${rawId}_${pMatch[1]}` : rawId;

            // Final ID: "OP01-001" (Base) or "OP01-001_p1" (Parallel)
            const finalId = isParallel ? parallelId : rawId;

            const rawEffect = $el.find('.text').text().replace('Effect', '').trim();
            const activations = parseActivations(rawEffect);

            cards.push({
                id: finalId,
                baseId: rawId,
                isParallel: isParallel,
                name: name,
                cardId: rawId,
                cardSetCode: seriesCode,
                rarity,
                cardType: type,
                color: $el.find('.color').text().replace('Color', '').split('/'),
                cost: $el.find('.cost').text().replace(/Life|Cost/, ''),
                power: $el.find('.power').text().replace('Power', ''),
                counter: $el.find('.counter').text().replace('Counter', ''),
                attribute: $el.find('.attribute i').text(),
                category: $el.find('.feature').text().replace('Type', '').split('/'),
                text: rawEffect,
                trigger: $el.find('.trigger').text().replace(/\[.*?\]/, '').trim(),
                imageUrl: `${CONFIG.BASE_URL}/images/cardlist/card/${imgFileName}`,
                imageFileName: imgFileName,
                blockNumber: $el.find('.block').text().replace('Block icon', '').trim()
            });
        });

        return cards;
    } catch (e) {
        console.error(`❌ Error fetching ${seriesCode}:`, e.message);
        return [];
    }
};

const parseActivations = (text) => {
    if (!text) return [];
    const matches = text.match(/\[(.*?)\]/gm);
    if (!matches) return [];
    return matches
        .map(x => x.replace(/[\[\]]/g, ''))
        .filter(x => !x.includes('DON!!'));
};

// === IMAGE DOWNLOADER ===

// === IMAGE DOWNLOADER ===

const downloadImages = async (cards) => {
    const total = cards.length;
    let processed = 0;

    console.log(`\n🖼️  Verifying ${total} images...`);

    const limit = pLimit(CONFIG.CONCURRENCY);

    const downloadTasks = cards.map(card => limit(async () => {
        // Increment progress immediately when we start processing or finishing a card
        // We do it at the end of the block to ensure accurate "completion" status

        try {
            // === FIX 2: DEFENSIVE CHECKS ===
            if (!card.cardSetCode || !card.imageFileName) {
                processed++;
                process.stdout.write(`\r⏳ Progress: ${processed}/${total}`);
                return;
            }

            const saveDir = path.join(CONFIG.PATHS.IMAGES, card.cardSetCode);
            const savePath = path.join(saveDir, card.imageFileName);

            // OPTIMIZATION: Check existance
            if (!CONFIG.FORCE_REFRESH && fs.existsSync(savePath)) {
                processed++;
                process.stdout.write(`\r⏳ Progress: ${processed}/${total}`);
                return;
            }

            // Ensure dir exists
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir, { recursive: true });
            }

            const response = await axios({
                method: 'get',
                url: card.imageUrl,
                responseType: 'stream'
            });

            await pipeline(response.data, fs.createWriteStream(savePath));

        } catch (e) {
            // console.error(`\n   ❌ Failed ${card.imageFileName}: ${e.message}`);
        } finally {
            // Always increment, even on error, so the counter finishes
            processed++;
            process.stdout.write(`\r⏳ Progress: ${processed}/${total}`);
        }
    }));

    await Promise.all(downloadTasks);
    console.log(`\n✅ Image verification complete.`);
};

run();