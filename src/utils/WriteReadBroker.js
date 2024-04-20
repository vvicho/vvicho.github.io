function saveObject(key, data, accountId) {
    // replace with current storage
    saveLocalStorage(key, data);
}

function loadObject(key, accountId) {
    // replace with current storage
    return loadLocalStorage(key);
}
function deleteKey(key) {
    // replace with current storage
    deleteLocalStorage(key);
}

function clearAll() {
    // replace with current storage
    clearLocalStorage();
}

function saveLocalStorage(key, data) {
    localStorage.setItem(key, data);
}

function loadLocalStorage(key) {
    return localStorage.getItem(key);
}

function deleteLocalStorage(key) {
    localStorage.removeItem(key)
}

function clearLocalStorage() {
    localStorage.clear();
}



export {
    saveObject,
    loadObject,
    deleteKey,
    clearAll,
}

