import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface SavedFile {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  size: number;
  conversationId?: string;
  savedAt: number;
}

interface FilesState {
  files: SavedFile[];
  saveFile: (file: Omit<SavedFile, 'id' | 'savedAt'>) => string;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
}

export const useSavedFilesStore = create<FilesState>()(
  persist(
    (set) => ({
      files: [] as SavedFile[],

      saveFile: (file) => {
        const id = uuidv4();
        set((s) => ({ files: [{ ...file, id, savedAt: Date.now() }, ...s.files] }));
        return id;
      },

      renameFile: (id, name) =>
        set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, name } : f)) })),

      deleteFile: (id) =>
        set((s) => ({ files: s.files.filter((f) => f.id !== id) })),
    }),
    { name: 'openconduit-files' },
  ),
);
