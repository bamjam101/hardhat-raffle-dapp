const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const verify = require("../utils/verify")

const FUND_AMOUNT = ethers.utils.parseEther("1")

module.exports = async ({ getNamedAccounts, deployments }) => {
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()

	let vrfCoordinatorV2Address, subscriptionId
	const chainId = network.config.chainId

	if (developmentChains.includes(network.name)) {
		const VRFCoordinatorV2Mock = await ethers.getContract(
			"VRFCoordinatorV2Mock"
		)
		vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address
		const transactionResponse =
			await VRFCoordinatorV2Mock.createSubscription()
		const transactionReciept = await transactionResponse.wait(1)
		subscriptionId = transactionReciept.events[0].args.subId

		// Usually the subscription costs us LINK tokens but Mock deployment skips on that, so we can go ahead with a fake in the following manner:
		await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
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

	if (
		!developmentChains.includes(network.name) &&
		process.env.ETHERSCAN_API_KEY
	) {
		log("Verifying Raffle Contract...")
		await verify(raffle.address, args)
	}
	log("---------------------------------------------")
}
