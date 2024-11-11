// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "contracts/libraries/UTSERC20DataTypes.sol";

interface IUTSBase {

    function protocolVersion() external view returns(bytes2);

    function underlyingToken() external view returns(address);

    function router() external view returns(address routerAddress);

    function getChainConfigs(uint256[] calldata chainIds) external view returns(ChainConfig[] memory configs);

    function isExecutionFailed(
        address to,
        uint256 amount,
        bytes calldata payload,
        Origin calldata origin,
        uint256 nonce
    ) external view returns(bool);

    function estimateBridgeFee(
        uint256 dstChainId, 
        uint64 gasLimit, 
        uint16 payloadLength
    ) external view returns(uint256 paymentAmount, uint64 dstMinGasLimit);

    function setRouter(address newRouter) external returns(bool);

    function setChainConfig(
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs
    ) external returns(bool);

    function bridge(
        address from,
        bytes calldata to,
        uint256 amount,
        uint256 dstChainId,
        uint64 gasLimit,
        bytes calldata payload
    ) external payable returns(bool, uint256);

    function redeem(
        address to,
        uint256 amount,
        bytes calldata payload,
        Origin calldata origin
    ) external payable returns(bool);

    function storeFailedExecution(
        address to,
        uint256 amount,
        bytes calldata payload,
        Origin calldata origin,
        bytes calldata result
    ) external;

    function retryRedeem(
        address to, 
        uint256 amount, 
        bytes calldata payload, 
        Origin calldata origin,
        uint256 nonce
    ) external returns(bool);

}