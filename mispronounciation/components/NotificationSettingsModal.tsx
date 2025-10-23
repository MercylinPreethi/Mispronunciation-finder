// components/NotificationSettingsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import {
  NotificationPreferences,
  saveNotificationPreferences,
  getNotificationPreferences,
  requestNotificationPermissions,
  DEFAULT_PREFERENCES,
} from '../services/notificationService';

const COLORS = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  white: '#FFFFFF',
};

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationSettingsModal({
  visible,
  onClose,
}: NotificationSettingsModalProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPreferences();
    }
  }, [visible]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const prefs = await getNotificationPreferences();
      setPreferences(prefs);
      
      // Check permission status
      const permission = await requestNotificationPermissions();
      setHasPermission(permission);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    
    try {
      // Request permission if enabling notifications
      if (preferences.enabled && !hasPermission) {
        const permission = await requestNotificationPermissions();
        if (!permission) {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive reminders.',
            [{ text: 'OK' }]
          );
          setPreferences(prev => ({ ...prev, enabled: false }));
          return;
        }
        setHasPermission(true);
      }

      const success = await saveNotificationPreferences(preferences);
      if (success) {
        Alert.alert('Success', 'Notification preferences saved!', [
          { text: 'OK', onPress: onClose }
        ]);
      } else {
        Alert.alert('Error', 'Failed to save preferences. Please try again.');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    Haptics.selectionAsync();
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleTimeChange = (hour: number) => {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    updatePreference('reminderTime', time);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Themed Header */}
          <LinearGradient
            colors={[COLORS.primary, COLORS.secondary]}
            style={styles.header}
          >
            <Icon name="notifications-active" size={32} color={COLORS.white} />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Notification Settings</Text>
              <Text style={styles.headerSubtitle}>Customize your reminders</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Permission Warning */}
            {!hasPermission && (
              <View style={styles.warningCard}>
                <Icon name="warning" size={24} color={COLORS.warning} />
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>Permission Required</Text>
                  <Text style={styles.warningText}>
                    Enable notifications in settings to receive reminders
                  </Text>
                </View>
              </View>
            )}

            {/* Master Toggle */}
            <View style={styles.section}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Icon name="notifications" size={24} color={COLORS.primary} />
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Enable Notifications</Text>
                    <Text style={styles.settingDescription}>
                      Receive practice reminders and updates
                    </Text>
                  </View>
                </View>
                <Switch
                  value={preferences.enabled}
                  onValueChange={(value) => updatePreference('enabled', value)}
                  trackColor={{ false: COLORS.gray[300], true: COLORS.primary + '60' }}
                  thumbColor={preferences.enabled ? COLORS.primary : COLORS.gray[400]}
                />
              </View>
            </View>

            {/* Daily Reminder Settings */}
            {preferences.enabled && (
              <>
                <View style={styles.sectionDivider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Daily Reminders</Text>
                  
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Icon name="alarm" size={24} color={COLORS.secondary} />
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>Daily Practice Reminder</Text>
                        <Text style={styles.settingDescription}>
                          Get reminded to practice every day
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={preferences.dailyReminderEnabled}
                      onValueChange={(value) => updatePreference('dailyReminderEnabled', value)}
                      trackColor={{ false: COLORS.gray[300], true: COLORS.secondary + '60' }}
                      thumbColor={preferences.dailyReminderEnabled ? COLORS.secondary : COLORS.gray[400]}
                    />
                  </View>

                  {preferences.dailyReminderEnabled && (
                    <>
                      {/* Reminder Time Picker */}
                      <View style={styles.timePickerSection}>
                        <Text style={styles.subSectionTitle}>Reminder Time</Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={styles.timeScroll}
                        >
                          {Array.from({ length: 24 }, (_, i) => i).map(hour => {
                            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                            const isSelected = preferences.reminderTime === timeStr;
                            
                            return (
                              <TouchableOpacity
                                key={hour}
                                style={[
                                  styles.timeSlot,
                                  isSelected && styles.timeSlotSelected
                                ]}
                                onPress={() => handleTimeChange(hour)}
                              >
                                <Text style={[
                                  styles.timeSlotText,
                                  isSelected && styles.timeSlotTextSelected
                                ]}>
                                  {hour === 0 ? '12 AM' :
                                   hour < 12 ? `${hour} AM` :
                                   hour === 12 ? '12 PM' :
                                   `${hour - 12} PM`}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>

                      {/* Frequency Selection */}
                      <View style={styles.frequencySection}>
                        <Text style={styles.subSectionTitle}>Frequency</Text>
                        <View style={styles.frequencyButtons}>
                          {(['daily', 'weekdays'] as const).map(freq => (
                            <TouchableOpacity
                              key={freq}
                              style={[
                                styles.frequencyButton,
                                preferences.frequency === freq && styles.frequencyButtonSelected
                              ]}
                              onPress={() => updatePreference('frequency', freq)}
                            >
                              <Text style={[
                                styles.frequencyButtonText,
                                preferences.frequency === freq && styles.frequencyButtonTextSelected
                              ]}>
                                {freq === 'daily' ? 'Every Day' : 'Weekdays Only'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* Streak Alerts */}
                <View style={styles.sectionDivider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Streak Alerts</Text>
                  
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Icon name="local-fire-department" size={24} color={COLORS.warning} />
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>Streak Risk Alerts</Text>
                        <Text style={styles.settingDescription}>
                          Get notified when your streak is at risk
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={preferences.streakAlertEnabled}
                      onValueChange={(value) => updatePreference('streakAlertEnabled', value)}
                      trackColor={{ false: COLORS.gray[300], true: COLORS.warning + '60' }}
                      thumbColor={preferences.streakAlertEnabled ? COLORS.warning : COLORS.gray[400]}
                    />
                  </View>

                  {preferences.streakAlertEnabled && (
                    <View style={styles.thresholdSection}>
                      <Text style={styles.subSectionTitle}>
                        Alert Time ({preferences.streakRiskThreshold} hours before midnight)
                      </Text>
                      <View style={styles.thresholdButtons}>
                        {[3, 6, 9, 12].map(hours => (
                          <TouchableOpacity
                            key={hours}
                            style={[
                              styles.thresholdButton,
                              preferences.streakRiskThreshold === hours && styles.thresholdButtonSelected
                            ]}
                            onPress={() => updatePreference('streakRiskThreshold', hours)}
                          >
                            <Text style={[
                              styles.thresholdButtonText,
                              preferences.streakRiskThreshold === hours && styles.thresholdButtonTextSelected
                            ]}>
                              {hours}h
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Motivational Notifications */}
                <View style={styles.sectionDivider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Motivational</Text>
                  
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Icon name="emoji-events" size={24} color={COLORS.success} />
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>Achievement Notifications</Text>
                        <Text style={styles.settingDescription}>
                          Celebrate milestones and achievements
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={preferences.motivationalEnabled}
                      onValueChange={(value) => updatePreference('motivationalEnabled', value)}
                      trackColor={{ false: COLORS.gray[300], true: COLORS.success + '60' }}
                      thumbColor={preferences.motivationalEnabled ? COLORS.success : COLORS.gray[400]}
                    />
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          {/* Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={loading}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary]}
                style={styles.saveButtonGradient}
              >
                <Icon name="check" size={24} color={COLORS.white} />
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save Preferences'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
  },
  content: {
    maxHeight: '70%',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.warning + '15',
    padding: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.warning,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[800],
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginHorizontal: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[800],
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray[500],
  },
  timePickerSection: {
    marginTop: 12,
  },
  timeScroll: {
    marginHorizontal: -4,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
    borderWidth: 2,
    borderColor: COLORS.gray[200],
  },
  timeSlotSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  timeSlotTextSelected: {
    color: COLORS.white,
  },
  frequencySection: {
    marginTop: 16,
  },
  frequencyButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    alignItems: 'center',
  },
  frequencyButtonSelected: {
    backgroundColor: COLORS.secondary + '20',
    borderColor: COLORS.secondary,
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  frequencyButtonTextSelected: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  thresholdSection: {
    marginTop: 16,
  },
  thresholdButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  thresholdButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.gray[100],
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    alignItems: 'center',
  },
  thresholdButtonSelected: {
    backgroundColor: COLORS.warning + '20',
    borderColor: COLORS.warning,
  },
  thresholdButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  thresholdButtonTextSelected: {
    color: COLORS.warning,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
});
