pragma circom 2.1.5;

include "BigInt.circom";
include "MiMCW.circom";

template Product(M, w) {
    signal input x[M];
    signal output out[M]; // x*

    component mult[M-1];
    var multALen[M-1];
    var multOutLen[M-1];
    for (var i = 0; i < M-1; i += 1) {
        multALen[i] = i + 1;
        multOutLen[i] = multALen[i] + 1;
    }
    for (var i = 0; i < M-1; i += 1) {
        mult[i] = BigMult(w, multALen[i], 1);
    }

    mult[0].a[0] <== x[0];
    mult[0].b[0] <== x[1];
    for (var i = 1; i < M-1; i += 1) {
        for (var j = 0; j < multOutLen[i-1]; j += 1) {
            mult[i].a[j] <== mult[i-1].out[j];
        }
        mult[i].b[0] <== x[i+1];
    }

    for (var i = 0; i < M; i += 1) {
        out[i] <== mult[M-2].out[i];
    }
}

// Verify: xstar * obfs == agg, xstar is product of x
template AggUpdateVerify(M, w) {
    signal input x[M];
    signal input obfs[bp];
    signal input agg[ba];
    signal output xstar[M]; // x*
    signal output out;

    assert(bp + M == ba);

    component product = Product(M, w);
    for (var i = 0; i < M; i += 1) {
        product.x[i] <== x[i];
    }
    for (var i = 0; i < M; i += 1) {
        xstar[i] <== product.out[i];
    }

    component mult = BigMult(w, M, bp);
    for (var i = 0; i < M; i += 1) {
        mult.a[i] <== product.out[i];
    }
    for (var i = 0; i < bp; i += 1) {
        mult.b[i] <== obfs[i];
    }

    component isEqual = BigIsEqual(ba);
    for (var j = 0; j < ba; j += 1) {
        isEqual.in[0][j] <== agg[j];
        isEqual.in[1][j] <== mult.out[j];
    }
    out <== isEqual.out;

    // component mul[M-1];
    // for (var i = 0; i < M-1; i += 1) {
    //     mul[i] = BigMult(w, 2**i*nb);
    // }

    // for (var j = 0; j < nb; j += 1) {
    //     mul[0].a[j] <== x[0][j];
    //     mul[0].b[j] <== x[1][j];
    // }

    // for (var i = 1; i < M-1; i += 1) {
    //     for (var j = 0; j < 2**i*nb; j += 1) {
    //         mul[i].a[j] <== mul[i-1].out[j];
    //         if (j < nb) {
    //             mul[i].b[j] <== x[i+1][j];
    //         } else {
    //             mul[i].b[j] <== 0;
    //         }
    //     }
    // }

    // // agg === mul[M-2].out
    // // mul[M-2].out is of 2**(M-1)*nb length (longer than agg), but high limbs are zero
    // component isEqual = BigIsEqual(M*nb);
    // for (var j = 0; j < M*nb; j += 1) {
    //     isEqual.in[0][j] <== agg[j];
    //     isEqual.in[1][j] <== mul[M-2].out[j];
    // }
    // out <== isEqual.out;
    // out <== 1;
}

// proof**x === A
template MemVerify(M, w) {
    signal input A[bAcc];
    signal input proof[bAcc];
    signal input x[M];
    signal input modulus[bAcc];
    signal output out;

    component modexp = PowerMod(w, bAcc, M);
    for (var i = 0; i < bAcc; i += 1) {
        modexp.base[i] <== proof[i];
        modexp.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < M; i += 1) {
        modexp.exp[i] <== x[i];
    }

    component isEqual = BigIsEqual(bAcc);
    for (var i = 0; i < bAcc; i += 1) {
        isEqual.in[0][i] <== A[i];
        isEqual.in[1][i] <== modexp.out[i];
    }
    out <== isEqual.out;
}

// A**a * B**x === g
template NonMemVerify(M, w) {
    signal input g[bAcc];
    signal input A[bAcc];
    signal input a[M]; // part of proof
    signal input B[bAcc]; // part of proof
    signal input x[M];
    signal input modulus[bAcc];
    signal output out;

    component modexp1 = PowerMod(w, bAcc, M);
    component modexp2 = PowerMod(w, bAcc, M);
    component mul = BigMultModP(w, bAcc, bAcc, bAcc);

    for (var i = 0; i < bAcc; i += 1) {
        modexp1.base[i] <== A[i];
        modexp1.modulus[i] <== modulus[i];
        modexp2.base[i] <== B[i];
        modexp2.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < M; i += 1) {
        modexp1.exp[i] <== a[i];
        modexp2.exp[i] <== x[i];
    }

    for (var i = 0; i < bAcc; i += 1) {
        mul.a[i] <== modexp1.out[i];
        mul.b[i] <== modexp2.out[i];
        mul.p[i] <== modulus[i];
    }

    component isEqual = BigIsEqual(bAcc);
    for (var i = 0; i < bAcc; i += 1) {
        isEqual.in[0][i] <== g[i];
        isEqual.in[1][i] <== mul.out[i];
    }
    out <== isEqual.out;
}

