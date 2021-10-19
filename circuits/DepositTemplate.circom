include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Deposit an amount or pay back debt
template Deposit(levels, zeroLeaf) {
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

  // Check amount and debt invariant
  outputAmount === inputAmount + amount;
  inputDebt === outputDebt + debt;
  component debtCheck = LessEqThan(248);
  debtCheck.in[0] <== outputDebt * unitPerUnderlying;
  debtCheck.in[1] <== outputAmount;
  debtCheck.out === 1;

  // === check input and output accounts and block range ===
  // Check that amounts fit into 248 bits to prevent overflow
  // Technically block range check could be skipped because it can't be large enough
  // negative number that `outputAmount` fits into 248 bits
  component inputAmountCheck = Num2Bits(248);
  component outputAmountCheck = Num2Bits(248);
  inputAmountCheck.in <== inputAmount;
  outputAmountCheck.in <== outputAmount;

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
