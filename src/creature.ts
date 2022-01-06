import $j from 'jquery';
import { Ability } from './ability';
import { search } from './utility/pathfinding';
import { Hex } from './utility/hex';
import * as arrayUtils from './utility/arrayUtils';
import { Drop } from './drop';
import Game from './game';
import { Effect } from './effect';
import { Damage } from './damage';
import { Player } from './player';
import { MoveToOptions } from '../types/options/move-to-options';
import { TakeDamageOptions } from '../types/options/take-damage-options';

// TODO: How to add abstract information about stat? i.e. stat is something that can be used in different places.
export interface CreatureStats {
	/**
	 * Available "pool" or maximum health of the creature.
	 *
	 * Cannot fall below 1.
	 */
	health: number;

	/**
	 * Available "pool" or maximum endurance of the creature.
	 *
	 * Cannot fall below 1.
	 */
	endurance: number;

	/**
	 * Available "pool" or maximum energy of the creature.
	 *
	 * Cannot fall below 1.
	 */
	energy: number;

	/**
	 * Available "pool" or maximum movement of the creature. Cannot
	 * fall below 1.
	 */
	movement: number;

	regrowth: number;
	meditation: number;
	initiative: number;
	offense: number;
	defense: number;
	pierce: number;
	slash: number;
	crush: number;
	shock: number;
	burn: number;
	frost: number;
	poison: number;
	sonic: number;
	mental: number;

	// TODO: Should these states be moved somewhere else?
	moveable: boolean;
	fatigueImmunity: boolean;

	// Extra energy required for abilities
	reqEnergy: number;
}

export interface CreatureStatus {
	/**
	 * "Frozen" creature will miss their next turn. Frozen expires at the end
	 * of their next (missed) turn. Any damage will break the frozen status.
	 */
	frozen: boolean;

	/**
	 * "Cryostasis" enhances the "Frozen" status to not break on damage from any
	 * source.
	 */
	cryostasis: boolean;

	/**
	 * Another type of "Frozen", with a different name.
	 * TODO: Refactor to a generic "skip turn" status that can be customised.
	 */
	dizzy: boolean;
}

export type CreatureAlterations = Partial<Record<keyof CreatureStats, number | string | boolean>>;

export enum MovementType {
	Normal = 'normal',
	Flying = 'flying',
	Hovering = 'hovering',
}

/**
 * Creature contains all creatures properties and attacks.
 */
export class Creature {
	game: Game;

	/**
	 * Creature name.
	 */
	name: string;

	/**
	 * Creature Id incrementing for each creature starting to 1.
	 */
	id: number;

	/**
	 * Hex coordinates.
	 */
	x: number;

	/**
	 * Hex coordinates.
	 */
	y: number;

	/**
	 * Pos object for hex comparison {x,y}.
	 */
	pos: { x: number; y: number };

	size: number;

	/**
	 * Type of the creature stocked in the database.
	 */
	type: any;
	level: number;
	realm: any;
	animation: any;
	display: any;
	drop: Drop;
	_movementType: MovementType;

	/**
	 * True if the creature is only temporary for preview, false otherwise.
	 */
	temp: boolean;

	hexagons: Hex[];

	/**
	 * Owner's ID (0,1,2 or 3).
	 */
	team: number;

	player: Player;

	/**
	 * True if dead.
	 */
	dead: boolean;

	killer: Player;
	hasWait: boolean;
	travelDist: number;
	effects: Effect[];
	dropCollection: Drop[];
	protectedFromFatigue: boolean;
	turnsActive: number;
	baseStats: CreatureStats;

	/**
	 * Object containing stats of the creature.
	 */
	stats: CreatureStats;

	status: CreatureStatus;

	/**
	 * Remaining health for the creature.
	 *
	 * If reduced to 0, the creature dies. Cannot exceed its maximum (stats.health).
	 */
	health: number;

	/**
	 * Remaining energy for the creature.
	 *
	 * Many creature abilities have an energy cost and if the creature has insufficient
	 * energy it cannot use them. A creature regenerates energy equal to its stats.meditation
	 * value at the start of its turn. Cannot exceed its maximum (stats.energy).
	 */
	energy: number;

	/**
	 * Remaining endurance for the creature.
	 *
	 * If reduced to 0, the creature is "Fatigued". Fatigued creatures do not restore
	 * health through stats.regrowth, or energy through stats.meditation.
	 *
	 * When a creature takes damage it loses endurance equal to taken damage.
	 */
	endurance: number;

	/**
	 * Remaining movement points for a creature.
	 *
	 * A creature regenerates back to its maximum movement (stats.movement) at the
	 * beginning of its turn.
	 */
	remainingMove: number;

	/**
	 * Array containing the 4 abilities.
	 */
	abilities: Ability[];

	grp: any;
	sprite: any;
	hintGrp: Phaser.Group;
	healthIndicatorGroup: any;
	healthIndicatorSprite: any;
	healthIndicatorText: any;
	fatigueText: string;
	delayable: boolean;
	delayed: boolean;
	materializationSickness: boolean;
	noActionPossible: boolean;
	oldEnergy: number;
	oldHealth: number;
	undead: boolean;

