// components/PhonemeVisualization.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

const COLORS = {
  success: '#10B981',
  error: '#EF4444',
  gray: {
    100: '#F1F5F9',
    400: '#94A3B8',
    600: '#475569',
    800: '#1E293B',
  },
  white: '#FFFFFF',
};

interface PhonemeVisualizationProps {
  referencePhonemes: string[];
  predictedPhonemes: string[];
  alignedReference?: string[];
  alignedPredicted?: string[];
  showLabel?: boolean;
  animated?: boolean;
}

export default function PhonemeVisualization({
  referencePhonemes,
  predictedPhonemes,
  alignedReference,
  alignedPredicted,
  showLabel = true,
  animated = true,
}: PhonemeVisualizationProps) {
  const phonemeAnims = useRef<Animated.Value[]>([]).current;

  // Use aligned phonemes if available, otherwise use regular phonemes
  const refPhonemes = alignedReference || referencePhonemes || [];
  const predPhonemes = alignedPredicted || predictedPhonemes || [];
  
  // Initialize animations
  useEffect(() => {
    phonemeAnims.length = 0;
    refPhonemes.forEach(() => {
      phonemeAnims.push(new Animated.Value(0));
    });
    
    if (animated) {
      // Stagger animation
      Animated.stagger(50, 
        phonemeAnims.map(anim => 
          Animated.timing(anim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          })
        )
      ).start();
    } else {
      phonemeAnims.forEach(anim => anim.setValue(1));
    }
  }, [refPhonemes.length]);

  const getPhonemeStatus = (index: number): 'correct' | 'incorrect' | 'missing' => {
    if (index >= refPhonemes.length) return 'missing';
    if (index >= predPhonemes.length) return 'missing';
    
    const ref = refPhonemes[index];
    const pred = predPhonemes[index];
    
    if (ref === '_' && pred === '_') return 'missing';
    if (ref === pred && ref !== '_') return 'correct';
    return 'incorrect';
  };

  const getPhonemeColor = (status: 'correct' | 'incorrect' | 'missing') => {
    switch (status) {
      case 'correct': return COLORS.success;
      case 'incorrect': return COLORS.error;
      case 'missing': return COLORS.gray[400];
    }
  };

  const getPhonemeBackground = (status: 'correct' | 'incorrect' | 'missing') => {
    switch (status) {
      case 'correct': return '#D1FAE5';
      case 'incorrect': return '#FEE2E2';
      case 'missing': return COLORS.gray[100];
    }
  };

  return (
    <View style={styles.container}>
      {showLabel && <Text style={styles.title}>Phoneme Analysis</Text>}
      
      Reference Phonemes
      <View style={styles.phonemeRow}>
        {/* <Text style={styles.phonemeLabel}>Reference:</Text> */}
        <View style={styles.phonemeContainer}>
          {refPhonemes.map((phoneme, index) => {
            const status = getPhonemeStatus(index);
            const color = getPhonemeColor(status);
            const background = getPhonemeBackground(status);
            
            return (
              <Animated.View
                key={`ref-${index}`}
                style={[
                  styles.phonemeBox,
                  {
                    backgroundColor: background,
                    borderColor: color,
                    opacity: phonemeAnims[index] || 1,
                    transform: [
                      {
                        scale: phonemeAnims[index]?.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }) || 1,
                      },
                    ],
                  },
                ]}
              >
                <Text style={[styles.phonemeText, { color }]}>
                  {phoneme === '_' ? '•' : phoneme}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {/* Predicted Phonemes
      <View style={styles.phonemeRow}>
        <Text style={styles.phonemeLabel}>Your pronunciation:</Text>
        <View style={styles.phonemeContainer}>
          {predPhonemes.map((phoneme, index) => {
            const status = getPhonemeStatus(index);
            const color = getPhonemeColor(status);
            const background = getPhonemeBackground(status);
            
            return (
              <Animated.View
                key={`pred-${index}`}
                style={[
                  styles.phonemeBox,
                  {
                    backgroundColor: background,
                    borderColor: color,
                    opacity: phonemeAnims[index] || 1,
                    transform: [
                      {
                        scale: phonemeAnims[index]?.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }) || 1,
                      },
                    ],
                  },
                ]}
              >
                <Text style={[styles.phonemeText, { color }]}>
                  {phoneme === '_' ? '•' : phoneme}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View> */}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#D1FAE5', borderColor: COLORS.success }]} />
          <Text style={styles.legendText}>Correct</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FEE2E2', borderColor: COLORS.error }]} />
          <Text style={styles.legendText}>Incorrect</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.gray[100], borderColor: COLORS.gray[400] }]} />
          <Text style={styles.legendText}>Missing</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[800],
    marginBottom: 12,
  },
  phonemeRow: {
    marginBottom: 12,
  },
  phonemeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray[600],
    marginBottom: 8,
  },
  phonemeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  phonemeBox: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 32,
    alignItems: 'center',
  },
  phonemeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
});
