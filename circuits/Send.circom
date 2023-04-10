pragma circom 2.1.5;

include "MiMCW.circom";
include "RsaAcc.circom";

template Send(M, w, ba, bp) {
    // public
    signal input aggNote[ba];
    signal input vIn;
    signal input vOutNote;
    signal input prover; // non-malleability
    // private
    signal input LOutNoteV[M]; // field
    signal input LOutNoteRd[M]; // field
    signal input LOutNoteSn[M]; // a w-bit prime number
    signal input NOutNote;
    signal input obfsPrime[bp];

    // masks = [1] * NOutNote + [0] * (M-NOutNote)
    signal masks[M];
    component lt[M];
    for (var i = 0; i < M; i += 1) {
        lt[i] = LessThan(4);
        lt[i].in[0] <== i;
        lt[i].in[1] <== NOutNote;
        masks[i] <== lt[i].out;
    }

    signal sums[M];
    sums[0] <== LOutNoteV[0];
    for (var i = 1; i < M; i += 1) {
        sums[i] <== sums[i - 1] + LOutNoteV[i] * masks[i];
    }
    vOutNote === sums[M - 1]; // i.e. vOutNote === sum of masked LOutNoteV

    vIn === vOutNote;

    component aggUpdateVerify = AggUpdateVerify(M, w);
    for (var i = 0; i < ba; i += 1) {
        aggUpdateVerify.agg[i] <== aggNote[i];
    }
    // Verification of the actual bit length of obfsPrime is omitted
    for (var i = 0; i < bp; i += 1) {
        aggUpdateVerify.obfs[i] <== obfsPrime[i];
    }

    component inv[M];
    component mimc[M];
    for (var i = 0; i < M; i += 1) {
        inv[i] = IsZero();
        mimc[i] = MiMCW(3, w);
        mimc[i].ins[0] <== LOutNoteV[i];
        mimc[i].ins[1] <== LOutNoteRd[i];
        mimc[i].ins[2] <== LOutNoteSn[i];

        //     masks[i] == 1 (or inv[i].out == 0)
        //          N/     \Y
        //         1     mimc[i].out
        inv[i].in <== masks[i];
        aggUpdateVerify.x[i] <== inv[i].out * 1 + masks[i] * mimc[i].out; // i.e. masks[i] == 1 ? mimc[i].out : 1
    }
    aggUpdateVerify.out === 1;
}

component main { public [ aggNote, vIn, vOutNote, prover ] } = Send(/*M*/ 3, /*w*/ 121);
