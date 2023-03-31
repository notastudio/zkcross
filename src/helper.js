const snarkjs = require("snarkjs");

function mkMimc(wasmPath, zkeyPath) {
    return async function mimc(v, rd, sn) {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve({
            "ins": [v, rd, sn],
        }, wasmPath, zkeyPath);

        return publicSignals[0];
    }
}

function numberToBase(num, b) {
    if (typeof num !== 'bigint') num = BigInt(num);
    if (typeof b !== 'bigint') b = BigInt(b);
    if (num < 0n) num = -num;

    if (num === 0n) {
        return [0];
    }
    const ret = [];
    while (num > 0n) {
        ret.push(num % b);
        num /= b;
    }
    return ret;
}

function numberToArray(num, n, k) {
    if (typeof num !== 'bigint') num = BigInt(num);
    if (typeof n !== 'bigint') n = BigInt(n);
    if (num < 0n) num = -num;

    const ret = [];
    for (let i = 0; i < k; i += 1) {
        ret.push(num % (2n ** n));
        num /= 2n ** n;
    }
    return ret;
}

function arrayPad(arr, len, pad) {
    while (arr.length < len) {
        arr.push(pad);
    }
    return arr;
}

module.exports = { mkMimc, numberToBase, numberToArray, arrayPad };
