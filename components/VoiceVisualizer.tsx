
import React, { useRef, useEffect, useState } from 'react';

interface VoiceVisualizerProps {
  analyserNode: AnalyserNode | null;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // This effect observes the parent element and resizes the canvas accordingly.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries && entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        // Set the canvas rendering size to match the element's display size
        canvas.width = width;
        canvas.height = height;
        // Update state to trigger re-calculation of particle properties
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(parent);
    return () => resizeObserver.disconnect();
  }, []);

  // This effect handles the drawing of the animation.
  // It reruns if the analyserNode or canvas dimensions change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Parameters for the circular "sand" visualization
    const NUM_PARTICLES = 3000;
    const PARTICLE_SIZE = 1.5;
    const { width, height } = dimensions;
    const MAX_RADIUS = Math.min(width, height) / 2 * 0.7;
    const BASE_RADIUS_MIN = MAX_RADIUS * 0.6;
    const DISPLACEMENT_STRENGTH = 0.8; 
    const TWO_PI = Math.PI * 2;

    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
        angle: Math.random() * TWO_PI,
        baseRadius: BASE_RADIUS_MIN + Math.random() * (MAX_RADIUS - BASE_RADIUS_MIN),
        speed: (Math.random() - 0.5) * 0.002,
    }));

    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      const centerX = width / 2;
      const centerY = height / 2;
      
      canvasCtx.clearRect(0, 0, width, height);

      const gradient = canvasCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, MAX_RADIUS);
      gradient.addColorStop(0, '#60a5fa');
      gradient.addColorStop(1, '#2563eb');
      canvasCtx.fillStyle = gradient;

      const energyBins = Math.floor(bufferLength / 3);
      let energySum = 0;
      for (let i = 0; i < energyBins; i++) {
        energySum += dataArray[i];
      }
      const avgEnergy = energyBins > 0 ? energySum / energyBins : 0;
      const normalizedEnergy = avgEnergy / 255.0;

      // FIX: Implement a continuous "breathing" animation for the idle state
      // by using a time-based sine wave.
      const time = Date.now() * 0.001; // Time in seconds
      const idlePulse = (Math.sin(time * 2) + 1) / 2; // Oscillates smoothly between 0 and 1
      const idleDisplacement = idlePulse * MAX_RADIUS * 0.03; // A small, gentle pulse

      particles.forEach(p => {
        p.angle += p.speed;

        const voiceDisplacement = Math.pow(normalizedEnergy, 2) * MAX_RADIUS * DISPLACEMENT_STRENGTH;
        
        // The total displacement is the idle pulse plus the voice-driven pulse.
        // When the AI speaks, voiceDisplacement will dominate. When silent, idleDisplacement is visible.
        const totalDisplacement = idleDisplacement + voiceDisplacement;
        const currentRadius = p.baseRadius + totalDisplacement;
        
        const baseX = centerX + Math.cos(p.angle) * currentRadius;
        const baseY = centerY + Math.sin(p.angle) * currentRadius;

        // Jitter strength is now based on a combination of idle state and voice energy
        const combinedEnergyForJitter = Math.max(0.1, normalizedEnergy); // Ensures a minimum jitter
        const jitterStrength = combinedEnergyForJitter * 4;
        const jitterX = (Math.random() - 0.5) * jitterStrength;
        const jitterY = (Math.random() - 0.5) * jitterStrength;

        const x = baseX + jitterX;
        const y = baseY + jitterY;

        canvasCtx.fillRect(x, y, PARTICLE_SIZE, PARTICLE_SIZE);
      });
    };

    draw();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyserNode, dimensions]);

  return (
    <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full opacity-0 data-[active=true]:opacity-100 transition-opacity duration-500" 
        data-active={analyserNode !== null}
    />
  );
};
