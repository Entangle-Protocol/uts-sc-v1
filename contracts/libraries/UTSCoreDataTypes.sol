// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

    struct DeploymentData {
        bytes   deployer;
        address underlyingToken;
        bytes2  initProtocolVersion;
    }

    struct ApproveRequestData {
        address deployment;
        bytes   deployer;
        address underlyingToken;
        bytes2  protocolVersion;
    }

    enum OperationResult {
        Success,
        FailedAndStored,
        Failed,
        RouterPaused,
        UnauthorizedRouter,
        InvalidDstPeerAddress,
        InvalidSrcChainId,
        InvalidToAddress,
        InvalidSrcPeerAddress,
        DeployFailed,
        IncompatibleRouter,
        MasterRouterPaused,
        InvalidMessageType
    }