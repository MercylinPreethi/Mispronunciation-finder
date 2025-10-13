import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions, ImageBackground } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FormField from '@/components/FormField';
import CustomButton from '@/components/CustomButton';
import { auth } from '@/lib/firebase';

const { width, height } = Dimensions.get('window');

export default function Signin() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(100)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(slideUpAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email address';
    if (!form.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loginSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);
      console.log('User signed in successfully:', userCredential.user.uid);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('SignIn failed:', error.message);
      Alert.alert('Sign In Error', error.message || 'An error occurred during sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.background}
      >
        {/* Animated background elements */}
        <Animated.View 
          style={[
            styles.floatingOrb1,
            { transform: [{ translateY: floatY }] }
          ]}
        />
        <Animated.View 
          style={[
            styles.floatingOrb2,
            { transform: [{ translateY: floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 15],
            }) }] }
          ]}
        />

        <SafeAreaView style={styles.safeArea}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo Section */}
            <Animated.View 
              style={[
                styles.logoSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideUpAnim }]
                }
              ]}
            >
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoGradient}
                >
                  <Icon name="mic" size={42} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.logoGlow} />
              </View>
              
              <Text style={styles.brandTitle}>PronouncePro</Text>
              <View style={styles.brandTaglineContainer}>
                <View style={styles.taglineDot} />
                <Text style={styles.brandTagline}>AI-Powered Pronunciation</Text>
                <View style={styles.taglineDot} />
              </View>
            </Animated.View>

            {/* Form Card */}
            <Animated.View 
              style={[
                styles.formCard,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideUpAnim }]
                }
              ]}
            >
              <View style={styles.cardGlow} />
              
              <View style={styles.formHeader}>
                <Text style={styles.welcomeText}>Welcome Back</Text>
                <Text style={styles.instructionText}>Sign in to continue your journey</Text>
              </View>

              <View style={styles.formContent}>
                <FormField
                  title="Email"
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
                  placeholder="••••••••"
                  icon={<Icon name="lock-outline" size={22} color="#6366F1" />}
                  error={errors.password}
                />

                <View style={styles.optionsRow}>
                  <View style={styles.rememberMe}>
                    <View style={styles.checkbox} />
                    <Text style={styles.rememberText}>Remember me</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => Alert.alert('Coming Soon', 'Password reset will be available soon!')}
                  >
                    <Text style={styles.forgotText}>Forgot?</Text>
                  </TouchableOpacity>
                </View>

                <CustomButton
                  title="Sign In"
                  handlePress={loginSubmit}
                  containerStyle={styles.signInButton}
                  isLoading={isSubmitting}
                  size="large"
                  variant="primary"
                />

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <LinearGradient
                    colors={['transparent', 'rgba(99, 102, 241, 0.5)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dividerGradient}
                  />
                  <View style={styles.dividerTextContainer}>
                    <Text style={styles.dividerText}>OR</Text>
                  </View>
                </View>

                {/* Social Buttons */}
                <View style={styles.socialButtons}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Google sign-in will be available soon!')}
                  >
                    <LinearGradient
                      colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                      style={styles.socialGradient}
                    >
                      <Icon name="g-translate" size={26} color="#6366F1" />
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Apple sign-in will be available soon!')}
                  >
                    <LinearGradient
                      colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                      style={styles.socialGradient}
                    >
                      <Icon name="apple" size={26} color="#6366F1" />
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'GitHub sign-in will be available soon!')}
                  >
                    <LinearGradient
                      colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                      style={styles.socialGradient}
                    >
                      <Icon name="code" size={26} color="#6366F1" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            {/* Sign Up Prompt */}
            <Animated.View 
              style={[
                styles.signupPrompt,
                { opacity: fadeAnim }
              ]}
            >
              <Text style={styles.promptText}>Don't have an account? </Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity>
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signupLinkGradient}
                  >
                    <Text style={styles.signupLink}>Create Account →</Text>
                  </LinearGradient>
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
  floatingOrb1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    top: -100,
    right: -100,
  },
  floatingOrb2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    bottom: -80,
    left: -80,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  logoGradient: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  logoGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    opacity: 0.2,
    transform: [{ scale: 1.2 }],
    zIndex: -1,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  brandTaglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6366F1',
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  formCard: {
    position: 'relative',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    opacity: 0.4,
  },
  formHeader: {
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  instructionText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  formContent: {
    gap: 4,
  },
  field: {
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 4,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  rememberText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '700',
  },
  signInButton: {
    marginBottom: 24,
  },
  dividerContainer: {
    position: 'relative',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerGradient: {
    position: 'absolute',
    width: '100%',
    height: 2,
  },
  dividerTextContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 16,
  },
  dividerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '800',
    letterSpacing: 2,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  socialButton: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  socialGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  promptText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  signupLinkGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signupLink: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
