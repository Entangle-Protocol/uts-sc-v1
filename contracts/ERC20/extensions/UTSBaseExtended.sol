// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../UTSBase.sol";

import "../interfaces/IUTSBaseExtended.sol";

abstract contract UTSBaseExtended is IUTSBaseExtended, UTSBase {
    using AddressConverter for address;
    using BytesLib for bytes;

    function setChainConfigToDestination(
        uint256[] calldata dstChainIds,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable returns(bool) {
        _authorizeCall();

        if (dstChainIds.length != newConfigs.length) revert UTSBase__E4();

        bytes[] memory _dstPeers = new bytes[](dstChainIds.length);

        for (uint256 i; dstChainIds.length > i; ++i) _dstPeers[i] = _chainConfig[dstChainIds[i]].peerAddress;

        return IUTSRouter(router()).requestToUpdateConfig{value: msg.value}( 
            msg.sender.toBytes(),
            dstChainIds,
            _dstPeers,
            newConfigs
        );
    }

    function setChainConfigByRouter(
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs,
        Origin calldata origin
    ) external {
        _onlyRouter();

        if (!_chainConfig[origin.chainId].peerAddress.equalStorage(origin.peerAddress)) revert UTSBase__E7();

        _setChainConfig(allowedChainIds, chainConfigs);
    }

    function estimateUpdateFee(
        uint256[] calldata dstChainIds, 
        uint256[] calldata configsLength
    ) external view returns(uint256 paymentAmount) {
        return IUTSRouter(router()).getUpdateFee(dstChainIds, configsLength);
    }

}