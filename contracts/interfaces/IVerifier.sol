// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVerifier {
  function verifyProof(bytes memory proof, uint[3] memory pubSignals) external view returns (bool);
  function verifyProof(bytes memory proof, uint[4] memory pubSignals) external view returns (bool);
  function verifyProof(bytes memory proof, uint[5] memory pubSignals) external view returns (bool);
  function verifyProof(bytes memory proof, uint[6] memory pubSignals) external view returns (bool);
}
