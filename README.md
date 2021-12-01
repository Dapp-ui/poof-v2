# Poof v2 Smart Contracts

## Contributing to the Groth16 Phase 2 Setup
Assuming the latest circuits is at version 0001 (and the next version being the incremental 0002)
```
git clone git@github.com:poofcash/poof-v2.git
cd poof-v2
git checkout groth
yarn
yarn circuit:setup
yarn contribute 0001 0002
```

You will be prompted to submit 5 different entropies. This will give you the following files in `build/circuit`

```
Deposit_circuit_0002.zkey
Withdraw_circuit_0002.zkey
InputRoot_circuit_0002.zkey
OutputRoot_circuit_0002.zkey
TreeUpdate_circuit_0002.zkey
```

Contact Zeph (Discord: zeph_HK#7420) or Brian (Discord: brianl#9133) with these zkeys so we can add them to the Github releases