	/**
	 *
	 * @param obj Object containing all creature stats.
	 */
	constructor(obj: any) {
		// Engine
		this.game = Game.getInstance();
		this.name = obj.name;
		this.id = this.game.creatureIdCounter++;
		this.x = obj.x - 0;
		this.y = obj.y - 0;
		this.pos = {
			x: this.x,
			y: this.y,
		};
		this.size = obj.size - 0;
		this.type = obj.type;
		this.level = obj.level - 0;
		this.realm = obj.realm;
		this.animation = obj.animation;
		this.display = obj.display;
		this.drop = obj.drop;
		this._movementType = MovementType.Normal;
		this.temp = obj.temp;

		if (obj.movementType) {
			this._movementType = obj.movementType;
		}

		this.hexagons = [];

		// Game
		this.team = obj.team; // = playerID (0,1,2,3)
		this.player = this.game.players[obj.team];
		this.dead = false;
		this.killer = undefined;
		this.hasWait = false;
		this.travelDist = 0;
		this.effects = [];
		this.dropCollection = [];
		this.protectedFromFatigue = this.isDarkPriest() ? true : false;
		this.turnsActive = 0;

		// Statistics
		this.baseStats = {
			health: obj.stats.health - 0,
			endurance: obj.stats.endurance - 0,
			regrowth: obj.stats.regrowth - 0,
			energy: obj.stats.energy - 0,
			meditation: obj.stats.meditation - 0,
			initiative: obj.stats.initiative - 0,
			offense: obj.stats.offense - 0,
			defense: obj.stats.defense - 0,
			movement: obj.stats.movement - 0,
			pierce: obj.stats.pierce - 0,
			slash: obj.stats.slash - 0,
			crush: obj.stats.crush - 0,
			shock: obj.stats.shock - 0,
			burn: obj.stats.burn - 0,
			frost: obj.stats.frost - 0,
			poison: obj.stats.poison - 0,
			sonic: obj.stats.sonic - 0,
			mental: obj.stats.mental - 0,

			/* TODO: Move boolean flags into this.status, because updateAlterations() resets
			this.stats unless they've been applied via an effect. */
			moveable: true,
			fatigueImmunity: false,
			// Extra energy required for abilities
			reqEnergy: 0,
		};

		// Creature stats begin at their base values, but will diverge from effects, damage, etc.
		this.stats = {
			...this.baseStats,
		};

		this.status = {
			frozen: false,
			cryostasis: false,
			dizzy: false,
		};

		this.health = obj.stats.health;
		this.endurance = obj.stats.endurance;
		this.energy = obj.stats.energy;
		this.remainingMove = 0; //Default value recovered each turn

		// Abilities
		this.abilities = [
			new Ability(this, 0, this.game),
			new Ability(this, 1, this.game),
			new Ability(this, 2, this.game),
			new Ability(this, 3, this.game),
		];

		this.updateHex();

		let dp = '';

		if (this.type === '--') {
			switch (this.team) {
				case 0:
					dp = 'red';
					break;
				case 1:
					dp = 'blue';
					break;
				case 2:
					dp = 'orange';
					break;
				case 3:
					dp = 'green';
					break;
			}
		}

		// Creature Container
		this.grp = this.game.Phaser.add.group(this.game.grid.creatureGroup, 'creatureGrp_' + this.id);
		this.grp.alpha = 0;
		// Adding sprite
		this.sprite = this.grp.create(0, 0, this.name + dp + '_cardboard');
		this.sprite.anchor.setTo(0.5, 1);
		// Placing sprite
		this.sprite.x =
			(!this.player.flipped
				? this.display['offset-x']
				: 90 * this.size - this.sprite.texture.width - this.display['offset-x']) +
			this.sprite.texture.width / 2;
		this.sprite.y = this.display['offset-y'] + this.sprite.texture.height;
		// Placing Group
		this.grp.x = this.hexagons[this.size - 1].displayPos.x;
		this.grp.y = this.hexagons[this.size - 1].displayPos.y;

		this.facePlayerDefault();

		// Hint Group
		this.hintGrp = this.game.Phaser.add.group(this.grp, 'creatureHintGrp_' + this.id);
		this.hintGrp.x = 45 * this.size;
		this.hintGrp.y = -this.sprite.texture.height + 5;

		// Health indicator
		this.healthIndicatorGroup = this.game.Phaser.add.group(
			this.grp,
			'creatureHealthGrp_' + this.id,
		);
		// Adding background sprite
		this.healthIndicatorSprite = this.healthIndicatorGroup.create(
			this.player.flipped ? 19 : 19 + 90 * (this.size - 1),
			49,
			'p' + this.team + '_health',
		);
		// Add text
		this.healthIndicatorText = this.game.Phaser.add.text(
			this.player.flipped ? 45 : 45 + 90 * (this.size - 1),
			63,
			`${this.health}`,
			{
				font: 'bold 15pt Play',
				fill: '#fff',
				align: 'center',
				stroke: '#000',
				strokeThickness: 6,
			},
		);
		this.healthIndicatorText.anchor.setTo(0.5, 0.5);
		this.healthIndicatorGroup.add(this.healthIndicatorText);
		// Hide it
		this.healthIndicatorGroup.alpha = 0;

		// State variable for displaying endurance/fatigue text
		this.fatigueText = '';

		// Adding Himself to creature arrays and queue
		this.game.creatures[this.id] = this;

		this.delayable = true;
		this.delayed = false;
		if (typeof obj.materializationSickness !== 'undefined') {
			this.materializationSickness = obj.materializationSickness;
		} else {
			this.materializationSickness = this.isDarkPriest() ? false : true;
		}
		this.noActionPossible = false;
	}

