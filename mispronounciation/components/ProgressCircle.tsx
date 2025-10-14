import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface ProgressCircleProps {
  size: number;
  accuracy: number; // 0-1
  strokeWidth?: number;
  backgroundColor?: string;
  progressColor?: string;
  showPercentage?: boolean;
}

const ProgressCircle: React.FC<ProgressCircleProps> = ({
  size,
  accuracy,
  strokeWidth = 8,
  backgroundColor = '#E2E8F0',
  progressColor = '#6366F1',
  showPercentage = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(accuracy, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);

  // Calculate pie chart path
  const center = size / 2;
  const pieRadius = radius;
  
  // Convert progress to angle (0-360 degrees)
  const angle = progress * 360;
  const radians = (angle - 90) * (Math.PI / 180); // Start from top (-90 degrees)
  
  // Calculate end point of the arc
  const endX = center + pieRadius * Math.cos(radians);
  const endY = center + pieRadius * Math.sin(radians);
  
  // Determine if we need a large arc (>180 degrees)
  const largeArcFlag = angle > 180 ? 1 : 0;
  
  // Create pie slice path
  const piePath = progress > 0
    ? `M ${center} ${center} L ${center} ${center - pieRadius} A ${pieRadius} ${pieRadius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
    : '';

  const percentage = Math.round(progress * 100);
  
  // Determine color based on accuracy
  const getProgressColor = () => {
    if (accuracy >= 0.9) return '#10B981'; // success green
    if (accuracy >= 0.8) return '#6366F1'; // primary blue
    if (accuracy >= 0.7) return '#F59E0B'; // warning orange
    return '#EF4444'; // error red
  };

  const finalProgressColor = progressColor === '#6366F1' ? getProgressColor() : progressColor;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle with subtle gradient effect */}
        <Circle
          cx={center}
          cy={center}
          r={pieRadius}
          fill={backgroundColor}
          opacity={0.3}
        />
        
        {/* Progress pie slice */}
        {progress > 0 && (
          <Path
            d={piePath}
            fill={finalProgressColor}
            opacity={0.95}
          />
        )}
        
        {/* Inner white circle to create ring effect with slight shadow */}
        <Circle
          cx={center}
          cy={center}
          r={pieRadius * 0.68}
          fill="white"
          opacity={1}
        />
      </Svg>
      
      {showPercentage && (
        <View style={styles.percentageContainer}>
          <Text style={[styles.percentageText, { color: finalProgressColor, fontSize: size * 0.24 }]}>
            {percentage}%
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  percentageContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontWeight: '900',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default ProgressCircle;
