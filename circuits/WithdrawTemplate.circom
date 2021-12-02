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
  signal input unitPerUnderlying;
  signal input extDataHash;

  signal private input inputAmount;
  signal private input inputDebt;
  signal private input inputSecret;
  signal private input inputNullifier;
  signal private input inputSalt;
  signal         input inputAccountHash;

  signal private input outputAmount;
  signal private input outputDebt;
  signal private input outputSecret;
  signal private input outputNullifier;
  signal private input outputSalt;
  signal         input outputAccountHash;

  // Verify amount and debt invariant
  inputAmount === outputAmount + amount;
  outputDebt === inputDebt + debt;
  component debtCheck = LessEqThan(248);
  debtCheck.in[0] <== outputDebt * unitPerUnderlying;
  debtCheck.in[1] <== outputAmount;
  debtCheck.out === 1;

  // Check that amounts fit into 248 bits to prevent overflow
  // Amount range is checked by the smart contract
  component inputAmountCheck = Num2Bits(248);
  component outputAmountCheck = Num2Bits(248);
  component inputDebtCheck = Num2Bits(248);
  component outputDebtCheck = Num2Bits(248);
  inputAmountCheck.in <== inputAmount;
  outputAmountCheck.in <== outputAmount;
  inputDebtCheck.in <== inputDebt;
  outputDebtCheck.in <== outputDebt;

  // Check input account hash
  component inputAccountHasher = Poseidon(5);
  inputAccountHasher.inputs[0] <== inputAmount;
  inputAccountHasher.inputs[1] <== inputDebt;
  inputAccountHasher.inputs[2] <== inputSecret;
  inputAccountHasher.inputs[3] <== inputNullifier;
  inputAccountHasher.inputs[4] <== inputSalt;
  inputAccountHasher.out === inputAccountHash;

  // Check output account hash
  component outputAccountHasher = Poseidon(5);
  outputAccountHasher.inputs[0] <== outputAmount;
  outputAccountHasher.inputs[1] <== outputDebt;
  outputAccountHasher.inputs[2] <== outputSecret;
  outputAccountHasher.inputs[3] <== outputNullifier;
  outputAccountHasher.inputs[4] <== outputSalt;
  outputAccountHasher.out === outputAccountHash;

  // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
  // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
  // Squares are used to prevent optimizer from removing those constraints
  signal extDataHashSquare;
  extDataHashSquare <== extDataHash * extDataHash;
}
