#!/bin/bash
# Powers of Tau
if [ ! -f ptau/pot_final.ptau ]; then
  mkdir -p ptau
  wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_18.ptau -O ptau/pot_final.ptau
fi

if [ ! -f build/circuits/$1.r1cs ]; then
  yarn circom circuits/$1.circom --r1cs --wasm
  mkdir -p build/circuits
  mv $1.r1cs build/circuits/$1.r1cs
  mv $1.wasm build/circuits/$1.wasm
  yarn snarkjs info -c build/circuits/$1.r1cs
  yarn snarkjs plonk setup build/circuits/$1.r1cs ptau/pot_final.ptau build/circuits/$1_circuit_final.zkey
  yarn snarkjs zkey export verificationkey build/circuits/$1_circuit_final.zkey build/circuits/$1_verification_key.json
  yarn snarkjs zkey export solidityverifier build/circuits/$1_circuit_final.zkey build/circuits/${1}Verifier.sol
  sed -i.bak "s/contract PlonkVerifier/contract ${1}Verifier/g" build/circuits/${1}Verifier.sol
  sed -i.bak "s/uint16 constant n /uint32 constant n /g" build/circuits/${1}Verifier.sol
  sed -i.bak "s/public/external/g" build/circuits/${1}Verifier.sol
fi

