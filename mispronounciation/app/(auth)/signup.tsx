// app/(auth)/signup.tsx
import 'react-native-get-random-values';
import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FormField from '@/components/FormField';
import CustomButton from '@/components/CustomButton';
import { auth, database } from '@/lib/firebase';

const { width, height } = Dimensions.get('window');

const sanitizeUserId = (id: string | string[]): string => {
  if (Array.isArray(id)) id = id.join('');
  id = id.slice(0, 36).replace(/[^a-zA-Z0-9._-]/g, '');
  if (['.', '-', '_'].includes(id[0])) id = `user_${id}`;
  return id;
};

export default function Signup() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    reEnterPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [currentStep, setCurrentStep] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.username) newErrors.username = 'Full name is required';
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email address';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!form.reEnterPassword) newErrors.reEnterPassword = 'Please confirm your password';
    else if (form.password !== form.reEnterPassword) newErrors.reEnterPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: form.username });
      
      const userProfileRef = ref(database, `users/${user.uid}/profile`);
      await set(userProfileRef, {
        username: form.username,
        email: form.email,
        createdAt: new Date().toISOString(),
        displayName: form.username,
        uid: user.uid
      });
      
      router.replace('/(tabs)');
      
    } catch (error: any) {
      let errorMessage = 'Failed to create account';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Signup Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 2],
    outputRange: ['33%', '100%'],
  });

  const steps = [
    { icon: 'person', label: 'Profile' },
    { icon: 'email', label: 'Contact' },
    { icon: 'lock', label: 'Security' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View 
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <Icon name="person-add" size={48} color="#FFFFFF" />
              <Text style={styles.headerTitle}>Create Account</Text>
              <Text style={styles.headerSubtitle}>Join thousands of learners improving their pronunciation</Text>
            </LinearGradient>
          </Animated.View>

          {/* Progress Steps */}
          <Animated.View style={[styles.stepsContainer, { opacity: fadeAnim }]}>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <View style={styles.steps}>
              {steps.map((step, index) => (
                <View key={index} style={styles.step}>
                  <View style={[
                    styles.stepIcon,
                    currentStep >= index && styles.stepIconActive,
                    currentStep > index && styles.stepIconComplete
                  ]}>
                    <Icon 
                      name={currentStep > index ? 'check' : step.icon} 
                      size={20} 
                      color={currentStep >= index ? '#FFFFFF' : '#9CA3AF'} 
                    />
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    currentStep >= index && styles.stepLabelActive
                  ]}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View 
            style={[
              styles.formContainer,
              { opacity: fadeAnim }
            ]}
          >
            <View style={styles.formCard}>
              <FormField
                title="Full Name"
                value={form.username}
                handleChangeText={(e: string) => {
                  setForm({ ...form, username: e });
                  if (e && currentStep === 0) setCurrentStep(1);
                }}
                otherStyles={styles.field}
                placeholder="John Doe"
                icon={<Icon name="person-outline" size={20} color="#3B82F6" />}
                error={errors.username}
              />

              <FormField
                title="Email"
                value={form.email}
                handleChangeText={(e: string) => {
                  setForm({ ...form, email: e });
                  if (e && form.username && currentStep === 1) setCurrentStep(2);
                }}
                otherStyles={styles.field}
                keyboardType="email-address"
                placeholder="you@example.com"
                icon={<Icon name="alternate-email" size={20} color="#3B82F6" />}
                error={errors.email}
              />

              <FormField
                title="Password"
                value={form.password}
                handleChangeText={(e: string) => setForm({ ...form, password: e })}
                otherStyles={styles.field}
                isPasswordField={true}
                placeholder="Minimum 6 characters"
                icon={<Icon name="lock-outline" size={20} color="#3B82F6" />}
                error={errors.password}
              />

              <FormField
                title="Confirm Password"
                value={form.reEnterPassword}
                handleChangeText={(e: string) => setForm({ ...form, reEnterPassword: e })}
                otherStyles={styles.field}
                isPasswordField={true}
                placeholder="Re-enter your password"
                icon={<Icon name="verified-user" size={20} color="#3B82F6" />}
                error={errors.reEnterPassword}
              />

              {/* Terms */}
              <View style={styles.termsContainer}>
                <Icon name="info-outline" size={16} color="#6B7280" />
                <Text style={styles.termsText}>
                  By signing up, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>

              <CustomButton
                title="Create Account"
                handlePress={submit}
                containerStyle={styles.submitButton}
                isLoading={isSubmitting}
                size="large"
              />

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Buttons */}
              <View style={styles.socialContainer}>
                <TouchableOpacity 
                  style={styles.socialButton}
                  onPress={() => Alert.alert('Coming Soon', 'Google sign-up will be available soon!')}
                >
                  <View style={styles.socialIconBg}>
                    <Icon name="g-translate" size={24} color="#EA4335" />
                  </View>
                  <Text style={styles.socialText}>Google</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.socialButton}
                  onPress={() => Alert.alert('Coming Soon', 'Apple sign-up will be available soon!')}
                >
                  <View style={styles.socialIconBg}>
                    <Icon name="apple" size={24} color="#000000" />
                  </View>
                  <Text style={styles.socialText}>Apple</Text>
                </TouchableOpacity>
              </View>

              {/* Sign In Link */}
              <View style={styles.signinPrompt}>
                <Text style={styles.promptText}>Already have an account? </Text>
                <Link href="/(auth)/signin" asChild>
                  <TouchableOpacity>
                    <Text style={styles.signinLink}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#EFF6FF',
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  stepsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  step: {
    alignItems: 'center',
    flex: 1,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepIconActive: {
    backgroundColor: '#3B82F6',
  },
  stepIconComplete: {
    backgroundColor: '#10B981',
  },
  stepLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#3B82F6',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  field: {
    marginBottom: 20,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 4,
    gap: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    fontWeight: '500',
  },
  termsLink: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  submitButton: {
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  socialContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  socialIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  signinPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  promptText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  signinLink: {
    fontSize: 15,
    color: '#3B82F6',
    fontWeight: '800',
  },
});
