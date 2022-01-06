export interface MoveToOptions {
	callback(): boolean;
	callbackStepIn(): boolean;
	animation: 'fly' | 'walk' | 'teleport';
	ignoreMovementPoint: boolean;
	ignorePath: boolean;
	customMovementPoint: number;
	overrideSpeed: number;
	turnAroundOnComplete: boolean;
}
