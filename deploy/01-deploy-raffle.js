const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2")

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
		subscriptionId = transactionReciept.events[0].args.subid

		// Usually the subscription costs us LINK tokens but Mock deployment skips on that, so we can go ahead with a fake in the following manner:
		await VRFCoordinatorV2Mock.fundSubscription(
			subscriptionId,
			VRF_SUB_FUND_AMOUNT
		)
	} else {
		vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
		subscriptionId = networkConfig[chainId]["subscriptionId"]
	}
	const enlistmentFee = networkConfig[chainId]["enlistmentFee"]
	const gasLane = networkConfig[chainId]["gasLane"]
	const callbackGasLimt = networkConfig[chainId]["callbackGasLimit"]
	const interval = networkConfig[chainId]["interval"]

	const argruments = [
		vrfCoordinatorV2Address,
		enlistmentFee,
		gasLane,
		subscriptionId,
		callbackGasLimt,
		interval,
	]

	const raffle = await deploy("Raffle", {
		from: deployer,
		args: argruments,
		log: true,
		waitConfirmations: network.config.blockConfirmations || 1,
	})
}
