// Central NEXA Zustand Store
import { create } from 'zustand';
import {
  ProjectRecord,
  FileRecord,
  MessageRecord,
  PlanStep,
  getAllProjects,
  getProject,
  saveProject,
  getProjectFiles,
  getProjectMessages,
  putMessage,
  deleteProjectRecord,
} from './db';
import { VirtualFS, FSNode } from './fs';
import { NexaSettings, loadSettings, saveSettings } from './settings';
import {
  PROVIDER_INSTANCES,
  buildSystemPrompt,
  parseFileChangesFromText,
  enhanceUserPrompt,
} from '../ai/provider';

interface NexaState {
  // Navigation & Settings
  currentView: 'home' | 'ide';
  settings: NexaSettings;
  isSettingsOpen: boolean;
  settingsPromptReason?: string;
  isExportOpen: boolean;

  // Projects list
  projects: ProjectRecord[];
  isLoadingProjects: boolean;

  // Active Project State
  activeProject: ProjectRecord | null;
  files: FileRecord[];
  fileTree: FSNode[];
  activeFilePath: string;
  openTabs: string[];
  activeFileContent: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;

  // AI & Chat State
  messages: MessageRecord[];
  isStreaming: boolean;
  activeSteps: PlanStep[];
  abortController: AbortController | null;

  // Preview & Terminal
  previewRefreshTrigger: number;
  isTerminalCollapsed: boolean;
  mobileActiveTab: 'chat' | 'files' | 'preview' | 'terminal';

  // Actions
  loadInitialData: () => Promise<void>;
  openSettings: (reason?: string) => void;
  closeSettings: () => void;
  updateSettings: (newSettings: NexaSettings) => void;
  openExportModal: () => void;
  closeExportModal: () => void;

