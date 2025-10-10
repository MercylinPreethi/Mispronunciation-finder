import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import FormField from '@/components/FormField';
import CustomButton from '@/components/CustomButton';
import { auth } from '@/lib/firebase';

const { width } = Dimensions.get('window');

export default function Signin() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useState(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  });

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

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient 
        colors={['#667eea', '#764ba2', '#f093fb']} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Decorative circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          
          <Animated.View 
            style={[
              styles.cardWrapper,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <View style={styles.glassCard}>
              {/* Logo/Icon Section */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.logoGradient}
                >
                  <Icon name="mic" size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <Text style={styles.title}>Welcome Back! 👋</Text>
              <Text style={styles.subtitle}>Sign in to unlock your pronunciation mastery</Text>

              <View style={styles.formContainer}>
                <FormField
                  title="Email"
                  value={form.email}
                  handleChangeText={(e: string) => setForm({ ...form, email: e })}
                  otherStyles={styles.field}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  icon={<Icon name="email" size={22} color="#667eea" />}
                  error={errors.email}
                />
                <FormField
                  title="Password"
                  value={form.password}
                  handleChangeText={(e: string) => setForm({ ...form, password: e })}
                  otherStyles={styles.field}
                  isPasswordField={true}
                  placeholder="Enter your password"
                  icon={<Icon name="lock" size={22} color="#667eea" />}
                  error={errors.password}
                />

                <TouchableOpacity 
                  style={styles.forgotPassword}
                  onPress={() => Alert.alert('Coming Soon', 'Password reset will be available soon!')}
                >
                  <Text style={styles.forgotPasswordText}>Forgot password? 🔑</Text>
                </TouchableOpacity>

                <CustomButton
                  title={isSubmitting ? "Signing In..." : "Sign In"}
                  handlePress={loginSubmit}
                  containerStyle={styles.submitButton}
                  isLoading={isSubmitting}
                />

                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.divider} />
                </View>

                <View style={styles.socialButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Google sign-in will be available soon!')}
                  >
                    <View style={styles.socialIconContainer}>
                      <Icon name="login" size={24} color="#667eea" />
                    </View>
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Apple sign-in will be available soon!')}
                  >
                    <View style={styles.socialIconContainer}>
                      <Icon name="phone-iphone" size={24} color="#667eea" />
                    </View>
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.prompt}>
                  <Text style={styles.promptText}>New here? </Text>
                  <Link href="/(auth)/signup" style={styles.promptLink}>Create an account</Link>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -100,
    right: -100,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -50,
    left: -50,
  },
  cardWrapper: {
    zIndex: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 30,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#1a1a1a', 
    textAlign: 'center', 
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 32,
    lineHeight: 24,
  },
  formContainer: {
    width: '100%',
  },
  field: { 
    marginBottom: 20,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  submitButton: { 
    marginBottom: 24,
  },
  dividerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24,
  },
  divider: { 
    flex: 1, 
    height: 1, 
    backgroundColor: '#E0E0E0',
  },
  dividerText: { 
    fontSize: 14, 
    color: '#999', 
    marginHorizontal: 16,
    fontWeight: '500',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialIconContainer: {
    marginBottom: 8,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  prompt: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptText: { 
    fontSize: 15, 
    color: '#666',
  },
  promptLink: { 
    fontSize: 15, 
    color: '#667eea', 
    fontWeight: '700',
  },
});