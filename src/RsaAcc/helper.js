const random = require('random-bigint');
const millerRabin = require('primality-test').primalityTest;

function mod(a, n) {
    const r = a % n;
    return r >= 0n ? r : r + n;
}

async function isPrime(n) {
    if (n < 2n) {
        return false;
    }

    const lowPrimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997]
        .map(BigInt);

    if (lowPrimes.includes(n)) {
        return true;
    }

    for (const prime of lowPrimes) {
        if (mod(n, prime) === 0n) {
            return false;
        }
    }

    return (await millerRabin(n, { findDivisor: false })).probablePrime;
}

async function generateLargePrime(nBits) {
    while (true) {
        const n = random(nBits);
        if (await isPrime(n)) {
            return n;
        }
    }
}

async function generateTwoLargeDistinctPrimes(nBits) {
    p = await generateLargePrime(nBits);
    while (true) {
        q = await generateLargePrime(nBits);
        if (p !== q) {
            return [p, q];
        }
    }
}

function xgcd(b, a) {
    let [x0, x1, y0, y1, q] = [1n, 0n, 0n, 1n, 0n];
    while (a !== 0n) {
        q = b / a; // `/` for BigInt is floor division
        [b, a] = [a, mod(b, a)];
        [x0, x1] = [x1, x0 - q * x1];
        [y0, y1] = [y1, y0 - q * y1];
    }
    return [b, x0, y0]
}

function mulInv(b, n) {
    const [g, x, _] = xgcd(b, n)
    if (g === 1n) {
        return mod(x, n);
    }
}

function bezoute(x, y) {
    let [, a, b] = xgcd(x, y);
    while (a <= 0) {
        a += y;
        b -= x;
    }
    return [a, b];
}

function product(arr) {
    return arr.reduce((prod, cur) => prod * cur);
}

module.exports = { mod, isPrime, generateLargePrime, generateTwoLargeDistinctPrimes, xgcd, mulInv, bezoute, product };
