// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenWithFee.sol";

import "../interfaces/IUTSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for UTSTokenWithFee contract.
 *
 * The bytecode is used by the {UTSFactory} for deployment.
 */
contract UTSCodeStorageTokenWithFee is IUTSCodeStorage {

    /**
     * @notice Returns the UTSTokenWithFee creation bytecode.
     * @return bytecode creation bytecode of the {UTSTokenWithFee} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(UTSTokenWithFee).creationCode;
    }
    
}