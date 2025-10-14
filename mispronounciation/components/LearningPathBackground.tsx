import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Polygon, G, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface FloatingElementProps {
  delay: number;
  duration: number;
  startY: number;
  startX: number;
  type: 'book' | 'star' | 'sparkle' | 'scroll';
}

const FloatingElement: React.FC<FloatingElementProps> = ({ delay, duration, startY, startX, type }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -30,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: duration / 4,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: duration / 4,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, duration, translateY, opacity, rotate]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderIcon = () => {
    switch (type) {
      case 'book':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M4 19.5C4 18.837 4.5 18 6 18h14v2H6c-1.5 0-2 .837-2 1.5S4.5 23 6 23h14v-2H6c-1.5 0-2-.837-2-1.5zM18 2H6c-1.5 0-2 .5-2 2v12.5c0 .837.5 1.5 2 1.5h12V2z"
              fill="#6366F1"
              opacity={0.6}
            />
          </Svg>
        );
      case 'star':
        return (
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Polygon
              points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8"
              fill="#FFC800"
              opacity={0.8}
            />
          </Svg>
        );
      case 'sparkle':
        return (
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path
              d="M8 0L9 7L16 8L9 9L8 16L7 9L0 8L7 7Z"
              fill="#EC4899"
              opacity={0.7}
            />
          </Svg>
        );
      case 'scroll':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zM8 6H4v2h4V6zm0 4H4v2h4v-2zm0 4H4v2h4v-2z"
              fill="#8B5CF6"
              opacity={0.6}
            />
          </Svg>
        );
    }
  };

  return (
    <Animated.View
      style={[
        styles.floatingElement,
        {
          top: startY,
          left: startX,
          opacity,
          transform: [{ translateY }, { rotate: rotateInterpolate }],
        },
      ]}
    >
      {renderIcon()}
    </Animated.View>
  );
};

