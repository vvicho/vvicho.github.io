export const defaultSort = (cards, prop) => {
    const sortCol = prop ?? 'id'
    const ids = Object.keys(cards);
    ids.sort(
        (x, y) => {
            // sort default = cardId
            if (sortCol === 'default') {
                return cards[x][sortCol].localeCompare(cards[y][sortCol]);
            }
        });
    const sortedObjects = {};
    ids.forEach(x => sortedObjects[x] = cards[x]);
    return sortedObjects;
}

export const sortBy = (cards, prop) => {

}