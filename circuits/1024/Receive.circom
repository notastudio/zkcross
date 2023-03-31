pragma circom 2.1.5;

include "MiMCW.circom";
include "RsaAcc.circom";

template Receive(M, w) {
    // public
    signal input modulusANote[9];
    signal input ANote[9];
    signal input aggNote[10];

    signal input gASn[9];
    signal input modulusASn[9];
    signal input ASn[9];
    signal input aggSn[10];

    signal input vOut;

    signal input prover; // non-malleability
    // private
    signal input LInNoteV[M]; // field
    signal input LInNoteRd[M]; // field
    signal input LInNoteSn[M]; // a w-bit prime number
    signal input NInNote;

    signal input LOutNoteV[M]; // field
    signal input LOutNoteRd[M]; // field
    signal input LOutNoteSn[M]; // a w-bit prime number
    signal input NOutNote;

    signal input PNote[9];
    signal input PSn_a[M];
    signal input PSn_B[9];

    signal input obfsPrime[2][7]; // obfsPrime[0] for ASn, obfsPrime[1] for ANote

    signal masksIn[M];
    signal masksOut[M];
    component ltIn[M];
    component ltOut[M];
    for (var i = 0; i < M; i += 1) {
        ltIn[i] = LessThan(4);
        ltIn[i].in[0] <== i;
        ltIn[i].in[1] <== NInNote;
        masksIn[i] <== ltIn[i].out;

        ltOut[i] = LessThan(4);
        ltOut[i].in[0] <== i;
        ltOut[i].in[1] <== NOutNote;
        masksOut[i] <== ltOut[i].out;
    }

    signal sumsVInNote[M];
    signal sumsVOutNote[M];
    sumsVInNote[0] <== LInNoteV[0];
    sumsVOutNote[0] <== LOutNoteV[0] * masksOut[0];
    for (var i = 1; i < M; i += 1) {
        sumsVInNote[i] <== sumsVInNote[i - 1] + LInNoteV[i] * masksIn[i];
        sumsVOutNote[i] <== sumsVOutNote[i - 1] + LOutNoteV[i] * masksOut[i];
    }
    sumsVInNote[M - 1] === vOut + sumsVOutNote[M - 1];

    component invIn[M];
    component aggUpdateVerifyInSn = AggUpdateVerify(M, w);
    for (var i = 0; i < M; i += 1) {
        invIn[i] = IsZero();
        invIn[i].in <== masksIn[i];
        aggUpdateVerifyInSn.x[i] <== invIn[i].out * 1 + masksIn[i] * LInNoteSn[i]; // i.e. masksIn[i] == 1 ? LInNoteSn[i] : 1
    }
    for (var i = 0; i < 7; i += 1) {
        aggUpdateVerifyInSn.obfs[i] <== obfsPrime[0][i];
    }
    for (var i = 0; i < 10; i += 1) {
        aggUpdateVerifyInSn.agg[i] <== aggSn[i];
    }
    aggUpdateVerifyInSn.out === 1;

    component aggUpdateVerifyOutNote = AggUpdateVerify(M, w);
    for (var i = 0; i < 7; i += 1) {
        aggUpdateVerifyOutNote.obfs[i] <== obfsPrime[1][i];
    }
    for (var i = 0; i < 10; i += 1) {
        aggUpdateVerifyOutNote.agg[i] <== aggNote[i];
    }
    component invOut[M];
    component mimcOut[M];
    for (var i = 0; i < M; i += 1) {
        invOut[i] = IsZero();
        mimcOut[i] = MiMCW(3, w);
        mimcOut[i].ins[0] <== LOutNoteV[i];
        mimcOut[i].ins[1] <== LOutNoteRd[i];
        mimcOut[i].ins[2] <== LOutNoteSn[i];

        //     masksOut[i] == 1 (or invOut[i].out == 0)
        //             N/     \Y
        //            1     mimcOut[i].out
        invOut[i].in <== masksOut[i];
        aggUpdateVerifyOutNote.x[i] <== invOut[i].out * 1 + masksOut[i] * mimcOut[i].out; // i.e. masksOut[i] == 1 ? mimcOut[i].out : 1
    }
    aggUpdateVerifyOutNote.out === 1;

    component memVerify = MemVerify(M, w);
    component nonMemVerify = NonMemVerify(M, w);

    component mimcIn[M];
    component productOfInNote = Product(M, w);
    for (var i = 0; i < M; i += 1) {
        mimcIn[i] = MiMCW(3, w);
        mimcIn[i].ins[0] <== LInNoteV[i];
        mimcIn[i].ins[1] <== LInNoteRd[i];
        mimcIn[i].ins[2] <== LInNoteSn[i];

        productOfInNote.x[i] <== invIn[i].out * 1 + masksIn[i] * mimcIn[i].out; // i.e. masksIn[i] == 1 ? mimcIn[i].out : 1
    }
    for (var i = 0; i < 9; i += 1) {
        memVerify.A[i] <== ANote[i];
        memVerify.proof[i] <== PNote[i];
        memVerify.modulus[i] <== modulusANote[i];
    }
    for (var i = 0; i < M; i += 1) {
        memVerify.x[i] <== productOfInNote.out[i];
    }
    memVerify.out === 1;

    for (var i = 0; i < 9; i += 1) {
        nonMemVerify.g[i] <== gASn[i];
        nonMemVerify.A[i] <== ASn[i];
        nonMemVerify.B[i] <== PSn_B[i];
        nonMemVerify.modulus[i] <== modulusASn[i];
    }
    for (var i = 0; i < M; i += 1) {
        nonMemVerify.a[i] <== PSn_a[i];
        nonMemVerify.x[i] <== aggUpdateVerifyInSn.xstar[i];
    }
    nonMemVerify.out === 1;
}

component main { public [ modulusANote, ANote, aggNote, gASn, modulusASn, ASn, aggSn, vOut, prover ] } = Receive(/*M*/ 3, /*w*/ 121);
