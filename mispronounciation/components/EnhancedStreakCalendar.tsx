// components/EnhancedStreakCalendar.tsx - Interactive & Animated Calendar Component
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface DayData {
  date: string;
  wordsCount: number;
  accuracy: number;
  achievements: string[];
}

interface EnhancedStreakCalendarProps {
  visible: boolean;
  onClose: () => void;
  streakDays: string[];
  currentStreak: number;
  dayDataMap?: Map<string, DayData>;
  userId?: string;
}

const EnhancedStreakCalendar: React.FC<EnhancedStreakCalendarProps> = ({
  visible,
  onClose,
  streakDays,
  currentStreak,
  dayDataMap,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDetails, setShowDayDetails] = useState(false);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const detailsSlideAnim = useRef(new Animated.Value(300)).current;
  const fireAnimations = useRef<Map<string, Animated.Value>>(new Map());

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const isDateInStreak = (date: Date) => {
    const dateStr = formatDateKey(date);
    return streakDays.includes(dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    Haptics.selectionAsync();
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleDayPress = (date: Date, isStreak: boolean) => {
    if (!isStreak) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedDate(date);
    setShowDayDetails(true);
    
    Animated.spring(detailsSlideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const closeDayDetails = () => {
    Animated.timing(detailsSlideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowDayDetails(false);
      setSelectedDate(null);
    });
  };

  const getFireAnimation = (dateKey: string) => {
    if (!fireAnimations.current.has(dateKey)) {
      const anim = new Animated.Value(0);
      fireAnimations.current.set(dateKey, anim);
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 1000 + Math.random() * 500,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1000 + Math.random() * 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
    return fireAnimations.current.get(dateKey)!;
  };

  const getDayData = (date: Date): DayData | null => {
    if (!dayDataMap) return null;
    const dateKey = formatDateKey(date);
    return dayDataMap.get(dateKey) || null;
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
    
    const rows = [];
    let currentRow = [];
    
    // Empty cells
    for (let i = 0; i < firstDayOfMonth; i++) {
      currentRow.push(
        <View key={`empty-${i}`} style={styles.calendarDay} />
      );
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isStreakDay = isDateInStreak(date);
      const isCurrentDay = isToday(date);
      const dateKey = formatDateKey(date);
      const dayData = getDayData(date);
      
      const fireAnim = isStreakDay ? getFireAnimation(dateKey) : new Animated.Value(0);
      const fireScale = fireAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.2, 1],
      });
      const fireOpacity = fireAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.8, 1, 0.8],
      });

      currentRow.push(
        <TouchableOpacity
          key={`day-${day}`}
          style={styles.calendarDay}
          onPress={() => handleDayPress(date, isStreakDay)}
          activeOpacity={isStreakDay ? 0.7 : 1}
          disabled={!isStreakDay}
        >
          {isCurrentDay ? (
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dayCircle}
            >
              <Text style={styles.todayText}>{day}</Text>
              {isStreakDay && (
                <Animated.Text 
                  style={[
                    styles.fireIcon,
                    {
                      transform: [{ scale: fireScale }],
                      opacity: fireOpacity,
                    }
                  ]}
                >
                  🔥
                </Animated.Text>
              )}
            </LinearGradient>
          ) : isStreakDay ? (
            <LinearGradient
              colors={['#FF6B35', '#FF8C42', '#FFA600']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dayCircle}
            >
              <Text style={styles.streakDayText}>{day}</Text>
              <Animated.Text 
                style={[
                  styles.fireIcon,
                  {
                    transform: [{ scale: fireScale }],
                    opacity: fireOpacity,
                  }
                ]}
              >
                🔥
              </Animated.Text>
              {dayData && dayData.wordsCount > 0 && (
                <View style={styles.wordsBadge}>
                  <Text style={styles.wordsBadgeText}>{dayData.wordsCount}</Text>
                </View>
              )}
            </LinearGradient>
          ) : (
            <View style={styles.normalDay}>
              <Text style={styles.normalDayText}>{day}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
      
      if (currentRow.length === 7) {
        rows.push(
          <View key={`row-${rows.length}`} style={styles.calendarRow}>
            {currentRow}
          </View>
        );
        currentRow = [];
      }
    }
    
    // Fill remaining cells
    if (currentRow.length > 0) {
      const remainingCells = 7 - currentRow.length;
      for (let i = 0; i < remainingCells; i++) {
        currentRow.push(
          <View key={`empty-end-${i}`} style={styles.calendarDay} />
        );
      }
      rows.push(
        <View key={`row-${rows.length}`} style={styles.calendarRow}>
          {currentRow}
        </View>
      );
    }
    
    return rows;
  };

  const renderDayDetails = () => {
    if (!selectedDate || !showDayDetails) return null;
    
    const dateKey = formatDateKey(selectedDate);
    const dayData = getDayData(selectedDate);
    const formattedDate = selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return (
      <Animated.View 
        style={[
          styles.dayDetailsContainer,
          {
            transform: [{ translateY: detailsSlideAnim }],
          }
        ]}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F8FAFC']}
          style={styles.dayDetailsGradient}
        >
          <View style={styles.dayDetailsHeader}>
            <View style={styles.dayDetailsHeaderLeft}>
              <Text style={styles.fireIconLarge}>🔥</Text>
              <View>
                <Text style={styles.dayDetailsTitle}>Practice Day</Text>
                <Text style={styles.dayDetailsDate}>{formattedDate}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeDayDetails} style={styles.closeDetailsButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.dayDetailsContent}>
            {dayData ? (
              <>
                <View style={styles.detailStatRow}>
                  <View style={styles.detailStatCard}>
                    <Icon name="book" size={28} color="#6366F1" />
                    <Text style={styles.detailStatValue}>{dayData.wordsCount || 0}</Text>
                    <Text style={styles.detailStatLabel}>Words Practiced</Text>
                  </View>
                  <View style={styles.detailStatCard}>
                    <Icon name="check-circle" size={28} color="#10B981" />
                    <Text style={styles.detailStatValue}>{dayData.accuracy || 0}%</Text>
                    <Text style={styles.detailStatLabel}>Accuracy</Text>
                  </View>
                </View>

                {dayData.achievements && dayData.achievements.length > 0 && (
                  <View style={styles.achievementsSection}>
                    <Text style={styles.achievementsSectionTitle}>🎉 Achievements</Text>
                    {dayData.achievements.map((achievement, index) => (
                      <View key={index} style={styles.achievementItem}>
                        <Icon name="stars" size={20} color="#F59E0B" />
                        <Text style={styles.achievementText}>{achievement}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataIcon}>📊</Text>
                <Text style={styles.noDataText}>Practice data for this day</Text>
                <Text style={styles.noDataSubtext}>Keep up the great work!</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View 
            style={[
              styles.calendarContainer,
              {
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              {/* Header with Gradient */}
              <LinearGradient
                colors={['#6366F1', '#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.calendarHeader}
              >
                <TouchableOpacity 
                  style={styles.navButton}
                  onPress={() => navigateMonth('prev')}
                >
                  <Icon name="chevron-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                
                <View style={styles.headerCenter}>
                  <Text style={styles.monthText}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long' })}
                  </Text>
                  <Text style={styles.yearText}>
                    {currentMonth.getFullYear()}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.navButton}
                  onPress={() => navigateMonth('next')}
                >
                  <Icon name="chevron-right" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.calendarBody}>
                {/* Week Days */}
                <View style={styles.weekDaysContainer}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <View key={index} style={styles.weekDayCell}>
                      <Text style={styles.weekDayText}>{day}</Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Grid */}
                <ScrollView 
                  style={styles.calendarScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.calendarGrid}>
                    {renderCalendarDays()}
                  </View>

                  {/* Stats Section */}
                  <View style={styles.statsSection}>
                    <LinearGradient
                      colors={['#FEF3C7', '#FDE68A']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.statCard}
                    >
                      <Text style={styles.statIcon}>🔥</Text>
                      <Text style={styles.statValue}>{currentStreak}</Text>
                      <Text style={styles.statLabel}>Day Streak</Text>
                    </LinearGradient>

                    <LinearGradient
                      colors={['#DBEAFE', '#BFDBFE']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.statCard}
                    >
                      <Text style={styles.statIcon}>📅</Text>
                      <Text style={styles.statValue}>{streakDays.length}</Text>
                      <Text style={styles.statLabel}>Total Days</Text>
                    </LinearGradient>

                    <LinearGradient
                      colors={['#D1FAE5', '#A7F3D0']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.statCard}
                    >
                      <Text style={styles.statIcon}>⭐</Text>
                      <Text style={styles.statValue}>
                        {streakDays.length > 0 ? Math.round((currentStreak / streakDays.length) * 100) : 0}%
                      </Text>
                      <Text style={styles.statLabel}>Consistency</Text>
                    </LinearGradient>
                  </View>
                </ScrollView>

                {/* Close Button */}
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.closeButtonGradient}
                  >
                    <Text style={styles.closeButtonText}>Close Calendar</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>

        {/* Day Details Overlay */}
        {renderDayDetails()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    width: width - 40,
    maxWidth: 420,
    maxHeight: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerCenter: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  calendarBody: {
    padding: 16,
  },
  weekDaysContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  calendarScroll: {
    maxHeight: 420,
  },
  calendarGrid: {
    marginBottom: 16,
  },
  calendarRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  dayCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  normalDay: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  todayText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  streakDayText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  normalDayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  fireIcon: {
    position: 'absolute',
    top: -6,
    right: -6,
    fontSize: 18,
  },
  wordsBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  wordsBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6B35',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Day Details
  dayDetailsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  dayDetailsGradient: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dayDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dayDetailsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fireIconLarge: {
    fontSize: 40,
  },
  dayDetailsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  dayDetailsDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  closeDetailsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayDetailsContent: {
    gap: 16,
  },
  detailStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  detailStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  detailStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  achievementsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  achievementsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  achievementText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noDataIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default EnhancedStreakCalendar;