  // Project Actions
  createProjectFromPrompt: (promptText: string, templateType?: 'saas' | 'kanban' | 'docs') => Promise<string>;
  openProject: (projectId: string) => Promise<void>;
  updateProjectName: (newName: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  navigateToHome: () => void;

  // File Actions
  selectFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  updateActiveContent: (content: string) => void;
  saveActiveFile: () => Promise<void>;
  createNewFile: (path: string) => Promise<void>;
  createNewFolder: (path: string) => Promise<void>;
  deleteNode: (path: string) => Promise<void>;
  renameNode: (oldPath: string, newPath: string) => Promise<void>;
  importFiles: (files: { path: string; content: string }[]) => Promise<void>;

  // Chat & AI Actions
  sendMessage: (text: string) => Promise<void>;
  stopStreaming: () => void;
  enhancePrompt: (text: string) => string;

  // UI Toggles
  setTerminalCollapsed: (collapsed: boolean) => void;
  toggleTerminalCollapse: () => void;
  triggerPreviewRefresh: () => void;
  setMobileActiveTab: (tab: 'chat' | 'files' | 'preview' | 'terminal') => void;
}

export const useNexaStore = create<NexaState>((set, get) => ({
  currentView: 'home',
  settings: loadSettings(),
  isSettingsOpen: false,
  settingsPromptReason: undefined,
  isExportOpen: false,

  projects: [],
  isLoadingProjects: true,

  activeProject: null,
  files: [],
  fileTree: [],
  activeFilePath: '',
  openTabs: [],
  activeFileContent: '',
  hasUnsavedChanges: false,
  isSaving: false,
  lastSavedAt: null,

  messages: [],
  isStreaming: false,
  activeSteps: [],
  abortController: null,

  previewRefreshTrigger: 0,
  isTerminalCollapsed: false,
  mobileActiveTab: 'preview',

  loadInitialData: async () => {
    try {
      const projects = await getAllProjects();
      set({ projects, isLoadingProjects: false });
    } catch (err) {
      console.error('Failed to load projects from DB:', err);
      set({ isLoadingProjects: false });
    }
  },

  openSettings: (reason) => set({ isSettingsOpen: true, settingsPromptReason: reason }),
  closeSettings: () => set({ isSettingsOpen: false, settingsPromptReason: undefined }),
  updateSettings: (newSettings) => {
    saveSettings(newSettings);
    set({ settings: newSettings });
  },

  openExportModal: () => set({ isExportOpen: true }),
  closeExportModal: () => set({ isExportOpen: false }),

  createProjectFromPrompt: async (promptText, templateType = 'saas') => {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nameWords = promptText.trim().split(/\s+/).slice(0, 4).join(' ');
    const name = nameWords ? nameWords.charAt(0).toUpperCase() + nameWords.slice(1) : 'New Project';

    const newProject: ProjectRecord = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      description: promptText.trim(),
      template: templateType,
    };

    await saveProject(newProject);
    await VirtualFS.populateTemplate(id, templateType);

    // Initial user message in DB
    const initialUserMsg: MessageRecord = {
      id: `msg_${Date.now()}`,
      projectId: id,
      role: 'user',
      content: promptText,
      time: Date.now(),
    };
    await putMessage(initialUserMsg);

    // Refresh projects list
    const projects = await getAllProjects();
    set({ projects });

    // Open project and trigger generation if user entered custom idea
    await get().openProject(id);
    get().sendMessage(promptText);

    return id;
  },

  openProject: async (projectId) => {
    try {
      const project = await getProject(projectId);
      if (!project) throw new Error('Project not found');

      const files = await getProjectFiles(projectId);
      const fileTree = await VirtualFS.listTree(projectId);
      const messages = await getProjectMessages(projectId);

      // Default active file is index.html if exists, otherwise first file
      let defaultFile = files.find((f) => f.path === 'index.html')?.path || files[0]?.path || '';
      let defaultContent = files.find((f) => f.path === defaultFile)?.content || '';

      set({
        currentView: 'ide',
        activeProject: project,
        files,
        fileTree,
        activeFilePath: defaultFile,
        openTabs: defaultFile ? [defaultFile] : [],
        activeFileContent: defaultContent,
        hasUnsavedChanges: false,
        messages,
        isStreaming: false,
        activeSteps: [],
        previewRefreshTrigger: Date.now(),
      });
    } catch (err) {
      console.error('Failed to open project:', err);
    }
  },

  updateProjectName: async (newName) => {
    const { activeProject } = get();
    if (!activeProject || !newName.trim()) return;
    const updated = { ...activeProject, name: newName.trim(), updatedAt: Date.now() };
    await saveProject(updated);
    const projects = await getAllProjects();
    set({ activeProject: updated, projects });
  },

  deleteProject: async (projectId) => {
    await deleteProjectRecord(projectId);
    const projects = await getAllProjects();
    const { activeProject } = get();
    if (activeProject?.id === projectId) {
      set({
        currentView: 'home',
        activeProject: null,
        files: [],
        fileTree: [],
        openTabs: [],
        activeFilePath: '',
        activeFileContent: '',
        messages: [],
      });
    }
    set({ projects });
  },

  navigateToHome: () => {
    set({ currentView: 'home' });
  },

  selectFile: async (path) => {
    const { activeProject, openTabs, activeFilePath, activeFileContent, hasUnsavedChanges } = get();
    if (!activeProject) return;

    // Save pending unsaved changes if any
    if (hasUnsavedChanges && activeFilePath) {
      await VirtualFS.writeFile(activeProject.id, activeFilePath, activeFileContent);
    }

    try {
      const content = await VirtualFS.readFile(activeProject.id, path);
      const newTabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
      set({
        activeFilePath: path,
        activeFileContent: content,
        openTabs: newTabs,
        hasUnsavedChanges: false,
      });
    } catch (err) {
      console.error('Error selecting file:', err);
    }
  },

  closeTab: (path) => {
    const { openTabs, activeFilePath } = get();
    const nextTabs = openTabs.filter((t) => t !== path);
    if (activeFilePath === path) {
      const nextActive = nextTabs[nextTabs.length - 1] || '';
      if (nextActive) {
        get().selectFile(nextActive);
      } else {
        set({ openTabs: [], activeFilePath: '', activeFileContent: '' });
      }
    } else {
      set({ openTabs: nextTabs });
    }
  },

  updateActiveContent: (content) => {
    set({ activeFileContent: content, hasUnsavedChanges: true });
    // Debounced autosave
    const { activeProject, activeFilePath } = get();
    if (activeProject && activeFilePath) {
      VirtualFS.writeFile(activeProject.id, activeFilePath, content).then(() => {
        getProjectFiles(activeProject.id).then((files) => {
          set({ files, hasUnsavedChanges: false, lastSavedAt: Date.now() });
        });
      });
    }
  },

  saveActiveFile: async () => {
    const { activeProject, activeFilePath, activeFileContent } = get();
    if (!activeProject || !activeFilePath) return;

    set({ isSaving: true });
    try {
      await VirtualFS.writeFile(activeProject.id, activeFilePath, activeFileContent);
      const files = await getProjectFiles(activeProject.id);
      const fileTree = await VirtualFS.listTree(activeProject.id);
      set({
        files,
        fileTree,
        hasUnsavedChanges: false,
        isSaving: false,
        lastSavedAt: Date.now(),
        previewRefreshTrigger: Date.now(),
      });
    } catch (err) {
      console.error('Failed to save file:', err);
      set({ isSaving: false });
    }
  },

  createNewFile: async (path) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const cleanPath = VirtualFS.normalizePath(path);
    await VirtualFS.writeFile(activeProject.id, cleanPath, '');
    const files = await getProjectFiles(activeProject.id);
    const fileTree = await VirtualFS.listTree(activeProject.id);
    set({ files, fileTree });
    await get().selectFile(cleanPath);
  },

  createNewFolder: async (path) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const cleanPath = VirtualFS.normalizePath(path);
    // In git/virtual fs, create a .gitkeep or placeholder inside folder
    await VirtualFS.writeFile(activeProject.id, `${cleanPath}/.keep`, '');
    const files = await getProjectFiles(activeProject.id);
    const fileTree = await VirtualFS.listTree(activeProject.id);
    set({ files, fileTree });
  },

