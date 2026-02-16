import React, { useRef, useEffect, useState, useCallback } from 'react';
import { triggerHaptic } from '../utils';

interface ScratchCanvasProps {
  width: number;
  height: number;
  imageSrc: string; // New prop for cover image
  onScratchStart: () => void;
  onScratchEnd: () => void;
  onRevealComplete: () => void;
  isRevealed: boolean;
  brushSize?: number;
}

const ScratchCanvas: React.FC<ScratchCanvasProps> = ({
  width,
  height,
  imageSrc,
  onScratchStart,
  onScratchEnd,
  onRevealComplete,
  isRevealed,
  brushSize = 25,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const animationFrameId = useRef<number>();

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Load Image
    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      // Draw the image to fill the canvas
      // We use 'cover' logic to maintain aspect ratio if needed, or fill
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, 0, 0, width, height);
      setIsLoaded(true);

      // Setup for scratching
      ctx.globalCompositeOperation = 'destination-out';
    };

    img.onerror = () => {
      // Fallback if image fails
      ctx.fillStyle = '#C0C0C0';
      ctx.fillRect(0, 0, width, height);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#000';
      ctx.fillText('Scratch Here', width / 2 - 50, height / 2);
      setIsLoaded(true);
      ctx.globalCompositeOperation = 'destination-out';
    };

  }, [width, height, imageSrc]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  useEffect(() => {
    if (isRevealed && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.style.transition = 'opacity 0.8s ease-out';
      canvas.style.opacity = '0';
      setTimeout(() => {
        canvas.style.display = 'none';
      }, 800);
    }
  }, [isRevealed]);

  const checkScratchPercentage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Check every 15th pixel to be lighter on CPU
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    let clearPixels = 0;
    const step = 15;
    const totalPixelsChecked = (data.length / 4) / step;

    for (let i = 0; i < data.length; i += step * 4) {
      if (data[i + 3] === 0) {
        clearPixels++;
      }
    }

    const percentage = (clearPixels / totalPixelsChecked) * 100;

    // Changed threshold to 1% for testing
    if (percentage > 1 && !isRevealed) {
      onRevealComplete();
    }
  }, [isRevealed, onRevealComplete]);

  const scratch = useCallback((x: number, y: number) => {
    if (!isLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    if (lastPoint.current) {
      ctx.beginPath();
      ctx.lineWidth = brushSize * 2;
      ctx.lineCap = 'round';
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    lastPoint.current = { x, y };

    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
        checkScratchPercentage();
        animationFrameId.current = undefined;
      });
    }
  }, [brushSize, checkScratchPercentage, isLoaded]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    lastPoint.current = null;
    onScratchStart();
    triggerHaptic(5);
  };

  const handleEnd = () => {
    setIsDrawing(false);
    lastPoint.current = null;
    onScratchEnd();
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      triggerHaptic(2);
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    scratch(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 cursor-crosshair touch-none rounded-xl z-20"
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseMove={handleMove}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchMove={handleMove}
      style={{ touchAction: 'none' }}
    />
  );
};

export default ScratchCanvas;