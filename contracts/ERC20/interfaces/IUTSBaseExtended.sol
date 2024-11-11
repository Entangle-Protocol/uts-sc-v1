// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IUTSBase.sol";

interface IUTSBaseExtended {

    function setChainConfigToDestination(
        uint256[] calldata dstChainIds,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable returns(bool);

    function setChainConfigByRouter(
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs,
        Origin calldata origin
    ) external;

    function estimateUpdateFee(
        uint256[] calldata dstChainIds, 
        uint256[] calldata configsLength
    ) external view returns(uint256 paymentAmount);

}