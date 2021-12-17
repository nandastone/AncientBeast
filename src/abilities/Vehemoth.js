import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[6] = [
		// 	First Ability: Lamellar Body
		{
			//  Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onCreatureSummon onOtherCreatureSummon onOtherCreatureDeath',

			_buff: 0,

			//  require() :
			require: function () {
				// Stop temporary and dead creatures from activating
				if (this.creature.dead || this.creature.temp) {
					return false;
				}
				// Stop activation if the other creature is not a sloth type
				var buff = 0;
				G.creatures.forEach((crea) => {
					if (crea.realm == 'S' && !crea.dead && !crea.temp) {
						buff += 2;
					}
				});
				if (buff == this._buff) {
					return false;
				}
				this._buff = buff;
				return true;
			},

			//  activate() :
			activate: function () {
				let ability = this;
				// Force Vehemoth to stay facing the right way
				this.creature.facePlayerDefault();

				var regrowBuff = 0;
				if (this.isUpgraded()) {
					regrowBuff = this._buff;
				}

				this.creature.replaceEffect(
					// Add and replace the effect each time
					new Effect(
						'Lamellar Body', // name
						this.creature, // caster
						this.creature, // target
						'', // trigger
						{
							alterations: {
								defense: this._buff,
								frost: this._buff,
								regrowth: regrowBuff,
							},
							stackable: false,
						},
					),
				);
			},
		},

		// 	Second Ability: Flat Frons
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			_directions: [0, 1, 0, 0, 1, 0], // forward/backward
			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				if (
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.frontnback3hex), {
						team: this._targetTeam,
					})
				) {
					if (this.isUpgraded()) {
						if (
							!this.testDirection({
								team: this._targetTeam,
								directions: this._directions,
								distance: this.creature.remainingMove + 1,
								sourceCreature: this.creature,
							})
						) {
							return false;
						}
					} else {
						return false;
					}
				}
				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;
				let vehemoth = this.creature;

				let object = {
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: vehemoth.flipped,
					id: vehemoth.id,
					hexesDashed: vehemoth.getHexMap(matrices.frontnback3hex),
					team: Team.enemy,
					requireCreature: true,
					flipped: vehemoth.flipped,
				};

				object.choices = vehemoth.getHexMap(matrices.frontnback3hex).map((hex) => {
					return [hex];
				});

				if (this.isUpgraded()) {
					let directionObject = G.grid.getDirectionChoices({
						flipped: vehemoth.flipped,
						sourceCreature: vehemoth,
						team: this._targetTeam,
						id: vehemoth.id,
						requireCreature: true,
						x: vehemoth.x,
						y: vehemoth.y,
						distance: vehemoth.remainingMove + 1,
						directions: this._directions,
					});

					// removes duplicates between nearby and inline targets
					object.choices = object.choices.filter(
						(objectHexes) =>
							!directionObject.choices.some((directionHexes) =>
								objectHexes.every((v) => directionHexes.includes(v)),
							),
					);
					object.choices = [...object.choices, ...directionObject.choices];

					directionObject.choices.forEach((choice) => {
						let dir = choice[0].direction;
						let fx = 1;
						if ((!vehemoth.flipped && dir === 4) || (vehemoth.flipped && dir === 1)) {
							fx = -1 * vehemoth.size;
						}
						let hexesDashed = G.grid.getHexLine(
							vehemoth.x + fx,
							vehemoth.y,
							choice[0].direction,
							vehemoth.flipped,
						);
						hexesDashed.splice(0, choice.length);
						hexesDashed.splice(choice.length - arrayUtils.last(choice).creature.size);
						object.hexesDashed = [...object.hexesDashed, ...hexesDashed];
					});
				}

				G.grid.queryChoice(object);
			},

			//	activate() :
			activate: function (path, args) {
				let ability = this;
				let vehemoth = ability.creature;
				ability.end();

				let target = arrayUtils.last(path).creature;

				let damageType =
					target.health <= 39
						? { pure: this.damages.pure }
						: { crush: this.damages.crush, frost: this.damages.frost };
				let damage = new Damage(
					ability.creature, // Attacker
					damageType,
					1, // Area
					[], // Effects
				);

				let trgIsNearby = vehemoth
					.getHexMap(matrices.frontnback3hex)
					.includes(arrayUtils.last(path));

				if (trgIsNearby) {
					target.takeDamage(damage);
				} else {
					if (!this.isUpgraded()) {
						return;
					}
					arrayUtils.filterCreature(path, false, true, vehemoth.id);
					let destination = arrayUtils.last(path);
					let x = destination.x + (args.direction === 4 ? vehemoth.size - 1 : 0);
					destination = G.grid.hexes[destination.y][x];

					let fx = 1;
					if (
						(!vehemoth.flipped && args.direction === 4) ||
						(vehemoth.flipped && args.direction === 1)
					) {
						fx = -1 * vehemoth.size;
					}
					let knockbackHexes = G.grid.getHexLine(
						vehemoth.x + fx,
						vehemoth.y,
						args.direction,
						vehemoth.flipped,
					);
					knockbackHexes.splice(0, path.length + target.size);
					knockbackHexes.splice(path.length);

					vehemoth.moveTo(destination, {
						callback: function () {
							let knockbackHex = null;
							for (let i = 0; i < knockbackHexes.length; i++) {
								// Check that the next knockback hex is valid
								if (!knockbackHexes[i].isWalkable(target.size, target.id, true)) {
									break;
								}
								knockbackHex = knockbackHexes[i];
							}
							if (knockbackHex !== null) {
								target.moveTo(knockbackHex, {
									callback: function () {
										// Deal damage only if target have reached the end of the path
										if (knockbackHex.creature === target) {
											target.takeDamage(damage);
										}
										G.activeCreature.queryMove();
									},
									ignoreMovementPoint: true,
									ignorePath: true,
									animation: 'push',
								});
							} else {
								target.takeDamage(damage);
								G.activeCreature.queryMove();
							}
						},
					});
				}
			},
		},

		// 	Thirt Ability: Snow Storm
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				let straitrow = matrices.straitrow;
				let bellowrow = matrices.bellowrow;

				let crea = this.creature;
				let hexes = arrayUtils
					.filterCreature(
						G.grid.getHexMap(crea.x + 2, crea.y - 2, 0, false, straitrow),
						true,
						true,
						crea.id,
						crea.team,
					)
					.concat(
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x + 1, crea.y - 2, 0, false, bellowrow),
							true,
							true,
							crea.id,
							crea.team,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x, crea.y, 0, false, straitrow),
							true,
							true,
							crea.id,
							crea.team,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x + 1, crea.y, 0, false, bellowrow),
							true,
							true,
							crea.id,
							crea.team,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x + 2, crea.y + 2, 0, false, straitrow),
							true,
							true,
							crea.id,
							crea.team,
						),

						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x - 2, crea.y - 2, 2, true, straitrow),
							true,
							true,
							crea.id,
							crea.team,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x - 1, crea.y - 2, 2, true, bellowrow),
							true,
							true,
							crea.id,
							crea.team,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x, crea.y, 2, true, straitrow),
							true,
							true,
							crea.id,
							crea.team,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x - 1, crea.y, 2, true, bellowrow),
							true,
							true,
							crea.id,
							crea.team,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(crea.x - 2, crea.y + 2, 2, true, straitrow),
							true,
							true,
							crea.id,
							crea.team,
						),
					);

				if (
					!this.atLeastOneTarget(hexes, {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;
				let crea = this.creature;

				let choices = [
					//Front
					arrayUtils
						.filterCreature(
							G.grid.getHexMap(crea.x + 2, crea.y - 2, 0, false, matrices.straitrow),
							true,
							true,
							crea.id,
							crea.team,
						)
						.concat(
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x + 1, crea.y - 2, 0, false, matrices.bellowrow),
								true,
								true,
								crea.id,
								crea.team,
							),
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x, crea.y, 0, false, matrices.straitrow),
								true,
								true,
								crea.id,
								crea.team,
							),
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x + 1, crea.y, 0, false, matrices.bellowrow),
								true,
								true,
								crea.id,
								crea.team,
							),
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x + 2, crea.y + 2, 0, false, matrices.straitrow),
								true,
								true,
								crea.id,
								crea.team,
							),
						),
					//Behind
					arrayUtils
						.filterCreature(
							G.grid.getHexMap(crea.x - 2, crea.y - 2, 2, true, matrices.straitrow),
							true,
							true,
							crea.id,
							crea.team,
						)
						.concat(
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x - 1, crea.y - 2, 2, true, matrices.bellowrow),
								true,
								true,
								crea.id,
								crea.team,
							),
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x, crea.y, 2, true, matrices.straitrow),
								true,
								true,
								crea.id,
								crea.team,
							),
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x - 1, crea.y, 2, true, matrices.bellowrow),
								true,
								true,
								crea.id,
								crea.team,
							),
							arrayUtils.filterCreature(
								G.grid.getHexMap(crea.x - 2, crea.y + 2, 2, true, matrices.straitrow),
								true,
								true,
								crea.id,
								crea.team,
							),
						),
				];

				G.grid.queryChoice({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					}, //fnOnConfirm
					team: this._targetTeam,
					requireCreature: 1,
					id: crea.id,
					flipped: crea.flipped,
					choices: choices,
				});
			},

			//	activate() :
			activate: function (choice) {
				let ability = this;

				let creaturesHit = [];

				for (let i = 0; i < choice.length; i++) {
					if (
						choice[i].creature instanceof Creature &&
						creaturesHit.indexOf(choice[i].creature) == -1
					) {
						// Prevent Multiple Hit

						choice[i].creature.takeDamage(
							new Damage(
								ability.creature, // Attacker
								ability.damages1, // Damage Type
								1, // Area
								[], // Effects
							),
						);

						creaturesHit.push(choice[i].creature);
					}
				}
			},
		},

		// 	Fourth Ability: Frozen Orb
		{
			//	Type : Can be "onQuery"," onStartPhase", "onDamage"
			trigger: 'onQuery',

			directions: [0, 1, 0, 0, 1, 0],
			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				if (
					!this.testDirection({
						team: this._targetTeam,
						directions: this.directions,
						sourceCreature: this.creature,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;
				let crea = this.creature;

				G.grid.queryDirection({
					fnOnSelect: function (path) {
						let trg = arrayUtils.last(path).creature;

						let hex = ability.creature.player.flipped
							? G.grid.hexes[arrayUtils.last(path).y][arrayUtils.last(path).x + trg.size - 1]
							: arrayUtils.last(path);

						hex
							.adjacentHex(ability.radius)
							.concat([hex])
							.forEach(function (item) {
								if (item.creature instanceof Creature) {
									item.overlayVisualState('creature selected player' + item.creature.team);
								} else {
									item.overlayVisualState('creature selected player' + G.activeCreature.team);
								}
							});
					},
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: crea.player.flipped,
					team: this._targetTeam,
					id: this.creature.id,
					requireCreature: true,
					x: crea.x,
					y: crea.y,
					sourceCreature: crea,
				});
			},

			//	activate() :
			activate: function (path) {
				let ability = this;
				ability.end();

				let trg = arrayUtils.last(path).creature;

				let hex = ability.creature.player.flipped
					? G.grid.hexes[arrayUtils.last(path).y][arrayUtils.last(path).x + trg.size - 1]
					: arrayUtils.last(path);

				let trgs = ability.getTargets(hex.adjacentHex(ability.radius).concat([hex])); // Include central hex

				let effect = new Effect(
					'Frozen', // Name
					ability.creature, // Caster
					undefined, // Target
					'', // Trigger
					{
						effectFn: function (eff) {
							eff.target.stats.frozen = true;
							this.deleteEffect();
						},
					},
				);

				ability.areaDamage(
					ability.creature,
					ability.damages,
					[effect], // Effects
					trgs,
				);
			},
		},
	];
};
