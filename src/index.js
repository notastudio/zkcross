const fs = require('fs');
const snarkjs = require('snarkjs');
const RsaAcc = require('./RsaAcc');
const { mkMimc, numberToBase, numberToArray, arrayPad } = require('./helper.js');
const { mod, isPrime, generateLargePrime, generateTwoLargeDistinctPrimes, xgcd, mulInv, bezoute, product } = require('./RsaAcc/helper.js');

BigInt.prototype.toJSON = function () { return this.toString(); }

const zkout = '../circuits/1024/out';

const w = 121;
const nBits = 1024;
const bp = {
    2: 782,
    3: 661,
};
const M = 3;

const mimc = mkMimc(`../circuits/out/MiMCHasher_js/MiMCHasher.wasm`, `../circuits/out/MiMCHasher_0001.zkey`);

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

async function testSend(ANote, availableNotes, vArr) {
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
    const obfsPrime = await generateLargePrime(bp[NOutNote]);

    console.log('new notes: ', outNotes);
    console.log('obfsPrime: ', obfsPrime);

    const aggNote = product(outNotes.map(x => x.commitment)) * obfsPrime;

    console.log('aggNote: ', aggNote);

    const input = {
        aggNote: numberToArray(aggNote, w, 10),
        vIn,
        vOutNote,
        prover: 0, // omitted
        LOutNoteV: arrayPad(outNotes.map(x => x.note.v), M, 0n),
        LOutNoteRd: arrayPad(outNotes.map(x => x.note.rd), M, 0n),
        LOutNoteSn: arrayPad(outNotes.map(x => x.note.sn), M, 0n),
        NOutNote,
        obfsPrime: numberToArray(obfsPrime, w, 7),
    };

    fs.writeFileSync('../json/inputSend.json', JSON.stringify(input, null, 2), 'utf-8');

    console.time('proof for Send');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${zkout}/Send_js/Send.wasm`, `${zkout}/Send_0001.zkey`);
    console.timeEnd('proof for Send');

    console.log('proof for Send: ', proof, '\npublicSignals: ', publicSignals);

    const res = await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${zkout}/Send_vk.json`)), publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

    ANote.add(aggNote);
}

async function testReceive(ANote, ASn, availableNotes, inNotes, vArr, vOut) {
    vArr = vArr.map(BigInt);

    const NInNote = inNotes.length;
    const NOutNote = vArr.length;

    console.log('in notes: ', inNotes);

    const outNotes = [];
    for (let i = 0; i < NOutNote; i += 1) {
        const n = await generateNote(vArr[i]);
        outNotes.push(n);
        availableNotes.push(n);
    }

    console.log('out notes: ', outNotes);

    const obfsPrimeArr = [
        await generateLargePrime(bp[NInNote]), // for ASn
        await generateLargePrime(bp[NOutNote]), // for ANote
    ];

    console.log('obfsPrime: ', obfsPrimeArr);

    const aggSn = product(inNotes.map(x => x.note.sn)) * obfsPrimeArr[0];
    const aggNote = product(outNotes.map(x => x.commitment)) * obfsPrimeArr[1];

    console.log('aggSn: ', aggSn);
    console.log('aggNote: ', aggNote);

    const PNote = ANote.memWitCreateStar(inNotes.map(x => x.commitment));
    const [PSn_a, PSn_B] = ASn.nonMemWitCreateStar(inNotes.map(x => x.note.sn));

    console.log('membership proof of ANote: ', PNote);
    console.log('non-membership proof of ASn: ', [PSn_a, PSn_B]);

    const input = {
        modulusANote: numberToArray(ANote.n, w, 9),
        ANote: numberToArray(ANote.A, w, 9),
        aggNote: numberToArray(aggNote, w, 10),

        gASn: numberToArray(ASn.g, w, 9),
        modulusASn: numberToArray(ASn.n, w, 9),
        ASn: numberToArray(ASn.A, w, 9),
        aggSn: numberToArray(aggSn, w, 10),

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

        PNote: numberToArray(PNote, w, 9),
        PSn_a: numberToArray(PSn_a, w, M),
        PSn_B: numberToArray(PSn_B, w, 9),

        obfsPrime: obfsPrimeArr.map(x => numberToArray(x, w, 7)),
    }

    fs.writeFileSync('../json/inputReceive.json', JSON.stringify(input, null, 2), 'utf-8');

    console.time('proof for Receive');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${zkout}/Receive_js/Receive.wasm`, `${zkout}/Receive_0001.zkey`);
    console.timeEnd('proof for Receive');

    console.log('proof for Receive: ', proof, '\npublicSignals: ', publicSignals);

    const res = await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${zkout}/Receive_vk.json`)), publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

    ASn.add(aggSn);
    ANote.add(aggNote);
}

async function main() {
    const ANote = await RsaAcc.setup(nBits);
    const ASn = await RsaAcc.setup(nBits);
    const availableNotes = [];

    console.log('=== Test: Send, in 30 coins, out 3 notes (10, 10, 10) ===');
    await testSend(ANote, availableNotes, [10n, 10n, 10n]);

    console.log('\n=== Test: Receive, in 2 notes (10, 10), out 2 notes (7, 8) + 5 coins ===');
    let inNotes = [availableNotes.pop(), availableNotes.pop()];
    await testReceive(ANote, ASn, availableNotes, inNotes, [7n, 8n], 5n);

    console.log('\n=== Test: Receive, in 3 notes (8, 7, 10), out 3 notes (0, 0, 1) + 24 coins ===');
    inNotes = [availableNotes.pop(), availableNotes.pop(), availableNotes.pop()];
    await testReceive(ANote, ASn, availableNotes, inNotes, [0n, 0n, 1n], 24n);
}

main().then(() => {
    process.exit(0);
}).catch(console.log);
