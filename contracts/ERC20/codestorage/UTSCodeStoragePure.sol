// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenPure.sol";

import "../interfaces/IUTSCodeStorage.sol";

contract UTSCodeStoragePure is IUTSCodeStorage {

    function getCode(bool /* isConnector */) external pure returns(bytes memory) {
        return type(UTSTokenPure).creationCode;
    }
    
}