// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../libraries/UTSCoreDataTypes.sol";
import "../libraries/UTSERC20DataTypes.sol";

interface IUTSRegistry {

    function validateUnderlyingRegistered(address underlyingToken) external view returns(bool isRegistered);

    function validateDeploymentRegistered(address deployment) external view returns(bool isRegistered);

    function validateFactory(address target) external view returns(bool isAuthorized);
    
    function deploymentData(address deployment) external view returns(DeploymentData memory);

    function totalDeployments() external view returns(uint256);

    function underlyingTokens() external view returns(address[] memory);

    function deployments() external view returns(address[] memory);

    function deploymentsByIndex(uint256[] calldata indexes) external view returns(address[] memory);

    function deploymentsByUnderlying(address underlyingToken) external view returns(address[] memory);

    function deploymentsByDeployer(bytes calldata deployer) external view returns(address[] memory);
    
    function registerDeployment(
        address deployment,
        bytes calldata deployer,
        address underlyingToken,
        bytes2 protocolVersion
    ) external;

    function approveRequestBatch(ApproveRequestData[] calldata requests) external returns(bool);

    function updateChainConfigs(uint256[] calldata allowedChainIds, ChainConfig[] calldata chainConfigs) external;

    function updateRouter(address newRouter) external;

}