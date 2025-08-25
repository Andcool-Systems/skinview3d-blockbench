import { PlayerAnimation, PlayerObject } from 'skinview3d';
import {
    AnimationsObject,
    BlockbenchAnimationProviderProps,
    BonesAnimation,
    BonesOverrides,
    ExtendedKeyframe,
    InternalAnimationObject,
    KeyframesList,
    KeyframeValue,
    NormalizedBonesNames,
    SingleKeyframeListItem
} from './types';

import { Clock, Euler, MathUtils } from 'three';
import { catmullRom } from './lerp';
import { defaultBonesOverrides, defaultPositions } from './defaults';

/** Provider for bedrock .animation.json files */
export class SkinViewBlockbench extends PlayerAnimation {
    private animations: Record<string, InternalAnimationObject>;

    /** Function called when looped animation loop ends */
    onLoopEnd: BlockbenchAnimationProviderProps['onLoopEnd'];

    /** Function call when single-iteration animation ends */
    onFinish: BlockbenchAnimationProviderProps['onFinish'];

    /**
     * Force loop animation, ignoring its settings
     * (undefined for using loop setting from animation)
     */
    forceLoop?: boolean;

    /** Connect cape to body if its not animated */
    connectCape: boolean;

    /** Currently playing animation name */
    animationName: string = '';

    /** Currently playing animation iteration */
    animationIteration: number = 0;

    /** Player object */
    private player!: PlayerObject;

    /** Animation progress in milliseconds */
    private _progress: number = 0;
    private clock: Clock;

    /** Normalize keyframes names by adding explicit lerp mode */
    private convertKeyframe(input?: Record<string, KeyframeValue>) {
        if (!input) return undefined;

        const result: Record<string, ExtendedKeyframe> = {};
        for (const [k, v] of Object.entries(input)) {
            if (Array.isArray(v)) {
                result[k] = { post: v, lerp_mode: 'linear' };
            } else {
                result[k] = v;
            }
        }
        return result;
    }

    constructor(params: BlockbenchAnimationProviderProps) {
        super();

        this.animations = {};
        this.onFinish = params.onFinish;
        this.onLoopEnd = params.onLoopEnd;
        this.forceLoop = params.forceLoop;
        this.connectCape = params.connectCape ?? false;
        this.clock = new Clock();

        // Initialize all animations
        for (const animation_name of Object.keys(params.animation.animations)) {
            this.processAnimation(
                params.animation.animations,
                animation_name,
                params.bonesOverrides
            );
        }

        // Reset animation
        this.reset(params.animationName);
    }

    /** Reset animation */
    private reset(animation_name?: string) {
        const _animation_name = animation_name ?? Object.keys(this.animations).at(0);

        if (!_animation_name || !(_animation_name in this.animations))
            throw new Error('Animation name not specified or no animation found');

        this.clock.stop();
        this.clock.autoStart = true;

        this._progress = 0;
        this.animationIteration = 0;

        this.animationName = _animation_name;

        if (this.player) this.player.resetJoints();
        this.paused = false;
    }

    /** Prepare single animation */
    private processAnimation(
        animations: {
            [anim_name: string]: AnimationsObject;
        },
        animation_name: string,
        bones_overrides?: BonesOverrides
    ) {
        const animation = animations[animation_name];
        const bones: Record<string, BonesAnimation<ExtendedKeyframe>> = {};
        const keyframes_list: Record<string, KeyframesList> = {};

        // Iterate by each bone animation
        for (const [bone, value] of Object.entries(animation.bones)) {
            // Normalizing bones names
            let normalizedBoneName: NormalizedBonesNames | undefined = undefined;
            if (bone in defaultBonesOverrides) {
                normalizedBoneName = defaultBonesOverrides[bone];
            }

            // Apply overrides
            if (bones_overrides && Object.values(bones_overrides).includes(bone)) {
                normalizedBoneName = Object.entries(bones_overrides)
                    .find(([, v]) => v === bone)
                    ?.at(0);
            }

            if (!normalizedBoneName) throw Error(`Found unknown bone: ${bone}`);

            // Normalize keyframes objects
            bones[normalizedBoneName] = {
                position: this.convertKeyframe(value.position),
                rotation: this.convertKeyframe(value.rotation)
            };

            // Prepare keyframes for proper use
            const rotation_keys = Object.keys(value.rotation ?? {});
            const position_keys = Object.keys(value.position ?? {});
            keyframes_list[normalizedBoneName] = {
                rotation: { str: rotation_keys, num: rotation_keys.map(parseFloat) },
                position: {
                    str: position_keys,
                    num: position_keys.map(parseFloat)
                }
            };
        }

        this.animations[animation_name] = {
            bones,
            keyframes_list,
            animation_length: animation.animation_length,
            animation_name,
            animation_loop: animation.loop == true
        };
    }

