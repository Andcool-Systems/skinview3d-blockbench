import { PlayerAnimation, PlayerObject } from 'skinview3d';
import {
    AnimationsObject,
    BlockbenchAnimationProviderProps,
    BonesAnimation,
    BonesOverrides,
    ExtendedKeyframe,
    KeyframesList,
    KeyframeValue,
    NormalizedBonesNames,
    SingleKeyframeListItem
} from './types';

import { Euler, MathUtils, Vector3 } from 'three';
import { easeInOutQuad } from './lerp';
import { defaultBonesOverrides, defaultPositions } from './defaults';

/** Provider for bedrock .animation.json files */
export class SkinViewBlockbench extends PlayerAnimation {
    config_params: BlockbenchAnimationProviderProps;
    animation: AnimationsObject;
    bones: Record<NormalizedBonesNames, BonesAnimation<ExtendedKeyframe>>;
    keyframes_list: Record<string, KeyframesList>;

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

        this.keyframes_list = {};
        this.config_params = params;
        this.bones = {
            head: {},
            body: {},
            leftArm: {},
            rightArm: {},
            leftLeg: {},
            rightLeg: {}
        };

        const animation_name =
            params.animationName ?? Object.keys(params.animation.animations).at(0);

        if (!animation_name)
            throw Error('Animation name not specified or no animation found');

        this.animation = this.config_params.animation.animations[animation_name];

        for (const [bone, value] of Object.entries(this.animation.bones)) {
            let normalizedBoneName = undefined;
            if (bone in defaultBonesOverrides) {
                normalizedBoneName = defaultBonesOverrides[bone];
            }

            const overrides = this.config_params.bonesOverrides;
            if (overrides && Object.values(overrides).includes(bone)) {
                normalizedBoneName = Object.entries(overrides)
                    .find(([, v]) => v === bone)
                    ?.at(0);
            }

            if (!normalizedBoneName) throw Error(`Found unknown bone: ${bone}`);

            this.bones[normalizedBoneName as keyof BonesOverrides] = {
                position: this.convertKeyframe(value.position),
                rotation: this.convertKeyframe(value.rotation)
            };

            const rotation_keys = Object.keys(value.rotation ?? {});
            const position_keys = Object.keys(value.position ?? {});
            this.keyframes_list[normalizedBoneName] = {
                rotation: { str: rotation_keys, num: rotation_keys.map(parseFloat) },
                position: {
                    str: position_keys,
                    num: position_keys.map(parseFloat)
                }
            };
        }
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
        const next_insertion = (insertion + 1) % keyframes_list!.num.length;

        const keyframe_start = keyframes_list!.num[insertion];
        const keyframe_end = keyframes_list!.num[next_insertion];

        const keyframe_progress =
            (looped_time - keyframe_start) / Math.abs(keyframe_end - keyframe_start);

        const prev_target = value[keyframes_list!.str[insertion]];
        const target = value[keyframes_list!.str[next_insertion]];

        let progress = keyframe_progress;
        if (target.lerp_mode === 'catmullrom') {
            progress = easeInOutQuad(keyframe_progress);
        }

        return Array.from({ length: 3 }, (_, i) => {
            const prev_t = prev_target.post![i];
            const target_t = target.post![i];
            return prev_t + (target_t - prev_t) * progress;
        });
    }

    protected animate(player: PlayerObject): void {
        const looped =
            this.config_params.forceLoop !== undefined
                ? this.config_params.forceLoop
                : this.animation.loop;

        const looped_time = looped
            ? this.progress % this.animation.animation_length
            : this.clamp(this.progress, 0, this.animation.animation_length);

        for (const [bone, value] of Object.entries(this.bones)) {
            if (value.rotation) {
                const keyframes_list = this.keyframes_list[bone].rotation;

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
                const keyframes_list = this.keyframes_list[bone].position;

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

                if (bone === 'body' && this.config_params.connectCape) {
                    const cape_defaults = defaultPositions['cape'];
                    player.cape.position.x = cape_defaults[0] + curr[0];
                    player.cape.position.y = cape_defaults[1] + curr[1];
                    player.cape.position.z = cape_defaults[2] + -curr[2];
                }
            }
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
