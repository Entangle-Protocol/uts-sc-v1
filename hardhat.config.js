require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require('dotenv').config();

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            // forking: {
            //     url: "https://mainnet.infura.io/v3/",
            //     blockNumber: 20000000,
            // }
        },
        eth: {
            url: process.env.ETH_RPC_URL,
            chainId: 1,
            gasPrice: 5000000000,
            accounts: [process.env.PRIVATE_KEY],
        },
        holeskyTestnet: {
            url: process.env.HOLESKY_RPC_URL,
            chainId: 17000,
            gasPrice: 10000000000,
            accounts: [process.env.PRIVATE_KEY],
        },
        bsc: {
            url: process.env.BSC_RPC_URL,
            chainId: 56,
            gasPrice: 5000000000,
            accounts: [process.env.PRIVATE_KEY],
        },
        bscTestnet: {
            url: process.env.BSC_TESTNET_RPC_URL,
            chainId: 97,
            gasPrice: 10000000000,
            accounts: [process.env.PRIVATE_KEY],
        }
    },

    etherscan: {
        apiKey: {
            eth: process.env.ETH_API_KEY,
            holeskyTestnet: process.env.ETH_API_KEY,
            bsc: process.env.BSC_API_KEY,
            bscTestnet: process.env.BSC_API_KEY
        }
    },

    solidity: {
        compilers: [
            {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 99999,
                    },
                },
            },
        ],

        overrides: {
            "contracts/ERC20/codestorage/UTSCodeStorage.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            },

            "contracts/ERC20/codestorage/UTSCodeStorageMintable.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            },

            "contracts/ERC20/codestorage/UTSCodeStorageTokenWithFee.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            },

            "contracts/ERC20/codestorage/UTSCodeStorageMintableWithFee.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            },

            "contracts/ERC20/codestorage/UTSCodeStoragePure.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            },

            "contracts/ERC20/codestorage/UTSCodeStorageConnectorWithFee.sol": {
                version: "0.8.24",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            }
        },
    },

    gasReporter: {
        enabled: false,
    },

    contractSizer: {
        alphaSort: false,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
        only: [],
    }
}