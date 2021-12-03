#!/bin/bash
# Powers of Tau
if [ ! -f ptau/pot_final.ptau ]; then
  mkdir -p ptau
  wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_18.ptau -O ptau/pot_final.ptau
fi

Circuits="Deposit Withdraw InputRoot OutputRoot TreeUpdate DepositMini WithdrawMini InputRootMini OutputRootMini TreeUpdateMini"
for circuit in $Circuits; do
  if [ ! -f build/circuits/${circuit}_circuit_0000.zkey ]; then
    yarn circom circuits/$circuit.circom --r1cs --wasm
    mkdir -p build/circuits
    mv $circuit.r1cs build/circuits/$circuit.r1cs
    mv $circuit.wasm build/circuits/$circuit.wasm
    yarn snarkjs info -c build/circuits/$circuit.r1cs
    yarn snarkjs groth16 setup build/circuits/$circuit.r1cs ptau/pot_final.ptau build/circuits/${circuit}_circuit_0000.zkey
  fi
done