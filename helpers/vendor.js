var path = require('path');
var fs = require('fs');

let keys = JSON.parse(process.env.TIINGO_API_KEYS);
let usableKeys = [...keys];
let index = 0;
let symbols = JSON.parse(fs.readFileSync(path.join(__dirname, "../res/symbols.json"), { encoding: "utf-8" }));
let numSymbols = symbols.length;
console.log(`Keys: ${keys.length}\nSymbols: ${numSymbols}\nSymbols per Key: ${numSymbols / keys.length}`);

function numKeys() {
    return keys.length;
}

function getSymbolIndex(symbol) {
    let index = symbols.indexOf(symbol);
    return index == -1 ? 0 : index;
}

function removeKey(key) {
    const index = usableKeys.indexOf(key);
    if (index > -1) {
        usableKeys.splice(index, 1);
    }
}

function getKey(index, attempts) {
    // if first attempt, try using partition
    if (attempts == 0)
    {
        return getKeyPartition(index);
    }
    // if partitioned key fails, use round robin
    else
    {
        return getKeyRoundRobin();
    }
}

function getKeyPartition(index) {
    let keyIndex = Math.floor( (index / numSymbols) * keys.length );
    return keys[keyIndex];
}

function getKeyRoundRobin() {
    let res = usableKeys[index];
    index += 1;
    index %= usableKeys.length;
    return res;
}

module.exports = { getKey: getKey, removeKey:removeKey, numKeys: numKeys, getSymbolIndex: getSymbolIndex };