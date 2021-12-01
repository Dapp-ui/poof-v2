#!/bin/bash
Circuits="Deposit Withdraw InputRoot OutputRoot TreeUpdate DepositMini WithdrawMini InputRootMini OutputRootMini TreeUpdateMini"
for circuit in $Circuits; do
  if [[ $circuit == *"Mini" ]]; then
    cp build/circuits/${circuit}_circuit_0000.zkey build/circuits/${circuit}_circuit_final.zkey
  else
    cp build/circuits/${circuit}_circuit_$1.zkey build/circuits/${circuit}_circuit_final.zkey
  fi
  yarn snarkjs zkey export verificationkey build/circuits/${circuit}_circuit_final.zkey build/circuits/${circuit}_verification_key.json
  yarn snarkjs zkey export solidityverifier build/circuits/${circuit}_circuit_final.zkey build/circuits/${circuit}Verifier.sol
  sed -i.bak "s/contract Verifier/contract ${circuit}Verifier/g" build/circuits/${circuit}Verifier.sol
done