  deleteNode: async (path) => {
    const { activeProject, activeFilePath, openTabs } = get();
    if (!activeProject) return;
    await VirtualFS.deleteFile(activeProject.id, path);
    const files = await getProjectFiles(activeProject.id);
    const fileTree = await VirtualFS.listTree(activeProject.id);

    const remainingTabs = openTabs.filter((t) => t !== path && !t.startsWith(`${path}/`));
    let nextActive = activeFilePath;
    if (activeFilePath === path || activeFilePath.startsWith(`${path}/`)) {
      nextActive = remainingTabs[0] || files[0]?.path || '';
    }

    set({
      files,
      fileTree,
      openTabs: remainingTabs,
    });

    if (nextActive && nextActive !== activeFilePath) {
      await get().selectFile(nextActive);
    }
  },

  renameNode: async (oldPath, newPath) => {
    const { activeProject, openTabs, activeFilePath } = get();
    if (!activeProject) return;
    await VirtualFS.renameFile(activeProject.id, oldPath, newPath);
    const files = await getProjectFiles(activeProject.id);
    const fileTree = await VirtualFS.listTree(activeProject.id);

    const updatedTabs = openTabs.map((t) => (t === oldPath ? newPath : t));
    set({
      files,
      fileTree,
      openTabs: updatedTabs,
      activeFilePath: activeFilePath === oldPath ? newPath : activeFilePath,
    });
  },

  importFiles: async (newFiles) => {
    const { activeProject } = get();
    if (!activeProject) return;
    for (const f of newFiles) {
      await VirtualFS.writeFile(activeProject.id, f.path, f.content);
    }
    const files = await getProjectFiles(activeProject.id);
    const fileTree = await VirtualFS.listTree(activeProject.id);
    set({ files, fileTree, previewRefreshTrigger: Date.now() });
  },

  enhancePrompt: (text) => enhanceUserPrompt(text),

