import * as $j from 'jquery';
import { Ability } from './ability';
import { Creature } from './creature';
import Game from './game';
import * as arrayUtils from './utility/arrayUtils';
import { Hex } from './utility/hex';

export class Animations {
	game: Game;
	movementPoints: number;

	/**
	 *
	 */
	constructor() {
		this.game = Game.getInstance();
		this.movementPoints = 0;
	}

	/**
	 *
	 * @param creature
	 * @param path
	 * @param opts
	 */
	walk(creature: Creature, path: Hex[], opts: any) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = Math.random();
		game.animationQueue.push(animId);

		let hexId = 0;

		creature.healthHide();

		const anim = () => {
			const hex = path[hexId];

			if (hexId < path.length && (creature.remainingMove > 0 || opts.ignoreMovementPoint)) {
				this.leaveHex(creature, hex, opts);
			} else {
				this.movementComplete(creature, path[path.length - 1], animId, opts);
				return;
			}

			const nextPos = game.grid.hexes[hex.y][hex.x - creature.size + 1];
			const speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

			const tween = game.Phaser.add
				.tween(creature.grp)
				.to(nextPos.displayPos, parseInt(speed, 10), Phaser.Easing.Linear.None)
				.start();

			// Ignore traps for hover creatures, unless this is the last hex.
			const enterHexOpts = {
				ignoreTraps: creature.movementType() !== 'normal' && hexId < path.length - 1,
				...opts,
			};

			tween.onComplete.add(() => {
				if (creature.dead) {
					// Stop moving if creature has died while moving
					this.movementComplete(creature, hex, animId, opts);
					return;
				}

				// Sound Effect
				game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

				if (!opts.ignoreMovementPoint) {
					creature.remainingMove--;

					if (opts.customMovementPoint === 0) {
						creature.travelDist++;
					}
				}

				this.enterHex(creature, hex, enterHexOpts);

				anim(); // Next tween
			});

			hexId++;
		};

