const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');
const RsaAcc = require('./RsaAcc');
const { mkMimc, numberToBase, numberToArray, arrayPad } = require('./helper.js');
const { mod, isPrime, generateLargePrime, generateTwoLargeDistinctPrimes, xgcd, mulInv, bezoute, product } = require('./RsaAcc/helper.js');

BigInt.prototype.toJSON = function () { return this.toString(); }

const verbose = false;

const w = 121;
const M = 3;
const ba = {
    1024: 11,
    2048: 19,
    3072: 28,
};
const bp = {
    1024: 8,
    2048: 16,
    3072: 25,
};
const bAcc = {
    1024: 9,
    2048: 17,
    3072: 26,
};
const bpBits = {
    1024: {
        1: 903,
        2: 782,
        3: 661,
    },
    2048: {
        1: 1927,
        2: 1806,
        3: 1685,
    },
    3072: {
        1: 2951,
        2: 2830,
        3: 2709,
    },
};

const mkCircuitPath = nBits => path.join(__dirname, `../circuits/${nBits}/out`);
const mimcPath = path.join(__dirname, '../circuits/out');
const outJsonPath = path.join(__dirname, '../json');

const mimc = mkMimc(`${mimcPath}/MiMCHasher_js/MiMCHasher.wasm`, `${mimcPath}/MiMCHasher_0001.zkey`);

function t() {
    const now = new Date();
    const ti = [now.getHours(), now.getMinutes(), now.getSeconds()]
                    .map(x => x.toString())
                    .map(x => x.padStart(2, '0'))
                    .join('');
    return ti;
}

async function generateNote(v) {
    const sn = await generateLargePrime(w);
    let rd = await generateLargePrime(252);
    while (true) {
        const commitment = BigInt(await mimc(v, rd, sn));
        if (await isPrime(commitment)) {
            return {
                commitment,
                note: { v, rd, sn },
            }
        }
        rd -= 1n;
    }
}

async function testSend(nBits, ANote, availableNotes, vArr) {
    console.time('InitSend time');

    vArr = vArr.map(BigInt);

    const NOutNote = vArr.length;
    const vIn = vArr.reduce((prod, cur) => prod + cur);
    const vOutNote = vIn;

    const outNotes = [];
    for (let i = 0; i < NOutNote; i += 1) {
        const n = await generateNote(vArr[i]);
        outNotes.push(n);
        availableNotes.push(n);
    }
    const obfsPrime = await generateLargePrime(bpBits[nBits][NOutNote]);

    verbose && console.log('new notes: ', outNotes);
    verbose && console.log('obfsPrime: ', obfsPrime);

    const aggNote = product(outNotes.map(x => x.commitment)) * obfsPrime;

    verbose && console.log('aggNote: ', aggNote);

    const input = {
        aggNote: numberToArray(aggNote, w, ba[nBits]),
        vIn,
        vOutNote,
        prover: 0, // omitted
        LOutNoteV: arrayPad(outNotes.map(x => x.note.v), M, 0n),
        LOutNoteRd: arrayPad(outNotes.map(x => x.note.rd), M, 0n),
        LOutNoteSn: arrayPad(outNotes.map(x => x.note.sn), M, 0n),
        NOutNote,
        obfsPrime: numberToArray(obfsPrime, w, bp[nBits]),
    };

    console.time('proof for Send time');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${mkCircuitPath(nBits)}/Send_js/Send.wasm`,
        `${mkCircuitPath(nBits)}/Send_0001.zkey`
    );
    console.timeEnd('proof for Send time');

    console.timeEnd('InitSend time');

    const ti = t();
    fs.writeFileSync(`${outJsonPath}/inputSend_${nBits}_${ti}.json`, JSON.stringify(input, null, 2), 'utf-8');
    fs.writeFileSync(`${outJsonPath}/proofSend_${nBits}_${ti}.json`, JSON.stringify(proof, null, 2), 'utf-8');
    fs.writeFileSync(`${outJsonPath}/publicSend_${nBits}_${ti}.json`, JSON.stringify(publicSignals, null, 2), 'utf-8');

    const res = await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${mkCircuitPath(nBits)}/Send_vk.json`)), publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

    ANote.add(aggNote);
}

