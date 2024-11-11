// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IUTSToken.sol";

interface IUTSTokenMintable is IUTSToken {

    function mint(address to, uint256 amount) external;

}