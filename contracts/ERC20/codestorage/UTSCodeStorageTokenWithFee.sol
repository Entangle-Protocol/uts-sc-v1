// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenWithFee.sol";

import "../interfaces/IUTSCodeStorage.sol";

contract UTSCodeStorageTokenWithFee is IUTSCodeStorage {

    function getCode(bool /* isConnector */) external pure returns(bytes memory) {
        return type(UTSTokenWithFee).creationCode;
    }
    
}