// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

error Raffle__NotEnoughETHForRaffle();

contract Raffle {
	// State Variables
	uint256 private immutable i_enlistmentFee; // entry fee private to developers
	address payable[] private players; // list of players during a raffle round private to developers

	// Events - These are defined to facilitate logging of data in much more convenient manner such that it becomes retrieveable.

	// Functions
	/**
	 * @dev All the initialization is being carried forward in this constructor function.
	 * @param enlistmentFee Fee amount to enlist into a Raffle round
	 */
	constructor(uint256 enlistmentFee) {
		i_enlistmentFee = enlistmentFee;
	}

	/**
	 * @notice Function to enlist players into a round of Raffle
	 * @dev Function is payable requiring a minimum amount to get enlisted
	 */
	function enlistInRaffle() public payable {
		if (msg.value < i_enlistmentFee) {
			revert Raffle__NotEnoughETHForRaffle();
		}
		s_players.push(payable(msg.sender));
	}

	// view/pure function
	/**
	 * @notice Retrieves minimum amount to get enlisted into a round of Raffle
	 */
	function getEnlistmentFeeAmount() public view returns (unit256) {
		return i_enlistmentFee;
	}

	/**
	 * @notice Retrieves enlisted players based out on the index provided
	 * @param index is the position of the player enlisted in current Raffle round.
	 */
	function getPlayers(uint256 index) public view returns (address) {
		return s_players[index];
	}
}
