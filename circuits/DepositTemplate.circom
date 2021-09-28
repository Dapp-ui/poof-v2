include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./MerkleTree.circom";
include "./MerkleTreeUpdater.circom";

// Deposit an amount or pay back debt
template Deposit(levels, zeroLeaf) {
  signal input amount;
  signal input debt;
  signal input underlyingPerUnit;
  signal input extDataHash;

  signal private input inputAmount;
  signal private input inputDebt;
  signal private input inputSecret;
  signal private input inputNullifier;
  signal         input inputRoot;
  signal private input inputPathElements[levels];
  signal private input inputPathIndices;
  signal         input inputNullifierHash;

  signal private input outputAmount;
  signal private input outputDebt;
  signal private input outputSecret;
  signal private input outputNullifier;
  signal         input outputRoot;
  signal         input outputPathIndices;
  signal private input outputPathElements[levels];
  signal         input outputCommitment;

  // Check amount and debt invariant
  outputAmount === inputAmount + amount;
  inputDebt === outputDebt + debt;
  component debtCheck = LessEqThan(248);
  debtCheck.in[0] <== outputDebt;
  debtCheck.in[1] <== outputAmount * underlyingPerUnit;
  debtCheck.out === 1;

  // === check input and output accounts and block range ===
  // Check that amounts fit into 248 bits to prevent overflow
  // Technically block range check could be skipped because it can't be large enough
  // negative number that `outputAmount` fits into 248 bits
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

  // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
  // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
  // Squares are used to prevent optimizer from removing those constraints
  signal extDataHashSquare;
  extDataHashSquare <== extDataHash * extDataHash;
}
