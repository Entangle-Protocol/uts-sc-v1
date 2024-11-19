// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./UTSBaseExtended.sol";

interface IUTSFactory {

    function REGISTRY() external view returns(address);

}

interface IUTSRegistry {

    function updateChainConfigs(uint256[] calldata allowedChainIds, ChainConfig[] calldata chainConfigs) external;

    function updateRouter(address newRouter) external;

}

abstract contract UTSBaseIndexed is UTSBaseExtended {

    address private immutable REGISTRY;

    constructor() {
        REGISTRY = IUTSFactory(msg.sender).REGISTRY();
    }

    function _setChainConfig(uint256[] memory allowedChainIds, ChainConfig[] memory chainConfigs) internal virtual override {

        IUTSRegistry(REGISTRY).updateChainConfigs(allowedChainIds, chainConfigs);

        super._setChainConfig(allowedChainIds, chainConfigs);
    }

    function _setRouter(address newRouter) internal virtual override {

        IUTSRegistry(REGISTRY).updateRouter(newRouter);

        super._setRouter(newRouter);
    }

}