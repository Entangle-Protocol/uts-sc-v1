// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./UTSToken.sol";

import "../interfaces/IUTSTokenMintable.sol";

contract UTSTokenMintable is IUTSTokenMintable, UTSToken {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function mint(address to, uint256 amount) external {
        if (!hasRole(MINTER_ROLE, msg.sender)) revert UTSToken__E0();
        
        _mint(to, amount);
    }

}