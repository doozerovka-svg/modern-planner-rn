import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  User,
  Briefcase,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Check,
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import {
  getTasks,
  getCategories,
  addTask,
  deleteTask,
  toggleTaskCompletion,
  toggleSubtaskCompletion,
  Category,
  TaskWithSubtasks,
} from '../database/db';
import { decomposeTask } from '../services/gemini';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<TaskWithSubtasks[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCatId, setTaskCatId] = useState<number>(1);
  const [taskPriority, setTaskPriority] = useState<number>(1); // 1-Low, 2-Medium, 3-High
  const [taskDueDate, setTaskDueDate] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [subtasksList, setSubtasksList] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
      if (cats.length > 0 && !cats.some(c => c.id === taskCatId)) {
        setTaskCatId(cats[0].id);
      }
      const allTasks = await getTasks(selectedCategory);
      setTasks(allTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleAddTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите название задачи');
      return;
    }
    try {
      await addTask(
        taskCatId,
        taskTitle,
        taskDesc || null,
        taskDueDate || null,
        taskPriority,
        subtasksList
      );
      resetForm();
      setModalVisible(false);
      loadData();
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось добавить задачу');
    }
  };

  const handleDeleteTask = async (id: number) => {
    Alert.alert('Удалить задачу', 'Вы уверены, что хотите удалить эту задачу?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(id);
          loadData();
        },
      },
    ]);
  };

  const handleToggleTask = async (id: number, currentVal: boolean) => {
    await toggleTaskCompletion(id, !currentVal);
    loadData();
  };

  const handleToggleSubtask = async (id: number, currentVal: boolean) => {
    await toggleSubtaskCompletion(id, !currentVal);
    loadData();
  };

  const handleDecomposeWithAi = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите название задачи для разбиения ИИ');
      return;
    }
    setAiLoading(true);
    try {
      const subtasks = await decomposeTask(taskTitle, taskDesc);
      setSubtasksList(prev => [...prev, ...subtasks]);
    } catch (error: any) {
      Alert.alert('Ошибка ИИ', error.message || 'Не удалось разбить задачу с помощью Gemini AI');
    } finally {
      setAiLoading(false);
    }
  };

  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority(1);
    setTaskDueDate('');
    setSubtasksList([]);
    setNewSubtask('');
  };

  const addSubtaskToForm = () => {
    if (newSubtask.trim()) {
      setSubtasksList(prev => [...prev, newSubtask.trim()]);
      setNewSubtask('');
    }
  };

  const removeSubtaskFromForm = (index: number) => {
    setSubtasksList(prev => prev.filter((_, i) => i !== index));
  };

  // Completion calculation
  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getCategoryIcon = (iconName: string, color: string, size = 18) => {
    switch (iconName) {
      case 'briefcase':
        return <Briefcase size={size} color={color} />;
      case 'book-open':
        return <BookOpen size={size} color={color} />;
      default:
        return <User size={size} color={color} />;
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority === 3) return Colors.danger;
    if (priority === 2) return Colors.warning;
    return Colors.textMuted;
  };

  const getPriorityLabel = (priority: number) => {
    if (priority === 3) return 'Высокий';
    if (priority === 2) return 'Средний';
    return 'Низкий';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Мои Задачи</Text>

      {/* Completion Progress Widget */}
      {totalCount > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressLabel}>Процент выполнения</Text>
            <Text style={styles.progressVal}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressSubtext}>
            Выполнено {completedCount} из {totalCount} задач
          </Text>
        </View>
      )}

      {/* Category Horizontal Filter Chips */}
      <View style={{ maxHeight: 48, marginBottom: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <Pressable
            style={[styles.chip, selectedCategory === undefined && styles.activeChip]}
            onPress={() => setSelectedCategory(undefined)}
          >
            <Text style={[styles.chipText, selectedCategory === undefined && styles.activeChipText]}>
              Все
            </Text>
          </Pressable>
          {categories.map(cat => (
            <Pressable
              key={cat.id}
              style={[styles.chip, selectedCategory === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color }]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              {getCategoryIcon(cat.icon, selectedCategory === cat.id ? cat.color : Colors.textSecondary, 14)}
              <Text style={[
                styles.chipText,
                selectedCategory === cat.id && { color: cat.color, fontWeight: 'bold' }
              ]}>
                {' '}{cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Tasks List */}
      <ScrollView contentContainerStyle={styles.taskList} showsVerticalScrollIndicator={false}>
        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Задачи не найдены</Text>
            <Text style={styles.emptyStateText}>
              {selectedCategory === undefined
                ? 'Создайте задачу, чтобы начать планирование!'
                : 'В этой категории пока нет задач.'}
            </Text>
          </View>
        ) : (
          tasks.map(task => {
            const isExpanded = expandedTaskId === task.id;
            const subtaskCompletedCount = task.subtasks.filter(s => s.isCompleted).length;
            const subtaskTotalCount = task.subtasks.length;

            return (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeaderRow}>
                  {/* Complete/Incomplete Circle */}
                  <Pressable onPress={() => handleToggleTask(task.id, task.isCompleted)} style={styles.checkButton}>
                    {task.isCompleted ? (
                      <CheckCircle2 size={24} color={Colors.success} />
                    ) : (
                      <Circle size={24} color={Colors.textSecondary} />
                    )}
                  </Pressable>

                  {/* Task details */}
                  <Pressable
                    style={styles.taskTitlePressable}
                    onPress={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  >
                    <Text style={[styles.taskTitle, task.isCompleted && styles.taskTitleCompleted]}>
                      {task.title}
                    </Text>
                    {task.description && (
                      <Text numberOfLines={1} style={styles.taskDesc}>
                        {task.description}
                      </Text>
                    )}

                    <View style={styles.taskMetaRow}>
                      {/* Priority Dot */}
                      <View style={styles.metaBadge}>
                        <View style={[styles.dot, { backgroundColor: getPriorityColor(task.priority) }]} />
                        <Text style={styles.metaText}>{getPriorityLabel(task.priority)}</Text>
                      </View>

                      {/* Due Date */}
                      {task.dueDate && (
                        <View style={styles.metaBadge}>
                          <Clock size={12} color={Colors.textMuted} />
                          <Text style={styles.metaText}>{' '}{task.dueDate}</Text>
                        </View>
                      )}

                      {/* Subtasks Count */}
                      {subtaskTotalCount > 0 && (
                        <View style={styles.metaBadge}>
                          <Text style={styles.metaText}>
                            📊 {subtaskCompletedCount}/{subtaskTotalCount} подзадач
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>

                  {/* Trash / Action Buttons */}
                  <View style={styles.taskActions}>
                    <Pressable onPress={() => handleDeleteTask(task.id)} style={styles.actionIconButton}>
                      <Trash2 size={18} color={Colors.danger} />
                    </Pressable>
                    <Pressable onPress={() => setExpandedTaskId(isExpanded ? null : task.id)} style={styles.actionIconButton}>
                      {isExpanded ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
                    </Pressable>
                  </View>
                </View>

                {/* Expanded Subtasks & Description */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {task.description && (
                      <View style={styles.expandedDescBox}>
                        <Text style={styles.expandedDescTitle}>Описание</Text>
                        <Text style={styles.expandedDescText}>{task.description}</Text>
                      </View>
                    )}

                    {/* Subtasks checklist */}
                    <Text style={styles.subtasksHeader}>Чек-лист</Text>
                    {task.subtasks.length === 0 ? (
                      <Text style={styles.noSubtasksText}>Шаги еще не добавлены.</Text>
                    ) : (
                      task.subtasks.map(sub => (
                        <Pressable
                          key={sub.id}
                          onPress={() => handleToggleSubtask(sub.id, sub.isCompleted)}
                          style={styles.subtaskRow}
                        >
                          <View style={styles.subtaskCheck}>
                            {sub.isCompleted ? (
                              <Check size={14} color={Colors.success} />
                            ) : null}
                          </View>
                          <Text style={[styles.subtaskTitle, sub.isCompleted && styles.subtaskTitleCompleted]}>
                            {sub.title}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB - Create Task */}
      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus color={Colors.textPrimary} size={24} />
      </Pressable>

      {/* Add Task Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новая задача</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Отмена</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Название</Text>
              <TextInput
                style={styles.input}
                placeholder="Что нужно сделать?"
                placeholderTextColor={Colors.textMuted}
                value={taskTitle}
                onChangeText={setTaskTitle}
              />

              <Text style={styles.label}>Описание</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Добавьте детали задачи..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                value={taskDesc}
                onChangeText={setTaskDesc}
              />

              {/* AI Decompose Button */}
              <Pressable
                style={[styles.aiButton, aiLoading && styles.disabledButton]}
                onPress={handleDecomposeWithAi}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <>
                    <Sparkles size={16} color={Colors.accent} />
                    <Text style={styles.aiButtonText}>{' '}Разбить на шаги с Gemini ИИ</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Категория</Text>
                  <View style={styles.pickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                      {categories.map(c => (
                        <Pressable
                          key={c.id}
                          style={[
                            styles.pickerOption,
                            taskCatId === c.id && { backgroundColor: c.color + '22', borderColor: c.color }
                          ]}
                          onPress={() => setTaskCatId(c.id)}
                        >
                          <Text style={[styles.pickerText, taskCatId === c.id && { color: c.color, fontWeight: 'bold' }]}>
                            {c.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Приоритет</Text>
                  <View style={styles.prioritySelector}>
                    {[1, 2, 3].map(p => (
                      <Pressable
                        key={p}
                        style={[
                          styles.priorityOption,
                          taskPriority === p && {
                            backgroundColor: p === 3 ? Colors.danger + '22' : p === 2 ? Colors.warning + '22' : Colors.primary + '22',
                            borderColor: p === 3 ? Colors.danger : p === 2 ? Colors.warning : Colors.primary
                          }
                        ]}
                        onPress={() => setTaskPriority(p)}
                      >
                        <Text style={[
                          styles.priorityText,
                          taskPriority === p && {
                            color: p === 3 ? Colors.danger : p === 2 ? Colors.warning : Colors.primary,
                            fontWeight: 'bold'
                          }
                        ]}>
                          {getPriorityLabel(p)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Срок выполнения (необязательно)</Text>
              <TextInput
                style={styles.input}
                placeholder="например, Завтра, Пятница, 15 июня"
                placeholderTextColor={Colors.textMuted}
                value={taskDueDate}
                onChangeText={setTaskDueDate}
              />

              {/* Subtasks lists in Form */}
              <Text style={styles.label}>Подзадачи ({subtasksList.length})</Text>
              {subtasksList.map((sub, idx) => (
                <View key={idx} style={styles.subtaskFormItem}>
                  <Text style={styles.subtaskFormText}>{sub}</Text>
                  <Pressable onPress={() => removeSubtaskFromForm(idx)}>
                    <Text style={styles.removeSubtaskText}>Удалить</Text>
                  </Pressable>
                </View>
              ))}

              <View style={styles.subtaskInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Добавить шаг..."
                  placeholderTextColor={Colors.textMuted}
                  value={newSubtask}
                  onChangeText={setNewSubtask}
                />
                <Pressable style={styles.addSubtaskButton} onPress={addSubtaskToForm}>
                  <Text style={styles.addSubtaskButtonText}>Добавить</Text>
                </Pressable>
              </View>

              {/* Save Button */}
              <Pressable style={styles.saveButton} onPress={handleAddTask}>
                <Text style={styles.saveButtonText}>Создать задачу</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  progressCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  progressVal: {
    color: Colors.accent,
    fontWeight: 'bold',
    fontSize: 16,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  progressSubtext: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  categoryScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeChip: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  activeChipText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  taskList: {
    gap: 12,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  taskCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkButton: {
    padding: 2,
    marginRight: 12,
    marginTop: 2,
  },
  taskTitlePressable: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  taskDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  taskMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionIconButton: {
    padding: 6,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 12,
    paddingTop: 12,
  },
  expandedDescBox: {
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expandedDescTitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  expandedDescText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  subtasksHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  noSubtasksText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  subtaskCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  subtaskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  cancelText: {
    color: Colors.danger,
    fontSize: 16,
  },
  modalForm: {
    paddingBottom: 40,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBg,
    borderColor: Colors.accent,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  aiButtonText: {
    color: Colors.accent,
    fontWeight: 'bold',
    fontSize: 14,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pickerContainer: {
    marginVertical: 4,
  },
  pickerScroll: {
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pickerText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  priorityText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  subtaskFormItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subtaskFormText: {
    color: Colors.textPrimary,
    fontSize: 13,
    flex: 1,
  },
  removeSubtaskText: {
    color: Colors.danger,
    fontSize: 12,
    marginLeft: 8,
  },
  subtaskInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  addSubtaskButton: {
    backgroundColor: Colors.cardBgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addSubtaskButtonText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