	/**
	 * Summon animation.
	 *
	 * @param disableMaterializationSickness Do not affect the creature with Materialization Sickness.
	 */
	summon(disableMaterializationSickness = false) {
		const game = this.game;

		/* Without Sickness the creature should act in the current turn, except the dark
		priest who must always be in the next queue to properly start the game. */
		const alsoAddToCurrentQueue = disableMaterializationSickness && !this.isDarkPriest();

		game.queue.addByInitiative(this, alsoAddToCurrentQueue);

		if (disableMaterializationSickness) {
			this.materializationSickness = false;
		}

		// Remove temporary Creature to prevent duplicates when the actual
		// materialized Creature with correct position is added to the queue
		game.queue.removeTempCreature();
		game.updateQueueDisplay();

		game.grid.orderCreatureZ();

		if (game.grid.materialize_overlay) {
			game.grid.materialize_overlay.alpha = 0.5;
			game.Phaser.add
				.tween(game.grid.materialize_overlay)
				.to(
					{
						alpha: 0,
					},
					500,
					Phaser.Easing.Linear.None,
				)
				.start();
		}

		game.Phaser.add
			.tween(this.grp)
			.to(
				{
					alpha: 1,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();

		// Reveal and position health indicator
		this.updateHealth();
		this.healthShow();

		// Trigger trap under
		this.hexagons.forEach((hex) => {
			hex.activateTrap(game.triggers.onStepIn, this);
		});

		// Pickup drop
		this.pickupDrop();
		this.hint(this.name, 'creature_name');
	}

	healthHide() {
		this.healthIndicatorGroup.alpha = 0;
	}

	healthShow() {
		this.healthIndicatorGroup.alpha = 1;
	}

	/**
	 * Activate the creature by showing movement range and binding controls to this creature.
	 *
	 * @returns
	 */
	activate() {
		this.travelDist = 0;
		this.oldEnergy = this.energy;
		this.oldHealth = this.health;
		this.noActionPossible = false;

		const game = this.game;
		const stats = this.stats;
		const varReset = () => {
			this.game.onReset(this);
			// Variables reset
			this.updateAlteration();
			this.remainingMove = stats.movement;

			if (!this.materializationSickness) {
				// Fatigued creatures (endurance 0) should not regenerate.
				if (!this.isFatigued()) {
					this.heal(stats.regrowth, true);

					if (stats.meditation > 0) {
						this.recharge(stats.meditation);
					}
				} else {
					if (stats.regrowth < 0) {
						this.heal(stats.regrowth, true);
					} else {
						this.hint('♦', 'damage');
					}
				}
			} else {
				this.hint('♣', 'damage');
			}

			setTimeout(() => {
				game.UI.energyBar.animSize(this.energy / stats.energy);
				game.UI.healthBar.animSize(this.health / stats.health);
			}, 1000);

			this.endurance = stats.endurance;

			this.abilities.forEach((ability) => {
				ability.reset();
			});
		};

		// Frozen or dizzy effect
		if (this.isFrozen() || this.isDizzy()) {
			varReset();
			const interval = setInterval(() => {
				if (!game.turnThrottle) {
					clearInterval(interval);
					game.skipTurn({
						tooltip: this.isFrozen() ? 'Frozen' : 'Dizzy',
					});
				}
			}, 50);
			return;
		}

		if (!this.hasWait) {
			varReset();

			// Trigger
			game.onStartPhase(this);
		}

		this.materializationSickness = false;

		const interval = setInterval(() => {
			// if (!game.freezedInput) { remove for muliplayer
			clearInterval(interval);
			if (game.turn >= game.minimumTurnBeforeFleeing) {
				game.UI.btnFlee.changeState('normal');
			}

			game.startTimer();
			this.queryMove();
			// }
		}, 1000);
	}

	/**
	 * Preview the creature position at the given coordinates.
	 *
	 * @param wait Deactivate while waiting or not.
	 */
	deactivate(wait: boolean) {
		const game = this.game;
		this.delayed = Boolean(wait);
		this.hasWait = this.delayed;
		this.status.frozen = false;
		this.status.cryostasis = false;
		this.status.dizzy = false;

		// Effects triggers
		if (!wait) {
			this.turnsActive += 1;
			game.onEndPhase(this);
		}

		this.delayable = false;
	}

	/**
	 * Move the creature to the end of the queue.
	 *
	 * @returns
	 */
	wait() {
		let abilityAvailable = false;

		if (this.delayed) {
			return;
		}

		// If at least one ability has not been used
		this.abilities.forEach((ability) => {
			abilityAvailable = abilityAvailable || !ability.used;
		});

		if (this.remainingMove > 0 && abilityAvailable) {
			this.delay(this.game.activeCreature === this);
			this.deactivate(true);
		}
	}

	delay(excludeActiveCreature) {
		const game = this.game;

		game.queue.delay(this);
		this.delayable = false;
		this.delayed = true;
		this.hint('Delayed', 'msg_effects');
		game.updateQueueDisplay(excludeActiveCreature);
	}

	/**
	 * Launch move action query.
	 *
	 * @param o
	 * @returns
	 */
	queryMove(o: any = {}) {
		const game = this.game;

		if (this.dead) {
			// Creatures can die during their turns from trap effects; make sure this
			// function doesn't do anything
			return;
		}

		// Once Per Damage Abilities recover
		game.creatures.forEach((creature) => {
			//For all Creature
			if (creature instanceof Creature) {
				creature.abilities.forEach((ability) => {
					if (game.triggers.oncePerDamageChain.test(ability.getTrigger())) {
						ability.setUsed(false);
					}
				});
			}
		});

		// Clean up temporary creature if a summon was cancelled.
		if (game.creatures[game.creatures.length - 1].temp) {
			game.creatures.pop();
			game.creatureIdCounter--;
		}

		let remainingMove = this.remainingMove;
		// No movement range if unmoveable
		if (!this.stats.moveable) {
			remainingMove = 0;
		}

		o = $j.extend(
			{
				targeting: false,
				noPath: false,
				isAbility: false,
				ownCreatureHexShade: true,
				range: game.grid.getMovementRange(this.x, this.y, remainingMove, this.size, this.id),
				callback: function (hex, args) {
					if (hex.x == args.creature.x && hex.y == args.creature.y) {
						// Prevent null movement
						game.activeCreature.queryMove();
						return;
					}

					game.gamelog.add({
						action: 'move',
						target: {
							x: hex.x,
							y: hex.y,
						},
					});
					if (game.multiplayer) {
						game.gameplay.moveTo({
							target: {
								x: hex.x,
								y: hex.y,
							},
						});
					}
					args.creature.delayable = false;
					game.UI.btnDelay.changeState('disabled');
					args.creature.moveTo(hex, {
						animation: args.creature.movementType() === MovementType.Flying ? 'fly' : 'walk',
						callback: function () {
							game.activeCreature.queryMove();
						},
					});
				},
			},
			o,
		);

		if (!o.isAbility) {
			if (game.UI.selectedAbility != -1) {
				this.hint('Canceled', 'gamehintblack');

				// If this Creature is Dark Priest, remove temporary Creature in queue
				if (this.isDarkPriest()) {
					game.queue.removeTempCreature();
				}
			}

			$j('#abilities .ability').removeClass('active');
			game.UI.selectAbility(-1);
			game.UI.updateQueueDisplay();
		}

		game.grid.orderCreatureZ();
		this.facePlayerDefault();
		this.updateHealth();

		if (this.movementType() === MovementType.Flying) {
			o.range = game.grid.getFlyingRange(this.x, this.y, remainingMove, this.size, this.id);
		}

		const selectNormal = function (hex, args) {
			args.creature.tracePath(hex);
		};
		const selectFlying = function (hex, args) {
			args.creature.tracePosition({
				x: hex.x,
				y: hex.y,
				overlayClass: 'creature moveto selected player' + args.creature.team,
			});
		};
		const select =
			o.noPath || this.movementType() === MovementType.Flying ? selectFlying : selectNormal;

		if (this.noActionPossible) {
			game.grid.querySelf({
				fnOnConfirm: function () {
					game.UI.btnSkipTurn.click();
				},
				fnOnCancel: function () {
					// No-op default function.
				},
				confirmText: 'Skip turn',
			});
		} else {
			game.grid.queryHexes({
				fnOnSelect: select,
				fnOnConfirm: o.callback,
				args: {
					creature: this,
					args: o.args,
				}, // Optional args
				size: this.size,
				flipped: this.player.flipped,
				id: this.id,
				hexes: o.range,
				ownCreatureHexShade: o.ownCreatureHexShade,
				targeting: o.targeting,
			});
		}
	}

	/**
	 * Preview the creature position at the given Hex.
	 *
	 * @param hex Position.
	 * @returns
	 */
	previewPosition(hex: Hex) {
		const game = this.game;

		game.grid.cleanOverlay('hover h_player' + this.team);
		if (!game.grid.hexes[hex.y][hex.x].isWalkable(this.size, this.id)) {
			return; // Break if not walkable
		}

		this.tracePosition({
			x: hex.x,
			y: hex.y,
			overlayClass: 'hover h_player' + this.team,
		});
	}

	/**
	 * Clean current creature hexagons.
	 */
	cleanHex() {
		this.hexagons.forEach((hex) => {
			hex.creature = undefined;
		});
		this.hexagons = [];
	}

	/**
	 * Update the current hexes containing the creature and their display.
	 */
	updateHex() {
		const count = this.size;

		/* TODO: Is this safe to call multiple times? It looks like it only adds hexes,
		not removes hexes that are no longer part of the creature. */
		for (let i = 0; i < count; i++) {
			this.hexagons.push(this.game.grid.hexes[this.y][this.x - i]);
		}

		this.hexagons.forEach((hex) => {
			hex.creature = this;
		});
	}

	/**
	 * Face creature at given hex.
	 *
	 * @param faceTo Hex to face.
	 * @param faceFrom Hex to face from.
	 * @param ignoreCreatureHex
	 * @param attackFix
	 * @returns
	 */
	faceHex(
		faceTo: Hex | Creature,
		faceFrom: Hex | Creature,
		ignoreCreatureHex: boolean,
		attackFix = false,
	) {
		if (!faceFrom) {
			faceFrom = this.player.flipped ? this.hexagons[this.size - 1] : this.hexagons[0];
		}

		if (
			ignoreCreatureHex &&
			faceTo instanceof Hex &&
			faceFrom instanceof Hex &&
			this.hexagons.indexOf(faceTo) != -1 &&
			this.hexagons.indexOf(faceFrom) != -1
		) {
			this.facePlayerDefault();
			return;
		}

		if (faceTo instanceof Creature) {
			if (faceTo === this) {
				this.facePlayerDefault();
				return;
			}
			faceTo = faceTo.size < 2 ? faceTo.hexagons[0] : faceTo.hexagons[1];
		}

		if (faceTo.x == faceFrom.x && faceTo.y == faceFrom.y) {
			this.facePlayerDefault();
			return;
		}

		if (attackFix && this.size > 1) {
			//only works on 2hex creature targeting the adjacent row
			if (faceFrom.y % 2 === 0) {
				// TODO: Test.
				if (faceTo.x - (this.player.flipped ? 1 : 0) == faceFrom.x) {
					this.facePlayerDefault();
					return;
				}
			} else {
				if (faceTo.x + 1 - (this.player.flipped ? 1 : 0) == faceFrom.x) {
					this.facePlayerDefault();
					return;
				}
			}
		}

		let flipped: boolean;

		if (faceFrom.y % 2 === 0) {
			flipped = faceTo.x <= faceFrom.x;
		} else {
			flipped = faceTo.x < faceFrom.x;
		}

		if (flipped) {
			this.sprite.scale.setTo(-1, 1);
		} else {
			this.sprite.scale.setTo(1, 1);
		}
		this.sprite.x =
			(!flipped
				? this.display['offset-x']
				: 90 * this.size - this.sprite.texture.width - this.display['offset-x']) +
			this.sprite.texture.width / 2;
	}

	/**
	 * Face default direction.
	 */
	facePlayerDefault() {
		if (this.player.flipped) {
			this.sprite.scale.setTo(-1, 1);
		} else {
			this.sprite.scale.setTo(1, 1);
		}

		this.sprite.x =
			(!this.player.flipped
				? this.display['offset-x']
				: 90 * this.size - this.sprite.texture.width - this.display['offset-x']) +
			this.sprite.texture.width / 2;
	}

	/**
	 * Move the creature along a calculated path to the given coordinates.
	 *
	 * @param hex Destination Hex.
	 * @param opts Optional args object.
	 * @returns
	 */
	moveTo(hex: Hex, opts: MoveToOptions) {
		const game = this.game;

		const defaultOpt: MoveToOptions = {
			callback: function () {
				return true;
			},
			callbackStepIn: function () {
				return true;
			},
			animation: this.movementType() === MovementType.Flying ? 'fly' : 'walk',
			ignoreMovementPoint: false,
			ignorePath: false,
			customMovementPoint: 0,
			overrideSpeed: 0,
			turnAroundOnComplete: true,
		};
		let path = [];

		const options: MoveToOptions = { ...defaultOpt, ...opts };

		// Teleportation ignores moveable
		if (this.stats.moveable || options.animation === 'teleport') {
			const { x, y } = hex;

			if (options.ignorePath || options.animation == 'fly') {
				path = [hex];
			} else {
				path = this.calculatePath(x, y);
			}

			if (path.length === 0) {
				return; // Break if empty path
			}

			game.grid.xray(new Hex(0, 0, undefined, game)); // Clean Xray

			this.travelDist = 0;

			game.animations[options.animation](this, path, opts);
		} else {
			game.log('This creature cannot be moved');
		}

		const interval = setInterval(() => {
			// Check if creature's movement animation is completely finished.
			if (!game.freezedInput) {
				clearInterval(interval);
				options.callback();
				game.signals.creature.dispatch('movementComplete', { creature: this, hex });
				game.onCreatureMove(this, hex); // Trigger
			}
		}, 100);
	}

	/**
	 * Trace the path from the current position to the given coordinates.
	 *
	 * @param hex Destination Hex.
	 * @returns
	 */
	tracePath(hex: Hex) {
		const { x, y } = hex;
		const path = this.calculatePath(x, y); // Store path in grid to be able to compare it later

		if (path.length === 0) {
			return; // Break if empty path
		}

		path.forEach((item) => {
			this.tracePosition({
				x: item.x,
				y: item.y,
				displayClass: 'adj',
				drawOverCreatureTiles: false,
			});
		}); // Trace path

		// Highlight final position
		const last = arrayUtils.last(path);

		this.tracePosition({
			x: last.x,
			y: last.y,
			overlayClass: 'creature moveto selected player' + this.team,
			drawOverCreatureTiles: false,
		});
	}

	/**
	 *
	 * @param args
	 */
	tracePosition(args: any) {
		const defaultArgs = {
			x: this.x,
			y: this.y,
			overlayClass: '',
			displayClass: '',
			drawOverCreatureTiles: true,
		};

		args = $j.extend(defaultArgs, args);

		for (let i = 0; i < this.size; i++) {
			let canDraw = true;

			if (!args.drawOverCreatureTiles) {
				// then check to ensure this is not a creature tile
				for (let j = 0; j < this.hexagons.length; j++) {
					if (this.hexagons[j].x == args.x - i && this.hexagons[j].y == args.y) {
						canDraw = false;
						break;
					}
				}
			}
			if (canDraw) {
				const hex = this.game.grid.hexes[args.y][args.x - i];
				this.game.grid.cleanHex(hex);
				hex.overlayVisualState(args.overlayClass);
				hex.displayVisualState(args.displayClass);
			}
		}
	}

	/**
	 *
	 * @param x Destination coordinates.
	 * @param y Destination coordinates.
	 * @returns Array containing the path hexes.
	 */
	calculatePath(x: number, y: number): Hex[] {
		return search(
			this.game.grid.hexes[this.y][this.x],
			this.game.grid.hexes[y][x],
			this.size,
			this.id,
			this.game.grid,
		);
	}

	/**
	 * Return the first possible position for the creature at the given coordinates.
	 *
	 * @param x Destination coordinates.
	 * @param y Destination coordinates.
	 * @returns New position taking into account the size, orientation and obstacle {x,y}.
	 */
	calcOffset(x: number, y: number) {
		const game = this.game;
		const offset = game.players[this.team].flipped ? this.size - 1 : 0;
		const mult = game.players[this.team].flipped ? 1 : -1; // For FLIPPED player

		for (let i = 0; i < this.size; i++) {
			// Try next hexagons to see if they fit
			if (x + offset - i * mult >= game.grid.hexes[y].length || x + offset - i * mult < 0) {
				continue;
			}

			if (game.grid.hexes[y][x + offset - i * mult].isWalkable(this.size, this.id)) {
				x += offset - i * mult;
				break;
			}
		}

		return {
			x: x,
			y: y,
		};
	}

	/**
	 *
	 * @returns Initiative value to order the queue.
	 */
	getInitiative() {
		// To avoid 2 identical initiative
		return this.stats.initiative * 500 - this.id;
	}

	/**
	 *
	 * @param distance Adjacency distance in hexagons.
	 * @param clockwise
	 * @returns Array of adjacent hexagons.
	 */
	adjacentHexes(distance: number, clockwise = false) {
		const game = this.game;

		// TODO Review this algo to allow distance
		if (clockwise) {
			const hexes = [];
			let c;
			const o = this.y % 2 === 0 ? 1 : 0;

			if (this.size == 1) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y,
						x: this.x - 1,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			if (this.size == 2) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y,
						x: this.x - 2,
					},
					{
						y: this.y + 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			if (this.size == 3) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 3 + o,
					},
					{
						y: this.y,
						x: this.x - 3,
					},
					{
						y: this.y + 1,
						x: this.x - 3 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			const total = c.length;
			for (let i = 0; i < total; i++) {
				const { x, y } = c[i];
				if (game.grid.hexExists(y, x)) {
					hexes.push(game.grid.hexes[y][x]);
				}
			}

			return hexes;
		}

		if (this.size > 1) {
			const hexes = this.hexagons[0].adjacentHex(distance);
			const lasthexes = this.hexagons[this.size - 1].adjacentHex(distance);

			hexes.forEach((hex) => {
				if (arrayUtils.findPos(this.hexagons, hex)) {
					arrayUtils.removePos(hexes, hex);
				} // Remove from array if own creature hex
			});

			lasthexes.forEach((hex) => {
				// If node doesnt already exist in final collection and if it's not own creature hex
				if (!arrayUtils.findPos(hexes, hex) && !arrayUtils.findPos(this.hexagons, hex)) {
					hexes.push(hex);
				}
			});

			return hexes;
		} else {
			return this.hexagons[0].adjacentHex(distance);
		}
	}

	/**
	 * Restore energy up to the max limit.
	 *
	 * @param amount Amount of energy to restore.
	 * @param log
	 */
	recharge(amount: number, log = true) {
		this.energy = Math.min(this.stats.energy, this.energy + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' energy');
		}
	}

	/**
	 * Restore endurance to a creature. Will be capped against the creature's maximum
	 * endurance (this.stats.endurance).
	 *
	 * @param amount Number of endurance points to restore.
	 * @param log
	 */
	restoreEndurance(amount: number, log = true) {
		this.endurance = Math.min(this.stats.endurance, this.endurance + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' endurance');
		}
	}

