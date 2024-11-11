const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UTSCodeStorageModule", (m) => {

    const codeStorage = m.contract("UTSCodeStorage");
    const codeStoragePure = m.contract("UTSCodeStoragePure");
    const codeStorageMintable = m.contract("UTSCodeStorageMintable");
    const codeStorageTokenWithFee = m.contract("UTSCodeStorageTokenWithFee");
    const codeStorageConnectorWithFee = m.contract("UTSCodeStorageConnectorWithFee");
    const codeStorageMintableWithFee = m.contract("UTSCodeStorageMintableWithFee");

    return { codeStorage, codeStorageMintable, codeStorageTokenWithFee, codeStorageMintableWithFee, codeStoragePure, codeStorageConnectorWithFee };
});