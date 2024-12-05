// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSToken.sol";
import "../connector/UTSConnector.sol";

import "../interfaces/IUTSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for UTSConnector and UTSToken contracts.
 *
 * The bytecode is used by the {UTSFactory} for deployment.
 */
contract UTSCodeStorage is IUTSCodeStorage {

    /**
     * @notice Returns the creation bytecode for a specified contract type.
     * @param isConnector flag indicating whether to return the creation bytecode for the {UTSConnector} or {UTSToken} contract.
     * @return bytecode creation bytecode of the specified contract type.
     */
    function getCode(bool isConnector) external pure returns(bytes memory bytecode) {
        return isConnector ? type(UTSConnector).creationCode : type(UTSToken).creationCode;
    }
    
}