	/**
	 * Restore remaining movement to a creature. Will be capped against the creature's
	 * maximum movement (this.stats.movement).
	 *
	 * @param amount Number of movement points to restore.
	 * @param log
	 */
	restoreMovement(amount: number, log = true) {
		this.remainingMove = Math.min(this.stats.movement, this.remainingMove + amount);

		if (log) {
			this.game.log('%CreatureName' + this.id + '% recovers +' + amount + ' movement');
		}
	}

	/**
	 *
	 * @param amount Amount of health point to restore.
	 * @param isRegrowth
	 * @param log
	 */
	heal(amount: number, isRegrowth = false, log = true) {
		const game = this.game;
		// Cap health point
		amount = Math.min(amount, this.stats.health - this.health);

		if (this.health + amount < 1) {
			amount = this.health - 1; // Cap to 1hp
		}

		this.health += amount;

		// Health display Update
		this.updateHealth(isRegrowth);

		if (amount > 0) {
			if (isRegrowth) {
				this.hint('+' + amount + ' ♥', 'healing d' + amount);
			} else {
				this.hint('+' + amount, 'healing d' + amount);
			}

			if (log) {
				game.log('%CreatureName' + this.id + '% recovers +' + amount + ' health');
			}
		} else if (amount === 0) {
			if (isRegrowth) {
				this.hint('♦', 'msg_effects');
			} else {
				this.hint('!', 'msg_effects');
			}
		} else {
			if (isRegrowth) {
				this.hint(`${amount} ♠`, `damage d${amount}`);
			} else {
				this.hint(`${amount}`, `damage d${amount}`);
			}

			if (log) {
				game.log('%CreatureName' + this.id + '% loses ' + amount + ' health');
			}
		}

		game.onHeal(this, amount);
	}

