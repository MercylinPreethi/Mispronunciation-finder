import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
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
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

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
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(logoAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
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

  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const logoRotate = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '5deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Section - Brand */}
          <Animated.View 
            style={[
              styles.topSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.logoWrapper,
                {
                  transform: [
                    { scale: logoScale },
                    { rotate: logoRotate }
                  ]
                }
              ]}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Icon name="mic" size={56} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>
            
            <Text style={styles.brandName}>PronouncePro</Text>
            <Text style={styles.tagline}>Master Every Word with Confidence</Text>
          </Animated.View>

          {/* Form Section */}
          <Animated.View 
            style={[
              styles.formSection,
              {
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>Sign in to continue your learning</Text>
            </View>

            <View style={styles.formContent}>
              <FormField
                title="Email"
                value={form.email}
                handleChangeText={(e: string) => setForm({ ...form, email: e })}
                otherStyles={styles.field}
                keyboardType="email-address"
                placeholder="Enter your email"
                icon={<Icon name="alternate-email" size={20} color="#3B82F6" />}
                error={errors.email}
              />

              <FormField
                title="Password"
                value={form.password}
                handleChangeText={(e: string) => setForm({ ...form, password: e })}
                otherStyles={styles.field}
                isPasswordField={true}
                placeholder="Enter your password"
                icon={<Icon name="lock-outline" size={20} color="#3B82F6" />}
                error={errors.password}
              />

              <TouchableOpacity 
                style={styles.forgotLink}
                onPress={() => Alert.alert('Coming Soon', 'Password reset will be available soon!')}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <CustomButton
                title="Sign In"
                handlePress={loginSubmit}
                containerStyle={styles.signInButton}
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
                  onPress={() => Alert.alert('Coming Soon', 'Google sign-in will be available soon!')}
                >
                  <View style={styles.socialIconBg}>
                    <Icon name="g-translate" size={24} color="#EA4335" />
                  </View>
                  <Text style={styles.socialText}>Google</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.socialButton}
                  onPress={() => Alert.alert('Coming Soon', 'Apple sign-in will be available soon!')}
                >
                  <View style={styles.socialIconBg}>
                    <Icon name="apple" size={24} color="#000000" />
                  </View>
                  <Text style={styles.socialText}>Apple</Text>
                </TouchableOpacity>
              </View>

              {/* Sign Up Link */}
              <View style={styles.signupPrompt}>
                <Text style={styles.promptText}>Don't have an account? </Text>
                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity>
                    <Text style={styles.signupLink}>Sign Up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </Animated.View>

          {/* Bottom Decoration */}
          <View style={styles.bottomWave}>
            <LinearGradient
              colors={['#EFF6FF', '#DBEAFE']}
              style={styles.waveGradient}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: height * 0.06,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  logoWrapper: {
    marginBottom: 20,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  formSection: {
    flex: 1,
    paddingHorizontal: 24,
  },
  formHeader: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  formContent: {
    flex: 1,
  },
  field: {
    marginBottom: 20,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 32,
    marginTop: -8,
  },
  forgotText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '700',
  },
  signInButton: {
    marginBottom: 28,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
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
    marginBottom: 28,
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
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  promptText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  signupLink: {
    fontSize: 15,
    color: '#3B82F6',
    fontWeight: '800',
  },
  bottomWave: {
    height: 100,
    marginTop: 'auto',
  },
  waveGradient: {
    flex: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
});
