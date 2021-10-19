include "../node_modules/circomlib/circuits/poseidon.circom";
include "./MerkleTreeUpdater.circom";

// OutputRoot an amount or pay back debt
template OutputRoot(levels, zeroLeaf) {
  signal         input inputRoot;

  signal private input outputAmount;
  signal private input outputDebt;
  signal private input outputSecret;
  signal private input outputNullifier;
  signal private input outputSalt;
  signal         input outputRoot;
  signal         input outputPathIndices;
  signal private input outputPathElements[levels];
  signal         input outputCommitment;
  signal         input outputAccountHash;

  // Check output account hash
  component outputAccountHasher = Poseidon(5);
  outputAccountHasher.inputs[0] <== outputAmount;
  outputAccountHasher.inputs[1] <== outputDebt;
  outputAccountHasher.inputs[2] <== outputSecret;
  outputAccountHasher.inputs[3] <== outputNullifier;
  outputAccountHasher.inputs[4] <== outputSalt;
  outputAccountHasher.out === outputAccountHash;

  // Compute and verify output commitment
  component outputHasher = Poseidon(4);
  outputHasher.inputs[0] <== outputAmount;
  outputHasher.inputs[1] <== outputDebt;
  outputHasher.inputs[2] <== outputSecret;
  outputHasher.inputs[3] <== outputNullifier;
  outputHasher.out === outputCommitment;

  // Update accounts tree with output account commitment
  component accountTreeUpdater = MerkleTreeUpdater(levels, zeroLeaf);
  accountTreeUpdater.oldRoot <== inputRoot;
  accountTreeUpdater.newRoot <== outputRoot;
  accountTreeUpdater.leaf <== outputCommitment;
  accountTreeUpdater.pathIndices <== outputPathIndices;
  for (var i = 0; i < levels; i++) {
      accountTreeUpdater.pathElements[i] <== outputPathElements[i];
  }
}
