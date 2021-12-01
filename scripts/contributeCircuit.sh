#!/bin/bash
Circuits="Deposit Withdraw InputRoot OutputRoot TreeUpdate"
for circuit in $Circuits; do
  [ ! -f build/circuits/${circuit}_circuit_$1.zkey ] && wget https://github.com/poofcash/poof-v2/releases/download/$1/${circuit}_circuit_$1.zkey -O build/circuits/${circuit}_circuit_$1.zkey
  yarn snarkjs zkey contribute build/circuits/${circuit}_circuit_$1.zkey build/circuits/${circuit}_circuit_$2.zkey -v
done