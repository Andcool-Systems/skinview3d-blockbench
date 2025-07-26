import { PlayerAnimation, PlayerObject } from 'skinview3d';
import {
    AnimationsObject,
    BlockbenchAnimationProviderProps,
    BonesAnimation,
    BonesOverrides,
    ExtendedKeyframe,
    KeyframeValue,
    NormalizedBonesNames
} from './types';

import { Euler, MathUtils } from 'three';
import { easeInOutQuad } from './lerp';
import { defaultBonesOverrides, defaultPositions } from './defaults';

/** Provider for bedrock .animation.json files */
export class BlockbenchAnimationProvider extends PlayerAnimation {
    config_params: BlockbenchAnimationProviderProps;
    animation: AnimationsObject;
    bones: Record<NormalizedBonesNames, BonesAnimation<ExtendedKeyframe>>;

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
            throw Error('Animation name not specified and no animation found');

        this.animation = this.config_params.animation.animations[animation_name];

        for (const [bone, value] of Object.entries(this.animation.bones)) {
            let normalizedBoneName = undefined;
            if (bone in defaultBonesOverrides) {
                normalizedBoneName = defaultBonesOverrides[bone];
            }

            if (
                this.config_params.bonesOverrides &&
                Object.values(this.config_params.bonesOverrides).includes(bone)
            ) {
                normalizedBoneName = Object.entries(
                    this.config_params.bonesOverrides
                )
                    .find(([, v]) => v === bone)
                    ?.at(0);
            }

            if (!normalizedBoneName) throw Error(`Found unknown bone: ${bone}`);

            this.bones[normalizedBoneName as keyof BonesOverrides] = {
                position: this.convertKeyframe(value.position),
                rotation: this.convertKeyframe(value.rotation)
            };
        }
    }

    private getCurrentKeyframe(
        value: Record<string, ExtendedKeyframe>,
        keyframes_list_str: string[],
        insertion: number,
        looped_time: number
    ) {
        const keyframes_list = keyframes_list_str.map(parseFloat);
        const next_insertion = (insertion + 1) % keyframes_list.length;

        const keyframe_start = keyframes_list[insertion];
        const keyframe_end = keyframes_list[next_insertion];

        const keyframe_progress =
            (looped_time - keyframe_start) / Math.abs(keyframe_end - keyframe_start);

        const prev_target = value[keyframes_list_str[insertion]];
        const target = value[keyframes_list_str[next_insertion]];

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
        const looped_time = this.progress % this.animation.animation_length;

        for (const [bone, value] of Object.entries(this.bones)) {
            if (value.rotation) {
                const rot = value.rotation;
                const keyframes_list_str = Object.keys(rot);
                const keyframes_list = keyframes_list_str.map(parseFloat);

                let insertion_rotation = this.findInsertPosition(
                    keyframes_list,
                    looped_time
                );

                if (insertion_rotation === null)
                    insertion_rotation = keyframes_list.length - 1;

                const curr = this.getCurrentKeyframe(
                    value.rotation,
                    keyframes_list_str,
                    insertion_rotation,
                    looped_time
                ).map(MathUtils.degToRad);

                player.skin[bone as NormalizedBonesNames].setRotationFromEuler(
                    new Euler(curr[0], -curr[1], -curr[2], 'ZYX')
                );
            }

            if (value.position) {
                const rot = value.position;
                const keyframes_list_str = Object.keys(rot);
                const keyframes_list = keyframes_list_str.map(parseFloat);

                let insertion_rotation = this.findInsertPosition(
                    keyframes_list,
                    looped_time
                );

                if (insertion_rotation === null)
                    insertion_rotation = keyframes_list.length - 1;

                const curr = this.getCurrentKeyframe(
                    value.position,
                    keyframes_list_str,
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
            }
        }
    }

    private findInsertPosition(arr: number[], target: number): number | null {
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] <= target && arr[i + 1] >= target) return i;
        }

        return null;
    }
}