    /** Sets the current animation by name from already imported animation set */
    setAnimation(
        animation_name: string,
        options?: Pick<BlockbenchAnimationProviderProps, 'forceLoop' | 'connectCape'>
    ) {
        this.reset(animation_name);

        if (!options) return;
        if (options.connectCape) this.connectCape = options.connectCape ?? false;
        if (options.forceLoop) this.forceLoop = options.forceLoop;
    }

    private clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(val, max));
    }

    private getCurrentKeyframe(
        value: Record<string, ExtendedKeyframe>,
        keyframes_list: SingleKeyframeListItem,
        insertion: number,
        looped_time: number,
        loop: boolean
    ) {
        const times = keyframes_list.num;
        const labels = keyframes_list.str;

        const n = times.length;
        let i0: number, i1: number, i2: number, i3: number;

        const stepBackwards = (i: number, step: number, n: number) => {
            const _i = i - step;
            if (_i <= 0) return n - (1 + step);
            return _i;
        };

        if (loop) {
            i0 = stepBackwards(insertion, 1, n);
            i1 = insertion % n;
            i2 = (insertion + 1) % n;
            i3 = (insertion + 2) % n;
        } else {
            i0 = Math.max(insertion - 1, 0);
            i1 = insertion;
            i2 = Math.min(insertion + 1, n - 1);
            i3 = Math.min(insertion + 2, n - 1);
        }

        const t1 = times[i1];
        let t2 = times[i2];

        const p0 = value[labels[i0]].post!;
        const p1 = value[labels[i1]].post!;
        const p2 = value[labels[i2]].post!;
        const p3 = value[labels[i3]].post!;

        let time = looped_time;
        if (loop && t2 <= t1) {
            const duration = times[n - 1] - times[0];
            t2 += duration;
            if (time < t1) time += duration;
        }

        let t: number;
        if (t2 === t1) {
            t = 0;
        } else {
            t = (time - t1) / (t2 - t1);
        }
        const target = value[labels[i2]];

        if (target.lerp_mode === 'catmullrom') {
            return [0, 1, 2].map(i => catmullRom(p0[i], p1[i], p2[i], p3[i], t));
        } else {
            return [0, 1, 2].map(i => p1[i] + (p2[i] - p1[i]) * t);
        }
    }

    protected animate(player: PlayerObject): void {
        const delta = this.clock.getDelta() * this.speed;
        this.player = player; // Save player object for future

        const current_animation = this.animations[this.animationName];

        const looped =
            this.forceLoop !== undefined
                ? this.forceLoop
                : current_animation.animation_loop;

        const looped_time = looped
            ? this._progress % current_animation.animation_length
            : this.clamp(this._progress, 0, current_animation.animation_length);

        for (const [bone, value] of Object.entries(current_animation.bones)) {
            for (const type of ['rotation', 'position'] as const) {
                if (!value[type]) continue;

                const keyframes_list = current_animation.keyframes_list[bone][type];
                let insert_index = this.findInsertPosition(
                    keyframes_list!.num,
                    looped_time
                );
                if (insert_index === null)
                    insert_index = keyframes_list!.num.length - 1;

                const curr = this.getCurrentKeyframe(
                    value[type],
                    keyframes_list!,
                    insert_index,
                    looped_time,
                    current_animation.animation_loop
                );

                const skin_bone = player.skin[bone as NormalizedBonesNames];

                if (type === 'rotation') {
                    const [x, y, z] = curr.map(MathUtils.degToRad);
                    skin_bone.setRotationFromEuler(new Euler(x, -y, -z, 'ZYX'));
                } else {
                    const defaults = defaultPositions[bone as NormalizedBonesNames];
                    skin_bone.position.set(
                        defaults[0] + curr[0],
                        defaults[1] + curr[1],
                        defaults[2] + -curr[2]
                    );

                    if (bone === 'body' && this.connectCape) {
                        const cape_defaults = defaultPositions['cape'];
                        player.cape.position.set(
                            cape_defaults[0] + curr[0],
                            cape_defaults[1] + curr[1],
                            cape_defaults[2] + -curr[2]
                        );
                    }
                }
            }
        }

        const old_progress = this._progress;
        this._progress += delta;

        const animation_iteration = Math.floor(
            old_progress / current_animation.animation_length
        );
        if (animation_iteration > this.animationIteration && looped) {
            this.animationIteration = animation_iteration;
            this.onLoopEnd?.(this);
        }

        if (old_progress >= current_animation.animation_length && !looped) {
            this.paused = true;
            this.onFinish?.(this);
        }
    }

    private findInsertPosition(arr: number[], target: number): number | null {
        let left = 0;
        let right = arr.length - 1;

        if (target <= arr[0] || target >= arr[arr.length - 1]) {
            return null;
        }

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);

            if (arr[mid] < target && target < arr[mid + 1]) {
                return mid;
            }

            if (target < arr[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }

        return null;
    }
}
