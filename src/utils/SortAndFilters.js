export const defaultSort = (cards, prop) => {
    const sortCol = prop ?? 'id'
    const ids = Object.keys(cards);
    ids.sort(
        (x, y) => {
            // sort by color
            if (sortCol === 'id') {
                return -cards[x][sortCol].localeCompare(cards[y][sortCol]);
            }
            // sort default = cardId
            if (sortCol === 'default') {
                return cards[x][sortCol].localeCompare(cards[y][sortCol]);
            }
        });
    const sortedObjects = {};
    ids.forEach(x => sortedObjects[x] = cards[x]);
    return sortedObjects;
}

export const sortCardsById = (x, y) => {
    const setX = x.cardSetCode.split('-')[0];
    const setY = y.cardSetCode.split('-')[0];
    const indexOfX = setOrder.indexOf(setX);
    const indexOfY = setOrder.indexOf(setY);
    if (indexOfX !== indexOfY) {
        return indexOfX - indexOfY;
    }
    return x.parallelId.localeCompare(y.parallelId);
}

export const sortCards = (x, y) => {
    const xSet = x.cardSetCode;
    const ySet = y.cardSetCode;
    if (xSet === ySet) {
        return x.parallelId.localeCompare(y.parallelId);
    }

    return setOrder.indexOf(xSet) - setOrder.indexOf(ySet);
}

const filterCards = (cards, cardAmounts, valueToPropertyMap, noAlts, onlyAlts, collectedCards, missingCards) => {
    let cardObjects = Object.values(cards);
    for (var filter of Object.entries(valueToPropertyMap)) {
        cardObjects = cardObjects.filter(x => {
            if (filter[1] === '') return true;
            if (filter[0] === 'name') {
                return x[filter[0]]?.toLocaleLowerCase().indexOf(filter[1]?.toLocaleLowerCase()) >= 0;
            } else if (filter[0] === 'cardSetCode') {
                return x[filter[0]]?.toLocaleLowerCase().indexOf(filter[1]?.toLocaleLowerCase().replace("-", "")) === 0;
            }
        });
    }

    // only alts
    cardObjects = cardObjects.filter(x => onlyAlts === true ? x.parallelId.indexOf('_p') > 0 : true);
    // no alts
    cardObjects = cardObjects.filter(x => noAlts === true ? x.parallelId.indexOf('_p') === -1 : true);
    // collected cards
    cardObjects = cardObjects.filter(x => collectedCards ? cardAmounts[x.parallelId] > 0 : true);
    // missing cards
    cardObjects = cardObjects.filter(x => missingCards ? cardAmounts[x.parallelId] == null || cardAmounts[x.parallelId] === 0 : true);

    // sort
    cardObjects.sort(sortCardsById);
    const filteredCards = {};
    cardObjects.map(x => filteredCards[x.parallelId] = x);
    return filteredCards;
}

export const filterCardsByName = (cards, collection, filterMap, onlyShowAlts, noAlts, collectedCards, missingCards) => {
    return filterCards(cards, collection, filterMap, noAlts, onlyShowAlts, collectedCards, missingCards);
}

export const sortBy = (cards, prop) => {

}

const setOrder = [
    "EB01",
    "OP06",
    "OP05",
    "OP04",
    "OP03",
    "OP02",
    "OP01",
    "ST13",
    "ST12",
    "ST11",
    "ST10",
    "ST09",
    "ST08",
    "ST07",
    "ST06",
    "ST05",
    "ST04",
    "ST03",
    "ST02",
    "ST01",
    "P",
    "DON",
];