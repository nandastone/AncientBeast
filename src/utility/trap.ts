import { Creature } from '../creature';
import { Effect } from '../effect';
import Game from '../game';
import { Player } from '../player';
import { Hex } from './hex';

/**
 * Object containing hex information, positions and DOM elements
 */
export class Trap {
	game: Game;
	hex: Hex;
	type: string;
	effects: Effect[];
	owner: Player;
	ownerCreature: Creature;
	creationTurn: any;
	destroyOnActivate: boolean;
	id: number;
	display: any;
	typeOver: any;
	displayOver: any;
	turnLifetime: number;
	fullTurnLifetime: boolean;

	/**
	 *
	 * @param x Hex coordinates.
	 * @param y Hex coordinates.
	 * @param type
	 * @param effects
	 * @param owner
	 * @param opt
	 */
	constructor(x: number, y: number, type: string, effects: Effect[], owner: Player, opt: any) {
		this.game = Game.getInstance();
		this.hex = this.game.grid.hexes[y][x];
		this.type = type;
		this.effects = effects;
		this.owner = owner;
		this.creationTurn = this.game.turn;
		this.destroyOnActivate = false;

		const o = {
			turnLifetime: 0,
			fullTurnLifetime: false,
			ownerCreature: undefined, // Needed for fullTurnLifetime
			destroyOnActivate: false,
			typeOver: undefined,
		};

		Object.assign(this, o, opt);

		// Register
		this.game.grid.traps.push(this);
		this.id = this.game.trapId++;
		this.hex.trap = this;

		const spriteName = `trap_${type}`;
		const pos = this.hex.originalDisplayPos;

		this.display = this.game.grid.trapGroup.create(
			pos.x + this.hex.width / 2,
			pos.y + 60,
			spriteName,
		);
		this.display.anchor.setTo(0.5);

		if (this.typeOver) {
			this.displayOver = this.game.grid.trapOverGroup.create(
				pos.x + this.hex.width / 2,
				pos.y + 60,
				spriteName,
			);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	}

	/**
	 *
	 */
	destroy() {
		const game = this.game;
		const tweenDuration = 500;
		const destroySprite = (sprite, animation) => {
			if (animation === 'shrinkDown') {
				sprite.anchor.y = 1;
				sprite.y += sprite.height / 2;

				const tween = game.Phaser.add
					.tween(sprite.scale)
					.to(
						{
							y: 0,
						},
						tweenDuration,
						Phaser.Easing.Linear.None,
					)
					.start();
				tween.onComplete.add(() => {
					sprite.destroy();
				}, sprite);
			} else {
				sprite.destroy();
			}
		};

		destroySprite(this.display, this.destroyAnimation);
		if (this.displayOver) {
			destroySprite(this.displayOver, this.destroyAnimation);
		}

		// Unregister
		const i = game.grid.traps.indexOf(this);
		game.grid.traps.splice(i, 1);
		this.hex.trap = undefined;
	}

	/**
	 * Intended to be overridden during construction.
	 *
	 * @param display
	 * @param destroyAnimation
	 */
	destroyAnimation(display: any, destroyAnimation: any) {
		// No-op default method.
	}

	/**
	 *
	 * @param duration
	 */
	hide(duration: number) {
		duration = duration - 0; // Avoid undefined
		this.game.Phaser.add.tween(this.display).to(
			{
				alpha: 0,
			},
			duration,
			Phaser.Easing.Linear.None,
		);
	}

	/**
	 *
	 * @param duration
	 */
	show(duration: number) {
		duration = duration - 0; // Avoid undefined
		this.game.Phaser.add.tween(this.display).to(
			{
				alpha: 1,
			},
			duration,
			Phaser.Easing.Linear.None,
		);
	}
}