	/**
	 *
	 * @param damage Damage object.
	 * @param o Options.
	 * @returns Contains damages dealt and if creature is killed or not.
	 */
	takeDamage(damage: Damage, o: TakeDamageOptions) {
		const game = this.game;

		if (this.dead) {
			console.info(`${this.name} (${this.id}) is already dead, aborting takeDamage call.`);
			return;
		}

		const defaultOpt: TakeDamageOptions = {
			ignoreRetaliation: false,
			isFromTrap: false,
		};

		const options: TakeDamageOptions = { ...defaultOpt, ...o };

		// Determine if melee attack
		damage.melee = false;
		this.adjacentHexes(1).forEach((hex) => {
			if (damage.attacker == hex.creature) {
				damage.melee = true;
			}
		});

		damage.target = this;
		damage.isFromTrap = options.isFromTrap;

		// Trigger
		game.onUnderAttack(this, damage);
		game.onAttack(damage.attacker, damage);

		// Calculation
		if (damage.status === '') {
			// Damages
			const dmg = damage.applyDamage();
			const dmgAmount = dmg.total;

			if (!isFinite(dmgAmount)) {
				// Check for Damage Errors
				this.hint('Error', 'damage');
				game.log('Oops something went wrong !');

				return {
					damages: 0,
					kill: false,
				};
			}

			this.health -= dmgAmount;
			this.health = this.health < 0 ? 0 : this.health; // Cap

			this.addFatigue(dmgAmount);

			// Display
			const nbrDisplayed = dmgAmount ? '-' + dmgAmount : 0;
			this.hint(`${nbrDisplayed}`, `damage d${dmgAmount}`);

			if (!damage.noLog) {
				game.log(`%CreatureName${this.id}% is hit : ${nbrDisplayed} health`);
			}

			// If Health is empty
			if (this.health <= 0) {
				this.die(damage.attacker);

				return {
					damages: dmg,
					damageObj: damage,
					kill: true,
				}; // Killed
			}

			// Effects
			damage.effects.forEach((effect) => {
				this.addEffect(effect);
			});

			// Unfreeze if taking non-zero damage and not a Cryostasis freeze.
			if (dmgAmount > 0 && !this.isInCryostasis()) {
				this.status.frozen = false;
			}

			// Health display Update
			// Note: update health after adding effects as some effects may affect
			// health display
			this.updateHealth();
			game.UI.updateFatigue();
			/* Some of the active creature's abilities may become active/inactive depending
			on new health/endurance values. */
			game.UI.checkAbilities();

			// Trigger
			if (!options.ignoreRetaliation) {
				game.onDamage(this, damage);
			}

			return {
				damages: dmg,
				damageObj: damage,
				kill: false,
			}; // Not Killed
		} else {
			if (damage.status == 'Dodged') {
				// If dodged
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% dodged the attack');
				}
			}

			if (damage.status == 'Shielded') {
				// If Shielded
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% shielded the attack');
				}
			}

