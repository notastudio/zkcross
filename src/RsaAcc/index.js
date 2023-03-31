const random = require('random-bigint');
const modPow = require('bigint-mod-arith').modPow;
const { mod, isPrime, generateLargePrime, generateTwoLargeDistinctPrimes, xgcd, mulInv, bezoute, product } = require('./helper.js');

class RSAAccumulator {
    constructor(n, g, A, product) {
        if (typeof n !== 'bigint') n = BigInt(n);
        if (typeof g !== 'bigint') g = BigInt(g);
        if (typeof A !== 'bigint') A = BigInt(A);
        if (typeof product !== 'bigint') product = BigInt(product);

        this.n = n;
        this.g = g;
        this.A = A;
        this.product = product;
    }

    static async setup(nBits) {
        const [p, q] = await generateTwoLargeDistinctPrimes(nBits / 2);
        const n = p * q;
        const A0 = mod(random(nBits), n);

        return new RSAAccumulator(n, A0, A0, 1n);
    }

    add(x) {
        this.A = modPow(this.A, x, this.n);
        this.product *= x;
        return this.A;
    }

    memWitCreate(x) {
        const sstar = this.product / x;
        return modPow(this.g, sstar, this.n);
    }

    nonMemWitCreate(x) {
        const [a, b] = bezoute(this.product, x);
        let B = 0;
        if (b < 0) {
            const bPos = -b;
            const invG = mulInv(this.g, this.n);
            B = modPow(invG, bPos, this.n);
        } else {
            B = modPow(this.g, b, this.n);
        }
        return [a, B];
    }

    verMem(w, x) {
        return modPow(w, x, this.n) === this.A;
    }

    verNonMem(u, x) {
        const [a, B] = u;
        let power1 = 0;
        if (a < 0) {
            const aPos = -a;
            const invA = mulInv(this.A, this.n);
            power1 = modPow(invA, aPos, this.n);
        } else {
            power1 = modPow(this.A, a, this.n);
        }
        const power2 = modPow(B, x, this.n);
        return mod(power1 * power2, this.n) === this.g;
    }

    memWitCreateStar(xArr) {
        const xstar = product(xArr);
        return this.memWitCreate(xstar);
    }

    nonMemWitCreateStar(xArr) {
        const xstar = product(xArr);
        return this.nonMemWitCreate(xstar);
    }

    verMemStar(w, xArr) {
        const xstar = product(xArr);
        return this.verMem(w, xstar);
    }

    verNonMemStar(u, xArr) {
        const xstar = product(xArr);
        return this.verNonMem(u, xstar);
    }
}

module.exports = RSAAccumulator;

// (async () => {
//     let acc = await RSAAccumulator.setup(128)
//     // console.log(acc)
//     acc.add(7n)
//     acc.add(13n)
//     acc.add(3n)
//     acc.add(29n)
//     acc.add(127n)
//     acc.add(307n)

//     // console.log(acc)
//     let prf = acc.memWitCreate(13n)
//     console.log('prf: ', prf)
//     console.log(13n, acc.verMem(prf, 13n))

//     let prf2 = acc.memWitCreateStar([3n, 29n, 307n, 7n])
//     console.log('prf2: ', prf2)
//     console.log([3n, 29n, 307n, 7n], acc.verMemStar(prf2, [3n, 29n, 307n, 7n]))

//     let nonprf = acc.nonMemWitCreate(5n)
//     console.log('nonprf: ', nonprf)
//     console.log(5n, acc.verNonMem(nonprf, 5n))

//     let nonprf2 = acc.nonMemWitCreateStar([5n, 19n]);
//     console.log('nonprf2: ', nonprf2)
//     console.log([5n, 19n], acc.verNonMemStar(nonprf2, [5n, 19n]))
// })()

