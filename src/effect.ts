import { Creature, CreatureAlterations } from './creature';
import Game from './game';
import { Hex } from './utility/hex';

/**
 * Override default Effect properties on construction.
 */
export type EffectOptions = Partial<
	Pick<
		Effect,
		| 'trigger'
		| 'requireFn'
		| 'effectFn'
		| 'alterations'
		| 'turnLifetime'
		| 'deleteTrigger'
		| 'stackable'
		| 'noLog'
		| 'specialHint'
		| 'deleteOnOwnerDeath'
	>
>;

/**
 * Class representing temporary or permanent changes to a Creature. Changes could
 * include stat buffs/debuffs, extra logic applied when conditions are triggered,
 * etc.
 */
export class Effect {
	/**
	 * Unique auto-incrementing ID.
	 */
	id: number;

	/**
	 * Reference to the Game class.
	 */
	game: Game;

	/**
	 * Name of the effect. May be displayed in hints, logs, etc.
	 */
	name: string;

	/**
	 * Creature that created the effect.
	 */
	owner: Creature;

	/**
	 * The object that possesses the effect.
	 * While an effect can be applied to a Hex as part of a Trap, it doesn't actually
	 * alter the Hex but is instead copied to, and activated on, the Trap target when
	 * the trap activates.
	 */
	target: Creature | Hex;

	/**
	 * Trigger event that may call `optArgs.effectFn()` to apply additional logic
	 * against the target.
	 *
	 * Generally there are two types of Effects - 1) immediately applied stat changes
	 * or 2) delayed (triggered) effects with more complex logic.
	 *
	 * @see Game.triggers
	 */
	// TODO: type triggers
	trigger: string;

	/**
	 * The Game turn the effect was added to target. Used in conjunction with optArgs.turnLifetime
	 * to determine when an Effect should be removed.
	 */
	creationTurn: number;

	/**
	 * @default false
	 */
	noLog: boolean;

	/**
	 *
	 */
	alterations: CreatureAlterations;

	/**
	 * Trigger event that will automatically delete the effect.
	 *
	 * @see Game.triggers
	 * @default onStartOfRound
	 */
	deleteTrigger?: 'onReset' | 'onStartPhase' | 'onEndPhase' | 'onStartOfRound';

	/**
	 * The number of game turns before an Effect should be automatically removed.
	 * 0 = infinite turns. The exact point in the turn is determined by `deleteTrigger`.
	 *
	 * @default 0
	 */
	turnLifetime: number;

	/**
	 * If true the same "effect" (unique by name) can be applied multiple times to
	 * the same target.
	 *
	 * @default false
	 */
	stackable: boolean;

	/**
	 *
	 */
	specialHint: string;

	/**
	 * @default false
	 */
	deleteOnOwnerDeath: boolean;

	constructor(name: string, owner: Creature, target: Creature | Hex, options: EffectOptions = {}) {
		this.game = Game.getInstance();
		this.name = name;
		this.owner = owner;
		this.target = target;

		this.id = this.game.effectId++;
		this.creationTurn = this.game.turn;
		this.trigger = '';
		this.alterations = {};
		this.turnLifetime = 0;
		this.deleteTrigger = 'onStartOfRound';
		this.stackable = true;
		this.noLog = false;
		this.specialHint = undefined;
		this.deleteOnOwnerDeath = false;

		// Combine default options, passed options, and assign as properties to the instance.
		Object.assign(this, options);

		// Update the global list of Effects for iteration and triggering on game events.
		this.game.effects.push(this);
	}

	/**
	 *
	 * @param args
	 */
	animation(...args) {
		this.activate(args);
	}

	/**
	 *
	 * @param arg
	 * @returns
	 */
	activate(arg) {
		if (!this.requireFn(arg)) {
			return false;
		}

		if (!this.noLog) {
			console.log('Effect ' + this.name + ' triggered');
		}

		// Transfer an Effect from another Creature or Hex.
		if (arg instanceof Creature) {
			arg.addEffect(this);
		}

		this.effectFn(arg);
	}

	/**
	 * Intended to be overridden during construction.
	 *
	 * @param arg
	 * @returns {boolean}
	 */
	requireFn(arg: any) {
		return true;
	}

	/**
	 * Intended to be overridden during construction.
	 *
	 * @param arg
	 */
	effectFn(arg: any) {
		// No-op method.
	}

	/**
	 * Remove an effect from a Creature.
	 *
	 * Technically this code path could be called Hex effects applied via a Trap.
	 * However, this doesn't happen because Trap effects don't have a lifetime, so
	 * never end up being automatically deleted. Instead they are generally cleaned
	 * up via `effectFn()` which is the Effect after being transferred to a Creature.
	 */
	deleteEffect() {
		if (this.target instanceof Hex) {
			console.warn('Attempting to deleteEffect() on unsupported target.');
			return;
		}

		let i = this.target.effects.indexOf(this);

		this.target.effects.splice(i, 1);
		i = this.game.effects.indexOf(this);
		this.game.effects.splice(i, 1);
		this.target.updateAlteration();
		console.log('Effect ' + this.name + ' deleted');
	}
}
