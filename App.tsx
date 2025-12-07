

import React, { useState, useEffect, useCallback } from 'react';
import { Project, StarryFile, BlockType, BlockState } from './types';
import { INITIAL_PROJECTS, createDefaultBlockState } from './constants';
import { ProjectView } from './components/ProjectView';
import { Editor } from './components/Editor';
import { Button, Input, Modal, Label, Textarea, Toast } from './components/UI';
import * as Icons from 'lucide-react';
import { analyzeReference, getEffectiveApiKey } from './services/geminiService';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'project' | 'editor'>('dashboard');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentFile, setCurrentFile] = useState<StarryFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectIdea, setNewProjectIdea] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Documentation Modal State
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  // API Key Manager State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [hasEffectiveKey, setHasEffectiveKey] = useState(!!getEffectiveApiKey());
  const [apiToastMessage, setApiToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check key status on mount
    setHasEffectiveKey(!!getEffectiveApiKey());
    setCustomApiKey(localStorage.getItem('gemini_api_key') || '');
  }, []);

  const handleSaveApiKey = () => {
    if (customApiKey.trim()) {
        localStorage.setItem('gemini_api_key', customApiKey.trim());
        setHasEffectiveKey(true);
        setApiToastMessage("Custom API Key saved.");
    } else {
        localStorage.removeItem('gemini_api_key');
        setHasEffectiveKey(!!process.env.API_KEY);
        setApiToastMessage("Custom API Key removed.");
    }
    setIsApiKeyModalOpen(false);
  };

  const handleCloseToast = useCallback(() => {
    setApiToastMessage(null);
  }, []);

  // Handlers
  const openProject = (p: Project) => {
    setCurrentProject(p);
    setView('project');
  };

  const openFile = (f: StarryFile) => {
    setCurrentFile(f);
    setView('editor');
  };

  const updateFileInProject = (updatedFile: StarryFile) => {
    if (!currentProject) return;
    const updatedFiles = currentProject.files.map(f => f.id === updatedFile.id ? updatedFile : f);
    const updatedProject = { ...currentProject, files: updatedFiles, lastModified: Date.now() };
    setCurrentProject(updatedProject);
    setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const deleteFileFromProject = (fileId: string) => {
    if (!currentProject) return;
    const updatedFiles = currentProject.files.filter(f => f.id !== fileId);
    const updatedProject = { ...currentProject, files: updatedFiles, lastModified: Date.now() };
    setCurrentProject(updatedProject);
    setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
    setCurrentFile(null);
    setView('project');
  };

  const updateProject = (updatedProject: Project) => {
      setCurrentProject(updatedProject);
      setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const updateGlobalBlock = (updatedBlock: BlockState) => {
      if (!currentProject) return;
      const updatedGlobals = (currentProject.globalBlocks || []).map(b => b.id === updatedBlock.id ? updatedBlock : b);
      const updatedProject = { ...currentProject, globalBlocks: updatedGlobals };
      setCurrentProject(updatedProject);
      setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const handleCreateProject = async () => {
    if (!newProjectName) return;

    if (projects.some(p => p.name.trim().toLowerCase() === newProjectName.trim().toLowerCase())) {
        setApiToastMessage("A project with this name already exists.");
        return;
    }

    setIsCreatingProject(true);

    try {
        let files: StarryFile[] = [];
        let globalBlocks: BlockState[] = []; 

        // 1. Main File (from Idea or Default)
        let mainBlocks: BlockState[] = [];
        let mainIdea = newProjectIdea || 'A beautiful cinematic scene';
        if (newProjectIdea) {
             try {
                mainBlocks = await analyzeReference(newProjectIdea);
             } catch (e) {
                console.error("AI Analysis failed, utilizing defaults", e);
             }
        }
        
        if (mainBlocks.length === 0) {
            mainBlocks = [
                createDefaultBlockState(BlockType.SUBJECT),
                createDefaultBlockState(BlockType.BACKGROUND),
                createDefaultBlockState(BlockType.LIGHTING),
                createDefaultBlockState(BlockType.CAMERA),
                createDefaultBlockState(BlockType.STYLE)
            ];
        }

        files.push({
            id: `f-main-${Date.now()}`,
            name: newProjectIdea ? 'Main Concept' : 'Main Scene',
            blocks: mainBlocks,
            seed: Math.floor(Math.random() * 100000),
            lastModified: Date.now(),
            aspectRatio: '16:9',
            roughIdea: mainIdea,
            baseStyle: 'Cinematic',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        });

        const newProject: Project = {
            id: `p-${Date.now()}`,
            name: newProjectName,
            description: newProjectDesc,
            lastModified: Date.now(),
            files: files,
            globalBlocks: globalBlocks
        };

        setProjects([newProject, ...projects]);
        setIsProjectModalOpen(false);
        setNewProjectName('');
        setNewProjectDesc('');
        setNewProjectIdea('');
        openProject(newProject);
    } catch (e) {
        console.error("Failed to create project", e);
    } finally {
        setIsCreatingProject(false);
    }
  };

  const filteredProjects = projects.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Library Calculations ---
  
  // 1. Local Library (Current Project)
  const localLibrary = React.useMemo(() => {
      if (!currentProject) return [];
      const libs: any[] = [];
      currentProject.files.forEach(f => {
          if (currentFile && f.id === currentFile.id) return; // Exclude current file
          f.blocks.forEach(b => {
              libs.push({ 
                  block: b, 
                  sourceFile: f.name, 
                  sourceProject: currentProject.name,
                  sourcePreview: f.previewImage // Capture preview
              });
          });
      });
      // Add Project Globals
      (currentProject.globalBlocks || []).forEach(b => {
           libs.push({ block: b, sourceFile: 'Global Styling', sourceProject: currentProject.name });
      });
      return libs;
  }, [currentProject, currentFile]);

  // 2. Global Library (Other Projects)
  const externalLibrary = React.useMemo(() => {
      if (!currentProject) return [];
      const libs: any[] = [];
      projects.forEach(p => {
          if (p.id === currentProject.id) return; // Skip current project
          p.files.forEach(f => {
              f.blocks.forEach(b => {
                   libs.push({ 
                       block: b, 
                       sourceFile: f.name, 
                       sourceProject: p.name,
                       sourcePreview: f.previewImage
                   });
              });
          });
          (p.globalBlocks || []).forEach(b => {
              libs.push({ block: b, sourceFile: 'Global Styling', sourceProject: p.name });
          });
      });
      return libs;
  }, [projects, currentProject]);

  // --- Views ---

  if (view === 'editor' && currentFile && currentProject) {
    return (
        <Editor 
            file={currentFile} 
            onSave={updateFileInProject} 
            onDelete={() => deleteFileFromProject(currentFile.id)}
            onBack={() => setView('project')} 
            globalBlocks={currentProject.globalBlocks || []}
            onUpdateGlobalBlock={updateGlobalBlock}
            localLibrary={localLibrary}
            externalLibrary={externalLibrary}
            existingFileNames={currentProject.files.map(f => f.name)}
        />
    );
  }

  if (view === 'project' && currentProject) {
    return (
        <ProjectView 
            project={currentProject} 
            onOpenFile={openFile} 
            onUpdateProject={updateProject}
            onBack={() => setView('dashboard')} 
        />
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-main font-sans selection:bg-primary-500/30 selection:text-white transition-colors duration-300">
      {apiToastMessage && <Toast message={apiToastMessage} onClose={handleCloseToast} />}

      {/* Navbar */}
      <nav className="h-16 border-b border-border flex items-center justify-between px-8 bg-surface/80 backdrop-blur fixed top-0 w-full z-50">
        <div className="flex items-center gap-3">
            <span className="font-bold text-lg tracking-tight text-text-main">StarryGen</span>
        </div>
        <div className="w-1/3">
             <div className="relative group">
                 <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary-400 transition-colors" size={16} />
                 <input 
                    type="text" 
                    placeholder="Search your library..." 
                    className="w-full bg-black/20 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/20 transition-all text-text-main placeholder-text-dim"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
             </div>
        </div>
        <div className="flex items-center gap-4">
             {/* API Key Status Indicator */}
             <button 
                onClick={() => setIsApiKeyModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-black/20 hover:bg-white/5 hover:border-white/20 transition-all group"
                title={hasEffectiveKey ? "API Key Active" : "Missing API Key"}
             >
                 <div className={`w-2 h-2 rounded-full ${hasEffectiveKey ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                 <span className={`text-[10px] font-medium ${hasEffectiveKey ? 'text-text-muted group-hover:text-text-main' : 'text-red-400'}`}>
                    {hasEffectiveKey ? 'System Ready' : 'Key Missing'}
                 </span>
                 <Icons.Settings2 size={12} className="text-text-dim group-hover:text-text-main" />
             </button>

             {/* Documentation Button (Replaces Profile Icon) */}
             <button 
                onClick={() => setIsDocsModalOpen(true)}
                className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold hover:bg-primary-400 transition-colors shadow-lg shadow-primary-500/20 cursor-pointer ring-2 ring-transparent hover:ring-primary-500/30"
                title="Documentation & About StarryGen"
             >
                 SG
             </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 px-8 max-w-7xl mx-auto pb-12">
          
          <div className="flex items-end justify-between mb-10 animate-fade-in">
              <div>
                  <h1 className="text-4xl font-bold text-text-main mb-2 tracking-tight">Projects</h1>
                  <p className="text-text-muted">Manage your visual generation workspaces.</p>
              </div>
              <Button onClick={() => setIsProjectModalOpen(true)} className="shadow-xl shadow-primary-500/10">
                  <Icons.Plus size={18} /> New Project
              </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project, idx) => (
                  <div 
                    key={project.id} 
                    onClick={() => openProject(project)}
                    className="group bg-surface border border-white/5 rounded-xl p-6 hover:border-primary-500/40 hover:bg-surfaceHighlight hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-[280px] relative overflow-hidden"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                      {/* Decorative Gradient Background on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                      
                      <div className="flex justify-between items-start mb-6 relative z-10">
                          <div className="w-12 h-12 rounded-xl bg-surfaceHighlight border border-white/5 flex items-center justify-center text-text-muted group-hover:text-primary-400 group-hover:border-primary-500/30 transition-all shadow-inner">
                              <Icons.Folder size={24} strokeWidth={1.5} />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {project.tags?.map(tag => (
                                <span 
                                    key={tag} 
                                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${tag === 'Template' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-text-dim border-white/10'}`}
                                >
                                    {tag}
                                </span>
                            ))}
                          </div>
                      </div>
                      
                      <div className="relative z-10 flex-1">
                        <h3 className="text-xl font-bold text-text-main group-hover:text-primary-400 mb-2 transition-colors">{project.name}</h3>
                        <p className="text-text-muted text-sm line-clamp-3 leading-relaxed">{project.description || "No description provided."}</p>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2 text-xs font-medium text-text-dim">
                             <Icons.FileStack size={14} />
                             <span>{project.files.length} Files</span>
                          </div>
                          <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">{new Date(project.lastModified).toLocaleDateString()}</span>
                      </div>
                  </div>
              ))}
          </div>
          
          {filteredProjects.length === 0 && (
             <div className="flex flex-col items-center justify-center h-96 border border-dashed border-white/10 rounded-2xl bg-surface/30">
                 <Icons.Search size={48} className="text-text-dim mb-4 opacity-50"/>
                 <h3 className="text-lg font-medium text-text-muted">No projects found</h3>
                 <p className="text-text-dim text-sm mt-1">Try a different search term or create a new project.</p>
             </div>
          )}
      </div>

      {/* Create Project Modal */}
      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title="CREATE NEW PROJECT">
          <div className="space-y-6">
              <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input 
                    value={newProjectName} 
                    onChange={(e) => setNewProjectName(e.target.value)} 
                    placeholder="e.g. Neo-Tokyo Short Film" 
                    autoFocus
                  />
              </div>
              <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    value={newProjectDesc} 
                    onChange={(e) => setNewProjectDesc(e.target.value)} 
                    placeholder="Brief objective of the project" 
                  />
              </div>
              <div className="space-y-2">
                  <Label>Idea / Initial Concept (Optional)</Label>
                  <p className="text-xs text-text-muted">StarryGen will automatically generate your first file based on this description.</p>
                  <Textarea 
                     className="h-28"
                     value={newProjectIdea}
                     onChange={(e) => setNewProjectIdea(e.target.value)}
                     placeholder="e.g. A solitary robot gardening on a spaceship..."
                  />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setIsProjectModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateProject} disabled={!newProjectName || isCreatingProject}>
                      {isCreatingProject ? <Icons.Loader2 className="animate-spin" /> : 'Create Project'}
                  </Button>
              </div>
          </div>
      </Modal>

      {/* API Key Modal */}
      <Modal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} title="API KEY SETTINGS">
          <div className="space-y-6">
             <div className="p-4 bg-black/20 rounded border border-white/5 text-xs text-text-muted">
                 <h4 className="font-bold text-white mb-2">API Key Configuration</h4>
                 <p className="mb-2">A Google Gemini API key is required to use generation features. <a href="https://aistudio.google.com/" target="_blank" className="text-primary-400 hover:underline">Get a key here</a>.</p>
                 {process.env.API_KEY ? (
                     <p className="text-emerald-400 flex items-center gap-1"><Icons.CheckCircle size={12}/> System Environment Variable Detected.</p>
                 ) : (
                     <p className="text-amber-400 flex items-center gap-1"><Icons.AlertTriangle size={12}/> No System Variable Detected.</p>
                 )}
             </div>

             <div className="space-y-2">
                 <Label>Custom API Key</Label>
                 <Input 
                    type="password"
                    placeholder="AIzaSy..."
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                 />
                 <p className="text-[10px] text-text-dim">Overrides system default. Stored locally in your browser.</p>
             </div>

             <div className="pt-2 flex justify-end gap-3">
                 <Button variant="ghost" onClick={() => setIsApiKeyModalOpen(false)}>Close</Button>
                 <Button onClick={handleSaveApiKey}>Save Key</Button>
             </div>
          </div>
      </Modal>

      {/* Documentation Modal */}
      <Modal isOpen={isDocsModalOpen} onClose={() => setIsDocsModalOpen(false)} title="ABOUT STARRYGEN" maxWidth="max-w-3xl">
         <div className="space-y-8">
             <div className="text-center pb-6 border-b border-white/5">
                 <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">StarryGen <span className="text-primary-500">v1.0.0</span></h2>
                 <p className="text-text-muted max-w-lg mx-auto">
                     A modular, visual-first AI creativity tool designed for constructing complex image generation prompts using structured blocks.
                 </p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                     <h3 className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
                         <Icons.BoxSelect size={16} className="text-primary-400" /> Block System
                     </h3>
                     <p className="text-sm text-text-muted leading-relaxed">
                         StarryGen moves beyond text prompting by using a <strong>Block-Based System</strong>. 
                         Compose your scene using distinct modules like <em>Subject</em>, <em>Lighting</em>, <em>Camera</em>, and <em>Background</em>.
                         Each block contains specialized fields that enforce structure while allowing creativity.
                     </p>
                 </div>

                 <div className="space-y-4">
                     <h3 className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
                         <Icons.Palette size={16} className="text-primary-400" /> Global Styling
                     </h3>
                     <p className="text-sm text-text-muted leading-relaxed">
                         Define <strong>Master Blocks</strong> at the project level to create a consistent visual language. 
                         Any file in the project inherits these styles automatically, making it perfect for creating cohesive assets or storyboard frames.
                     </p>
                 </div>

                 <div className="space-y-4">
                     <h3 className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
                         <Icons.Sparkles size={16} className="text-primary-400" /> AI Intelligence
                     </h3>
                     <p className="text-sm text-text-muted leading-relaxed">
                         Powered by <strong>Google Gemini 2.5</strong>. StarryGen understands context. 
                         It can analyze your rough ideas to auto-build blocks, suggest creative values for fields based on the scene, and even edit specific parts of your image via natural language.
                     </p>
                 </div>

                 <div className="space-y-4">
                     <h3 className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
                         <Icons.FlaskConical size={16} className="text-primary-400" /> Labs
                     </h3>
                     <p className="text-sm text-text-muted leading-relaxed">
                         Post-processing built right in. Apply color grading filters, add text overlays, 
                         or use AI tools to remove backgrounds and upscale images to 4K resolution directly within the editor.
                     </p>
                 </div>
             </div>

             <div className="p-4 bg-surfaceHighlight/30 rounded-lg border border-white/5 space-y-3">
                 <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Build Information</h4>
                 <div className="grid grid-cols-2 gap-4 text-xs">
                     <div>
                         <span className="text-text-dim block mb-0.5">Core Engine</span>
                         <span className="text-text-muted">React 19 + Vite</span>
                     </div>
                     <div>
                         <span className="text-text-dim block mb-0.5">AI Models</span>
                         <span className="text-text-muted">Gemini 2.5 Flash (Logic & Image)</span>
                     </div>
                     <div>
                         <span className="text-text-dim block mb-0.5">State Management</span>
                         <span className="text-text-muted">Local Storage Persisted</span>
                     </div>
                     <div>
                         <span className="text-text-dim block mb-0.5">Styling</span>
                         <span className="text-text-muted">TailwindCSS + Lucide Icons</span>
                     </div>
                 </div>
             </div>
         </div>
      </Modal>

    </div>
  );
}