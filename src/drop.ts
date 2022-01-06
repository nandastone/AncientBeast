import { Creature, CreatureAlterations } from './creature';
import Game from './game';
import { Hex } from './utility/hex';

/**
 * Drops are a type of creature "buff" collected from a game board hex rather than
 * being applied by an ability.
 *
 * For "pool" resources such as health and energy, the buff restores those resources
 * as well as increasing their maximum values.
 *
 * Each creature has a unique Drop that is added to their location hex when they
 * die.
 *
 * Another creature entering the same hex as the Drop can pick it up, altering its
 * stats (alterations) and/or restoring health/energy.
 *
 * Other rules:
 * - Multiple Drops can stack on a single creature, either the same Drop multiple
 *   times or different Drops from multiple creatures.
 * - Drops currently do NOT expire.
 * - Drops currently cannot be removed by other abilities.
 * - Drops are essentially permanent although this may change in the future.
 */
export class Drop {
	name: string;
	game: Game;
	id: number;
	x: number;
	y: number;
	pos: { x: number; y: number };
	alterations: CreatureAlterations;
	hex: Hex;
	display: any;

	/**
	 *
	 * @param name
	 * @param alterations
	 * @param x
	 * @param y
	 */
	constructor(name: string, alterations: CreatureAlterations, x: number, y: number) {
		this.name = name;
		this.game = Game.getInstance();
		this.id = this.game.dropId++;
		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y,
		};
		this.alterations = alterations;
		this.hex = this.game.grid.hexes[this.y][this.x];

		this.hex.drop = this;

		this.display = this.game.grid.dropGroup.create(
			this.hex.displayPos.x + 54,
			this.hex.displayPos.y + 15,
			'drop_' + this.name,
		);
		this.display.alpha = 0;
		this.display.anchor.setTo(0.5, 0.5);
		this.display.scale.setTo(1.5, 1.5);
		this.game.Phaser.add
			.tween(this.display)
			.to(
				{
					alpha: 1,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();
	}

	/**
	 *
	 * @param creature
	 */
	pickup(creature: Creature) {
		const game = this.game;

		game.log('%CreatureName' + creature.id + '% picks up ' + this.name);
		creature.hint(this.name, 'msg_effects');
		creature.dropCollection.push(this);

		creature.updateAlteration();

		this.hex.drop = undefined;

		if (this.alterations.health && typeof this.alterations.health === 'number') {
			creature.heal(this.alterations.health, false, false);
		}

		if (this.alterations.energy && typeof this.alterations.energy === 'number') {
			creature.recharge(this.alterations.energy, false);
		}

		if (this.alterations.endurance && typeof this.alterations.endurance === 'number') {
			creature.restoreEndurance(this.alterations.endurance, false);
		}

		if (this.alterations.movement && typeof this.alterations.movement === 'number') {
			creature.restoreMovement(this.alterations.movement, false);
		}

		// Log all the gained alterations.
		const gainedMessage = Object.keys(this.alterations)
			.map((key) => `${this.alterations[key]} ${key}`)
			.join(', ')
			// Replace last comma with "and".
			.replace(/, ([^,]*)$/, ', and $1');
		game.log(`%CreatureName${creature.id}% gains ${gainedMessage}`);

		creature.player.score.push({
			type: 'pickupDrop',
		});

		const tween = game.Phaser.add
			.tween(this.display)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();

		tween.onComplete.add(() => {
			this.display.destroy();
		});
	}
}
