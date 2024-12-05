// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenPure.sol";

import "../interfaces/IUTSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for UTSTokenPure contract.
 *
 * The bytecode is used by the {UTSFactory} for deployment.
 */
contract UTSCodeStoragePure is IUTSCodeStorage {

    /**
     * @notice Returns the UTSTokenPure creation bytecode.
     * @return bytecode creation bytecode of the {UTSTokenPure} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(UTSTokenPure).creationCode;
    }
    
}