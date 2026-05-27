import sharp from 'sharp';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. ROBUST PATH RESOLUTION
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const INPUT_DIR = path.join(PROJECT_ROOT, 'public/cards');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public/cards_compressed');

const TARGET_HEIGHT = 600;
const QUALITY = 80;

const run = async () => {
    console.log(`📍 Project Root: ${PROJECT_ROOT}`);

    // Windows-compatible glob pattern
    const globPattern = `${INPUT_DIR.replace(/\\/g, '/')}/**/*.+(png|jpg|jpeg|PNG|JPG)`;
    const files = await glob(globPattern);
    const total = files.length;

    if (total === 0) {
        console.error('❌ No images found!');
        return;
    }

    console.log(`✅ Found ${total} images. Starting compression...`);

    let processed = 0;
    let errors = 0;
    let skipped = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (filePath) => {
            try {
                const relativePath = path.relative(INPUT_DIR, filePath);
                const outputFilePath = path.join(
                    OUTPUT_DIR,
                    relativePath.replace(/\.(png|jpg|jpeg|PNG|JPG)$/, '.webp')
                );
                const outputDir = path.dirname(outputFilePath);

                // Check if exists
                if (fs.existsSync(outputFilePath)) {
                    skipped++;
                } else {
                    // Create dir if missing
                    if (!fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, { recursive: true });
                    }

                    // Compress
                    await sharp(filePath)
                        .resize({ height: TARGET_HEIGHT })
                        .webp({ quality: QUALITY })
                        .toFile(outputFilePath);
                }

                processed++;

                // === THE FIX: DYNAMIC LOGGING ===
                // \r moves cursor to start of line, allowing us to overwrite it
                process.stdout.write(`\r⏳ Progress: ${processed} / ${total} (Errors: ${errors})`);

            } catch (err) {
                errors++;
                // Print error on a new line so we don't overwrite it
                console.error(`\n❌ Error on ${filePath}:`, err.message);
            }
        }));
    }

    console.log(`\n\n🎉 Compression Complete!`);
    console.log(`   Total Files: ${total}`);
    console.log(`   Compressed:  ${processed - skipped}`);
    console.log(`   Skipped:     ${skipped}`);
    console.log(`   Errors:      ${errors}`);
};

run();