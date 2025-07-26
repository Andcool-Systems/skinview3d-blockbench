'use client';

import { useEffect, useRef } from 'react';
import { SkinViewer } from 'skinview3d';
import { BlockbenchAnimationProvider } from './BlockbenchAnimationProvider/BlockbenchAnimationProvider';
import bb_anim from '@/app/model.animation.json';

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const viewer = new SkinViewer({
            canvas: canvasRef.current,
            width: 500,
            height: 500,
            skin: '/skin.png',
            panorama: '/panorama.png'
        });

        canvasRef.current.width = 500;
        canvasRef.current.height = 500;

        viewer.animation = new BlockbenchAnimationProvider({
            animation: bb_anim,
            animationName: '1_anim2'
        });
    }, []);

    return (
        <div>
            <canvas ref={canvasRef} />
        </div>
    );
}
