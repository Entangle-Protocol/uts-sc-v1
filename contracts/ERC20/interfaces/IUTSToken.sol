// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/libraries/UTSERC20DataTypes.sol";

interface IUTSToken is IERC20 {

    function globalBurnable() external view returns(bool);
    
    function onlyRoleBurnable() external view returns(bool);

    function initializeToken(DeployTokenData calldata $) external;

}