			if (damage.status == 'Disintegrated') {
				// If Disintegrated
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% has been disintegrated');
				}
				this.die(damage.attacker);
			}

			// Hint
			this.hint(damage.status, 'damage ' + damage.status.toLowerCase());
		}

		return {
			damageObj: damage,
			kill: false,
		}; // Not killed
	}

	/**
	 *
	 * @param noAnimBar
	 */
	updateHealth(noAnimBar = false) {
		const game = this.game;

		if (this == game.activeCreature && !noAnimBar) {
			game.UI.healthBar.animSize(this.health / this.stats.health);
		}

		// Dark Priest plasma shield when inactive
		if (this.isDarkPriest()) {
			if (this.hasCreaturePlayerGotPlasma() && this !== game.activeCreature) {
				this.displayPlasmaShield();
			} else {
				this.displayHealthStats();
			}
		} else {
			this.displayHealthStats();
		}
	}

	/**
	 *
	 */
	displayHealthStats() {
		if (this.isFrozen()) {
			this.healthIndicatorSprite.loadTexture('p' + this.team + '_frozen');
		} else {
			this.healthIndicatorSprite.loadTexture('p' + this.team + '_health');
		}

		this.healthIndicatorText.setText(this.health);
	}

	displayPlasmaShield() {
		this.healthIndicatorSprite.loadTexture('p' + this.team + '_plasma');
		this.healthIndicatorText.setText(this.player.plasma);
	}

	hasCreaturePlayerGotPlasma() {
		return this.player.plasma > 0;
	}

	addFatigue(dmgAmount) {
		if (!this.stats.fatigueImmunity) {
			this.endurance -= dmgAmount;
			this.endurance = this.endurance < 0 ? 0 : this.endurance; // Cap
		}

		this.game.UI.updateFatigue();
	}

	/**
	 *
	 * @param effect
	 * @param specialString
	 * @param specialHint
	 * @param disableLog
	 * @param disableHint
	 * @returns
	 */
	addEffect(
		effect: Effect,
		specialString?: string,
		specialHint?: string,
		disableLog = false,
		disableHint = false,
	) {
		const game = this.game;

		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			return false;
		}

		effect.target = this;
		this.effects.push(effect);

		game.onEffectAttach(this, effect);

		this.updateAlteration();

		if (effect.name !== '') {
			if (!disableHint) {
				if (specialHint || effect.specialHint) {
					this.hint(specialHint, 'msg_effects');
				} else {
					this.hint(effect.name, 'msg_effects');
				}
			}

			if (!disableLog) {
				if (specialString) {
					game.log(specialString);
				} else {
					game.log('%CreatureName' + this.id + '% is affected by ' + effect.name);
				}
			}
		}
	}

	/**
	 * Add effect, but if the effect is already attached, replace it with the new
	 * effect.
	 * Note that for stackable effects, this is the same as addEffect().
	 *
	 * @param effect The effect to add.
	 */
	replaceEffect(effect: Effect) {
		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			this.removeEffect(effect.name);
		}

		this.addEffect(effect);
	}

	/**
	 * Remove an effect by name.
	 *
	 * @param name Name of effect.
	 */
	removeEffect(name: string) {
		const totalEffects = this.effects.length;

		for (let i = 0; i < totalEffects; i++) {
			if (this.effects[i].name === name) {
				this.effects.splice(i, 1);
				break;
			}
		}
	}

	/**
	 *
	 * @param text
	 * @param cssClass
	 */
	hint(text: string, cssClass: string) {
		const game = this.game;
		const tooltipSpeed = 250;
		const tooltipDisplaySpeed = 500;
		const tooltipTransition = Phaser.Easing.Linear.None;

		const hintColor = {
			confirm: {
				fill: '#ffffff',
				stroke: '#000000',
			},
			gamehintblack: {
				fill: '#ffffff',
				stroke: '#000000',
			},
			healing: {
				fill: '#00ff00',
			},
			msg_effects: {
				fill: '#ffff00',
			},
			creature_name: {
				fill: '#ffffff',
				stroke: '#AAAAAA',
			},
		};

		const style = $j.extend(
			{
				font: 'bold 20pt Play',
				fill: '#ff0000',
				align: 'center',
				stroke: '#000000',
				strokeThickness: 2,
			},
			hintColor[cssClass],
		);

		// Remove constant element
		this.hintGrp.forEach(
			(grpHintElem: Phaser.Text) => {
				if (grpHintElem.data.cssClass == 'confirm') {
					grpHintElem.data.cssClass = 'confirm_deleted';
					grpHintElem.data.tweenAlpha = game.Phaser.add
						.tween(grpHintElem)
						.to(
							{
								alpha: 0,
							},
							tooltipSpeed,
							tooltipTransition,
						)
						.start();
					grpHintElem.data.tweenAlpha.onComplete.add((targetObject, tween) => {
						tween.destroy();
					}, grpHintElem);
				}
			},
			this,
			true,
		);

		const hint = game.Phaser.add.text(0, 50, text, style);
		hint.anchor.setTo(0.5, 0.5);

		hint.alpha = 0;

		if (cssClass == 'confirm') {
			hint.data.tweenAlpha = game.Phaser.add
				.tween(hint)
				.to(
					{
						alpha: 1,
					},
					tooltipSpeed,
					tooltipTransition,
				)
				.start();
		} else {
			hint.data.tweenAlpha = game.Phaser.add
				.tween(hint)
				.to(
					{
						alpha: 1,
					},
					tooltipSpeed,
					tooltipTransition,
				)
				.to(
					{
						alpha: 1,
					},
					tooltipDisplaySpeed,
					tooltipTransition,
				)
				.to(
					{
						alpha: 0,
					},
					tooltipSpeed,
					tooltipTransition,
				)
				.start();
			hint.data.tweenAlpha.onComplete.add((targetObject, tween) => {
				tween.destroy();
			}, hint);
		}

		this.hintGrp.add(hint);

		// Stacking
		this.hintGrp.forEach(
			(grpHintElem) => {
				const index = this.hintGrp.total - this.hintGrp.getIndex(grpHintElem) - 1;
				const offset = -50 * index;

				if (grpHintElem.tweenPos) {
					grpHintElem.tweenPos.stop();
				}

				grpHintElem.tweenPos = game.Phaser.add
					.tween(grpHintElem)
					.to(
						{
							y: offset,
						},
						tooltipSpeed,
						tooltipTransition,
					)
					.start();
			},
			this,
			true,
		);
	}

	/**
	 * Update the stats taking into account the effects' alteration.
	 */
	updateAlteration() {
		// Start alteration calculations from the unmodified stats.
		this.stats = { ...this.baseStats };

		const buffDebuffArray = [...this.effects, ...this.dropCollection];

		for (const buff of buffDebuffArray) {
			for (const stat in buff.alterations) {
				const value = buff.alterations[stat];

				if (typeof value == 'string') {
					// Multiplication Buff
					if (value.match(/\*/)) {
						this.stats[stat] = eval(this.stats[stat] + value);
					}

					// Division Debuff
					if (value.match(/\//)) {
						this.stats[stat] = eval(this.stats[stat] + value);
					}
				}

				// Usual Buff/Debuff
				if (typeof value == 'number') {
					this.stats[stat] = value;
				}

				// Boolean Buff/Debuff
				if (typeof value == 'boolean') {
					this.stats[stat] = value;
				}
			}
		}

		// Maximum stat pools cannot be lower than 1.
		this.stats.health = Math.max(this.stats.health, 1);
		this.stats.endurance = Math.max(this.stats.endurance, 1);
		this.stats.energy = Math.max(this.stats.energy, 1);
		this.stats.movement = Math.max(this.stats.movement, 1);

		// These stats cannot exceed their maximum values.
		this.health = Math.min(this.health, this.stats.health);
		this.endurance = Math.min(this.endurance, this.stats.endurance);
		this.energy = Math.min(this.energy, this.stats.energy);
		this.remainingMove = Math.min(this.remainingMove, this.stats.movement);
	}

	/**
	 * kill animation. remove creature from queue and from hexes.
	 *
	 * @param killer Killer of this creature.
	 * @returns
	 */
	die(killer: Creature) {
		const game = this.game;

		game.log(`%CreatureName${this.id}% is dead`);

		this.dead = true;

		// Triggers
		game.onCreatureDeath(this);

		this.killer = killer.player;
		const isDeny = this.killer.flipped == this.player.flipped;

		// Drop item
		if (game.unitDrops == 1 && this.drop) {
			const offsetX = this.player.flipped ? this.x - this.size + 1 : this.x;
			/* All properties aside from `name` are assumed to be alterations to the creature's
			statistics. */
			const { name, ...alterations } = this.drop;
			new Drop(name, alterations, offsetX, this.y);
		}

		if (!game.firstKill && !isDeny) {
			// First Kill
			this.killer.score.push({
				type: 'firstKill',
			});
			game.firstKill = true;
		}

		if (this.isDarkPriest()) {
			// If Dark Priest
			if (isDeny) {
				// TEAM KILL (DENY)
				this.killer.score.push({
					type: 'deny',
					creature: this,
				});
			} else {
				// Humiliation
				this.killer.score.push({
					type: 'humiliation',
					player: this.player,
				});
			}
		}

		if (!this.undead) {
			// Only if not undead
			if (isDeny) {
				// TEAM KILL (DENY)
				this.killer.score.push({
					type: 'deny',
					creature: this,
				});
			} else {
				// KILL
				this.killer.score.push({
					type: 'kill',
					creature: this,
				});
			}
		}

		if (this.player.isAnnihilated()) {
			// Remove humiliation as annihilation is an upgrade
			const total = this.killer.score.length;
			for (let i = 0; i < total; i++) {
				const s = this.killer.score[i];
				if (s.type === 'humiliation') {
					if (s.player == this.player) {
						this.killer.score.splice(i, 1);
					}

					break;
				}
			}
			// ANNIHILATION
			this.killer.score.push({
				type: 'annihilation',
				player: this.player,
			});
		}

		if (this.isDarkPriest()) {
			this.player.deactivate(); // Here because of score calculation
		}

		// Kill animation
		const tweenSprite = game.Phaser.add
			.tween(this.sprite)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();
		const tweenHealth = game.Phaser.add
			.tween(this.healthIndicatorGroup)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();
		tweenSprite.onComplete.add(() => {
			this.sprite.destroy();
		});
		tweenHealth.onComplete.add(() => {
			this.healthIndicatorGroup.destroy();
		});

		this.cleanHex();

		game.queue.remove(this);
		game.updateQueueDisplay();
		game.grid.updateDisplay();

		if (game.activeCreature === this) {
			game.nextCreature();
			return;
		} // End turn if current active creature die

		// As hex occupation changes, path must be recalculated for the current creature not the dying one
		game.activeCreature.queryMove();
	}

	/**
	 *
	 * @returns
	 */
	isFatigued() {
		return this.endurance === 0;
	}

	/**
	 *
	 * @returns
	 */
	isFragile() {
		return this.stats.endurance === 1;
	}

	/**
	 * Shortcut convenience function to grid.getHexMap.
	 *
	 * @param map
	 * @param invertFlipped
	 * @returns
	 */
	getHexMap(map, invertFlipped = false) {
		const x = (this.player.flipped ? !invertFlipped : invertFlipped)
			? this.x + 1 - this.size
			: this.x;
		return this.game.grid.getHexMap(
			x,
			this.y - map.origin[1],
			0 - map.origin[0],
			this.player.flipped ? !invertFlipped : invertFlipped,
			map,
		);
	}

	/**
	 *
	 * @param name
	 * @returns
	 */
	findEffect(name: string) {
		const ret = [];

		this.effects.forEach((effect) => {
			if (effect.name == name) {
				ret.push(effect);
			}
		});

		return ret;
	}

	/**
	 * Make units transparent.
	 *
	 * @param enable Toggle xray on or off.
	 */
	xray(enable: boolean) {
		const game = this.game;

		if (enable) {
			game.Phaser.add
				.tween(this.grp)
				.to(
					{
						alpha: 0.5,
					},
					250,
					Phaser.Easing.Linear.None,
				)
				.start();
		} else {
			game.Phaser.add
				.tween(this.grp)
				.to(
					{
						alpha: 1,
					},
					250,
					Phaser.Easing.Linear.None,
				)
				.start();
		}
	}

	/**
	 *
	 */
	pickupDrop() {
		this.hexagons.forEach((hex) => {
			hex.pickupDrop(this);
		});
	}

	/**
	 * Get movement type for this creature.
	 */
	movementType(): MovementType {
		/* If the creature has an ability that modifies movement type, use that, otherwise
		use the creature's base movement type. */
		for (const ability of this.abilities) {
			const abilityMovementType = ability.movementType();
			if (abilityMovementType) {
				return abilityMovementType;
			}
		}

		return this._movementType;
	}

	/**
	 * Is this unit a Dark Priest?
	 */
	isDarkPriest(): boolean {
		return this.type === '--';
	}

	/**
	 * Does the creature have the Frozen status? @see status.frozen
	 *
	 * @returns
	 */
	isFrozen() {
		return this.status.frozen;
	}

	/**
	 * Does the creature have the Cryostasis status? @see status.cryostasis
	 *
	 * @returns
	 */
	isInCryostasis() {
		return this.isFrozen() && this.status.cryostasis;
	}

	/**
	 * Does the creature have the Dizzy status? @see status.dizzy
	 *
	 * @returns
	 */
	isDizzy() {
		return this.status.dizzy;
	}

	/**
	 * Freeze a creature, skipping its next turn. @see status.frozen
	 *
	 * @param cryostasis Also apply the Cryostasis status @see status.cryostasis
	 */
	freeze(cryostasis = false) {
		this.status.frozen = true;

		if (cryostasis) {
			this.status.cryostasis = true;
		}

		// Update the health box under the creature cardboard with frozen effect.
		this.updateHealth();
		// Show frozen fatigue text effect in queue.
		this.game.UI.updateFatigue();

		this.game.signals.creature.dispatch('frozen', { creature: this, cryostasis });
	}
}
