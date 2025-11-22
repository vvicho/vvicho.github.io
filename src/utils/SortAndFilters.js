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
    const groupOf = (code) => (code?.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
    const numberOf = (code) => {
        const m = code?.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
    };

    const groupPriority = { EB: 0, PRB: 1, OP: 2, ST: 3, P: 4, DON: 5 };

    const baseOf = (card) => (card.cardId ?? card.parallelId ?? '').split('_')[0] ?? '';
    const altRank = (parallelId) => {
        const m = parallelId?.match(/_p(\d+)/);
        return m ? parseInt(m[1], 10) : -1; // -1 means base (no alt)
    };

    const gx = groupOf(x.cardSetCode);
    const gy = groupOf(y.cardSetCode);
    const px = groupPriority[gx] ?? 999;
    const py = groupPriority[gy] ?? 999;

    if (px !== py) return px - py;

    const nx = numberOf(x.cardSetCode);
    const ny = numberOf(y.cardSetCode);
    if (nx !== ny) return nx - ny;

    // Within same set, group by base id (cardId or base of parallelId)
    const bx = baseOf(x);
    const by = baseOf(y);
    if (bx !== by) return bx.localeCompare(by);

    // Prioritize alts first, with higher _pN first (descending), then base
    const ax = altRank(x.parallelId);
    const ay = altRank(y.parallelId);
    if (ax !== ay) return ay - ax;

    // Stable fallback
    return (x.parallelId ?? '').localeCompare(y.parallelId ?? '');
}

export const sortCards = (x, y) => {
    // Reuse the same ordering as sortCardsById
    return sortCardsById(x, y);
}

const filterCards = (cards, cardAmounts, valueToPropertyMap, noAlts, onlyAlts, collectedCards, missingCards) => {
    let cardObjects = Object.values(cards);
    for (var filter of Object.entries(valueToPropertyMap)) {
        cardObjects = cardObjects.filter(x => {
            if (filter[1] === '') return true;
            if (filter[0] === 'name') {
                return x[filter[0]]?.toLocaleLowerCase().indexOf(filter[1]?.toLocaleLowerCase()) >= 0;
            } else if (filter[0] === 'cardSetCode') {
                const normalized = filter[1]?.toLocaleLowerCase().replace('-', '');
                return x[filter[0]]?.toLocaleLowerCase() === normalized;
            }
        });
    }

    // only alts
    cardObjects = cardObjects.filter(x => onlyAlts === true ? x.parallelId.indexOf('_') > 0 : true);
    // no alts
    cardObjects = cardObjects.filter(x => noAlts === true ? x.parallelId.indexOf('_') === -1 : true);
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