const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONTEND_ADDRESSES_FILE =
  "../nextjs-raffle-dapp/constants/contractAdressses.json"
const FRONTEND_ABI_FILE = "../nextjs-raffle-dapp/constants/abi.json"

module.exports = async () => {
  if (process.env.UPDATE_FRONTEND) {
    console.log("Updating frontend...")
    await updateContractAddresses()
    await updateABIFile()
  }
}

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle")
  const chainId = network.config.chainId.toString()
  const currentAddresses = JSON.parse(
    fs.readFileSync(FRONTEND_ADDRESSES_FILE),
    "utf8"
  )
  if (chainId in contractAddress) {
    if (!contractAddress[chainId].includes(raffle.address)) {
      currentAddresses[chainId].push(raffle.address)
    }
  }
  {
    currentAddresses[chainId] = [raffle.address]
  }
  fs.writeFileSync(FRONTEND_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

async function updateABIFile() {
  const raffle = await ethers.getContract("Raffle")
  fs.writeFileSync(
    FRONTEND_ABI_FILE,
    raffle.interface.format(ethers.utils.FormatTypes.json)
  )
}

module.exports.tags = ["all", "frontend"]
