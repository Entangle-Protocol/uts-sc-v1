// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IUTSCodeStorage {

    function getCode(bool isConnector) external pure returns(bytes memory);

}