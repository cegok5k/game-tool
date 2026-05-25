import { create } from 'zustand'

type State = {
  path: string | null
  original: string
  draft: string
  isDirty: boolean
  parseError: string | null
  loadFile: (path: string, content: string) => void
  setDraft: (content: string) => void
  validate: () => void
  markSaved: () => void
  reset: () => void
}

export const useConfigEditorStore = create<State>((set, get) => ({
  path: null,
  original: '',
  draft: '',
  isDirty: false,
  parseError: null,
  loadFile: (path, content) => set({ path, original: content, draft: content, isDirty: false, parseError: null }),
  setDraft: (draft) => {
    const original = get().original
    set({ draft, isDirty: draft !== original })
  },
  validate: () => {
    const draft = get().draft
    try {
      JSON.parse(draft)
      set({ parseError: null })
    } catch (e) {
      set({ parseError: e instanceof Error ? e.message : String(e) })
    }
  },
  markSaved: () => set({ original: get().draft, isDirty: false, parseError: null }),
  reset: () => set({ path: null, original: '', draft: '', isDirty: false, parseError: null }),
}))
