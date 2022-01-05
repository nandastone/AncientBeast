import { Point } from 'phaser-ce';
import { getUrl } from './assetLoader';
import { Creature } from './creature';
import Game from './game';
import { Score } from './score';
import { getGameConfig } from './script';

/**
 * Player object with attributes.
 */
export class Player {
	id: number;
	game: Game;
	creatures: Creature[];
	name: string;
	color: string;
	avatar: any;

	/**
	 * List of various scoring metrics that will form the player's total score. Many
	 * scoring metrics can be added multiple times i.e. "picking up drop".
	 */
	score: Score[];

	plasma: number;
	flipped: boolean;
	availableCreatures: any;
	hasLost: boolean;
	hasFled: boolean;
	bonusTimePool: number;
	totalTimePool: number;
	startTime: Date;

	/**
	 * Whether creatures summoned by Player are affected by Materialization Sickness.
	 */
	_summonCreaturesWithMaterializationSickness: boolean;

	constructor(id: number, game: Game) {
		/* Attributes
		 *
		 * id :		Integer :	Id of the player 1, 2, 3 or 4
		 * creature :	Array :		Array containing players creatures
		 * plasma :	Integer :	Plasma amount for the player
		 * flipped :	Boolean :	Player side of the battlefield (affects displayed creature)
		 *
		 */
		this.id = id;
		this.game = game;
		this.creatures = [];
		this.name = 'Player' + (id + 1);

		switch (id) {
			case 0:
				this.color = 'red';
				break;
			case 1:
				this.color = 'blue';
				break;
			case 2:
				this.color = 'orange';
				break;
			default:
				this.color = 'green';
				break;
		}

		this.avatar = getUrl('units/avatars/Dark Priest ' + this.color);
		this.score = [];
		this.plasma = getGameConfig().plasma_amount;
		this.flipped = Boolean(id % 2); // Convert odd/even to true/false
		this.availableCreatures = game.availableCreatures;
		this.hasLost = false;
		this.hasFled = false;
		this.bonusTimePool = 0;
		this.totalTimePool = game.timePool * 1000;
		this.startTime = new Date();

		this.score = [
			{
				type: 'timebonus',
			},
		];

		this._summonCreaturesWithMaterializationSickness = true;

		// Events
		this.game.signals.metaPowers.add(this.handleMetaPowerEvent, this);
	}

	/**
	 * TODO: Is this even right? it should be off by 1 based on this code...
	 *
	 * @returns
	 */
	getNbrOfCreatures() {
		let nbr = -1;
		const creatures = this.creatures;
		const count = creatures.length;
		let creature;

		for (let i = 0; i < count; i++) {
			creature = creatures[i];

			if (!creature.dead && !creature.undead) {
				nbr++;
			}
		}

		return nbr;
	}

	/**
	 *
	 * @param type Creature type (ex: "0" for Dark Priest and "G2" for Swampler).
	 * @param pos Position {x,y}.
	 */
	summon(type: string, pos: Point) {
		const game = this.game;
		let data = game.retrieveCreatureStats(type);

		// Create the full data for creature creation.
		data = {
			...data,
			...pos,
			team: this.id,
			temp: false,
		};

		for (let i = game.creatureData.length - 1; i >= 0; i--) {
			// Avoid Dark Priest shout at the beginning of a match.
			if (game.creatureData[i].type == type && i !== 0) {
				game.soundsys.playSound(game.soundLoaded[1000 + i], game.soundsys.announcerGainNode);
			}
		}

		const creature = new Creature(data);
		this.creatures.push(creature);
		creature.summon(!this._summonCreaturesWithMaterializationSickness);
		game.onCreatureSummon(creature);
	}

	/**
	 * Ask if the player wants to flee the match.
	 *
	 * @param o
	 */
	flee(o: any) {
		this.hasFled = true;
		this.deactivate();
		this.game.skipTurn(o);
	}

	/**
	 * Return the total of the score events.
	 *
	 * @returns The current score of the player.
	 */
	getScore() {
		let s: Score;
		let points = 0;
		const totalScore = {
			firstKill: 0,
			kill: 0,
			deny: 0,
			humiliation: 0,
			annihilation: 0,
			timebonus: 0,
			nofleeing: 0,
			creaturebonus: 0,
			darkpriestbonus: 0,
			immortal: 0,
			total: 0,
			pickupDrop: 0,
			upgrade: 0,
		};

		for (let i = 0; i < this.score.length; i++) {
			s = this.score[i];
			points = 0;

			switch (s.type) {
				case 'firstKill':
					points += 20;
					break;
				case 'kill':
					// Prevent issues with non-leveled creatures, e.g. Dark Priest
					if (s.creature.level) {
						points += s.creature.level * 5;
					}
					break;
				case 'combo':
					points += s.kills * 5;
					break;
				case 'humiliation':
					points += 50;
					break;
				case 'annihilation':
					points += 100;
					break;
				case 'deny':
					points += -1 * s.creature.size * 5;
					break;
				case 'timebonus':
					points += Math.round(this.bonusTimePool * 0.5);
					break;
				case 'nofleeing':
					points += 25;
					break;
				case 'creaturebonus':
					points += s.creature.level * 5;
					break;
				case 'darkpriestbonus':
					points += 50;
					break;
				case 'immortal':
					points += 100;
					break;
				case 'pickupDrop':
					points += 2;
					break;
				case 'upgrade':
					points += 1;
					break;
			}

			totalScore[s.type] += points;
			totalScore.total += points;
		}

		return totalScore;
	}

	/**
	 * Test if the player has the greater score.
	 * TODO: This is also wrong, because it allows for ties to result in a "leader".
	 *
	 * @returns Return true if in lead. False if not.
	 */
	isLeader() {
		const game = this.game;

		// Each player
		for (let i = 0; i < game.playerMode; i++) {
			// If someone has a higher score
			if (game.players[i].getScore().total > this.getScore().total) {
				return false; // He's not in lead
			}
		}

		// If nobody has a better score he's in lead.
		return true;
	}

	/**
	 * A player is considered annihilated if all his creatures are dead DP included.
	 *
	 * @returns
	 */
	isAnnihilated() {
		// annihilated is false if only one creature is not dead
		let annihilated = this.creatures.length > 1;
		const count = this.creatures.length;

		for (let i = 0; i < count; i++) {
			annihilated = annihilated && this.creatures[i].dead;
		}

		return annihilated;
	}

	/**
	 * Remove all player's creature from the queue.
	 */
	deactivate() {
		const game = this.game;
		const count = game.creatures.length;
		let creature;

		this.hasLost = true;

		// Remove all player creatures from queues
		for (let i = 1; i < count; i++) {
			creature = game.creatures[i];

			if (creature.player.id == this.id) {
				game.queue.remove(creature);
			}
		}

		game.updateQueueDisplay();

		// Test if allie Dark Priest is dead
		if (game.playerMode > 2) {
			// 2 vs 2
			if (game.players[(this.id + 2) % 4].hasLost) {
				game.endGame();
			}
		} else {
			// 1 vs 1
			game.endGame();
		}
	}

	get summonCreaturesWithMaterializationSickness() {
		return this._summonCreaturesWithMaterializationSickness;
	}

	/**
	 * Handle events on the "meta powers" channel.
	 *
	 * @param message Event name.
	 * @param payload Event payload.
	 */
	private handleMetaPowerEvent(message: string, payload: any) {
		if (message === 'toggleDisableMaterializationSickness') {
			this._summonCreaturesWithMaterializationSickness = !payload;
		}
	}
}
