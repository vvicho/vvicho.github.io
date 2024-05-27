import axios, { Axios } from 'axios'
import { load as cheerioLoad } from 'cheerio';
import allCards from '../assets/allCards.json' assert {type: 'json'};
import fs from 'fs';
import path from 'path'
import request from 'request';
import missingCardImages from '../assets/missingCardImages.json' assert {type: 'json'};
import downloadedSets from '../assets/sets.json' assert {type: 'json'};

const GLB_BASE_URL = "https://en.onepiece-cardgame.com";
const IMAGE_SAVE_PATH = 'public/cards';

const run = async (url, lang, partialRun = false, force = false) => {
    const sets = {};
    console.log(`getSeries start`)
    const series = await getSeries(url);
    console.log(series);
    console.log(`getSeries end`);
    const newCards = {};
    const missingImages = {};
    missingCardImages.missingCards?.map(id => missingImages[id] = '');
    for (var seriesId of Object.keys(series)) {
        console.log(`getCardsFromSeries ${seriesId} start`);
        let cards = await getCardsFromSeries(seriesId, url, lang);
        console.log(`getCardsForSeries ${seriesId} end`)
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            sets[seriesId] = series[seriesId];
            if (downloadedSets[series[seriesId]] != null && partialRun) {
                console.log(`skip set ${card.cardSetCode}`);
                continue;
            }
            console.log(`processing card ${card.parallelId}`);
            if (!allCards[card.parallelId] || force === true) {
                console.log(`new card ${card.parallelId}`)
                newCards[card.parallelId] = card;
                allCards[card.parallelId] = card;
            }

            if (missingCardImages &&
                missingCardImages.missingCards &&
                missingCardImages.missingCards.indexOf(card.cardId) >= 0
            ) {
                console.log(`--- missing image ${card.parallelId}`);
                missingImages[card.parallelId] = card;
            }
        }
    }

    // download images for new cards
    console.log('download newCards');
    console.log(newCards);
    if (newCards && newCards != {}) {
        // overwrite allCards json
        await downloadImagesInBatches(newCards);
        fs.writeFile(
            'src/assets/allCards.json',
            JSON.stringify(allCards, null, 2),
            x => console.log(`finalized writing file allCards ${x}`)
        );
    }
    console.log('download missing images')
    // console.log(missingImages);
    if (missingImages && missingImages != {}) {
        await downloadImagesInBatches(missingImages);
        // overwrite missingImages json
        fs.writeFile(
            'src/assets/missingCardImages.json',
            JSON.stringify({ missingCards: [] }, null, 2),
            x => console.log(`finalized writing file missingImages \n${x}`)
        );
    }
    sets['DON'] = 'DON';

    fs.writeFile(
        'src/assets/sets.json',
        JSON.stringify(sets, null, 2),
        x => console.log(`finalized writing file sets \n${x}`)
    );
}

const downloadImagesInBatches = async cards => {
    let ids = Object.keys(cards);
    console.log(ids);
    // ids = ids.sort()
    const sliceIntoChunks = (arr, chunkSize) => {
        const newArr = [];
        while (arr.length) {
            newArr.push(arr.splice(0, chunkSize))
        }
        return newArr;
    }

    const chunks = sliceIntoChunks(ids, 20);

    while (chunks.length) {
        await Promise.all(
            chunks.shift().map(
                cardId => new Promise((resolve, reject) => {
                    setTimeout(() => {
                        download(
                            cards[cardId],
                            () => console.log(`finished downloading ${cards[cardId].parallelId}`)
                        )
                        resolve()
                    }, 3000);
                })
            )
        );
    }
}



