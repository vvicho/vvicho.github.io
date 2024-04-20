import axios, { Axios } from 'axios'
import { load as cheerioLoad } from 'cheerio';
import client from 'https'
import allCards from '../assets/allCards.json' assert {type: 'json'};
import fs from 'fs';
// import download from 'image-downloader'
import path from 'path'
import { fileURLToPath } from 'url';
import request from 'request';


const GLB_BASE_URL = "https://en.onepiece-cardgame.com";
const IMAGE_SAVE_PATH = 'src/assets/cards';
const CARD_LIST_PATH = '/assets/sets.json'


const run = async (url, lang) => {
    console.log(`getSeries sart`)
    const series = await getSeries(url);
    console.log(series);
    console.log(`getSeries end`)
    const newCards = {};
    for (var seriesId of series) {
        console.log(`getCardsFromSeries ${seriesId} start`);
        let cards = await getCardsFromSeries(seriesId, url, lang);
        console.log(`getCardsForSeries ${seriesId} end`)
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            console.log(`processing card ${card.parallelId}`);
            if (allCards[card.parallelId]) {
                console.log(`card ${card.parallelId} already in allcards`)
                continue;
            } else {
                newCards[card.parallelId] = card;
                allCards[card.parallelId] = card;
            }
        }
    }
    // download images for new cards
    await downloadImagesInBatches(newCards);
    fs.writeFile('src/assets/allCards.json', JSON.stringify(allCards, null, 2), x => console.log(`finalized writing file ${x}`));
}

const downloadImagesInBatches = async cards => {
    const ids = Object.keys(cards);
    ids = ids.sort()
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
    const seriesArr = [];
    options.each((_, ref) => {
        const elem = $(ref);
        const seriesId = elem.attr('value');
        if (seriesId === undefined || seriesId === '') return;
        let seriesName = elem.text();
        seriesName = seriesName.replace(/\<br.*\>/, "");
        seriesArr.push(seriesId);
    });

    return seriesArr;
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
        const cost = elem.find('.cost').text().replace(/Life|Cost/, '');
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

// const downloadImage = async (url, card) => {
//     const path = `${IMAGE_SAVE_PATH}/${card.cardSetCode}/${card.cardId}.png`;
//     console.log('__filename:', path.dirname(fileURLToPath(import.meta.url)));
//     // console.log('__dirname:', );
//     return download.image({
//         url,
//         dest: path,
//     });
// };

// const saveImageToFile = async (cardId, cardSet, image) => {
//     image.data.pipe(fs.createWriteStream(`${IMAGE_SAVE_PATH}/${cardSet}/${cardId}.png`))
// }

const download = async function (card, callback) {
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

await run(GLB_BASE_URL, 'en');
