import { Effect } from '../../src/effect';

/**
 * Effect options override properties and methods of the class.
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
