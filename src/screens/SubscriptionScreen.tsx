import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '../services/UserContext';
import { paymentService } from '../services/PaymentService';
import moment from 'moment';

export const SubscriptionScreen: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    status: 'trial' | 'active' | 'expired';
    message: string;
  } | null>(null);

  useEffect(() => {
    updateSubscriptionStatus();
  }, [user]);

  const updateSubscriptionStatus = () => {
    if (!user) return;

    const now = moment();
    const trialEnd = moment(user.trialEndDate);
    const subscriptionEnd = user.subscriptionEndDate ? moment(user.subscriptionEndDate) : null;

    if (now.isBefore(trialEnd)) {
      const daysLeft = trialEnd.diff(now, 'days');
      setSubscriptionStatus({
        status: 'trial',
        message: `Trial period: ${daysLeft} days remaining`,
      });
    } else if (user.isSubscribed && subscriptionEnd && now.isBefore(subscriptionEnd)) {
      const daysLeft = subscriptionEnd.diff(now, 'days');
      setSubscriptionStatus({
        status: 'active',
        message: `Subscription active: ${daysLeft} days remaining`,
      });
    } else {
      setSubscriptionStatus({
        status: 'expired',
        message: user.isSubscribed ? 'Subscription expired' : 'Trial period ended',
      });
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to subscribe');
      return;
    }

    try {
      setLoading(true);
      const success = await paymentService.processSubscription(user.uid);
      
      if (success) {
        Alert.alert(
          'Success',
          'Thank you for subscribing! Your subscription is now active.',
          [{ text: 'OK', onPress: updateSubscriptionStatus }]
        );
      } else {
        Alert.alert('Error', 'Failed to process subscription. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const success = await paymentService.cancelSubscription(user.uid);
              
              if (success) {
                Alert.alert(
                  'Subscription Cancelled',
                  'Your subscription has been cancelled. You will have access until the end of your current billing period.',
                  [{ text: 'OK', onPress: updateSubscriptionStatus }]
                );
              } else {
                Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.title}>Subscription Status</Text>
        {subscriptionStatus && (
          <Text style={[
            styles.status,
            subscriptionStatus.status === 'expired' && styles.statusExpired,
            subscriptionStatus.status === 'active' && styles.statusActive,
            subscriptionStatus.status === 'trial' && styles.statusTrial,
          ]}>
            {subscriptionStatus.message}
          </Text>
        )}
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Monthly Plan</Text>
        <Text style={styles.price}>€{paymentService.getSubscriptionPrice()}/month</Text>
        <View style={styles.features}>
          <Text style={styles.feature}>✓ Unlimited translations</Text>
          <Text style={styles.feature}>✓ Voice recognition</Text>
          <Text style={styles.feature}>✓ Text-to-speech</Text>
          <Text style={styles.feature}>✓ Multiple languages</Text>
        </View>
        
        {subscriptionStatus?.status !== 'active' && (
          <TouchableOpacity
            style={styles.button}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Subscribe Now</Text>
            )}
          </TouchableOpacity>
        )}

        {subscriptionStatus?.status === 'active' && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancelSubscription}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Cancel Subscription</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.note}>
        {subscriptionStatus?.status === 'active'
          ? 'Your subscription will automatically renew each month. You can cancel anytime.'
          : `Start with a ${paymentService.getTrialDays()}-day free trial. Cancel anytime.`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
  },
  status: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusExpired: {
    color: '#FF3B30',
  },
  statusActive: {
    color: '#34C759',
  },
  statusTrial: {
    color: '#007AFF',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 20,
  },
  features: {
    marginBottom: 20,
  },
  feature: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
