// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenMintable.sol";

import "../interfaces/IUTSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for UTSTokenMintable contract.
 *
 * The bytecode is used by the {UTSFactory} for deployment.
 */
contract UTSCodeStorageMintable is IUTSCodeStorage {

    /**
     * @notice Returns the UTSTokenMintable creation bytecode.
     * @return bytecode creation bytecode of the {UTSTokenMintable} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(UTSTokenMintable).creationCode;
    }
    
}