import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

interface PathDecorationsProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  difficulty: 'easy' | 'intermediate' | 'hard';
  isActive?: boolean;
  isCompleted?: boolean;
}

const PathDecorations: React.FC<PathDecorationsProps> = ({
  startX,
  startY,
  endX,
  endY,
  difficulty,
  isActive = false,
  isCompleted = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      // Pulsing animation for active path
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }

    if (isCompleted) {
      // Shimmer animation for completed path
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [isActive, isCompleted, pulseAnim, shimmerAnim]);

  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'easy':
        return { primary: '#10B981', secondary: '#D1FAE5', glow: 'rgba(16, 185, 129, 0.3)' };
      case 'intermediate':
        return { primary: '#F59E0B', secondary: '#FEF3C7', glow: 'rgba(245, 158, 11, 0.3)' };
      case 'hard':
        return { primary: '#EF4444', secondary: '#FEE2E2', glow: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { primary: '#6366F1', secondary: '#EEF2FF', glow: 'rgba(99, 102, 241, 0.3)' };
    }
  };

  const colors = getDifficultyColor();
  const angle = Math.atan2(endY - startY, endX - startX);
  const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

  // Calculate control points for smooth curve
  const controlOffset = 50;
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const perpAngle = angle + Math.PI / 2;
  const controlX = midX + Math.cos(perpAngle) * controlOffset;
  const controlY = midY + Math.sin(perpAngle) * controlOffset;

  // Create decorative dots along the path
  const numDots = Math.floor(distance / 30);
  const dots = [];
  for (let i = 0; i < numDots; i++) {
    const t = i / numDots;
    // Quadratic Bezier curve formula
    const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX;
    const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY;
    dots.push({ x, y, delay: i * 200 });
  }

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, distance],
  });

  return (
    <View style={[styles.container, { 
      left: Math.min(startX, endX) - 50, 
      top: Math.min(startY, endY) - 50,
      width: Math.abs(endX - startX) + 100,
      height: Math.abs(endY - startY) + 100,
    }]}>
      <Svg width="100%" height="100%" style={styles.svg}>
        <G>
          {/* Base path with glow */}
          <Path
            d={`M ${startX - Math.min(startX, endX) + 50} ${startY - Math.min(startY, endY) + 50} Q ${controlX - Math.min(startX, endX) + 50} ${controlY - Math.min(startY, endY) + 50} ${endX - Math.min(startX, endX) + 50} ${endY - Math.min(startY, endY) + 50}`}
            stroke={colors.glow}
            strokeWidth={isActive ? 16 : 12}
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Main path */}
          <Path
            d={`M ${startX - Math.min(startX, endX) + 50} ${startY - Math.min(startY, endY) + 50} Q ${controlX - Math.min(startX, endX) + 50} ${controlY - Math.min(startY, endY) + 50} ${endX - Math.min(startX, endX) + 50} ${endY - Math.min(startY, endY) + 50}`}
            stroke={isCompleted ? colors.primary : colors.secondary}
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            opacity={isCompleted ? 0.9 : 0.5}
          />

          {/* Decorative dots along the path */}
          {isCompleted && dots.map((dot, index) => (
            <Circle
              key={index}
              cx={dot.x - Math.min(startX, endX) + 50}
              cy={dot.y - Math.min(startY, endY) + 50}
              r={3}
              fill={colors.primary}
              opacity={0.6}
            />
          ))}
        </G>
      </Svg>

      {/* Animated shimmer effect for completed paths */}
      {isCompleted && (
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerTranslate }],
              backgroundColor: colors.primary,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1,
  },
  svg: {
    position: 'absolute',
  },
  shimmer: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.4,
  },
});

export default PathDecorations;
