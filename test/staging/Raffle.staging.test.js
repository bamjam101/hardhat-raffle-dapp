const { network, getNamedAccounts, ethers } = require("hardhat")
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", function () {
      let raffle, deployer, raffleEnlistmentFee

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        raffle = await ethers.getContract("Raffle", deployer)
        raffleEnlistmentFee = await raffle.getEnlistmentFeeAmount()
      })

      describe("fulfillRandomWords", () => {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
          const startingTimeStamp = await raffle.getTimeStamp()
          const accounts = await ethers.getSigners()

          // setup listener before we join the raffle, just in case blockchain moves really fase. Note: This is one change from unit test written for fulfillRandomWords.
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("") // empty line
              console.log("WinnerPicked event fired!")
              try {
                // Add our assert comparisons here
                const recentWinner = await raffle.getRecentWinner()
                const raffleState = await raffle.getRaffleState()
                const winnerEndingBalance = await accounts[0].getBalance()
                const endingTimeStamp = await raffle.getTimeStamp()

                await expect(raffle.getPlayer(0)).to.be.reverted // as players array should be emptied after WinnerPicked event is fired.
                assert.equal(recentWinner.toString(), accounts[0].address) // Recent winner (address of winner of raffle) would equal the deployer address i.e., accounts[0].address
                assert.equal(raffleState.toString(), "0") // After the event has been fired the enum Raffle state is switched back to OPEN i.e., 0

                console.log(
                  winnerStartingBalance.add(raffleEnlistmentFee).toString(),
                  winnerEndingBalance.toString()
                )
                // assert.equal(
                //   winnerEndingBalance.toString(),
                //   winnerStartingBalance.add(raffleEnlistmentFee).toString()
                // ) // Balance of winner would be same as the balance before joining the raffle.
                assert(endingTimeStamp > startingTimeStamp) // timestamp of ending transaction must always be greater than timestamp of previous transaction block, which in this case is the joining transcaction.
                resolve()
              } catch (error) {
                reject(error)
                console.log(error)
              }
            })
            // Join the Raffle
            await raffle.joinRaffle({ value: raffleEnlistmentFee })
            console.log(
              "Transaction went through, time to wait for interval to run-out and event to be fired..."
            )
            const winnerStartingBalance = await accounts[0].getBalance()

            // and this code won't execute until listener has finished listening.
          })
        })
      })
    })