		anim();
	}

	/**
	 *
	 * @param creature
	 * @param path
	 * @param opts
	 */
	fly(creature: Creature, path: Hex[], opts: any) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = Math.random();
		game.animationQueue.push(animId);

		creature.healthHide();

		const hex = path[0];

		const start = game.grid.hexes[creature.y][creature.x - creature.size + 1];
		const currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		const speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

		const tween = game.Phaser.add
			.tween(creature.grp)
			.to(currentHex.displayPos, parseInt(speed, 10), Phaser.Easing.Linear.None)
			.start();

		tween.onComplete.add(() => {
			// Sound Effect
			game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

			if (!opts.ignoreMovementPoint) {
				// Determine distance
				let distance = 0;
				let k = 0;
				while (!distance) {
					k++;

					if (arrayUtils.findPos(start.adjacentHex(k), currentHex)) {
						distance = k;
					}
				}

				creature.remainingMove -= distance;
				if (opts.customMovementPoint === 0) {
					creature.travelDist += distance;
				}
			}

			this.enterHex(creature, hex, opts);
			this.movementComplete(creature, hex, animId, opts);
			return;
		});
	}

	/**
	 *
	 * @param creature
	 * @param path
	 * @param opts
	 */
	teleport(creature: Creature, path: Hex[], opts: any) {
		const game = this.game;
		const hex = path[0];
		const currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		const animId = Math.random();
		game.animationQueue.push(animId);

		// FadeOut
		const tween = game.Phaser.add
			.tween(creature.grp)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();

		tween.onComplete.add(() => {
			// Sound Effect
			game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

			// position
			creature.grp.x = currentHex.displayPos.x;
			creature.grp.y = currentHex.displayPos.y;

			// FadeIn
			game.Phaser.add
				.tween(creature.grp)
				.to(
					{
						alpha: 1,
					},
					500,
					Phaser.Easing.Linear.None,
				)
				.start();

			this.enterHex(creature, hex, opts);
			this.movementComplete(creature, hex, animId, opts);
			return;
		});
	}

	/**
	 *
	 * @param creature
	 * @param path
	 * @param opts
	 */
	push(creature: Creature, path: Hex[], opts: any) {
		opts.pushed = true;
		this.walk(creature, path, opts);
	}

	//--------Special Functions---------//

	/**
	 *
	 * @param creature
	 * @param hex
	 * @param opts
	 */
	enterHex(creature: Creature, hex: Hex, opts: any) {
		const game = this.game;

		creature.cleanHex();
		creature.x = hex.x - 0;
		creature.y = hex.y - 0;
		creature.pos = hex.pos;
		creature.updateHex();

		game.onStepIn(creature, hex, opts);

		creature.pickupDrop();

		if (opts.callbackStepIn) {
			opts.callbackStepIn(hex);
		}

		game.grid.orderCreatureZ();
	}

	/**
	 *
	 * @param creature
	 * @param hex
	 * @param opts
	 */
	leaveHex(creature: Creature, hex: Hex, opts: any) {
		const game = this.game;

		if (!opts.pushed) {
			creature.faceHex(hex, creature.hexagons[0]); // Determine facing
		}

		game.onStepOut(creature, creature.hexagons[0]); // Trigger
		game.grid.orderCreatureZ();
	}

	/**
	 *
	 * @param creature
	 * @param hex
	 * @param animId
	 * @param opts
	 */
	movementComplete(creature: Creature, hex: Hex, animId: number, opts: any) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			creature.remainingMove = this.movementPoints;
		}

		// TODO: Turn around animation
		if (opts.turnAroundOnComplete) {
			creature.facePlayerDefault();
		}

		// TODO: Reveal health indicator
		creature.healthShow();

		creature.hexagons.forEach((h) => {
			h.pickupDrop(creature);
		});

		game.grid.orderCreatureZ();

		const queue = game.animationQueue.filter((item) => item != animId);

		if (queue.length === 0) {
			game.freezedInput = false;
			if (game.multiplayer) {
				game.freezedInput = game.UI.active ? false : true;
			}
		}

		game.animationQueue = queue;
	}

	/**
	 *
	 * @param ability
	 * @param target
	 * @param spriteId
	 * @param path
	 * @param args
	 * @param startX
	 * @param startY
	 * @returns
	 */
	projectile(
		ability: Ability,
		target: Creature,
		spriteId: string,
		path: Hex[],
		args,
		startX: number,
		startY: number,
	) {
		// Get the target's position on the projectile's path that is closest.
		const emissionPointX = ability.creature.grp.x + startX;
		let distance = Number.MAX_SAFE_INTEGER;
		let targetX = path[0].displayPos.x;

		for (const hex of path) {
			if (typeof hex.creature != 'undefined' && hex.creature.id == target.id) {
				if (distance > Math.abs(emissionPointX - hex.displayPos.x)) {
					distance = Math.abs(emissionPointX - hex.displayPos.x);
					targetX = hex.displayPos.x;
				}
			}
		}

		const game = this.game;
		const baseDist = arrayUtils.filterCreature(path.slice(0), false, false).length;
		const dist = baseDist == 0 ? 1 : baseDist;
		const emissionPoint = {
			x: ability.creature.grp.x + startX,
			y: ability.creature.grp.y + startY,
		};
		const targetPoint = {
			x: targetX + 45,
			y: path[baseDist].displayPos.y - 20,
		};
		// Sprite id here
		const sprite = game.grid.creatureGroup.create(emissionPoint.x, emissionPoint.y, spriteId);
		const duration = dist * 75;

		sprite.anchor.setTo(0.5);
		sprite.rotation = -Math.PI / 3 + (args.direction * Math.PI) / 3;
		const tween = game.Phaser.add
			.tween(sprite)
			.to(
				{
					x: targetPoint.x,
					y: targetPoint.y,
				},
				duration,
				Phaser.Easing.Linear.None,
			)
			.start();

		return [tween, sprite, dist];
	}
}
