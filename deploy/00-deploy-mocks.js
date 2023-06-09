const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") // 0.25 is the premium, i.e., it costs 0.25 LINK
const GAS_PRICE_LINK = 1e9 // 1000000000 // calculated value based on the gas price of the chain.

/* If ETH price skyrockets then it will drastically increase the gas price for transaction to happen.
Since, Chainlink nodes run computation outside the network but serve as Oracle network to gather data from the outside world, they need to pay the gas price as well.
In Raffle Smart Contract the fulfillRandomWords and performUpkeep functions are carried out by Chainlink nodes requiring some ETH to pay as gas cost.
Hence, to avoid bankruptcy Chainlink request prices vary in accordance of gas price of actual computation i.e., LINK per gas. 
*/

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...")
    // deploying a mock vrf coordinator:
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: [BASE_FEE, GAS_PRICE_LINK],
    })
    log("Mocks deployed!")
    log("-----------------------------------------")
  }
}

module.exports.tags = ["all", "mocks"]
