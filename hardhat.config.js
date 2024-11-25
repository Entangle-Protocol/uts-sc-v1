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
            url: process.env.ETH_RPC_URL !== undefined ? process.env.ETH_RPC_URL : "https://eth.llamarpc.com",
            chainId: 1,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        holesky: {
            url: process.env.HOLESKY_RPC_URL !== undefined ? process.env.HOLESKY_RPC_URL : "https://1rpc.io/holesky",
            chainId: 17000,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL !== undefined ? process.env.SEPOLIA_RPC_URL : "https://ethereum-sepolia-rpc.publicnode.com",
            chainId: 11155111,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        bsc: {
            url: process.env.BSC_RPC_URL !== undefined ? process.env.BSC_RPC_URL : "https://binance.llamarpc.com",
            chainId: 56,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        bscTestnet: {
            url: process.env.BSC_TESTNET_RPC_URL !== undefined ? process.env.BSC_TESTNET_RPC_URL : "https://bsc-testnet-rpc.publicnode.com",
            chainId: 97,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        eob: {
            url: process.env.EOB_RPC_URL !== undefined ? process.env.EOB_RPC_URL : "https://json-rpc.entangle.fi",
            chainId: 33033,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        eobTestnet: {
            url: process.env.EOB_TESTNET_RPC_URL !== undefined ? process.env.EOB_TESTNET_RPC_URL : "https://evm-testnet.entangle.fi",
            chainId: 33133,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        arbitrum: {
            url: process.env.ARBITRUM_RPC_URL !== undefined ? process.env.ARBITRUM_RPC_URL : "https://arbitrum.llamarpc.com",
            chainId: 42161,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        base: {
            url: process.env.BASE_RPC_URL !== undefined ? process.env.BASE_RPC_URL : "https://base.llamarpc.com",
            chainId: 8453,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        polygon: {
            url: process.env.POLYGON_RPC_URL !== undefined ? process.env.POLYGON_RPC_URL : "https://polygon.llamarpc.com",
            chainId: 137,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        avalanche: {
            url: process.env.AVALANCHE_RPC_URL !== undefined ? process.env.AVALANCHE_RPC_URL : "https://avalanche-c-chain-rpc.publicnode.com",
            chainId: 43114,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        optimism: {
            url: process.env.OPTIMISM_RPC_URL !== undefined ? process.env.OPTIMISM_RPC_URL : "https://optimism.llamarpc.com",
            chainId: 10,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        mantle: {
            url: process.env.MANTLE_RPC_URL !== undefined ? process.env.MANTLE_RPC_URL : "https://mantle-rpc.publicnode.com",
            chainId: 5000,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        xlayer: {
            url: process.env.XLAYER_RPC_URL !== undefined ? process.env.XLAYER_RPC_URL : "https://xlayer.drpc.org",
            chainId: 196,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        core: {
            url: process.env.CORE_RPC_URL !== undefined ? process.env.CORE_RPC_URL : "https://1rpc.io/core",
            chainId: 1116,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        }
    },

    etherscan: {
        apiKey: {
            eth: process.env.ETH_API_KEY,
            holesky: process.env.ETH_API_KEY,
            sepolia: process.env.ETH_API_KEY,
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