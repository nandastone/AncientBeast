import { Creature } from './creature';
import Game from './game';
import { Hex } from './utility/hex';

interface CreatureStats {}

interface Alterations {}

/**
 * Effect properties that can be overridden on construction.
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
	alterations: Alterations;

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
		this.activate(...args);
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

		// TODO: what is this?
		if (arg instanceof Creature) {
			arg.addEffect(this);
		}

		this.effectFn(arg);
	}

	/**
	 *
	 * @param arg
	 * @returns
	 */
	requireFn(arg: any) {
		return true;
	}

	/**
	 *
	 * @param arg
	 */
	effectFn(arg: any) {
		throw new Error('Method not implemented.');
	}

	/**
	 *
	 */
	deleteEffect() {
		// deleteEffect() is only called on Creature types by the game. How best to represent this?
		// One option would be to check in the function and return early.
		// Another option is to extend the Effect class with HexEffect/CreatureEffect.
		// Another option would be to call this for Hex and update the code to work.

		let i = this.target.effects.indexOf(this);

		this.target.effects.splice(i, 1);
		i = this.game.effects.indexOf(this);
		this.game.effects.splice(i, 1);
		this.target.updateAlteration();
		console.log('Effect ' + this.name + ' deleted');
	}
}

const test = new Effect('test', new Creature(), new Creature());