  sendMessage: async (text) => {
    const { activeProject, settings, files, isStreaming } = get();
    if (!activeProject || isStreaming) return;

    // Check if user has an active key
    const currentKey = settings.apiKeys[settings.provider];
    if (!currentKey && settings.provider !== 'custom') {
      // Friendly open settings with message
      get().openSettings(`Please set your ${settings.provider} API key to stream live AI responses.`);
      return;
    }

    const abortController = new AbortController();
    set({ isStreaming: true, abortController });

    // Step pipeline
    const initialSteps: PlanStep[] = [
      { id: '1', name: 'Understand', status: 'running' },
      { id: '2', name: 'Plan', status: 'pending' },
      { id: '3', name: 'Build', status: 'pending' },
      { id: '4', name: 'Review', status: 'pending' },
      { id: '5', name: 'Fix', status: 'pending' },
    ];
    set({ activeSteps: initialSteps });

    // Save user message to DB
    const userMsg: MessageRecord = {
      id: `user_${Date.now()}`,
      projectId: activeProject.id,
      role: 'user',
      content: text,
      time: Date.now(),
    };
    await putMessage(userMsg);
    set((state) => ({ messages: [...state.messages, userMsg] }));

    // Prepare assistant message record
    const assistantMsgId = `asst_${Date.now()}`;
    let accumulatedText = '';

    const updateStep = (index: number, status: 'pending' | 'running' | 'completed' | 'failed') => {
      set((state) => {
        const nextSteps = [...state.activeSteps];
        if (nextSteps[index]) {
          nextSteps[index] = { ...nextSteps[index], status };
        }
        return { activeSteps: nextSteps };
      });
    };

    try {
      // Step 1: Understand
      await new Promise((r) => setTimeout(r, 400));
      updateStep(0, 'completed');
      updateStep(1, 'running');

      // Step 2: Plan
      await new Promise((r) => setTimeout(r, 400));
      updateStep(1, 'completed');
      updateStep(2, 'running');

      // Build context
      const currentFiles = await getProjectFiles(activeProject.id);
      const systemPrompt = buildSystemPrompt(currentFiles);

      const conversationHistory = get().messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const provider = PROVIDER_INSTANCES[settings.provider];
      const stream = provider.streamChat(
        [{ role: 'system', content: systemPrompt }, ...conversationHistory],
        settings,
        {
          signal: abortController.signal,
          onChunk: (chunk) => {
            accumulatedText += chunk;
            set((state) => {
              const existingIdx = state.messages.findIndex((m) => m.id === assistantMsgId);
              if (existingIdx !== -1) {
                const updated = [...state.messages];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  content: accumulatedText,
                };
                return { messages: updated };
              } else {
                return {
                  messages: [
                    ...state.messages,
                    {
                      id: assistantMsgId,
                      projectId: activeProject.id,
                      role: 'assistant',
                      content: accumulatedText,
                      time: Date.now(),
                    },
                  ],
                };
              }
            });
          },
        }
      );

      for await (const _ of stream) {
        // streaming handled in onChunk
      }

      // Step 3: Build -> parse file modifications
      updateStep(2, 'completed');
      updateStep(3, 'running');

      const changes = parseFileChangesFromText(accumulatedText);
      if (changes.length > 0) {
        for (const ch of changes) {
          if (ch.action === 'delete') {
            await VirtualFS.deleteFile(activeProject.id, ch.path);
          } else {
            await VirtualFS.writeFile(activeProject.id, ch.path, ch.content);
          }
        }
        // Refresh files and tree
        const updatedFiles = await getProjectFiles(activeProject.id);
        const updatedTree = await VirtualFS.listTree(activeProject.id);
        set({
          files: updatedFiles,
          fileTree: updatedTree,
          previewRefreshTrigger: Date.now(),
        });
      }

      updateStep(3, 'completed');
      updateStep(4, 'running');
      await new Promise((r) => setTimeout(r, 300));
      updateStep(4, 'completed');

      // Finalize assistant message with steps in DB
      const finalMsg: MessageRecord = {
        id: assistantMsgId,
        projectId: activeProject.id,
        role: 'assistant',
        content: accumulatedText || 'Application updated successfully.',
        time: Date.now(),
        steps: get().activeSteps,
      };
      await putMessage(finalMsg);

      // Update project updated timestamp
      await saveProject({ ...activeProject, updatedAt: Date.now() });
      const refreshedProjects = await getAllProjects();

      set({
        isStreaming: false,
        activeSteps: [],
        abortController: null,
        projects: refreshedProjects,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream stopped by user');
      } else {
        console.error('Error during AI generation:', err);
        const errorMsg: MessageRecord = {
          id: `err_${Date.now()}`,
          projectId: activeProject.id,
          role: 'assistant',
          content: `Build encountered an issue: ${err.message || String(err)}. Please verify your API Key and model settings in Settings.`,
          time: Date.now(),
        };
        await putMessage(errorMsg);
        set((state) => ({ messages: [...state.messages, errorMsg] }));
      }
      set({ isStreaming: false, activeSteps: [], abortController: null });
    }
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ isStreaming: false, abortController: null, activeSteps: [] });
  },

  setTerminalCollapsed: (collapsed) => set({ isTerminalCollapsed: collapsed }),
  toggleTerminalCollapse: () => set((state) => ({ isTerminalCollapsed: !state.isTerminalCollapsed })),
  triggerPreviewRefresh: () => set({ previewRefreshTrigger: Date.now() }),
  setMobileActiveTab: (tab) => set({ mobileActiveTab: tab }),
}));
