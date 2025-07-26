export interface BlockbenchAnimationProviderProps {
    /** Animation object/json */
    animation: AnimationFileType;

    /**
     * Name of animation to play
     *
     * Playing first if not specified
     */
    animationName?: string;

    /**
     * Overrides for bones names
     *
     * If not specified using LeftLeg, Head, etc.
     */
    bonesOverrides?: BonesOverrides;
}

/** Overrides for bones names */
export interface BonesOverrides {
    head?: string;
    body?: string;
    leftLeg?: string;
    leftArm?: string;
    rightLeg?: string;
    rightArm?: string;
}

/** Type of .json animation file */
export interface AnimationFileType {
    format_version: string;
    animations: { [anim_name: string]: AnimationsObject };
}

/** Type of single animation */
export interface AnimationsObject {
    loop: boolean;
    animation_length: number;
    bones: { [bone: string]: BonesAnimation<KeyframeValue> };
}

export type KeyframeValue = number[] | ExtendedKeyframe;

/** Type of bone animation */
export interface BonesAnimation<V = ExtendedKeyframe> {
    rotation?: Record<string, V>;
    position?: Record<string, V>;
}

export interface ExtendedKeyframe {
    pre?: number[];
    post?: number[];
    lerp_mode: string;
}

export type NormalizedBonesNames =
    | 'head'
    | 'body'
    | 'leftArm'
    | 'rightArm'
    | 'leftLeg'
    | 'rightLeg';
