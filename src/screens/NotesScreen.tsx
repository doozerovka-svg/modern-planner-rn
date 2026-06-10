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
  Dimensions,
} from 'react-native';
import {
  Plus,
  Trash2,
  Sparkles,
  Tag,
  FileText,
  Check,
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import {
  getNotes,
  addNote,
  updateNote,
  deleteNote,
  Note,
} from '../database/db';
import { summarizeNote, tagNote } from '../services/gemini';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 2;

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  
  // Form State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSummary, setNoteSummary] = useState<string | null>(null);
  const [noteTags, setNoteTags] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const allNotes = await getNotes();
      setNotes(allNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleOpenEdit = (note: Note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteSummary(note.summary);
    setNoteTags(note.tags);
    setModalVisible(true);
  };

  const handleOpenCreate = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteSummary(null);
    setNoteTags(null);
    setModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите название и текст заметки');
      return;
    }

    try {
      if (editingNote) {
        await updateNote(editingNote.id, noteTitle, noteContent, noteSummary, noteTags);
      } else {
        await addNote(noteTitle, noteContent, noteSummary, noteTags);
      }
      setModalVisible(false);
      loadNotes();
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить заметку');
    }
  };

  const handleDeleteNote = async (id: number) => {
    Alert.alert('Удалить заметку', 'Вы уверены, что хотите удалить эту заметку?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(id);
          loadNotes();
        },
      },
    ]);
  };

  const handleAiSummarizeNote = async (noteId?: number, contentToUse?: string) => {
    const textToSummarize = contentToUse || noteContent;
    if (!textToSummarize.trim()) {
      Alert.alert('Ошибка', 'Текст заметки пуст');
      return;
    }

    if (noteId) {
      setActionLoadingId(noteId);
    } else {
      setAiLoading(true);
    }

    try {
      const summaryResult = await summarizeNote(textToSummarize);
      if (noteId) {
        const target = notes.find(n => n.id === noteId);
        if (target) {
          await updateNote(noteId, target.title, target.content, summaryResult, target.tags);
          loadNotes();
        }
      } else {
        setNoteSummary(summaryResult);
      }
    } catch (error: any) {
      Alert.alert('Ошибка ИИ', error.message || 'Не удалось составить краткий пересказ');
    } finally {
      setAiLoading(false);
      setActionLoadingId(null);
    }
  };

  const handleAiTagNote = async (noteId?: number, contentToUse?: string) => {
    const textToTag = contentToUse || noteContent;
    if (!textToTag.trim()) {
      Alert.alert('Ошибка', 'Текст заметки пуст');
      return;
    }

    if (noteId) {
      setActionLoadingId(noteId);
    } else {
      setAiLoading(true);
    }

    try {
      const tagsResult = await tagNote(textToTag);
      if (noteId) {
        const target = notes.find(n => n.id === noteId);
        if (target) {
          await updateNote(noteId, target.title, target.content, target.summary, tagsResult);
          loadNotes();
        }
      } else {
        setNoteTags(tagsResult);
      }
    } catch (error: any) {
      Alert.alert('Ошибка ИИ', error.message || 'Не удалось сгенерировать хэштеги');
    } finally {
      setAiLoading(false);
      setActionLoadingId(null);
    }
  };

  const renderTags = (tagsStr: string | null) => {
    if (!tagsStr) return null;
    return (
      <View style={styles.tagsRow}>
        {tagsStr.split(',').map((tag, idx) => (
          <View key={idx} style={styles.tagBadge}>
            <Text style={styles.tagText}>{tag.trim()}</Text>
          </View>
        ))}
      </View>
    );
  };

  const leftColumnNotes = notes.filter((_, idx) => idx % 2 === 0);
  const rightColumnNotes = notes.filter((_, idx) => idx % 2 !== 0);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Мои Заметки</Text>

      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={64} color={Colors.textMuted} />
          <Text style={styles.emptyStateTitle}>Заметок пока нет</Text>
          <Text style={styles.emptyStateText}>
            Записывайте свои мысли, планы, списки покупок или важные памятки.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notesScroll}>
          <View style={styles.masonryContainer}>
            {/* Left Column */}
            <View style={styles.column}>
              {leftColumnNotes.map(note => (
                <View key={note.id} style={styles.noteCard}>
                  <Pressable onPress={() => handleOpenEdit(note)}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <Text numberOfLines={6} style={styles.noteContent}>
                      {note.content}
                    </Text>
                  </Pressable>

                  {note.summary && (
                    <View style={styles.summaryContainer}>
                      <View style={styles.summaryHeader}>
                        <Sparkles size={10} color={Colors.accent} />
                        <Text style={styles.summaryTitle}>{' '}ИИ Пересказ</Text>
                      </View>
                      <Text style={styles.summaryText}>{note.summary}</Text>
                    </View>
                  )}

                  {renderTags(note.tags)}

                  <View style={styles.cardActions}>
                    {actionLoadingId === note.id ? (
                      <ActivityIndicator size="small" color={Colors.accent} style={{ padding: 6 }} />
                    ) : (
                      <>
                        <Pressable
                          onPress={() => handleAiSummarizeNote(note.id, note.content)}
                          style={styles.cardActionButton}
                          hitSlop={8}
                        >
                          <Sparkles size={14} color={Colors.accent} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleAiTagNote(note.id, note.content)}
                          style={styles.cardActionButton}
                          hitSlop={8}
                        >
                          <Tag size={14} color={Colors.primaryLight} />
                        </Pressable>
                      </>
                    )}
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={() => handleDeleteNote(note.id)}
                      style={styles.cardActionButton}
                      hitSlop={8}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            {/* Right Column */}
            <View style={styles.column}>
              {rightColumnNotes.map(note => (
                <View key={note.id} style={styles.noteCard}>
                  <Pressable onPress={() => handleOpenEdit(note)}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <Text numberOfLines={6} style={styles.noteContent}>
                      {note.content}
                    </Text>
                  </Pressable>

                  {note.summary && (
                    <View style={styles.summaryContainer}>
                      <View style={styles.summaryHeader}>
                        <Sparkles size={10} color={Colors.accent} />
                        <Text style={styles.summaryTitle}>{' '}ИИ Пересказ</Text>
                      </View>
                      <Text style={styles.summaryText}>{note.summary}</Text>
                    </View>
                  )}

                  {renderTags(note.tags)}

                  <View style={styles.cardActions}>
                    {actionLoadingId === note.id ? (
                      <ActivityIndicator size="small" color={Colors.accent} style={{ padding: 6 }} />
                    ) : (
                      <>
                        <Pressable
                          onPress={() => handleAiSummarizeNote(note.id, note.content)}
                          style={styles.cardActionButton}
                          hitSlop={8}
                        >
                          <Sparkles size={14} color={Colors.accent} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleAiTagNote(note.id, note.content)}
                          style={styles.cardActionButton}
                          hitSlop={8}
                        >
                          <Tag size={14} color={Colors.primaryLight} />
                        </Pressable>
                      </>
                    )}
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={() => handleDeleteNote(note.id)}
                      style={styles.cardActionButton}
                      hitSlop={8}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* FAB - Create Note */}
      <Pressable style={styles.fab} onPress={handleOpenCreate}>
        <Plus color={Colors.textPrimary} size={24} />
      </Pressable>

      {/* Add/Edit Note Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingNote ? 'Редактировать заметку' : 'Новая заметка'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Отмена</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Название</Text>
              <TextInput
                style={styles.input}
                placeholder="Напишите заголовок заметки..."
                placeholderTextColor={Colors.textMuted}
                value={noteTitle}
                onChangeText={setNoteTitle}
              />

              <Text style={styles.label}>Текст заметки</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Запишите свои мысли..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={10}
                value={noteContent}
                onChangeText={setNoteContent}
              />

              {/* AI Helper Tools Box */}
              <View style={styles.aiToolsBox}>
                <Text style={styles.aiToolsTitle}>ИИ-редактор Gemini</Text>
                
                <View style={styles.aiToolsRow}>
                  <Pressable
                    style={[styles.aiToolButton, aiLoading && styles.disabledButton]}
                    onPress={() => handleAiSummarizeNote(undefined, noteContent)}
                    disabled={aiLoading}
                  >
                    <Sparkles size={14} color={Colors.accent} />
                    <Text style={styles.aiToolButtonText}>{' '}Краткий пересказ</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.aiToolButton, aiLoading && styles.disabledButton]}
                    onPress={() => handleAiTagNote(undefined, noteContent)}
                    disabled={aiLoading}
                  >
                    <Tag size={14} color={Colors.primaryLight} />
                    <Text style={styles.aiToolButtonText}>{' '}Создать теги</Text>
                  </Pressable>
                </View>

                {/* Live Preview of AI tags and summary in form */}
                {noteSummary && (
                  <View style={[styles.summaryContainer, { marginTop: 12 }]}>
                    <Text style={styles.summaryTitle}>Пересказ от ИИ</Text>
                    <Text style={styles.summaryText}>{noteSummary}</Text>
                  </View>
                )}

                {noteTags && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.summaryTitle}>Хэштеги от ИИ</Text>
                    {renderTags(noteTags)}
                  </View>
                )}
              </View>

              {/* Save Button */}
              <Pressable style={styles.saveButton} onPress={handleSaveNote}>
                <Text style={styles.saveButtonText}>
                  {editingNote ? 'Сохранить изменения' : 'Создать заметку'}
                </Text>
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
  },
  emptyStateTitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  notesScroll: {
    paddingBottom: 120,
  },
  masonryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    width: COLUMN_WIDTH,
    gap: 12,
  },
  noteCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-between',
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  noteContent: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  summaryContainer: {
    backgroundColor: Colors.background,
    borderColor: Colors.borderLight,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 10,
  },
  tagBadge: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary + '44',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    color: Colors.primaryLight,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
    gap: 4,
  },
  cardActionButton: {
    padding: 6,
    borderRadius: 6,
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
    height: 180,
    textAlignVertical: 'top',
  },
  aiToolsBox: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    marginVertical: 12,
  },
  aiToolsTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  aiToolsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  aiToolButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderColor: Colors.borderLight,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
  },
  aiToolButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
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
