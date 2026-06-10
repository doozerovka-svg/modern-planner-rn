import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Key,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Briefcase,
  User,
  BookOpen,
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import {
  getCategories,
  addCategory,
  deleteCategory,
  Category,
} from '../database/db';
import { getApiKey, saveApiKey, testApiKey } from '../services/gemini';

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#a855f7', // Purple
];

const PRESET_ICONS = ['user', 'briefcase', 'book-open'];

export default function SettingsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'not_set' | 'validating' | 'valid' | 'invalid'>('not_set');

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [newCatIcon, setNewCatIcon] = useState(PRESET_ICONS[0]);
  const [catLoading, setCatLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedKey = await getApiKey();
      if (savedKey) {
        setApiKey(savedKey);
        setApiKeyStatus('valid'); // Assume valid unless tested otherwise
      }
      
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleTestAndSaveKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите API-ключ');
      return;
    }
    setApiKeyStatus('validating');
    try {
      const isValid = await testApiKey(apiKey.trim());
      if (isValid) {
        await saveApiKey(apiKey.trim());
        setApiKeyStatus('valid');
        Alert.alert('Успешно', 'API-ключ Gemini верен и успешно сохранен.');
      } else {
        setApiKeyStatus('invalid');
        Alert.alert('Ошибка', 'Неверный API-ключ Gemini. Пожалуйста, проверьте его и попробуйте снова.');
      }
    } catch (error) {
      setApiKeyStatus('invalid');
      Alert.alert('Ошибка', 'Произошла ошибка при проверке API-ключа.');
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите название категории');
      return;
    }

    setCatLoading(true);
    try {
      await addCategory(newCatName.trim(), newCatColor, newCatIcon);
      setNewCatName('');
      const cats = await getCategories();
      setCategories(cats);
      Alert.alert('Успешно', 'Категория успешно добавлена');
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось добавить категорию. Имя может дублироваться.');
    } finally {
      setCatLoading(false);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (['Личное', 'Работа', 'Учеба'].includes(name)) {
      Alert.alert('Блокировка', 'Предустановленные категории нельзя удалить.');
      return;
    }

    Alert.alert(
      'Удалить категорию',
      `Вы уверены, что хотите удалить категорию «${name}»? Все задачи из этой категории будут безвозвратно удалены!`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(id);
            const cats = await getCategories();
            setCategories(cats);
          },
        },
      ]
    );
  };

  const getCategoryIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case 'briefcase':
        return <Briefcase size={16} color={color} />;
      case 'book-open':
        return <BookOpen size={16} color={color} />;
      default:
        return <User size={16} color={color} />;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.header}>Настройки</Text>

      {/* API Key Box */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Key size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>{' '}API-ключ Gemini</Text>
        </View>

        <Text style={styles.sectionDescription}>
          API-ключ хранится исключительно на вашем устройстве и используется для прямого безопасного подключения к Google Gemini Flash API с целью авторазбиения задач и анализа заметок.
        </Text>

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="AIzaSy..."
          placeholderTextColor={Colors.textMuted}
          value={apiKey}
          onChangeText={setApiKey}
        />

        <View style={styles.statusRow}>
          <View style={styles.statusIndicator}>
            {apiKeyStatus === 'validating' && (
              <>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.statusText}>{' '}Проверка ключа...</Text>
              </>
            )}
            {apiKeyStatus === 'valid' && (
              <>
                <CheckCircle size={16} color={Colors.success} />
                <Text style={[styles.statusText, { color: Colors.success }]}>{' '}Ключ активен и проверен</Text>
              </>
            )}
            {apiKeyStatus === 'invalid' && (
              <>
                <XCircle size={16} color={Colors.danger} />
                <Text style={[styles.statusText, { color: Colors.danger }]}>{' '}Недействительный ключ</Text>
              </>
            )}
            {apiKeyStatus === 'not_set' && (
              <Text style={styles.statusText}>API-ключ не настроен</Text>
            )}
          </View>

          <Pressable style={styles.verifyButton} onPress={handleTestAndSaveKey}>
            <Text style={styles.verifyButtonText}>Проверить и Сохранить</Text>
          </Pressable>
        </View>
      </View>

      {/* Category Manager */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Plus size={18} color={Colors.primaryLight} />
          <Text style={styles.sectionTitle}>{' '}Управление категориями</Text>
        </View>

        {/* Existing categories */}
        <View style={styles.categoriesList}>
          {categories.map(c => {
            const isDefault = ['Личное', 'Работа', 'Учеба'].includes(c.name);
            return (
              <View key={c.id} style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <View style={[styles.iconFrame, { backgroundColor: c.color + '22' }]}>
                    {getCategoryIcon(c.icon, c.color)}
                  </View>
                  <Text style={styles.categoryName}>{c.name}</Text>
                </View>

                {!isDefault && (
                  <Pressable onPress={() => handleDeleteCategory(c.id, c.name)} style={styles.deleteButton}>
                    <Trash2 size={16} color={Colors.danger} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        {/* Create new category form */}
        <View style={styles.addCategoryForm}>
          <Text style={styles.formSubTitle}>Создать категорию</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Название категории"
            placeholderTextColor={Colors.textMuted}
            value={newCatName}
            onChangeText={setNewCatName}
          />

          {/* Color Selector */}
          <Text style={styles.label}>Выберите цвет</Text>
          <View style={styles.pickerRow}>
            {PRESET_COLORS.map(c => (
              <Pressable
                key={c}
                style={[
                  styles.colorChip,
                  { backgroundColor: c },
                  newCatColor === c && styles.activeColorChip
                ]}
                onPress={() => setNewCatColor(c)}
              />
            ))}
          </View>

          {/* Icon Selector */}
          <Text style={styles.label}>Выберите иконку</Text>
          <View style={styles.pickerRow}>
            {PRESET_ICONS.map(i => (
              <Pressable
                key={i}
                style={[
                  styles.iconChip,
                  newCatIcon === i && styles.activeIconChip
                ]}
                onPress={() => setNewCatIcon(i)}
              >
                {getCategoryIcon(i, newCatIcon === i ? Colors.primary : Colors.textSecondary)}
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.saveButton, catLoading && styles.disabledButton]}
            onPress={handleAddCategory}
            disabled={catLoading}
          >
            {catLoading ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Создать категорию</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  sectionCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  verifyButtonText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  categoriesList: {
    gap: 8,
    marginBottom: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconFrame: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 6,
  },
  addCategoryForm: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 16,
  },
  formSubTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  colorChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  activeColorChip: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconChip: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '11',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
