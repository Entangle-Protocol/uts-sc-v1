// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./UTSConnector.sol";
import "../extensions/UTSFeeModule.sol";

contract UTSConnectorWithFee is UTSConnector, UTSFeeModule {
    using SafeERC20 for IERC20;

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
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory /* customPayload */
    ) internal override returns(uint256) {
        IERC20(_underlyingToken).safeTransferFrom(spender, address(this), amount);

        uint256 _feeAmount = amount * bridgeFeeRate[dstChainId] / BPS;

        if (_feeAmount > 0) IERC20(_underlyingToken).safeTransfer(feeCollector, _feeAmount);

        return amount - _feeAmount;
    }

    function _authorizeCall() internal override(UTSConnector, UTSFeeModule) onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }
}