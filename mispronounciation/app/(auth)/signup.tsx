// app/(auth)/signup.tsx
import 'react-native-get-random-values';
import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
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
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnim1 = useRef(new Animated.Value(50)).current;
  const cardAnim2 = useRef(new Animated.Value(100)).current;
  const cardAnim3 = useRef(new Animated.Value(150)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim1, {
        toValue: 0,
        tension: 50,
        friction: 8,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim2, {
        toValue: 0,
        tension: 50,
        friction: 8,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim3, {
        toValue: 0,
        tension: 50,
        friction: 8,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.background}
      >
        {/* Animated mesh gradient background */}
        <Animated.View 
          style={[
            styles.meshGradient1,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.2)', 'transparent']}
            style={styles.gradientFill}
          />
        </Animated.View>
        <Animated.View 
          style={[
            styles.meshGradient2,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.15)', 'transparent']}
            style={styles.gradientFill}
          />
        </Animated.View>

        <SafeAreaView style={styles.safeArea}>
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
                  transform: [{ translateY: cardAnim1 }]
                }
              ]}
            >
              <View style={styles.headerBadge}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.badgeGradient}
                >
                  <Icon name="stars" size={20} color="#FFFFFF" />
                  <Text style={styles.badgeText}>NEW</Text>
                </LinearGradient>
              </View>
              
              <Text style={styles.headerTitle}>Join PronouncePro</Text>
              <Text style={styles.headerSubtitle}>Start your journey to perfect pronunciation</Text>
              
              {/* Stats */}
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>10K+</Text>
                  <Text style={styles.statLabel}>Users</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>50+</Text>
                  <Text style={styles.statLabel}>Languages</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>4.9</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>
            </Animated.View>

            {/* Form Cards Stack */}
            <View style={styles.cardsStack}>
              {/* Back card */}
              <Animated.View 
                style={[
                  styles.backCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: cardAnim3 }]
                  }
                ]}
              />
              
              {/* Middle card */}
              <Animated.View 
                style={[
                  styles.middleCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: cardAnim2 }]
                  }
                ]}
              />
              
              {/* Front card */}
              <Animated.View 
                style={[
                  styles.frontCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: cardAnim1 }]
                  }
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardDots}>
                    <View style={[styles.dot, styles.dotActive]} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                  <Text style={styles.cardStep}>Step 1 of 3</Text>
                </View>

                <View style={styles.formContent}>
                  <FormField
                    title="Full Name"
                    value={form.username}
                    handleChangeText={(e: string) => setForm({ ...form, username: e })}
                    otherStyles={styles.field}
                    placeholder="John Doe"
                    icon={<Icon name="person-outline" size={22} color="#6366F1" />}
                    error={errors.username}
                  />

                  <FormField
                    title="Email Address"
                    value={form.email}
                    handleChangeText={(e: string) => setForm({ ...form, email: e })}
                    otherStyles={styles.field}
                    keyboardType="email-address"
                    placeholder="your@email.com"
                    icon={<Icon name="mail-outline" size={22} color="#6366F1" />}
                    error={errors.email}
                  />

                  <FormField
                    title="Password"
                    value={form.password}
                    handleChangeText={(e: string) => setForm({ ...form, password: e })}
                    otherStyles={styles.field}
                    isPasswordField={true}
                    placeholder="Min. 6 characters"
                    icon={<Icon name="lock-outline" size={22} color="#6366F1" />}
                    error={errors.password}
                  />

                  <FormField
                    title="Confirm Password"
                    value={form.reEnterPassword}
                    handleChangeText={(e: string) => setForm({ ...form, reEnterPassword: e })}
                    otherStyles={styles.field}
                    isPasswordField={true}
                    placeholder="Re-enter password"
                    icon={<Icon name="verified-user" size={22} color="#6366F1" />}
                    error={errors.reEnterPassword}
                  />

                  {/* Terms */}
                  <View style={styles.termsContainer}>
                    <View style={styles.checkboxContainer}>
                      <View style={styles.checkbox}>
                        <Icon name="check" size={14} color="#6366F1" />
                      </View>
                    </View>
                    <Text style={styles.termsText}>
                      I agree to the{' '}
                      <Text style={styles.termsLink}>Terms of Service</Text>
                      {' '}and{' '}
                      <Text style={styles.termsLink}>Privacy Policy</Text>
                    </Text>
                  </View>

                  <CustomButton
                    title="Create Account"
                    handlePress={submit}
                    containerStyle={styles.submitButton}
                    isLoading={isSubmitting}
                    size="large"
                    variant="primary"
                  />

                  {/* Divider */}
                  <View style={styles.dividerContainer}>
                    <LinearGradient
                      colors={['transparent', 'rgba(99, 102, 241, 0.3)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.dividerLine}
                    />
                    <Text style={styles.dividerText}>OR</Text>
                  </View>

                  {/* Social Buttons */}
                  <View style={styles.socialButtons}>
                    <TouchableOpacity 
                      style={styles.socialButton}
                      onPress={() => Alert.alert('Coming Soon', 'Google sign-up will be available soon!')}
                    >
                      <Icon name="g-translate" size={24} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.socialButton}
                      onPress={() => Alert.alert('Coming Soon', 'Apple sign-up will be available soon!')}
                    >
                      <Icon name="apple" size={24} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.socialButton}
                      onPress={() => Alert.alert('Coming Soon', 'GitHub sign-up will be available soon!')}
                    >
                      <Icon name="code" size={24} color="#6366F1" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </View>

            {/* Sign In Prompt */}
            <Animated.View 
              style={[
                styles.signinPrompt,
                { opacity: fadeAnim }
              ]}
            >
              <Text style={styles.promptText}>Already have an account? </Text>
              <Link href="/(auth)/signin" asChild>
                <TouchableOpacity>
                  <Text style={styles.signinLink}>Sign In →</Text>
                </TouchableOpacity>
              </Link>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  meshGradient1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    top: -150,
    right: -150,
  },
  meshGradient2: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 175,
    bottom: -100,
    left: -100,
  },
  gradientFill: {
    flex: 1,
    borderRadius: 200,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerBadge: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
  },
  cardsStack: {
    position: 'relative',
    marginBottom: 24,
  },
  backCard: {
    position: 'absolute',
    top: -16,
    left: 16,
    right: 16,
    height: 50,
    backgroundColor: 'rgba(30, 41, 59, 0.25)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  middleCard: {
    position: 'absolute',
    top: -8,
    left: 8,
    right: 8,
    height: 50,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  frontCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
  },
  dotActive: {
    backgroundColor: '#6366F1',
    width: 24,
  },
  cardStep: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '700',
    letterSpacing: 1,
  },
  formContent: {
    gap: 4,
  },
  field: {
    marginBottom: 16,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    marginTop: 4,
  },
  checkboxContainer: {
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 2,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 20,
    fontWeight: '500',
  },
  termsLink: {
    color: '#6366F1',
    fontWeight: '700',
  },
  submitButton: {
    marginBottom: 24,
  },
  dividerContainer: {
    position: 'relative',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
  },
  dividerText: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 12,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '800',
    letterSpacing: 2,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  socialButton: {
    flex: 1,
    height: 56,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  signinPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  promptText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  signinLink: {
    fontSize: 15,
    color: '#6366F1',
    fontWeight: '800',
  },
});