const getSeries = async (url) => {
    const response = await axios.get(`${url}/cardlist`, {
        method: 'GET',
        headers: {
            Accept: 'text/html',
        },
    });
    const $ = cheerioLoad(response.data);
    const seriesSelector = $('#series');
    const options = seriesSelector.find('option');
    const seriesMap = {};
    options.each((_, ref) => {
        const elem = $(ref);
        console.log(elem.contents().first().text());
        const seriesId = elem.attr('value');
        if (seriesId === undefined || seriesId === '') return;
        let seriesCode = elem.contents().first().text();
        seriesCode = seriesCode.substring(seriesCode.indexOf('[') + 1, seriesCode.indexOf(']'));
        seriesCode = seriesId === '569901' ? 'P' : seriesId === '569801' ? "LP" : seriesCode;
        seriesMap[seriesId] = seriesCode;
    });

    return seriesMap;
}

const getCardsFromSeries = async (seriesId, url, lang) => {
    const response = await axios.get(`${url}/cardlist?series=${seriesId}`, {
        method: 'GET',
        headers: {
            Accept: 'text/html',
        },
    });
    const $ = cheerioLoad(response.data);
    const cardModalList = $('.modalCol');
    const cards = [];
    cardModalList.each((_, ref) => {
        const elem = $(ref);
        const info = elem.find('.infoCol').text().replace('\n', '').split('|').map(e => e.trim());
        const name = elem.find('.cardName').text();
        const fullImgUrl = elem.find('.frontCol').find('img').attr('src');
        const imgFile = fullImgUrl.substring(fullImgUrl.lastIndexOf('/') + 1, fullImgUrl.indexOf('?'));
        let cost = elem.find('.cost').text().replace(/Life|Cost/, '');
        const attribute = elem.find('.attribute').find('i').text();
        const power = elem.find('.power').text().replace('Power', '');
        const counter = elem.find('.counter').text().replace('Counter', '');
        const color = elem.find('.color').text().replace('Color', '').split('\/');
        const types = elem.find('.feature').text().replace('Type', '').split('\/');
        const text = elem.find('.text').text().replace('Effect', '');
        const set = elem.find('.getInfo').text().replace(/\[.+\]/, '').replace('Card Set(s)', '').trim();
        const trigger = elem.find('.trigger').text().replace(/\[.+\]/, '').trim();
        const activations = getActivations(text);
        const imgUrl = `${url}/images/cardlist/card/${imgFile}`;
        const parallelId = getParallelId(name, info[0], imgFile);
        if (cost === '-' && info[2] === 'EVENT') { cost = '0' };
        const card = {
            id: `${name}_${parallelId}`, // generated card id (cardId+parallelNumber)
            rarity: info[1],
            cardType: info[2],
            name: name,
            imageName: imgFile,
            cost: cost,
            attribute: attribute,
            power: power,
            counter: counter,
            trigger: trigger,
            color: color,
            category: types,
            text: text,
            cardSet: set,
            imageUrl: imgUrl,
            cardSetCode: getSetCode(info[0]),
            cardId: info[0],
            activation: activations,
            parallelId: parallelId,
        };

        cards.push(card);
        return;
    });
    return cards;
}

const getSetCode = (cardSet) => {
    return cardSet.split('-')[0];
}

const getActivations = (text) => {
    var n = text.match(/\[(.*?)\]/gm);
    if (!n) return null;
    return n.map(x => x.replace(/\[|\]/g, ''));
}

const getParallelId = (name, id, imgUrl) => {
    const match = imgUrl.match(/\_(p[0-9])\.png/);
    if (!match) return id;

    return `${id}_${match[1]}`;
}

const download = async (card, callback) => {
    console.log(card);
    console.log(`downloading ${card.parallelId}`);
    request.head(card.imageUrl, function (_a, _b, _c) {
        const directoryPath = path.join(path.resolve(), `${IMAGE_SAVE_PATH}/${card.cardSetCode}`);
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath);
        }
        const filename = path.join(directoryPath, `${card.parallelId}.png`)
        request(card.imageUrl).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};

// partialRunRun will run for not downloaded sets
// await run(GLB_BASE_URL, 'en', partialRun = false);
// force will download everything again (remember to compress pngs)
// await run(GLB_BASE_URL, 'en', force = true);

// partial 
// await run(GLB_BASE_URL, 'en', true, false);
// full

await run(GLB_BASE_URL, 'en', false, false);