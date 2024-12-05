// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./UTSTokenWithFee.sol";
import "./UTSTokenMintable.sol";

/**
 * @notice Extends UTSTokenMintable to implement fee collecting for crosschain ERC20 token bridging.  
 */
contract UTSTokenMintableWithFee is UTSTokenMintable, UTSTokenWithFee {

    function _burnFrom(
        address spender,
        address from,
        bytes memory to, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory customPayload
    ) internal override(UTSToken, UTSTokenWithFee) returns(uint256) {
        return super._burnFrom(
            spender,
            from,
            to, 
            amount, 
            dstChainId, 
            customPayload
        );
    }

    function _authorizeCall() internal override(UTSToken, UTSTokenWithFee) onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }
    
}