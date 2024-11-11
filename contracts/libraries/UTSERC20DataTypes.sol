// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

    struct ChainConfig {
        bytes   peerAddress;
        uint64  minGasLimit;
        uint8   decimals;
        bool    paused;
    }

    struct ChainConfigUpdate {
        uint256[] allowedChainIds;
        ChainConfig[] chainConfigs;
    }

    struct Origin {
        bytes   sender;
        uint256 chainId;
        bytes   peerAddress;
        uint8   decimals;
    }

    struct DeployTokenData {
        bytes     owner;
        string    name;
        string    symbol;
        uint8     decimals;
        uint256   initialSupply;
        bool      pureToken;
        bool      mintable;
        bool      globalBurnable;
        bool      onlyRoleBurnable;
        bool      feeModule;
        bytes     router;
        uint256[] allowedChainIds;
        ChainConfig[] chainConfigs;
        bytes32   salt;
    }

    struct DeployConnectorData {
        bytes     owner;
        bytes     underlyingToken;
        bool      feeModule;
        bytes     router;
        uint256[] allowedChainIds;
        ChainConfig[] chainConfigs;
        bytes32   salt;
    }

    struct DeployMetadata {
        uint256 dstChainId;
        bool    isConnector;
        bytes   params;
    }

    struct DstDeployConfig {
        bytes   factory;
        uint64  tokenDeployGas;
        uint64  connectorDeployGas;
        uint16  protocolFee;
    }