const LearningPathBackground: React.FC = () => {
  // Create floating elements with varied delays and positions
  const floatingElements = [
    { type: 'book' as const, delay: 0, duration: 4000, startY: height * 0.2, startX: width * 0.15 },
    { type: 'star' as const, delay: 500, duration: 3500, startY: height * 0.35, startX: width * 0.75 },
    { type: 'sparkle' as const, delay: 1000, duration: 3000, startY: height * 0.5, startX: width * 0.2 },
    { type: 'scroll' as const, delay: 1500, duration: 4500, startY: height * 0.65, startX: width * 0.8 },
    { type: 'star' as const, delay: 2000, duration: 3800, startY: height * 0.8, startX: width * 0.3 },
    { type: 'sparkle' as const, delay: 2500, duration: 3200, startY: height * 0.95, startX: width * 0.7 },
    { type: 'book' as const, delay: 3000, duration: 4200, startY: height * 1.1, startX: width * 0.25 },
    { type: 'star' as const, delay: 500, duration: 3600, startY: height * 1.25, startX: width * 0.85 },
    { type: 'sparkle' as const, delay: 1200, duration: 3300, startY: height * 1.4, startX: width * 0.15 },
    { type: 'scroll' as const, delay: 1800, duration: 4000, startY: height * 1.55, startX: width * 0.65 },
  ];

  return (
    <View style={styles.container}>
      {/* Base gradient background */}
      <LinearGradient
        colors={['#EEF2FF', '#F8F9FE', '#FDF2F8', '#F5F3FF', '#EFF6FF']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={styles.gradientBackground}
      />

      {/* Decorative SVG elements */}
      <Svg width={width} height={height * 2.5} style={styles.svgBackground}>
        <Defs>
          <RadialGradient id="glow1" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow2" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#EC4899" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow3" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient glows positioned along the path */}
        <Circle cx={width * 0.5} cy={height * 0.3} r={120} fill="url(#glow1)" />
        <Circle cx={width * 0.3} cy={height * 0.6} r={100} fill="url(#glow2)" />
        <Circle cx={width * 0.7} cy={height * 0.9} r={110} fill="url(#glow3)" />
        <Circle cx={width * 0.5} cy={height * 1.2} r={120} fill="url(#glow1)" />
        <Circle cx={width * 0.4} cy={height * 1.5} r={100} fill="url(#glow2)" />
        <Circle cx={width * 0.6} cy={height * 1.8} r={110} fill="url(#glow3)" />
        <Circle cx={width * 0.5} cy={height * 2.1} r={120} fill="url(#glow1)" />

        {/* Decorative path accents - wavy trails */}
        <Path
          d={`M ${width * 0.1} ${height * 0.15} Q ${width * 0.3} ${height * 0.25}, ${width * 0.5} ${height * 0.35} T ${width * 0.9} ${height * 0.55}`}
          stroke="#6366F1"
          strokeWidth={2}
          fill="none"
          opacity={0.1}
          strokeDasharray="10,5"
        />
        <Path
          d={`M ${width * 0.9} ${height * 0.7} Q ${width * 0.7} ${height * 0.8}, ${width * 0.5} ${height * 0.9} T ${width * 0.1} ${height * 1.1}`}
          stroke="#EC4899"
          strokeWidth={2}
          fill="none"
          opacity={0.1}
          strokeDasharray="10,5"
        />
        <Path
          d={`M ${width * 0.1} ${height * 1.3} Q ${width * 0.3} ${height * 1.4}, ${width * 0.5} ${height * 1.5} T ${width * 0.9} ${height * 1.7}`}
          stroke="#8B5CF6"
          strokeWidth={2}
          fill="none"
          opacity={0.1}
          strokeDasharray="10,5"
        />
        <Path
          d={`M ${width * 0.9} ${height * 1.9} Q ${width * 0.7} ${height * 2.0}, ${width * 0.5} ${height * 2.1} T ${width * 0.1} ${height * 2.3}`}
          stroke="#10B981"
          strokeWidth={2}
          fill="none"
          opacity={0.1}
          strokeDasharray="10,5"
        />

        {/* Static decorative icons scattered around */}
        {/* Book icons */}
        <G opacity={0.08}>
          <Path
            d="M40 100 L50 100 L50 120 L40 120 Z M42 102 L48 102 L48 108 L42 108 Z"
            fill="#6366F1"
          />
          <Path
            d={`M${width - 60} 200 L${width - 50} 200 L${width - 50} 220 L${width - 60} 220 Z M${width - 58} 202 L${width - 52} 202 L${width - 52} 208 L${width - 58} 208 Z`}
            fill="#8B5CF6"
          />
        </G>

        {/* Star icons */}
        <G opacity={0.1}>
          <Polygon
            points={`${width * 0.85},${height * 0.4} ${width * 0.86},${height * 0.42} ${width * 0.88},${height * 0.42} ${width * 0.865},${height * 0.435} ${width * 0.87},${height * 0.45} ${width * 0.85},${height * 0.44} ${width * 0.83},${height * 0.45} ${width * 0.835},${height * 0.435} ${width * 0.82},${height * 0.42} ${width * 0.84},${height * 0.42}`}
            fill="#FFC800"
          />
          <Polygon
            points={`${width * 0.15},${height * 0.75} ${width * 0.16},${height * 0.77} ${width * 0.18},${height * 0.77} ${width * 0.165},${height * 0.785} ${width * 0.17},${height * 0.8} ${width * 0.15},${height * 0.79} ${width * 0.13},${height * 0.8} ${width * 0.135},${height * 0.785} ${width * 0.12},${height * 0.77} ${width * 0.14},${height * 0.77}`}
            fill="#FFC800"
          />
        </G>

        {/* Scroll/Paper icons */}
        <G opacity={0.08}>
          <Path
            d={`M${width * 0.25} ${height * 1.0} L${width * 0.35} ${height * 1.0} L${width * 0.35} ${height * 1.05} L${width * 0.25} ${height * 1.05} Z`}
            fill="#EC4899"
          />
          <Path
            d={`M${width * 0.7} ${height * 1.35} L${width * 0.8} ${height * 1.35} L${width * 0.8} ${height * 1.4} L${width * 0.7} ${height * 1.4} Z`}
            fill="#6366F1"
          />
        </G>

        {/* Sparkle/Achievement stars */}
        <G opacity={0.12}>
          <Path
            d={`M${width * 0.6} ${height * 0.55} L${width * 0.61} ${height * 0.57} L${width * 0.63} ${height * 0.57} L${width * 0.61} ${height * 0.58} L${width * 0.6} ${height * 0.55} Z`}
            fill="#10B981"
          />
          <Path
            d={`M${width * 0.35} ${height * 1.15} L${width * 0.36} ${height * 1.17} L${width * 0.38} ${height * 1.17} L${width * 0.36} ${height * 1.18} L${width * 0.35} ${height * 1.15} Z`}
            fill="#F59E0B"
          />
          <Path
            d={`M${width * 0.8} ${height * 1.75} L${width * 0.81} ${height * 1.77} L${width * 0.83} ${height * 1.77} L${width * 0.81} ${height * 1.78} L${width * 0.8} ${height * 1.75} Z`}
            fill="#EC4899"
          />
        </G>
      </Svg>

      {/* Animated floating elements */}
      {floatingElements.map((element, index) => (
        <FloatingElement
          key={index}
          type={element.type}
          delay={element.delay}
          duration={element.duration}
          startY={element.startY}
          startX={element.startX}
        />
      ))}

      {/* Subtle overlay pattern for texture */}
      <View style={styles.patternOverlay} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svgBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  floatingElement: {
    position: 'absolute',
    zIndex: 1,
  },
  patternOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    opacity: 0.03,
  },
});

export default LearningPathBackground;
