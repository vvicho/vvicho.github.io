function saveObject(key, data, accountId) {
    saveLocalStorage(key, data);
}

function loadObject(key, accountId) {
    return loadLocalStorage(key);
}

function saveLocalStorage(key, data) {
    localStorage.setItem(key, data);
}

function loadLocalStorage(key) {
    return localStorage.getItem(key);
}

export default { saveObject, loadObject }

