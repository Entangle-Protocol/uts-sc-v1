// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./UTSToken.sol";
import "../extensions/UTSFeeModule.sol";

contract UTSTokenWithFee is UTSToken, UTSFeeModule {

    function bridgeWithSlippageCheck(
        address from,
        bytes calldata to, 
        uint256 amount, 
        uint256 dstChainId,
        uint64 gasLimit,
        uint16 expectedFeeRate,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool, uint256) {
        if (expectedFeeRate != bridgeFeeRate[dstChainId]) revert UTSFeeModule__E1();

        return _bridge(msg.sender, from, to, amount, dstChainId, gasLimit, customPayload, protocolPayload);
    }

    function _burnFrom(
        address spender,
        address from,
        bytes memory /* to */, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory /* customPayload */
    ) internal virtual override returns(uint256) {
        if (from != spender) _spendAllowance(from, spender, amount);

        uint256 _feeAmount = amount * bridgeFeeRate[dstChainId] / BPS;

        if (_feeAmount > 0) ERC20Modified._update(from, feeCollector, _feeAmount);

        ERC20Modified._update(from, address(0), amount - _feeAmount);

        return amount - _feeAmount;
    }

    function _authorizeCall() internal virtual override(UTSToken, UTSFeeModule) onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }
}