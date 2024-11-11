// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../ERC20/token/ERC20Burnable.sol";
import "../ERC20/token/UTSToken.sol";
import "./ERC20Mock.sol";

contract UTSTokenMock is UTSToken {

    error UTSTokenMock__E0(bytes);

    function msgData() external view returns(bytes calldata) {
        return _msgData();
    }

    function contextSuffixLength() external view returns(uint256) {
        return _contextSuffixLength();
    }

    function redeem(
        address /* to */,
        uint256 /* amount */,
        bytes calldata /* payload */,
        Origin calldata /* origin */
    ) external payable override returns(bool) {
        bytes memory code = abi.encodePacked(type(ERC20Mock).creationCode);

        revert UTSTokenMock__E0(code);
    }

    function _setChainConfig(uint256[] memory allowedChainIds, ChainConfig[] memory chainConfigs) internal override {
        UTSBase._setChainConfig(allowedChainIds, chainConfigs);
    }

    function _setRouter(address newRouter) internal override {
        UTSBase._setRouter(newRouter);
    }
}

contract UTSTokenMockTwo is ERC20Burnable {

    error UTSTokenMock__E0(bytes);
    error UTSTokenMock__E1();

    address public router;

    mapping(bytes32 msgHash => address to) private _failedExecution;

    constructor(address _router) {
        __ERC20_init("1", "1");
        router = _router;
    }

    function redeem(
        address /* to */,
        uint256 /* amount */,
        bytes calldata /* payload */,
        Origin calldata /* origin */
    ) external payable returns(bool) {
        revert UTSTokenMock__E1();
    }

    function storeFailedExecution(
        address to,
        uint256 amount,
        bytes calldata payload,
        Origin calldata origin,
        bytes calldata result
    ) external {
        bytes memory code = abi.encodePacked(type(ERC20Mock).creationCode);
        _failedExecution[keccak256(abi.encode(to, amount, payload, origin, result.length))] = to;

        revert UTSTokenMock__E0(code);
    }

    function isExecutionFailed(
        address to, 
        uint256 amount, 
        bytes calldata payload, 
        Origin calldata origin,
        uint256 nonce
    ) external view returns(bool) {
        return _failedExecution[keccak256(abi.encode(to, amount, payload, origin, nonce))] == to;
    }
}