// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IUTSMasterRouter {

    function feeCollector() external view returns(address);

    function PAYLOAD_SIZE_LIMIT() external view returns(uint16);

    function validateRouter(address target) external view returns(bool);

    function dstMasterRouter(uint256 dstChainId) external view returns(bytes memory);

    function sendProposal(uint256 payloadLength, uint256 dstChainId, bytes calldata params) external payable;

    function executeProposal(bytes calldata data) external payable;

    function setFeeCollector(address newFeeCollector) external;

    function setDstMasterRouter(uint256[] calldata dstChainIds, bytes[] calldata newDstMasterRouter) external;

    function pause() external;

    function unpause() external;

}