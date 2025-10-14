import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Polygon, G } from 'react-native-svg';

interface MilestoneMarkerProps {
  x: number;
  y: number;
  type: 'achievement' | 'checkpoint' | 'milestone';
  isUnlocked?: boolean;
}

const MilestoneMarker: React.FC<MilestoneMarkerProps> = ({
  x,
  y,
  type,
  isUnlocked = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isUnlocked) {
      // Breathing/pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.5,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotation for achievement badge
      if (type === 'achievement') {
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 8000,
            useNativeDriver: true,
          })
        ).start();
      }
    }
  }, [isUnlocked, scaleAnim, glowAnim, rotateAnim, type]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderMarker = () => {
    switch (type) {
      case 'achievement':
        return (
          <Svg width={50} height={50} viewBox="0 0 50 50">
            <G>
              {/* Outer glow */}
              <Circle
                cx={25}
                cy={25}
                r={24}
                fill={isUnlocked ? '#FFC800' : '#CBD5E1'}
                opacity={0.2}
              />
              {/* Star badge */}
              <Polygon
                points="25,5 28,18 42,18 31,26 35,40 25,32 15,40 19,26 8,18 22,18"
                fill={isUnlocked ? '#FFC800' : '#94A3B8'}
                stroke={isUnlocked ? '#F59E0B' : '#64748B'}
                strokeWidth={2}
              />
              {/* Center highlight */}
              <Circle
                cx={25}
                cy={22}
                r={6}
                fill="white"
                opacity={isUnlocked ? 0.6 : 0.3}
              />
            </G>
          </Svg>
        );

      case 'checkpoint':
        return (
          <Svg width={40} height={40} viewBox="0 0 40 40">
            <G>
              {/* Flag pole */}
              <Path
                d="M10 35 L10 8"
                stroke={isUnlocked ? '#6366F1' : '#94A3B8'}
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* Flag */}
              <Path
                d="M10 8 L30 13 L10 18 Z"
                fill={isUnlocked ? '#6366F1' : '#CBD5E1'}
                stroke={isUnlocked ? '#4F46E5' : '#94A3B8'}
                strokeWidth={2}
              />
              {/* Base */}
              <Circle
                cx={10}
                cy={35}
                r={4}
                fill={isUnlocked ? '#4F46E5' : '#94A3B8'}
              />
            </G>
          </Svg>
        );

      case 'milestone':
        return (
          <Svg width={45} height={45} viewBox="0 0 45 45">
            <G>
              {/* Outer ring */}
              <Circle
                cx={22.5}
                cy={22.5}
                r={20}
                fill="none"
                stroke={isUnlocked ? '#8B5CF6' : '#CBD5E1'}
                strokeWidth={3}
              />
              {/* Inner fill */}
              <Circle
                cx={22.5}
                cy={22.5}
                r={16}
                fill={isUnlocked ? '#8B5CF6' : '#E2E8F0'}
                opacity={0.8}
              />
              {/* Trophy icon */}
              <Path
                d="M15 12 L15 18 Q15 23 22.5 23 Q30 23 30 18 L30 12 Z M12 12 L12 15 Q12 16 15 16 M33 12 L33 15 Q33 16 30 16 M20 23 L20 28 M25 23 L25 28 M17 28 L28 28"
                stroke={isUnlocked ? 'white' : '#94A3B8'}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          </Svg>
        );
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: x - 25,
          top: y - 25,
          transform: [
            { scale: scaleAnim },
            { rotate: type === 'achievement' ? rotateInterpolate : '0deg' },
          ],
        },
      ]}
    >
      {isUnlocked && (
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowAnim,
            },
          ]}
        >
          <LinearGradient
            colors={
              type === 'achievement'
                ? ['#FFC800', '#F59E0B']
                : type === 'checkpoint'
                ? ['#6366F1', '#8B5CF6']
                : ['#8B5CF6', '#EC4899']
            }
            style={styles.glowGradient}
          />
        </Animated.View>
      )}
      <View style={styles.markerContent}>{renderMarker()}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  glow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    top: -10,
    left: -10,
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    opacity: 0.3,
  },
  markerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

export default MilestoneMarker;
