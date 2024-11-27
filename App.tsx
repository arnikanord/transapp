import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { UserProvider, useUser } from './src/services/UserContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { TranslationComponent } from './src/components/TranslationComponent';

const MainApp: React.FC = () => {
  const { user, signOut, checkAccess } = useUser();
  const [hasAccess, setHasAccess] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  React.useEffect(() => {
    const verifyAccess = async () => {
      if (user) {
        const access = await checkAccess();
        setHasAccess(access);
      } else {
        setHasAccess(false);
      }
    };

    verifyAccess();
  }, [user, checkAccess]);

  if (!user) {
    return <AuthScreen />;
  }

  if (showSubscription || !hasAccess) {
    return (
      <View style={styles.container}>
        <SubscriptionScreen />
      </View>
    );
  }

  return (
    <TranslationComponent
      onShowSubscription={() => setShowSubscription(true)}
      onSignOut={signOut}
    />
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <MainApp />
    </UserProvider>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});
