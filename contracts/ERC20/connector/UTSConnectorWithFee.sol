// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./UTSConnector.sol";
import "../extensions/UTSFeeModule.sol";

/**
 * @notice Extends UTSConnector to implement fee collecting for crosschain ERC20 token bridging.  
 */
contract UTSConnectorWithFee is UTSConnector, UTSFeeModule {
    using SafeERC20 for IERC20;

    /**
     * @notice Initiates the tokens bridging with a check the fee rate has not updated to prevent unexpected deducting.
     * @param from tokens holder on the current chain.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param expectedFeeRate expected {bridgeFeeRate}.
     * @param customPayload user's additional data.
     * @param protocolPayload UTS protocol's additional data.
     * @return success call result.
     * @return afterFeeBridgedAmount bridged tokens amount after deducting fee.
     */
    function bridgeWithSlippageCheck(
        address from,
        bytes calldata to, 
        uint256 amount, 
        uint256 dstChainId,
        uint64 dstGasLimit,
        uint16 expectedFeeRate,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool success, uint256 afterFeeBridgedAmount) {
        if (expectedFeeRate != bridgeFeeRate[dstChainId]) revert UTSFeeModule__E1();

        return _bridge(msg.sender, from, to, amount, dstChainId, dstGasLimit, customPayload, protocolPayload);
    }

    function _burnFrom(
        address spender,
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory /* customPayload */
    ) internal override returns(uint256 afterFeeAmount) {
        IERC20(_underlyingToken).safeTransferFrom(spender, address(this), amount);

        uint256 _feeAmount = amount * bridgeFeeRate[dstChainId] / BPS;

        if (_feeAmount > 0) IERC20(_underlyingToken).safeTransfer(feeCollector, _feeAmount);

        return amount - _feeAmount;
    }

    function _authorizeCall() internal override(UTSConnector, UTSFeeModule) onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }
}