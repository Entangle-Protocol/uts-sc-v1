// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IUTSFeeModule {

    function feeCollector() external view returns(address);

    function bridgeFeeRate(uint256 dstChainId) external view returns(uint16);

    function bridgeWithSlippageCheck(
        address from,
        bytes calldata to, 
        uint256 amount, 
        uint256 dstChainId,
        uint64 gasLimit,
        uint16 expectedFeeRate,
        bytes calldata payload
    ) external payable returns(bool, uint256);

    function setFeeCollector(address newFeeCollector) external;

    function setBridgeFeeRate(uint256[] calldata dstChainIds, uint16[] calldata newBridgeFeeRates) external;

}