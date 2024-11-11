// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./UTSBaseExtended.sol";

import "contracts/interfaces/IUTSRegistry.sol";

abstract contract UTSBaseIndexed is UTSBaseExtended {

    address private constant REGISTRY = 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9;

    function _setChainConfig(uint256[] memory allowedChainIds, ChainConfig[] memory chainConfigs) internal virtual override {

        IUTSRegistry(REGISTRY).updateChainConfigs(allowedChainIds, chainConfigs);

        super._setChainConfig(allowedChainIds, chainConfigs);
    }

    function _setRouter(address newRouter) internal virtual override {

        IUTSRegistry(REGISTRY).updateRouter(newRouter);

        super._setRouter(newRouter);
    }

}