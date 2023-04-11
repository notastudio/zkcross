export NODE_OPTIONS=--max-old-space-size=8192

mkdir -p circuits/out/
mkdir -p circuits/1024/out/
mkdir -p circuits/2048/out/
mkdir -p circuits/3072/out/

cd circuits

# build MiMCHasher
circom --r1cs --sym --wasm --O2 MiMCHasher.circom -o out
snarkjs groth16 setup out/MiMCHasher.r1cs powersOfTau28_hez_final_18.ptau out/MiMCHasher_0001.zkey

# build Send and Receive
for bit in 1024 2048 3072
do
    circom --r1cs --sym --wasm --O2 $bit/Send.circom -o $bit/out
    circom --r1cs --sym --wasm --O2 $bit/Receive.circom -o $bit/out
done

for bit in 1024 2048 3072
do
    start=`date +%s`
    snarkjs groth16 setup $bit/out/Send.r1cs powersOfTau28_hez_final_18.ptau $bit/out/Send_0001.zkey
    end=`date +%s`
    time=`echo $start $end | awk '{print $2-$1}'`
    echo setup time of Send_$bit: $time

    snarkjs zkey export solidityverifier $bit/out/Send_0001.zkey $bit/out/Send_verifier.sol
    snarkjs zkey export verificationkey $bit/out/Send_0001.zkey $bit/out/Send_vk.json

    start=`date +%s`
    snarkjs groth16 setup $bit/out/Receive.r1cs powersOfTau28_hez_final_18.ptau $bit/out/Receive_0001.zkey
    end=`date +%s`
    time=`echo $start $end | awk '{print $2-$1}'`
    echo setup time of Receive_$bit: $time

    snarkjs zkey export solidityverifier $bit/out/Receive_0001.zkey $bit/out/Receive_verifier.sol
    snarkjs zkey export verificationkey $bit/out/Receive_0001.zkey $bit/out/Receive_vk.json
done
