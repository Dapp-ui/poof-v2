include "../node_modules/circomlib/circuits/poseidon.circom";
include "./MerkleTree.circom";

// InputRoot an amount or pay back debt
template InputRoot(levels, zeroLeaf) {
  signal private input inputAmount;
  signal private input inputDebt;
  signal private input inputSecret;
  signal private input inputNullifier;
  signal private input inputSalt;
  signal         input inputRoot;
  signal private input inputPathElements[levels];
  signal private input inputPathIndices;
  signal         input inputNullifierHash;
  signal         input inputAccountHash;

  // Check input account hash
  component inputAccountHasher = Poseidon(5);
  inputAccountHasher.inputs[0] <== inputAmount;
  inputAccountHasher.inputs[1] <== inputDebt;
  inputAccountHasher.inputs[2] <== inputSecret;
  inputAccountHasher.inputs[3] <== inputNullifier;
  inputAccountHasher.inputs[4] <== inputSalt;
  inputAccountHasher.out === inputAccountHash;

  // Compute input commitment
  component inputHasher = Poseidon(4);
  inputHasher.inputs[0] <== inputAmount;
  inputHasher.inputs[1] <== inputDebt;
  inputHasher.inputs[2] <== inputSecret;
  inputHasher.inputs[3] <== inputNullifier;

  // Verify that input commitment exists in the tree
  component inputTree = MerkleTree(levels);
  inputTree.leaf <== inputHasher.out;
  inputTree.pathIndices <== inputPathIndices;
  for (var i = 0; i < levels; i++) {
    inputTree.pathElements[i] <== inputPathElements[i];
  }

  // Check merkle proof only if amount is non-zero
  component checkRoot = ForceEqualIfEnabled();
  checkRoot.in[0] <== inputRoot;
  checkRoot.in[1] <== inputTree.root;
  checkRoot.enabled <== inputAmount;

  // Verify input nullifier hash
  component inputNullifierHasher = Poseidon(1);
  inputNullifierHasher.inputs[0] <== inputNullifier;
  inputNullifierHasher.out === inputNullifierHash;
}
