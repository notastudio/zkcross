pragma circom 2.1.5;

include "../Send.circom";

component main { public [ aggNote, vIn, vOutNote, prover ] } = Send(/*M*/ 3, /*w*/ 121, /*ba*/ 11, /*bp*/ 8);
