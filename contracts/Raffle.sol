// SPDX-License-Identifier: MIT

// Pragma statement
pragma solidity ^0.8.7;

// Import statements
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

// Error statements
error Raffle__UpkeepNotNeeded(
	uint256 currentBalance,
	uint256 numPlayers,
	uint256 raffleState
);
error Raffle__NotEnoughETHForRaffle();
error Raffle__TransferFailed();
error Raffle__NotOpen();

/**
 * @title A sample Raffle contract
 * @author bamjamlol
 * @notice This contract is for creating untamperable decentralized smart contract
 * @dev it implements chainlink VRF and chainlink Keepers
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
	// Type Declarations
	enum RaffleState {
		OPEN,
		CALCULATING
	} // where 0= open, 1 = calculating

	// State Variables
	// 1. Chainlink VRF variables
	VRFCoordinatorV2Interface private immutable i_vrfCoordinator; // declaring vrf coordinator using VRFCoordinatorV2Interface
	// Args for requesting random number
	bytes32 private immutable i_gasLane; // Gas configuration for network type
	uint64 private immutable i_subscriptionId; // Subscribers Id to work with VRF
	uint32 private immutable i_callbackGasLimit; // Gas limit value to suspend gas expensive VRF requests
	uint16 private constant REQUEST_CONFIRMATIONS = 3;
	uint32 private constant NUM_WORDS = 1; // no. of response to be generated

	// 2. Lottery Variables
	address payable[] private s_players; // list of players during a raffle round private to developers
	uint256 private immutable i_enlistmentFee; // entry fee private to developers
	address private s_recentWinner;
	RaffleState private s_raffleState;
	uint256 private s_lastTimeStamp;
	uint256 private immutable i_interval;

	// Events - These are defined to facilitate logging of data in much more convenient manner such that it becomes retrieveable.
	event RaffleJoin(address indexed player); // Takes in player address as indexed argument, indexed items are easier to query.
	event WinnerPicked(address indexed player);
	event RequestedRaffleWinner(uint256 indexed requestId);

	// Functions inorder

	/**
	 * @notice All the initialization is being carried forward in this constructor function
	 * @dev VRFConsumerBaseV2 accepts vrfCoordinatorV2 for coordinating our contract to the Chainlink VRF
	 * @param enlistmentFee Fee amount to enlist into a Raffle round
	 * @param vrfCoordinatorV2 is coordinator arguement
	 */
	constructor(
		bytes32 gasLane,
		address vrfCoordinatorV2,
		uint256 enlistmentFee,
		uint64 subscriptionId,
		uint32 callbackGasLimit,
		uint256 interval
	) VRFConsumerBaseV2(vrfCoordinatorV2) {
		i_gasLane = gasLane;
		i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
		i_enlistmentFee = enlistmentFee;
		// Initialization of parameters -> to be passed to function responsible for generating random words
		i_subscriptionId = subscriptionId;
		i_callbackGasLimit = callbackGasLimit;
		i_interval = interval;
		s_raffleState = RaffleState.OPEN;
		s_lastTimeStamp = block.timestamp;
	}

	/**
	 * @notice Function to enlist players into a round of Raffle
	 * @dev Function is payable requiring a minimum amount to get enlisted
	 */
	function joinRaffle() public payable {
		if (msg.value < i_enlistmentFee) {
			revert Raffle__NotEnoughETHForRaffle();
		}
		if (s_raffleState != RaffleState.OPEN) {
			revert Raffle__NotOpen();
		}
		s_players.push(payable(msg.sender));
		emit RaffleJoin(msg.sender);
	}

	/**
	 * @notice This function facilitates as a timer to trigger the functions to choose a random winner
	 * @dev This function is called by Chainlink Keeper nodes (automation),
	 * ChainLink Keeper looks for the "upkeepNeeded" to be true
	 * The following should be true in order to make the above true:
	 * 1. Our time interval should have passed
	 * 2. The lottery should have at least 1 player and some ETH
	 * 3. Our subscribtion is funded with LINK
	 * 4. The lottery should be in "open" state.
	 */
	function checkUpkeep(
		bytes memory /* checkData */
	)
		public
		override
		returns (bool upkeepNeeded, bytes memory /* performData */)
	{
		bool isOpen = (RaffleState.OPEN == s_raffleState);
		// To facilitate our timer intervals we require current timestamp or current block timestamp and previous block timestamp.
		bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
		bool hasPlayers = (s_players.length > 0);
		bool hasBalance = address(this).balance > 0;
		upkeepNeeded = (isOpen && timePassed && hasBalance && hasPlayers); // all the dependencies have to be true for upkeepNeeded to be true
	}

	function performUpkeep(bytes calldata /* performData */) external override {
		(bool upkeepNeeded, ) = checkUpkeep("");
		if (!upkeepNeeded) {
			revert Raffle__UpkeepNotNeeded(
				address(this).balance,
				s_players.length,
				uint256(s_raffleState)
			);
		}
		// Request random word using Chainlink VRF, learn more: https://docs.chain.link/vrf/v2/subscription/examples/get-a-random-number
		// Update RaffleState
		s_raffleState = RaffleState.CALCULATING;
		uint256 requestId = i_vrfCoordinator.requestRandomWords(
			i_gasLane,
			i_subscriptionId,
			REQUEST_CONFIRMATIONS,
			i_callbackGasLimit,
			NUM_WORDS
		);
		// Once response of random word is generated following actions are set off and fulfillRandomWords function is executed by Chainlink Keepers
		emit RequestedRaffleWinner(requestId);
		// 2 transaction process
	}

	/**
	 *@notice Generates the random response
	 * @param randomWords is array of random words or integers
	 */
	function fulfillRandomWords(
		uint256 /*requestId*/,
		uint256[] memory randomWords
	) internal override {
		// Modulo based winner index generation
		uint256 winnerIndex = randomWords[0] % s_players.length;
		address payable recentWinner = s_players[winnerIndex];
		s_recentWinner = recentWinner;
		// Once calculations are finished and a new winner has been choosen again set the Raffle state from calculating to open for another round of Raffle.
		s_raffleState = RaffleState.OPEN;
		// reset players
		s_players = new address payable[](0);
		s_lastTimeStamp = block.timestamp;
		(bool success, ) = recentWinner.call{value: address(this).balance}("");
		if (!success) {
			revert Raffle__TransferFailed(); // fires when failure in transaction
		}
		emit WinnerPicked(recentWinner);
	}

	// view/pure functions

	/**
	 * @notice Retrieves minimum amount to get enlisted into a round of Raffle
	 */
	function getEnlistmentFeeAmount() public view returns (uint256) {
		return i_enlistmentFee;
	}

	/**
	 * @notice Retrieves enlisted players based out on the index provided
	 * @param index is the position of the player enlisted in current Raffle round.
	 */
	function getPlayers(uint256 index) public view returns (address) {
		return s_players[index];
	}

	/**
	 * @notice Retrieves recent winner announced in a round of Raffle
	 */
	function getRecentWinner() public view returns (address) {
		return s_recentWinner;
	}

	/**
	 * @notice Retrieves state of current round of Raffle
	 */
	function getRaffleState() public view returns (RaffleState) {
		return s_raffleState;
	}

	/**
	 * @notice Retrieves number of words being generated using VRF to facilitate verifiable randomness.
	 */
	function getNumWords() public pure returns (uint256) {
		return NUM_WORDS;
	}

	/**
	 * @notice Retrieves number of players in current round of Raffle
	 */
	function getNumberOfPlayers() public view returns (uint256) {
		return s_players.length;
	}

	/**
	 * @notice Retrieves timestamp in a round of Raffle
	 */
	function getTimeStamp() public view returns (uint256) {
		return s_lastTimeStamp;
	}

	/**
	 * @notice Retrieves request confirmations required
	 */
	function getRequestConfirmations() public pure returns (uint256) {
		return REQUEST_CONFIRMATIONS;
	}
}
