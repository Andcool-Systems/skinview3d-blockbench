import { NormalizedBonesNames } from './types';

export const defaultPositions: Record<NormalizedBonesNames | 'cape', number[]> = {
    head: [0, 0, 0],
    body: [0, -6, 0],
    rightArm: [-5, -2, 0],
    leftArm: [5, -2, 0],
    rightLeg: [-1.9, -12, -0.1],
    leftLeg: [1.9, -12, -0.1],
    cape: [0, 8, -2],
    torso: [0, 0, 0],
    all: [0, 0, 0]
};

export const defaultBonesOverrides: Record<string, NormalizedBonesNames> = {
    Head: 'head',
    Body: 'body',
    RightArm: 'rightArm',
    LeftArm: 'leftArm',
    RightLeg: 'rightLeg',
    LeftLeg: 'leftLeg',
    All: 'all',
    Torso: 'torso'
};