/*
// ne == 2*nb
// i.e., x is a product of at most two primes
template NIPoEVerify(w, nb, ne) {
    assert(ne == 2*nb);
    signal input x[ne];
    signal input u[nb];
    signal input w[nb];
    signal input nonce;
    signal input Q[nb];
    signal input modulus[nb];
    signal output out;

    component mimc = MiMCSpongeW(ne+2*nb+1, nb, w);
    for (var i = 0; i < ne; i += 1) {
        mimc.ins[i] <== x[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimc.ins[ne+i] <== u[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimc.ins[ne+nb+i] <== w[i];
    }
    mimc.ins[ne+2*nb] <== nonce;
    // mimc.outs: l

    component mod = BigMod(w, nb);
    for (var i = 0; i < ne; i += 1) {
        mod.a[i] <== x[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mod.b[i] <== mimc.outs[i];
    }
    // mod.mod: r

    component mult = BigMultModP(w, nb);
    component modexp1 = PowerMod(w, nb, nb);
    component modexp2 = PowerMod(w, nb, nb);
    for (var i = 0; i < nb; i += 1) {
        modexp1.base[i] <== Q[i];
        modexp1.exp[i] <== mimc.outs[i];
        modexp1.modulus[i] <== modulus[i];

        modexp2.base[i] <== u[i];
        modexp2.exp[i] <== mod.mod[i];
        modexp2.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mult.a[i] <== modexp1.out[i];
        mult.b[i] <== modexp2.out[i];
        mult.p[i] <== modulus[i];
    }

    component isEqual = BigIsEqual(nb);
    for (var i = 0; i < nb; i += 1) {
        isEqual.in[0][i] <== w[i];
        isEqual.in[1][i] <== mult.out[i];
    }
    out <== isEqual.out;
}

template NIPoKE2Verify(w, nb) {
    signal input u[nb];
    signal input w[nb];
    signal input z[nb];
    signal input nonce;
    signal input Q[nb];
    signal input r[nb];
    signal input modulus[nb];
    signal output out;

    component mimcG = MiMCSpongeW(2*nb, nb, w);
    component mimcPrime = MiMCSpongeW(3*nb+1, nb, w);
    component mimcH = MiMCSpongeW(4*nb, nb, w);

    for (var i = 0; i < nb; i += 1) {
        mimcG.ins[i] <== u[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimcG.ins[nb+i] <== w[i];
    }
    // mimcG.outs: g

    for (var i = 0; i < nb; i += 1) {
        mimcPrime.ins[i] <== u[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimcPrime.ins[nb+i] <== w[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimcPrime.ins[nb+nb+i] <== z[i];
    }
    mimcPrime.ins[nb+nb+nb] <== nonce;
    // mimcPrime.outs: l

    for (var i = 0; i < nb; i += 1) {
        mimcH.ins[i] <== u[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimcH.ins[nb+i] <== w[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimcH.ins[nb+nb+i] <== z[i];
    }
    for (var i = 0; i < nb; i += 1) {
        mimcH.ins[nb+nb+nb+i] <== mimcPrime.outs[i];
    }
    // mimcH.outs: alpha

    component Ql = PowerMod(w, nb, nb);
    component gAlpha = PowerMod(w, nb, nb);
    component ugAlpha = BigMultModP(w, nb);
    component ugAlphaR = PowerMod(w, nb, nb);
    component QlugAlphaR = BigMultModP(w, nb);
    component zAlpha = PowerMod(w, nb, nb);
    component wzAlpha = BigMultModP(w, nb);

    for (var i = 0; i < nb; i += 1) {
        Ql.base[i] <== Q[i];
        Ql.exp[i] <== mimcPrime.outs[i];
        Ql.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < nb; i += 1) {
        gAlpha.base[i] <== mimcG.outs[i];
        gAlpha.exp[i] <== mimcH.outs[i];
        gAlpha.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < nb; i += 1) {
        ugAlpha.a[i] <== u[i];
        ugAlpha.b[i] <== gAlpha.out[i];
        ugAlpha.p[i] <== modulus[i];
    }
    for (var i = 0; i < nb; i += 1) {
        ugAlphaR.base[i] <== ugAlpha.out[i];
        ugAlphaR.exp[i] <== r[i];
        ugAlphaR.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < nb; i += 1) {
        QlugAlphaR.a[i] <== Ql.out[i];
        QlugAlphaR.b[i] <== ugAlphaR.out[i];
        QlugAlphaR.p[i] <== modulus[i];
    }
    for (var i = 0; i < nb; i += 1) {
        zAlpha.base[i] <== z[i];
        zAlpha.exp[i] <== mimcH.outs[i];
        zAlpha.modulus[i] <== modulus[i];
    }
    for (var i = 0; i < nb; i += 1) {
        wzAlpha.a[i] <== w[i];
        wzAlpha.b[i] <== zAlpha.out[i];
        wzAlpha.p[i] <== modulus[i];
    }

    component isEqual = BigIsEqual(nb);
    for (var i = 0; i < nb; i += 1) {
        isEqual.in[0][i] <== QlugAlphaR.out[i];
        isEqual.in[1][i] <== wzAlpha.out[i];
    }
    out <== isEqual.out;
}
*/
