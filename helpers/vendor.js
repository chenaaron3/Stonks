let keys = JSON.parse(process.env.TIINGO_API_KEYS);
let usableKeys = [...keys];
let index = 0;

function numKeys() {
    return keys.length;
}

function removeKey(key) {
    const index = usableKeys.indexOf(key);
    if (index > -1) {
        usableKeys.splice(index, 1);
    }
}

function getKey() {
    let res = usableKeys[index];
    index += 1;
    index %= usableKeys.length;
    return res;
}

module.exports = { getKey: getKey, removeKey:removeKey, numKeys: numKeys };