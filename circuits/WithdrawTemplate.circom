include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./MerkleTree.circom";
include "./MerkleTreeUpdater.circom";

// Withdraw an amount or take a loan
template Withdraw(levels, zeroLeaf) {
  // fee is included into the `amount` input
  signal input amount;
  signal input debt;
  signal input underlyingPerUnit;
  signal input extDataHash;

  signal private input inputAmount;
  signal private input inputDebt;
  signal private input inputSecret;
  signal private input inputNullifier;
  signal         input inputRoot;
  signal private input inputPathIndices;
  signal private input inputPathElements[levels];
  signal         input inputNullifierHash;

  signal private input outputAmount;
  signal private input outputDebt;
  signal private input outputSecret;
  signal private input outputNullifier;
  signal         input outputRoot;
  signal         input outputPathIndices;
  signal private input outputPathElements[levels];
  signal         input outputCommitment;

  // Verify amount and debt invariant
  inputAmount === outputAmount + amount;
  outputDebt === inputDebt + debt;
  component debtCheck = LessEqThan(248);
  debtCheck.in[0] <== outputDebt;
  debtCheck.in[1] <== outputAmount * underlyingPerUnit;
  debtCheck.out === 1;

  // Check that amounts fit into 248 bits to prevent overflow
  // Amount range is checked by the smart contract
  component inputAmountCheck = Num2Bits(248);
  component outputAmountCheck = Num2Bits(248);
  inputAmountCheck.in <== inputAmount;
  outputAmountCheck.in <== outputAmount;

  // Compute input commitment
  component inputHasher = Poseidon(4);
  inputHasher.inputs[0] <== inputAmount;
  inputHasher.inputs[1] <== inputDebt;
  inputHasher.inputs[2] <== inputSecret;
  inputHasher.inputs[3] <== inputNullifier;

  // Verify that input commitment exists in the tree
  component tree = MerkleTree(levels);
  tree.leaf <== inputHasher.out;
  tree.pathIndices <== inputPathIndices;
  for (var i = 0; i < levels; i++) {
    tree.pathElements[i] <== inputPathElements[i];
  }
  tree.root === inputRoot;

  // Verify input nullifier hash
  component nullifierHasher = Poseidon(1);
  nullifierHasher.inputs[0] <== inputNullifier;
  nullifierHasher.out === inputNullifierHash;

  // Compute and verify output commitment
  component outputHasher = Poseidon(4);
  outputHasher.inputs[0] <== outputAmount;
  outputHasher.inputs[1] <== outputDebt;
  outputHasher.inputs[2] <== outputSecret;
  outputHasher.inputs[3] <== outputNullifier;
  outputHasher.out === outputCommitment;

  // Update accounts tree with output account commitment
  component treeUpdater = MerkleTreeUpdater(levels, zeroLeaf);
  treeUpdater.oldRoot <== inputRoot;
  treeUpdater.newRoot <== outputRoot;
  treeUpdater.leaf <== outputCommitment;
  treeUpdater.pathIndices <== outputPathIndices;
  for (var i = 0; i < levels; i++) {
      treeUpdater.pathElements[i] <== outputPathElements[i];
  }

  // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
  // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
  // Squares are used to prevent optimizer from removing those constraints
  signal extDataHashSquare;
  extDataHashSquare <== extDataHash * extDataHash;
}
