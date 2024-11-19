// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "contracts/libraries/UTSERC20DataTypes.sol";

interface IUTSDeploymentRouter {

    function MASTER_ROUTER() external view returns(address);

    function PRICE_FEED() external view returns(address);

    function FACTORY() external view returns(address);

    function REGISTRY() external view returns(address);

    function PAYMENT_TOKEN() external view returns(address);

    function EOB_CHAIN_ID() external view returns(uint256);

    function protocolVersion() external view returns(bytes2);

    function dstDeployConfig(uint256 dstChainId) external view returns(DstDeployConfig memory);

    function dstTokenDeployGas(uint256 dstChainId) external view returns(uint64);

    function dstConnectorDeployGas(uint256 dstChainId) external view returns(uint64);

    function dstProtocolFee(uint256 dstChainId) external view returns(uint16);

    function dstFactory(uint256 dstChainId) external view returns(bytes memory);

    function estimateDeployTotal(
        uint256[] calldata dstTokenChainIds, 
        uint256[] calldata dstConnectorChainIds
    ) external view returns(uint256 paymentTokenAmount, uint256 paymentNativeAmount);

    function estimateDeploy(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(
        uint256[] memory tokenPaymentAmount, 
        uint256[] memory connectorPaymentAmount, 
        uint256 totalPaymentAmount
    );

    function estimateDeployNative(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(
        uint256[] memory tokenPaymentAmountNative, 
        uint256[] memory connectorPaymentAmountNative, 
        uint256 totalPaymentAmountNative
    );

    function sendDeployRequest(
        DeployMetadata[] calldata deployMetadata,
        address paymentToken
    ) external payable returns(uint256 paymentAmount, address currentChainDeployment);

    function getDeployTokenParams(DeployTokenData calldata deployData) external pure returns(bytes memory);

    function getDeployConnectorParams(DeployConnectorData calldata deployData) external pure returns(bytes memory);

    function setDstDeployConfig(uint256[] calldata dstChainIds, DstDeployConfig[] calldata newConfigs) external;

    function setDstDeployGas(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newTokenDeployGas, 
        uint64[] calldata newConnectorDeployGas
    ) external;

    function setDstProtocolFee(uint256[] calldata dstChainIds, uint16[] calldata newProtocolFees) external;

    function setDstFactory(uint256[] calldata dstChainIds, bytes[] calldata newFactory) external;

    function execute(
        address dstFactoryAddress, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult);

    function pause() external;

    function unpause() external;

}