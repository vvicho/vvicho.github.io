export const defaultSort = (cards, prop) => {
    const sortCol = prop ?? 'id'
    const ids = Object.keys(cards);
    ids.sort(
        (x, y) => {
            // sort by color

            // sort default = cardId
            if (sortCol === 'default') {
                return cards[x][sortCol].localeCompare(cards[y][sortCol]);
            }
        });
    const sortedObjects = {};
    ids.forEach(x => sortedObjects[x] = cards[x]);
    return sortedObjects;
}

const filterCardsByProp = (cards, val, prop) => {
    const filterProp = prop ?? 'name';
    const ids = Object.keys(cards);
    const filteredCardIds = ids.filter(x => {
        return cards[x][filterProp].toLocaleLowerCase().indexOf(val.toLocaleLowerCase()) >= 0
    });

    const filteredCards = {};
    filteredCardIds.map(x => filteredCards[x] = cards[x]);
    return filteredCards;
}

export const filterCardsByName = (cards, val) => {
    if (val === '' || val == null) return cards;
    return filterCardsByProp(cards, val, 'name');
}

export const sortBy = (cards, prop) => {

}