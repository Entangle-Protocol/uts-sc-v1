// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Various structs and enum used in the UTS protocol V1 core contracts.

    /// @notice The {UTSToken} and {UTSConnector} metadata registered in the {UTSRegistry}.
    struct DeploymentData {
        bytes   deployer;            // deployer {msg.sender} address
        address underlyingToken;     // underlying token address
        bytes2  initProtocolVersion; // initial UTS protocol version
    }

    /// @notice Metadata for manual registration of UTS compatible contract in the {UTSRegistry}.
    struct ApproveRequestData {
        address deployment;      // UTS compatible contract address
        bytes   deployer;        // deployer address
        address underlyingToken; // underlying token address
        bytes2  protocolVersion; // UTS protocol version
    }

    /// @notice Execution result code for the {UTSMasterRouter.ProposalExecuted} event.
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