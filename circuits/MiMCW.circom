pragma circom 2.1.2;

include "../node_modules/circomlib/circuits/mimc.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template Num2BitsDrop(n) {
    signal input in;
    signal output out[n];

    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] -1 ) === 0;
    }
}

// output a w-bit number
template MiMCW(nInputs, w) {
    signal input ins[nInputs];
    signal output out;

    component mimc = MultiMiMC7(nInputs, 91);
    for (var i = 0; i < nInputs; i += 1) {
        mimc.in[i] <== ins[i];
    }
    mimc.k <== 0;

    component n2b;
    component b2n;

    n2b = Num2BitsDrop(w);
    b2n = Bits2Num(w);

    n2b.in <== mimc.out;
    for (var j = 0; j < w; j += 1) {
        b2n.in[j] <== n2b.out[j];
    }
    out <== b2n.out;
}
