import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../theme';
import { useTranslation } from '../locales/i18n';

export const OfflineScreen = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const { t } = useTranslation();

  useEffect(() => {
    NetInfo.fetch().then(state => {
      if (state.isConnected !== null) {
        setIsConnected(state.isConnected);
      }
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected !== null) {
        setIsConnected(state.isConnected);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRetry = () => {
    NetInfo.fetch().then(state => {
      if (state.isConnected !== null) {
        setIsConnected(state.isConnected);
      }
    });
  };

  return (
    <Modal
      visible={!isConnected}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.container}>
        <Ionicons
          name="cloud-offline-outline"
          size={120}
          color={appColors.primary}
          style={{ marginBottom: 40 }}
        />
        <Text style={styles.title}>{t('offline.title')}</Text>
        <Text style={styles.subtitle}>{t('offline.subtitle')}</Text>
        <TouchableOpacity style={styles.button} onPress={handleRetry} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('offline.retry')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: appColors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  button: {
    backgroundColor: appColors.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: appColors.white,
    fontSize: 18,
    fontWeight: '700',
  },
});
