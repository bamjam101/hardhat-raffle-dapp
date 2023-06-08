require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: {
		compilers: [
			{ version: "0.8.18" },
			{ version: "0.8.7" },
			{ version: "0.6.6" },
		],
	},
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			chainId: 31337,
		},
		localhost: {
			chainId: 31337,
		},
		sepolia: {
			url: SEPOLIA_RPC_URL,
			accounts: [PRIVATE_KEY],
			blockConfirmations: 6,
		},
	},
	etherscan: {
		apiKey: {
			sepolia: ETHERSCAN_API_KEY,
		},
		customChains: [
			{
				network: "goerli",
				chainId: 5,
				urls: {
					apiURL: "https://api-goerli.etherscan.io/api",
					browseURL: "https://goerli.etherscan.io",
				},
			},
		],
	},
	gasReporter: {
		enabled: true,
		currency: "USD",
		outputFile: "gas-report.txt",
		noColors: true,
	},
	namedAccounts: {
		deployer: {
			default: 0,
			1: 0,
		},
		player: {
			default: 1,
		},
	},
	solidity: {
		compilers: [
			{
				version: "0.8.7",
			},
			{
				version: "0.4.24",
			},
		],
	},
}
