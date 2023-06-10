const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", function () {
      let raffle, deployer, vrfCoordinatorV2Mock, raffleEnlistmentFee, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        )
        raffleEnlistmentFee = await raffle.getEnlistmentFeeAmount()
        interval = await raffle.getInterval()
      })

      describe("constructor", function () {
        it("initializes the raffleState state variable correctly", async function () {
          // Ideally we make our test such that there is a single assert per "it"
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), "0")
        })

        it("initializes the interval state variable correctly", async function () {
          assert.equal(
            interval.toString(),
            networkConfig[chainId]["keepersUpdateInterval"]
          )
        })
      })

      describe("joinRaffle", function () {
        it("reverts when you don't send enough ETH to join the raffle", async function () {
          await expect(raffle.joinRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughETHForRaffle"
          )
        })
        it("records players as they join the raffle", async function () {
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          const playerFromContract = await raffle.getPlayer(0)
          assert.equal(playerFromContract, deployer)
        })
        // testing emiting of events
        it("emits event on player joining raffle", async function () {
          await expect(
            raffle.joinRaffle({ value: raffleEnlistmentFee })
          ).to.emit(raffle, "RaffleJoined")
        })
        it("doesn't allow entrance when raffle is calculating", async function () {
          // Methods and time travel to facilitate interval skipping
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          // skips ahead in time in accordance to interval duration
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          // mines the block
          await network.provider.send("evm_mine", [])
          // or
          // await network.provider.request({method: "evm_mine",params: []})  // has similar behavour as above statement

          // Pretend to be chainlink keeper
          await raffle.performUpkeep([])
          await expect(
            raffle.joinRaffle({ value: raffleEnlistmentFee })
          ).to.be.revertedWith("Raffle__NotOpen")
        })
      })
      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async function () {
          // skips ahead in time
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          // mines the blocks
          await network.provider.send("evm_mine", [])
          // callStatic facilitates us to access the return values of desired functions
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert(!upkeepNeeded)
        })
        it("returns false if raffle is not open", async function () {
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          await raffle.performUpkeep([])
          const raffleState = await raffle.getRaffleState()
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert.equal(raffleState.toString(), "1")
          assert.equal(upkeepNeeded, false)
        })
        it("returns false if enough time hasn't passed", async () => {
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 5,
          ]) // use a higher number here if this test fails
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", () => {
        it("it can only runif checkupKeep is true", async function () {
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          const tx = await raffle.performUpkeep([])
          assert(tx)
        })
        it("reverts when checkUpkeep is false", async function () {
          await expect(raffle.performUpkeep([])).to.be.revertedWith(
            "Raffle__UpkeepNotNeeded"
          )
        })
        it("updates the raffle state, emits an event, and calls the vrf coordinator", async function () {
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          const txResponse = await raffle.performUpkeep([])
          const txReciept = await txResponse.wait(1)
          const requestId = txReciept.events[1].args.requestId
          const raffleState = await raffle.getRaffleState()
          assert(requestId.toNumber() > 0)
          assert(raffleState.toString() == "1")
        })
      })

      describe("fulFillRandomWords", function () {
        beforeEach(async function () {
          await raffle.joinRaffle({ value: raffleEnlistmentFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
        })
        it("can only be called after performUpkeep", async function () {
          // The following custom error is thrown by Chainlink Keepers interface.
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith("nonexistent request")
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith("nonexistent request")
        })
        /*
				Massive promise dependent test, description:

                This test simulates users entering the raffle and wraps the entire functionality of the raffle
				inside a promise that will resolve if everything is successful.
                An event listener for the WinnerPicked is set up
                Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event.
                All the assertions are done once the WinnerPicked event is fired 
                */

        it("picks a winner, resets the raffle, and sends money", async () => {
          const additionalEnlistments = 3
          const startingAccountIndex = 1 // deployer = 0
          const accounts = await ethers.getSigners()
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalEnlistments;
            i++
          ) {
            const accountConnectedRaffle = raffle.connect(accounts[i])
            await accountConnectedRaffle.joinRaffle({
              value: raffleEnlistmentFee,
            })
          }
          const startingTimeStamp = await raffle.getTimeStamp()

          // Execute performUpkeep by being a mock Chainlink keeper. Also, executing fulfillRandomWords by being a mock Chainlink VRF.
          await new Promise(async (resolve, reject) => {
            // Listener setup
            raffle.once("WinnerPicked", async () => {
              console.log("Found the event!")
              try {
                const recentWinner = await raffle.getRecentWinner()
                // We compare the recent winner to all the players enlisted in the raffle to find out the index/address of account that won the raffle i.e., accounts[1] is the winner.
                console.log(`Recent winner is ${recentWinner}`)
                console.log(accounts[0].address)
                console.log(accounts[1].address)
                console.log(accounts[2].address)
                console.log(accounts[3].address)

                const raffleState = await raffle.getRaffleState()
                const endingTimeStamp = await raffle.getTimeStamp()
                const numPlayers = await raffle.getNumberOfPlayers()
                // To compare the balance of winner, whether he/she received money from the Raffle or not.
                const winnerEndingBalance = await accounts[1].getBalance()

                assert.equal(numPlayers.toString(), "0")
                assert.equal(raffleState.toString(), "0")
                assert(endingTimeStamp > startingTimeStamp)
                // Money transfer assert comparison
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(
                    raffleEnlistmentFee
                      .mul(additionalEnlistments)
                      .add(raffleEnlistmentFee)
                      .toString()
                  )
                )
              } catch (error) {
                reject(error)
                console.log(error)
              }
              resolve()
            })
            // Firing of event is carried out by following code which is picked up by our listener defined above.
            const tx = await raffle.performUpkeep([])
            const txReciept = await tx.wait(1)
            const winnerStartingBalance = await accounts[1].getBalance()

            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReciept.events[1].args.requestId,
              raffle.address
            )
            // Once these lines are executed the listener captures the event and then the unit tests are evaluated.
          })
        })
      })
    })
