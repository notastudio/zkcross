pragma circom 2.1.5;

include "../Receive.circom";

component main { public [ modulusANote, ANote, aggNote, gASn, modulusASn, ASn, aggSn, vOut, prover ] } =
    Receive(/*M*/ 3, /*w*/ 121, /*ba*/ 19, /*bp*/ 16, /*bAcc*/ 17);
