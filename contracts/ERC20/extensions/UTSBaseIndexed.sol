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

/**
 * @notice Extension of {UTSBase} that adds an external calls to emit events in the {UTSRegistry} to log crucial data
 * off-chain.
 *
 * @dev Сan only be used by contracts deployed by {UTSFactory} or contracts manually registered in the {UTSRegistry}.
 */
abstract contract UTSBaseIndexed is UTSBaseExtended {

    /// @notice The {UTSRegistry} contract address.
    address private immutable REGISTRY;

    /// @notice Initializes immutable {REGISTRY} variable.
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