import { NormalizedBonesNames } from './types';

export const defaultPositions: Record<NormalizedBonesNames, number[]> = {
    head: [0, 0, 0],
    body: [0, -6, 0],
    rightArm: [-5, -2, 0],
    leftArm: [5, -2, 0],
    rightLeg: [-1.9, -12, -0.1],
    leftLeg: [1.9, -12, -0.1]
};

export const defaultBonesOverrides: Record<string, NormalizedBonesNames> = {
    Head: 'head',
    Body: 'body',
    RightArm: 'rightArm',
    LeftArm: 'leftArm',
    RightLeg: 'rightLeg',
    LeftLeg: 'leftLeg'
};
