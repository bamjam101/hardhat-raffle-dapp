const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const verify = require("../utils/verify")

const FUND_AMOUNT = ethers.utils.parseEther("1")

module.exports = async ({ getNamedAccounts, deployments }) => {
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()

	let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock
	const chainId = network.config.chainId

	if (developmentChains.includes(network.name)) {
		vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
		vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
		const transactionResponse =
			await vrfCoordinatorV2Mock.createSubscription()
		const transactionReciept = await transactionResponse.wait(1)
		subscriptionId = transactionReciept.events[0].args.subId

		// Usually the subscription costs us LINK tokens but Mock deployment skips on that, so we can go ahead with a fake in the following manner:
		await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
	} else {
		vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
		subscriptionId = networkConfig[chainId]["subscriptionId"]
	}

	const arguments = [
		networkConfig[chainId]["gasLane"],
		vrfCoordinatorV2Address,
		networkConfig[chainId]["raffleEntranceFee"],
		subscriptionId,
		networkConfig[chainId]["callbackGasLimit"],
		networkConfig[chainId]["keepersUpdateInterval"],
	]

	const raffle = await deploy("Raffle", {
		from: deployer,
		args: arguments,
		log: true,
		waitConfirmations: network.config.blockConfirmations || 1,
	})

	// In latest version of Chainlink/contracts 0.6.1 or after 0.4.1, we need to add consumer explicitly after deployment of contract
	if (developmentChains.includes(network.name)) {
		await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
		log("Consumer is added")
	}

	if (
		!developmentChains.includes(network.name) &&
		process.env.ETHERSCAN_API_KEY
	) {
		log("Verifying Raffle Contract...")
		await verify(raffle.address, args)
	}
	log("---------------------------------------------")
}
module.exports.tags = ["all", "raffle"]
