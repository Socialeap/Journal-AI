
import React from 'react';

interface VoiceVisualizerProps {
    volume: number; // 0.0 to 1.0
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ volume }) => {
    // Amplify volume for better visual feedback, cap at 1
    const visualVolume = Math.min(1, volume * 8); 

    // Generate bar heights dynamically
    const getBarStyle = (index: number) => {
        // Center bar is tallest, outer bars are shorter
        const scaleFactors = [0.6, 1, 0.6]; 
        const minHeight = 20; // minimum % height
        const variableHeight = 80; // variable % height
        
        const height = minHeight + (visualVolume * variableHeight * scaleFactors[index]);
        
        return {
            height: `${height}%`,
            opacity: 0.5 + (visualVolume * 0.5) // Opacity also reacts to volume
        };
    };

    return (
        <div className="flex items-center justify-center space-x-1.5 h-full w-full">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="w-2 bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-75 ease-out"
                    style={getBarStyle(i)}
                />
            ))}
        </div>
    );
};
