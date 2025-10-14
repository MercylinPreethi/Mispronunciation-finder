import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Circle, Path, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface ProgressTrailProps {
  startY: number;
  endY: number;
  progress: number; // 0 to 1
  color?: string;
}

interface ParticleProps {
  index: number;
  y: number;
  delay: number;
  color: string;
}

const AnimatedParticle: React.FC<ParticleProps> = ({ index, y, delay, color }) => {
  const translateX = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 40,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.8,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(1200),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(1200),
            Animated.timing(scale, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(1000),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, translateX, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          top: y,
          opacity,
          transform: [{ translateX }, { scale }],
        },
      ]}
    >
      <View style={[styles.particleDot, { backgroundColor: color }]} />
    </Animated.View>
  );
};

const ProgressTrail: React.FC<ProgressTrailProps> = ({
  startY,
  endY,
  progress,
  color = '#6366F1',
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);

  const currentProgressY = startY + (endY - startY) * progress;
  const trailHeight = currentProgressY - startY;

  // Create particles along the trail
  const numParticles = Math.floor(trailHeight / 100);
  const particles = [];
  for (let i = 0; i < numParticles; i++) {
    particles.push({
      index: i,
      y: startY + (trailHeight / numParticles) * i,
      delay: i * 500,
    });
  }

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, trailHeight],
  });

  return (
    <View style={[styles.container, { top: startY, height: endY - startY }]}>
      {/* Animated particles */}
      {particles.map((particle) => (
        <AnimatedParticle
          key={particle.index}
          index={particle.index}
          y={particle.y - startY}
          delay={particle.delay}
          color={color}
        />
      ))}

      {/* Trail SVG with gradient */}
      <Svg width={width} height={endY - startY} style={styles.svg}>
        <Defs>
          <SvgLinearGradient id="trailGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </SvgLinearGradient>
        </Defs>

        {/* Progress trail line */}
        <Path
          d={`M ${width / 2} 0 L ${width / 2} ${trailHeight}`}
          stroke="url(#trailGradient)"
          strokeWidth={6}
          strokeLinecap="round"
        />

        {/* Progress dots along the line */}
        {Array.from({ length: Math.floor(trailHeight / 50) }).map((_, index) => (
          <Circle
            key={index}
            cx={width / 2}
            cy={index * 50}
            r={3}
            fill={color}
            opacity={0.5}
          />
        ))}
      </Svg>

      {/* Shimmer effect */}
      <Animated.View
        style={[
          styles.shimmer,
          {
            top: shimmerTranslate,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    width: width,
    zIndex: 0,
  },
  svg: {
    position: 'absolute',
    left: 0,
  },
  particle: {
    position: 'absolute',
    left: width / 2,
  },
  particleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shimmer: {
    position: 'absolute',
    left: width / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
});

export default ProgressTrail;
