import { Creature } from './creature';
import { Effect } from './effect';
import Game from './game';

export enum DamageType {
	Pure = 'pure',
	Frost = 'frost',
	Burn = 'burn',
	Poison = 'poison',
	Mental = 'mental',
	Sonic = 'sonic',
	Pierce = 'pierce',
	Slash = 'slash',
	Crush = 'crush',
	Special = 'special',
}

export type Damages = Partial<Record<DamageType, number>>;

/* Damage Class
 *
 * TODO: This documentation needs to be updated with things that are determined
 * dynamically like #melee and #counter
 */
export class Damage {
	game: Game;
	attacker: Creature;
	damages: Damages;
	status: string;
	effects: Effect[];
	area: number;
	counter: boolean;
	target: Creature;
	melee: boolean;
	isFromTrap: boolean;
	noLog: boolean;
	/**
	 * @param attacker Unit that initiated the damage.
	 * @param damages Object containing the damage by type {frost : 5} for example.
	 * @param area Number of hexagons being hit.
	 * @param effects Contains Effect object to apply to the target.
	 * @param game Game object.
	 */
	constructor(attacker: Creature, damages: Damages, area: number, effects: Effect[], game: Game) {
		this.game = game;
		this.attacker = attacker;
		this.damages = damages;
		this.status = '';
		this.effects = effects;
		this.area = area;
		// Whether this is counter-damage
		this.counter = false;
	}

	/**
	 * Calculate the damage that will be applied to a target based on their stats.
	 *
	 * @returns Total damages after damage calculations.
	 */
	applyDamage(): Damages & { total: number } {
		const trg = this.target.stats;
		const atk = this.attacker.stats;
		const returnObj: Damages & { total: number } = {
			total: 0,
		};

		// Damage calculation
		for (const key in this.damages) {
			let points: number;
			const value = this.damages[key];

			if (key === DamageType.Pure) {
				// Bypass defense calculation
				points = value;
			} else {
				points = Math.round(
					value * (1 + (atk.offense - trg.defense / this.area + atk[key] - trg[key]) / 100),
				);

				if (this.game.debugMode) {
					console.log(
						'damage = ' +
							value +
							key +
							'dmg * (1 + (' +
							atk.offense +
							'atkoffense - ' +
							trg.defense +
							'trgdefense / ' +
							this.area +
							'area + ' +
							atk[key] +
							'atk' +
							key +
							' - ' +
							trg[key] +
							'trg' +
							key +
							' )/100)',
					);
				}
			}

			returnObj[key] = points;
			returnObj.total += points;
		}

		// Minimum of 1 damage
		returnObj.total = Math.max(returnObj.total, 1);

		return returnObj;
	}
}
