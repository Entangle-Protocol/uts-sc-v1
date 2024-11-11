// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/IUTSFeeModule.sol";

abstract contract UTSFeeModule is IUTSFeeModule {

    uint16 internal constant BPS = 10000;

    address public feeCollector;

    /// @dev MAX value 9999 = 99.99%
    mapping(uint256 dstChainId => uint16 bridgeFeeRate) public bridgeFeeRate;
  
    error UTSFeeModule__E0();     // {newBridgeFeeRate} exceeds 100%
    error UTSFeeModule__E1();     // {bridgeFeeRate} updated
    error UTSFeeModule__E2();     // arguments length mismatch

    event FeeCollectorSet(address indexed caller, address newFeeCollector);
    event BridgeFeeRateSet(address indexed caller, uint256 indexed dstChainId, uint16 newBridgeFeeRate);

    function setFeeCollector(address newFeeCollector) external {
        _authorizeCall();
        feeCollector = newFeeCollector;

        emit FeeCollectorSet(msg.sender, newFeeCollector);
    }

    function setBridgeFeeRate(uint256[] calldata dstChainIds, uint16[] calldata newBridgeFeeRates) external {
        _authorizeCall();
        if (dstChainIds.length != newBridgeFeeRates.length) revert UTSFeeModule__E2();

        for (uint256 i; dstChainIds.length > i; ++i) {
            if (newBridgeFeeRates[i] >= BPS) revert UTSFeeModule__E0();
            bridgeFeeRate[dstChainIds[i]] = newBridgeFeeRates[i];

            emit BridgeFeeRateSet(msg.sender, dstChainIds[i], newBridgeFeeRates[i]);
        }
    }

    function _authorizeCall() internal virtual;
}