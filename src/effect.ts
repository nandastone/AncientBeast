import { Creature, CreatureAlterations } from './creature';
import Game from './game';
import { Hex } from './utility/hex';
import { EffectOptions } from '../types/options/effect-options';

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
	noLog: boolean;
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
	specialHint: string;
	deleteOnOwnerDeath: boolean;

	/**
	 *
	 * @param name Name of the effect.
	 * @param owner Creature that casted the effect.
	 * @param target The object that possess the effect.
	 * @param options
	 */
	constructor(name: string, owner: Creature, target: Creature | Hex, opts: EffectOptions = {}) {
		this.game = Game.getInstance();
		this.id = this.game.effectId++;

		this.name = name;
		this.owner = owner;
		this.target = target;
		this.trigger = '';
		this.creationTurn = this.game.turn;

		const defaultOpts = {
			alterations: {},
			turnLifetime: 0,
			deleteTrigger: 'onStartOfRound',
			stackable: true,
			noLog: false,
			specialHint: undefined, // Special hint for log
			deleteOnOwnerDeath: false,
		};
		// Combine default options, passed options, and assign as properties to the instance.
		Object.assign(this, defaultOpts, opts);

		// Update the global list of Effects for iteration and triggering on game events.
		this.game.effects.push(this);
	}

	/**
	 *
	 * @param args
	 */
	animation(...args: any) {
		this.activate(args);
	}

	/**
	 *
	 * @param arg
	 * @returns
	 */
	activate(arg: any) {
		if (!this.requireFn(arg)) {
			return false;
		}

		if (!this.noLog) {
			console.log('Effect ' + this.name + ' triggered');
		}

		if (arg instanceof Creature) {
			arg.addEffect(this);
		}

		this.effectFn(arg);
	}

	/**
	 * Intended to be overridden during construction.
	 *
	 * @param arg
	 * @returns
	 */
	requireFn(...arg: any) {
		return true;
	}

	/**
	 * Intended to be overridden during construction.
	 * @param arg
	 */
	effectFn(...arg: any) {
		// No-op default method.
	}

	/**
	 * Remove an effect from a Creature.
	 */
	deleteEffect() {
		if (this.target instanceof Hex) {
			console.warn('Attempting to deleteEffect() on unsupported target.');
			return;
		}

		const targetIdx = this.target.effects.indexOf(this);
		if (this.target.effects[targetIdx]) {
			this.target.effects.splice(targetIdx, 1);
		} else {
			console.warn('Failed to find effect on target.', this);
		}

		const gameIdx = this.game.effects.indexOf(this);
		if (this.game.effects[gameIdx]) {
			this.game.effects.splice(gameIdx, 1);
		} else {
			console.warn('Failed to find effect on game.', this);
		}

		this.target.updateAlteration();
	}
}