async function testReceive(nBits, ANote, ASn, availableNotes, inNotes, vArr, vOut) {
    console.time('InitReceive time');

    vArr = vArr.map(BigInt);

    const NInNote = inNotes.length;
    const NOutNote = vArr.length;

    verbose && console.log('in notes: ', inNotes);

    const outNotes = [];
    for (let i = 0; i < NOutNote; i += 1) {
        const n = await generateNote(vArr[i]);
        outNotes.push(n);
        availableNotes.push(n);
    }

    verbose && console.log('out notes: ', outNotes);

    const obfsPrimeArr = [
        await generateLargePrime(bpBits[nBits][NInNote]), // for ASn
        await generateLargePrime(bpBits[nBits][NOutNote]), // for ANote
    ];

    verbose && console.log('obfsPrime: ', obfsPrimeArr);

    const aggSn = product(inNotes.map(x => x.note.sn)) * obfsPrimeArr[0];
    const aggNote = product(outNotes.map(x => x.commitment)) * obfsPrimeArr[1];

    verbose && console.log('aggSn: ', aggSn);
    verbose && console.log('aggNote: ', aggNote);

    const PNote = ANote.memWitCreateStar(inNotes.map(x => x.commitment));
    const [PSn_a, PSn_B] = ASn.nonMemWitCreateStar(inNotes.map(x => x.note.sn));

    verbose && console.log('membership proof of ANote: ', PNote);
    verbose && console.log('non-membership proof of ASn: ', [PSn_a, PSn_B]);

    const input = {
        modulusANote: numberToArray(ANote.n, w, bAcc[nBits]),
        ANote: numberToArray(ANote.A, w, bAcc[nBits]),
        aggNote: numberToArray(aggNote, w, ba[nBits]),

        gASn: numberToArray(ASn.g, w, bAcc[nBits]),
        modulusASn: numberToArray(ASn.n, w, bAcc[nBits]),
        ASn: numberToArray(ASn.A, w, bAcc[nBits]),
        aggSn: numberToArray(aggSn, w, ba[nBits]),

        vOut,
        prover: 0, // omitted

        LInNoteV: arrayPad(inNotes.map(x => x.note.v), M, 0n),
        LInNoteRd: arrayPad(inNotes.map(x => x.note.rd), M, 0n),
        LInNoteSn: arrayPad(inNotes.map(x => x.note.sn), M, 0n),
        NInNote,

        LOutNoteV: arrayPad(outNotes.map(x => x.note.v), M, 0n),
        LOutNoteRd: arrayPad(outNotes.map(x => x.note.rd), M, 0n),
        LOutNoteSn: arrayPad(outNotes.map(x => x.note.sn), M, 0n),
        NOutNote,

        PNote: numberToArray(PNote, w, bAcc[nBits]),
        PSn_a: numberToArray(PSn_a, w, M),
        PSn_B: numberToArray(PSn_B, w, bAcc[nBits]),

        obfsPrime: obfsPrimeArr.map(x => numberToArray(x, w, bp[nBits])),
    }

    console.time('proof for Receive time');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${mkCircuitPath(nBits)}/Receive_js/Receive.wasm`,
        `${mkCircuitPath(nBits)}/Receive_0001.zkey`
    );
    console.timeEnd('proof for Receive time');

    console.timeEnd('InitReceive time');

    const ti = t();
    fs.writeFileSync(`${outJsonPath}/inputReceive_${nBits}_${ti}.json`, JSON.stringify(input, null, 2), 'utf-8');
    fs.writeFileSync(`${outJsonPath}/proofReceive_${nBits}_${ti}.json`, JSON.stringify(proof, null, 2), 'utf-8');
    fs.writeFileSync(`${outJsonPath}/publicReceive_${nBits}_${ti}.json`, JSON.stringify(publicSignals, null, 2), 'utf-8');

    const res = await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${mkCircuitPath(nBits)}/Receive_vk.json`)), publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

    ASn.add(aggSn);
    ANote.add(aggNote);
}

async function test_main() {
    for (const nBits of [1024, 2048, 3072]) {
        console.log(`!!! nBits: ${nBits} !!!`);

        console.time('accumulator setup time');
        const ANote = await RsaAcc.setup(nBits);
        const ASn = await RsaAcc.setup(nBits);
        console.timeEnd('accumulator setup time');

        const availableNotes = [];

        console.log('=== Test: Send, in 30 coins, out 3 notes (10, 10, 10) ===');
        await testSend(nBits, ANote, availableNotes, [10n, 10n, 10n]);

        console.log('\n=== Test: Receive, in 2 notes (10, 10), out 2 notes (7, 8) + 5 coins ===');
        let inNotes = [availableNotes.pop(), availableNotes.pop()];
        await testReceive(nBits, ANote, ASn, availableNotes, inNotes, [7n, 8n], 5n);

        console.log('\n=== Test: Receive, in 3 notes (8, 7, 10), out 3 notes (0, 0, 1) + 24 coins ===');
        inNotes = [availableNotes.pop(), availableNotes.pop(), availableNotes.pop()];
        await testReceive(nBits, ANote, ASn, availableNotes, inNotes, [0n, 0n, 1n], 24n);

        console.log('\n');
    }
}

async function test_singleNote() {
    for (const nBits of [1024, 2048, 3072]) {
        console.log(`!!! nBits: ${nBits} !!!`);

        console.time('accumulator setup time');
        const ANote = await RsaAcc.setup(nBits);
        const ASn = await RsaAcc.setup(nBits);
        console.timeEnd('accumulator setup time');

        const availableNotes = [];

        console.log('=== Test: Send, in 10 coins, out 1 notes (10) ===');
        await testSend(nBits, ANote, availableNotes, [10n]);

        console.log('\n=== Test: Receive, in 1 notes (10), out 1 notes (7) + 3 coins ===');
        let inNotes = [availableNotes.pop()];
        await testReceive(nBits, ANote, ASn, availableNotes, inNotes, [7n], 3n);

        console.log('\n');
    }
}

async function test_2in2out() {
    for (const nBits of [1024, 2048, 3072]) {
        console.log(`!!! nBits: ${nBits} !!!`);

        console.time('accumulator setup time');
        const ANote = await RsaAcc.setup(nBits);
        const ASn = await RsaAcc.setup(nBits);
        console.timeEnd('accumulator setup time');

        const availableNotes = [];

        console.log('=== Test: Send, in 20 coins, out 2 notes (10, 10) ===');
        await testSend(nBits, ANote, availableNotes, [10n, 10n]);

        console.log('\n=== Test: Receive, in 2 notes (10, 10), out 2 notes (7, 8) + 5 coins ===');
        let inNotes = [availableNotes.pop(), availableNotes.pop()];
        await testReceive(nBits, ANote, ASn, availableNotes, inNotes, [7n, 8n], 5n);

        console.log('\n');
    }
}

test_2in2out().then(() => {
    process.exit(0);
}).catch(console.log);
