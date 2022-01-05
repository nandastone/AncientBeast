import { Ability } from './ability';
import { Creature } from './creature';
import { Player } from './player';

/**
 * TODO: What is this?
 */
type KillScore = {
	type: 'kill';
	creature: Creature;
};

/**
 * TODO: What is this?
 */
type NoFleeingScore = {
	type: 'nofleeing';
};

/**
 * TODO: What is this?
 */
type CreatureBonusScore = {
	type: 'creaturebonus';
	creature: Creature;
};

/**
 * TODO: What is this?
 */
type TimeBonusScore = {
	type: 'timebonus';
};

/**
 * TODO: What is this?
 */
type FirstKillScore = {
	type: 'firstKill';
};

/**
 * TODO: What is this?
 */
type DenyScore = {
	type: 'deny';
	creature: Creature;
};

/**
 * TODO: What is this?
 */
type HumiliationScore = {
	type: 'humiliation';
	player: Player;
};

/**
 * TODO: What is this?
 */
type AnnihilationScore = {
	type: 'annihilation';
	player: Player;
};

/**
 * TODO: What is this?
 */
type ComboScore = {
	type: 'combo';
	kills: number;
};

/**
 * TODO: What is this?
 */
type ImmortalScore = {
	type: 'immortal';
};

/**
 * TODO: What is this?
 */
type DarkPriestBonusScore = {
	type: 'darkpriestbonus';
};

/**
 * TODO: What is this?
 */
type PickupDropScore = {
	type: 'pickupDrop';
};

/**
 * TODO: What is this?
 */
type UpgradeScore = {
	type: 'upgrade';
	ability: Ability;
	Creature: Creature;
};

export type Score =
	| KillScore
	| NoFleeingScore
	| CreatureBonusScore
	| TimeBonusScore
	| FirstKillScore
	| DenyScore
	| HumiliationScore
	| AnnihilationScore
	| ComboScore
	| ImmortalScore
	| DarkPriestBonusScore
	| PickupDropScore
	| UpgradeScore;
