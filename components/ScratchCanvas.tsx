import React, { useRef, useEffect, useState, useCallback } from 'react';
import { triggerHaptic } from '../utils';

interface ScratchCanvasProps {
  width: number;
  height: number;
  imageSrc: string;
  onScratchStart: () => void;
  onScratchEnd: () => void;
  onRevealComplete: () => void;
  onProgressUpdate?: (percentage: number) => void; // Phase 3: real-time progress
  isRevealed: boolean;
  brushSize?: number;
  revealThreshold?: number; // % threshold to auto-reveal
}

const ScratchCanvas: React.FC<ScratchCanvasProps> = ({
  width,
  height,
  imageSrc,
  onScratchStart,
  onScratchEnd,
  onRevealComplete,
  onProgressUpdate,
  isRevealed,
  brushSize = 25,
  revealThreshold = 95,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const animationFrameId = useRef<number | undefined>(undefined);

  // Debounce progress reporting: max once every 2s OR when progress jumps ≥10%
  const lastReportedProgress = useRef(0);
  const lastReportTime = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reportProgress = useCallback((percentage: number) => {
    if (!onProgressUpdate) return;

    const now = Date.now();
    const delta = percentage - lastReportedProgress.current;
    const timeSinceLastReport = now - lastReportTime.current;

    // Report immediately if ≥10% jump
    if (delta >= 10) {
      lastReportedProgress.current = percentage;
      lastReportTime.current = now;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      onProgressUpdate(percentage);
      return;
    }

    // Otherwise debounce to max once per 2s
    if (timeSinceLastReport >= 2000) {
      lastReportedProgress.current = percentage;
      lastReportTime.current = now;
      onProgressUpdate(percentage);
    } else {
      // Schedule a deferred report
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        lastReportedProgress.current = percentage;
        lastReportTime.current = Date.now();
        onProgressUpdate(percentage);
      }, 2000 - timeSinceLastReport);
    }
  }, [onProgressUpdate]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

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

    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, 0, 0, width, height);
      setIsLoaded(true);
      ctx.globalCompositeOperation = 'destination-out';
    };

    img.onerror = () => {
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

    // Report progress (debounced)
    reportProgress(percentage);

    // Auto-reveal at threshold
    if (percentage >= revealThreshold && !isRevealed) {
      onRevealComplete();
    }
  }, [isRevealed, onRevealComplete, reportProgress, revealThreshold]);

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