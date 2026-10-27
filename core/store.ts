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
import { enhanceUserPrompt } from '../ai/provider';
import { NexaAgentPipeline } from '../ai/agent';
import { getOrInitMemory, MEMORY_FILE_NAME } from '../ai/memory';

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
  openMemoryTab: () => Promise<void>;
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

    // Initialize PROJECT_MEMORY.md
    await getOrInitMemory(id, name, templateType);

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

    // Open project and trigger 6-stage autonomous agent execution
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

      // Ensure PROJECT_MEMORY.md exists
      await getOrInitMemory(projectId, project.name, project.template);

      // Default active file is index.html if exists, otherwise first non-memory file
      const nonMemory = files.filter((f) => f.path !== MEMORY_FILE_NAME);
      let defaultFile = nonMemory.find((f) => f.path === 'index.html')?.path || nonMemory[0]?.path || '';
      let defaultContent = nonMemory.find((f) => f.path === defaultFile)?.content || '';

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

  openMemoryTab: async () => {
    const { activeProject } = get();
    if (!activeProject) return;
    await getOrInitMemory(activeProject.id, activeProject.name);
    await get().selectFile(MEMORY_FILE_NAME);
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
    const { activeProject, settings, isStreaming } = get();
    if (!activeProject || isStreaming) return;

    // Check if user has an active key
    const currentKey = settings.apiKeys[settings.provider];
    if (!currentKey && settings.provider !== 'custom') {
      get().openSettings(`Please set your ${settings.provider} API key to stream live AI responses.`);
      return;
    }

    const abortController = new AbortController();
    set({ isStreaming: true, abortController });

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

    const pipeline = new NexaAgentPipeline(activeProject.id, activeProject.name, settings);

    try {
      const result = await pipeline.execute(
        text,
        {
          onStageChange: (steps) => set({ activeSteps: steps }),
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
          onFilesChanged: async () => {
            const files = await getProjectFiles(activeProject.id);
            const fileTree = await VirtualFS.listTree(activeProject.id);
            set({ files, fileTree, previewRefreshTrigger: Date.now() });
          },
        },
        abortController.signal
      );

      // Finalize assistant message with steps in DB
      const finalMsg: MessageRecord = {
        id: assistantMsgId,
        projectId: activeProject.id,
        role: 'assistant',
        content: result.text || accumulatedText || 'Application updated successfully.',
        time: Date.now(),
        steps: get().activeSteps,
      };
      await putMessage(finalMsg);

      // Update project timestamp
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
        console.log('Pipeline stopped by user');
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
