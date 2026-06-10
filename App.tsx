import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Pressable, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ListTodo, FileText, Settings } from 'lucide-react-native';
import { Colors } from './src/theme/colors';
import { initDb } from './src/database/db';

// Screens
import TasksScreen from './src/screens/TasksScreen';
import NotesScreen from './src/screens/NotesScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [currentTab, setCurrentTab] = useState<'tasks' | 'notes' | 'settings'>('tasks');

  useEffect(() => {
    async function setup() {
      try {
        await initDb();
        setDbReady(true);
      } catch (error) {
        console.error('Failed to initialize SQLite Database:', error);
      }
    }
    setup();
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Инициализация базы данных...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 'notes':
        return <NotesScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <TasksScreen />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Active Screen Content */}
      <View style={styles.screenContainer}>
        {renderActiveScreen()}
      </View>

      {/* Glassmorphic Bottom Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          style={[styles.navItem, currentTab === 'tasks' && styles.activeNavItem]}
          onPress={() => setCurrentTab('tasks')}
        >
          <ListTodo size={22} color={currentTab === 'tasks' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.navText, currentTab === 'tasks' && styles.activeNavText]}>
            Задачи
          </Text>
        </Pressable>

        <Pressable
          style={[styles.navItem, currentTab === 'notes' && styles.activeNavItem]}
          onPress={() => setCurrentTab('notes')}
        >
          <FileText size={22} color={currentTab === 'notes' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.navText, currentTab === 'notes' && styles.activeNavText]}>
            Заметки
          </Text>
        </Pressable>

        <Pressable
          style={[styles.navItem, currentTab === 'settings' && styles.activeNavItem]}
          onPress={() => setCurrentTab('settings')}
        >
          <Settings size={22} color={currentTab === 'settings' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.navText, currentTab === 'settings' && styles.activeNavText]}>
            Настройки
          </Text>
        </Pressable>
      </View>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  screenContainer: {
    flex: 1,
  },
  navBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 64,
    backgroundColor: 'rgba(30, 41, 59, 0.95)', // CardBg with high opacity for premium glassmorphism
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 8,
    // Shadow details for Premium UI depth
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  activeNavItem: {
    backgroundColor: Colors.background + '66',
  },
  navText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  activeNavText: {
    color: Colors.accent,
    fontWeight: 'bold',
  },
});
