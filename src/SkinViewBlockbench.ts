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

    onLoopEnd: BlockbenchAnimationProviderProps['onLoopEnd'];
    onFinish: BlockbenchAnimationProviderProps['onFinish'];
    force_loop?: boolean;
    connect_cape?: boolean;

    current_animation_name: string = '';
    animation_iteration: number = 0;

    private player!: PlayerObject;

    private _progress: number = 0;
    private clock: Clock;

    private convertKeyframe(
        input?: Record<string, KeyframeValue>
    ): Record<string, ExtendedKeyframe> | undefined {
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
        this.force_loop = params.forceLoop;
        this.connect_cape = params.connectCape;
        this.clock = new Clock();

        const animation_name =
            params.animationName ?? Object.keys(params.animation.animations).at(0);

        if (!animation_name)
            throw Error('Animation name not specified or no animation found');

        // Initialize all animations
        for (const animation_name of Object.keys(params.animation.animations)) {
            this.processAnimation(
                params.animation.animations,
                animation_name,
                params.bonesOverrides
            );
        }

        this.restart(animation_name);
    }

    private restart(animation_name: string) {
        this.clock.stop();
        this.clock.autoStart = true;

        this._progress = 0;
        this.animation_iteration = 0;

        this.current_animation_name = animation_name;

        if (this.player) this.player.resetJoints();
        this.paused = false;
    }

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
        params: Omit<
            BlockbenchAnimationProviderProps,
            'animation' | 'bonesOverrides' | 'onFinish' | 'onLoopEnd'
        >
    ) {
        const animation_name =
            params.animationName ?? Object.keys(this.animations).at(0);

        if (!animation_name)
            throw Error('Animation name not specified or no animation found');

        this.restart(animation_name);
        this.force_loop = params.forceLoop;
        this.connect_cape = params.connectCape;
    }

    private clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(val, max));
    }

    private getCurrentKeyframe(
        value: Record<string, ExtendedKeyframe>,
        keyframes_list: SingleKeyframeListItem,
        insertion: number,
        looped_time: number
    ) {
        const times = keyframes_list.num;
        const labels = keyframes_list.str;

        const i0 = (insertion - 1 + times.length) % times.length;
        const i1 = insertion;
        const i2 = (insertion + 1) % times.length;
        const i3 = (insertion + 2) % times.length;

        const t1 = times[i1];
        const t2 = times[i2];

        const p0 = value[labels[i0]].post!;
        const p1 = value[labels[i1]].post!;
        const p2 = value[labels[i2]].post!;
        const p3 = value[labels[i3]].post!;

        const t = (looped_time - t1) / (t2 - t1);
        const target = value[labels[i2]];

        if (target.lerp_mode === 'catmullrom') {
            return [0, 1, 2].map(i => catmullRom(p0[i], p1[i], p2[i], p3[i], t));
        } else {
            return [0, 1, 2].map(i => p1[i] + (p2[i] - p1[i]) * t);
        }
    }

    protected animate(player: PlayerObject): void {
        const delta = this.clock.getDelta();
        this.player = player; // Save player object for future

        const current_animation = this.animations[this.current_animation_name];

        const looped =
            this.force_loop !== undefined
                ? this.force_loop
                : current_animation.animation_loop;

        const looped_time = looped
            ? this._progress % current_animation.animation_length
            : this.clamp(this._progress, 0, current_animation.animation_length);

        for (const [bone, value] of Object.entries(current_animation.bones)) {
            if (value.rotation) {
                const keyframes_list =
                    current_animation.keyframes_list[bone].rotation;

                let insertion_rotation = this.findInsertPosition(
                    keyframes_list!.num,
                    looped_time
                );

                if (insertion_rotation === null)
                    insertion_rotation = keyframes_list!.num.length - 1;

                const curr = this.getCurrentKeyframe(
                    value.rotation,
                    keyframes_list!,
                    insertion_rotation,
                    looped_time
                ).map(MathUtils.degToRad);

                player.skin[bone as NormalizedBonesNames].setRotationFromEuler(
                    new Euler(curr[0], -curr[1], -curr[2], 'ZYX')
                );
            }

            if (value.position) {
                const keyframes_list =
                    current_animation.keyframes_list[bone].position;

                let insertion_rotation = this.findInsertPosition(
                    keyframes_list!.num,
                    looped_time
                );

                if (insertion_rotation === null)
                    insertion_rotation = keyframes_list!.num.length - 1;

                const curr = this.getCurrentKeyframe(
                    value.position,
                    keyframes_list!,
                    insertion_rotation,
                    looped_time
                );

                const defaults = defaultPositions[bone as NormalizedBonesNames];

                player.skin[bone as NormalizedBonesNames].position.x =
                    defaults[0] + curr[0];
                player.skin[bone as NormalizedBonesNames].position.y =
                    defaults[1] + curr[1];
                player.skin[bone as NormalizedBonesNames].position.z =
                    defaults[2] + -curr[2];

                if (bone === 'body' && this.connect_cape) {
                    const cape_defaults = defaultPositions['cape'];
                    player.cape.position.x = cape_defaults[0] + curr[0];
                    player.cape.position.y = cape_defaults[1] + curr[1];
                    player.cape.position.z = cape_defaults[2] + -curr[2];
                }
            }
        }

        const old_progress = this._progress;
        this._progress += delta;

        const animation_iteration = Math.floor(
            old_progress / current_animation.animation_length
        );
        if (animation_iteration > this.animation_iteration && looped) {
            this.animation_iteration = animation_iteration;
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
