import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import moment from 'moment';

export interface User {
  uid: string;
  email: string;
  trialEndDate?: Date;
  subscriptionEndDate?: Date;
  isSubscribed?: boolean;
}

class AuthService {
  async signUp(email: string, password: string): Promise<User> {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const trialEndDate = moment().add(5, 'days').toDate();
      
      await firestore().collection('users').doc(userCredential.user.uid).set({
        email,
        trialEndDate,
        isSubscribed: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      return {
        uid: userCredential.user.uid,
        email,
        trialEndDate,
        isSubscribed: false,
      };
    } catch (error) {
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<User> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const userDoc = await firestore().collection('users').doc(userCredential.user.uid).get();
      const userData = userDoc.data();

      return {
        uid: userCredential.user.uid,
        email,
        trialEndDate: userData?.trialEndDate?.toDate(),
        subscriptionEndDate: userData?.subscriptionEndDate?.toDate(),
        isSubscribed: userData?.isSubscribed,
      };
    } catch (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await auth().signOut();
    } catch (error) {
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const currentUser = auth().currentUser;
    if (!currentUser) return null;

    const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();

    return {
      uid: currentUser.uid,
      email: currentUser.email!,
      trialEndDate: userData?.trialEndDate?.toDate(),
      subscriptionEndDate: userData?.subscriptionEndDate?.toDate(),
      isSubscribed: userData?.isSubscribed,
    };
  }

  async updateSubscription(userId: string, months: number): Promise<void> {
    const subscriptionEndDate = moment().add(months, 'months').toDate();
    
    await firestore().collection('users').doc(userId).update({
      isSubscribed: true,
      subscriptionEndDate,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }

  async checkAccess(userId: string): Promise<boolean> {
    const userDoc = await firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) return false;

    const now = moment();
    const trialEnd = moment(userData.trialEndDate.toDate());
    const subscriptionEnd = userData.subscriptionEndDate ? moment(userData.subscriptionEndDate.toDate()) : null;

    // Check if user is in trial period
    if (now.isBefore(trialEnd)) {
      return true;
    }

    // Check if user has active subscription
    if (userData.isSubscribed && subscriptionEnd && now.isBefore(subscriptionEnd)) {
      return true;
    }

    return false;
  }
}

export const authService = new AuthService();
