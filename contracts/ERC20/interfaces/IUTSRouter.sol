// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "contracts/libraries/UTSERC20DataTypes.sol";

interface IUTSRouter {

    function MASTER_ROUTER() external view returns(address);

    function PRICE_FEED() external view returns(address);

    function protocolVersion() external view returns(bytes2);

    function getBridgeFee(
        uint256 dstChainId, 
        uint64 dstGasLimit,
        uint256 payloadLength,
        bytes calldata protocolPayload
    ) external view returns(uint256);

    function getUpdateFee(uint256[] calldata dstChainIds, uint256[] calldata configsLength) external view returns(uint256);

    function dstMinGasLimit(uint256 dstChainId) external view returns(uint64);

    function dstProtocolFee(uint256 dstChainId) external view returns(uint16);

    function dstUpdateGas(uint256 dstChainId) external view returns(uint64);

    function setDstMinGasLimit(uint256[] calldata dstChainIds, uint64[] calldata newDstMinGasLimits) external;

    function setDstProtocolFee(uint256[] calldata dstChainIds, uint16[] calldata newDstProtocolFees) external;

    function setDstUpdateGas(uint256[] calldata dstChainIds, uint64[] calldata newDstUpdateGas) external;

    function bridge(
        bytes calldata dstToken,
        bytes calldata sender,
        bytes calldata to,
        uint256 amount,
        uint8 srcDecimals,
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable returns(bool success);

    function requestToUpdateConfig(
        bytes calldata sender,
        uint256[] calldata dstChainIds,
        bytes[] calldata dstPeers,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable returns(bool success);

    function execute(
        address dstToken, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult);

    function pause() external;

    function unpause() external;

}