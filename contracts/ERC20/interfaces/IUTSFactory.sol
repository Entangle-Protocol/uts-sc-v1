// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "contracts/libraries/UTSERC20DataTypes.sol";

interface IUTSFactory {

    function MASTER_ROUTER() external view returns(address);

    function REGISTRY() external view returns(address);

    function router() external view returns(address);

    function codeStorage(uint256 blueprintId) external view returns(address);

    function protocolVersion() external pure returns(bytes2);

    function getPrecomputedAddress(
        uint256 blueprintId,
        bytes calldata deployer, 
        bytes32 salt, 
        bool isConnector
    ) external view returns(address deployment, bool hasCode);

    function deployToken(DeployTokenData calldata deployData) external returns(bool success, address newToken);

    function deployConnector(DeployConnectorData calldata deployData) external returns(bool success, address newConnector);

    function deployByRouter(
        bool isConnector, 
        bytes calldata deployer, 
        bytes calldata deployParams
    ) external returns(bool success, address newDeployment);

    function pause() external;

    function unpause() external;

    function setRouter(address newRouter) external;

    function setCodeStorage(uint256 blueprintId, address newCodeStorage) external;
    
}