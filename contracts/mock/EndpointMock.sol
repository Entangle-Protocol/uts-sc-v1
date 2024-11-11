// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@entangle_protocol/oracle-sdk/contracts/lib/PhotonFunctionSelectorLib.sol";
import "@entangle_protocol/oracle-sdk/contracts/IProposer.sol";

contract EndpointMock is IProposer {

    uint256 constant ADDRESS_MAX_LEN = 128;
    uint256 constant PARAMS_MAX_LEN = 4 * 1024;

    bytes32 public lastProposal;
    bytes32 public lastExecution;

    error Endpoint__E0();
    error Endpoint__E1();
    error Endpoint__E2();
    error Endpoint__E3();

    struct Signature {
        uint8   v;
        bytes32 r;
        bytes32 s;
    }

    struct OperationData {
        bytes32 protocolId;
        uint256 meta;
        uint256 srcChainId;
        uint256 srcBlockNumber;
        bytes32[2] srcOpTxId;
        uint256 nonce;
        uint256 destChainId;
        bytes   protocolAddr;
        bytes   functionSelector;
        bytes   params;
        bytes   reserved;
    }

    event Propose(
        bytes32 indexed protocolId,
        uint256 meta,
        uint256 nonce,
        uint256 indexed destChainId,
        bytes protocolAddress,
        bytes functionSelector,
        bytes params,
        bytes reserved
    );

    function propose(
        bytes32 protocolId,
        uint256 destChainId,
        bytes calldata protocolAddress,
        bytes calldata functionSelector,
        bytes calldata params
    ) external {
        if (protocolAddress.length > ADDRESS_MAX_LEN) revert Endpoint__E2();
        if (params.length > PARAMS_MAX_LEN) revert Endpoint__E3();

        lastProposal = getHash(protocolId, destChainId, protocolAddress, functionSelector, params);

        emit Propose(
            protocolId,
            0,
            0,
            destChainId,
            protocolAddress,
            functionSelector,
            params,
            ""
        );
    }

    function proposeInOrder(
        bytes32 protocolId,
        uint256 destChainId,
        bytes calldata protocolAddress,
        bytes calldata functionSelector,
        bytes calldata params
    ) external {
        lastProposal = getHash(protocolId, destChainId, protocolAddress, functionSelector, params);
    }

    function executeOperation(
        OperationData calldata opData, 
        Signature[] calldata /* transmitterSigs */
    ) external payable {
        address _target = abi.decode(opData.protocolAddr, (address));

        (uint8 _selectorType, bytes memory _selectorDecoded) = PhotonFunctionSelectorLib.decodeFunctionSelector(
            opData.functionSelector
        );

        if (_selectorType != 0) revert Endpoint__E0();

        bytes4 _func = abi.decode(_selectorDecoded, (bytes4));

        (bool success, /* bytes memory result */) = _target.call{value: msg.value}(
            abi.encodeWithSelector(
                _func,
                abi.encode(
                    opData.protocolId,
                    opData.srcChainId,
                    opData.srcBlockNumber,
                    opData.srcOpTxId,
                    opData.params
                )
            )
        );

        if (!success) revert Endpoint__E1();

        lastExecution = getHash(
            opData.protocolId, 
            opData.destChainId, 
            opData.protocolAddr, 
            opData.functionSelector, 
            opData.params
        );
    }

    function getHash(
        bytes32 protocolId,
        uint256 destChainId,
        bytes calldata protocolAddress,
        bytes calldata functionSelector,
        bytes calldata params
    ) public pure returns(bytes32) {
        return keccak256(abi.encode(protocolId, destChainId, protocolAddress, functionSelector, params));
    }
}