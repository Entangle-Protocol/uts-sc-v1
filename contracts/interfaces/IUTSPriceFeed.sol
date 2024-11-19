// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IUTSPriceFeed {

    function setPrices(uint256[] calldata groupIds, uint256[] calldata packedPrices) external;

    function setDstPricePerByteInWei(uint256[] calldata chainIds, uint64[] calldata dstPricePerByteInWei) external;

    function setChainInfo(uint256[] calldata chainIds, uint256[] calldata packedChainInfo) external;

    function pause() external;

    function unpause() external;

    function getPrices(uint256 chainId) external view returns(uint256 dstGasPrice, uint256 dstPricePerByte);

    function getDstGasPriceAtSrcNative(uint256 chainId) external view returns(uint256 dstGasPrice);

    function getDstPricePerByteInWei(uint256 chainId) external view returns(uint64);

    function getChainInfo(uint256 chainId) external view returns(
        uint176 reserved, 
        uint8 groupId, 
        uint8 slotOffset, 
        uint64 pricePerByte
    );

    function getPriceByOffset(uint8 groupId, uint8 offset) external view returns(uint256);

    function getGroupPrices(uint8 groupId) external view returns(uint256, uint256, uint256, uint256);

    function getRawChainInfo(uint256 chainId) external view returns(uint256);

    function getRawPrices(uint256 groupId) external view returns(uint256);

}