// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenMintableWithFee.sol";

import "../interfaces/IUTSCodeStorage.sol";

contract UTSCodeStorageMintableWithFee is IUTSCodeStorage {

    function getCode(bool /* isConnector */) external pure returns(bytes memory) {
        return type(UTSTokenMintableWithFee).creationCode;
    }
    
}