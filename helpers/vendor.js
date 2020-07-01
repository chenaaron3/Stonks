let keys = JSON.parse(process.env.TIINGO_API_KEYS);
let index = 0;

function getKey() {
    let res = keys[index];
    index += 1;
    index %= keys.length;
    return res;
}

module.exports = {getKey: getKey};