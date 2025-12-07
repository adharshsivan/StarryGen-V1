import React, { useState, useEffect } from 'react';
import { Project, StarryFile, BlockType, BlockState, SectionState } from '../types';
import * as Icons from 'lucide-react';
import { Button, Input, Modal, Label, Textarea, Toast, Select, Badge } from './UI';
import { analyzeReference } from '../services/geminiService';
import { BLOCK_DEFINITIONS, createDefaultBlockState, getSmartLabel } from '../constants';
import { BlockControls } from './BlockControls';

interface ProjectViewProps {
  project: Project;
  onOpenFile: (file: StarryFile) => void;
  onUpdateProject: (p: Project) => void;
  onBack: () => void;
  onDeleteFile?: (fileId: string) => void;
  onDeleteProject?: () => void;
}

interface LibraryItem {
    block: BlockState;
    sourceFile: string;
    sourceFileId: string;
    sourcePreview?: string;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project, onOpenFile, onUpdateProject, onBack, onDeleteFile, onDeleteProject }) => {
  const [activeTab, setActiveTab] = useState('files');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileIdea, setNewFileIdea] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Global Styling Editor State
  const [selectedGlobalBlockId, setSelectedGlobalBlockId] = useState<string | null>(null);
  const [isAddGlobalModalOpen, setIsAddGlobalModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings State
  const [settingsName, setSettingsName] = useState(project.name);
  const [settingsDesc, setSettingsDesc] = useState(project.description);

  // Library State
  const [librarySearch, setLibrarySearch] = useState('');
  const [isAddToModalOpen, setIsAddToModalOpen] = useState(false);
  const [blockToAddTo, setBlockToAddTo] = useState<BlockState | null>(null);
  const [targetFileId, setTargetFileId] = useState<string>('');
  const [sourcePreviewForAdd, setSourcePreviewForAdd] = useState<string | undefined>(undefined);

  const [isEditAddModalOpen, setIsEditAddModalOpen] = useState(false);
  const [tempBlock, setTempBlock] = useState<BlockState | null>(null);

  // Sync settings state if project changes externally
  useEffect(() => {
      setSettingsName(project.name);
      setSettingsDesc(project.description);
  }, [project.name, project.description]);
  
  // Auto-select first global block if available when entering styling tab
  useEffect(() => {
      if (activeTab === 'styling' && project.globalBlocks && project.globalBlocks.length > 0 && !selectedGlobalBlockId) {
          setSelectedGlobalBlockId(project.globalBlocks[0].id);
      }
  }, [activeTab, project.globalBlocks]);

  const tabs = [
    { id: 'files', label: 'Files', icon: Icons.FileStack },
    { id: 'styling', label: 'Global Styling', icon: Icons.Palette },
    { id: 'library', label: 'Block Library', icon: Icons.Box },
    { id: 'team', label: 'Team', icon: Icons.Users },
    { id: 'settings', label: 'Settings', icon: Icons.Settings },
  ];

  // --- File Management Handlers ---

  const handleCreateFile = async () => {
    if (!newFileName) return;
    
    // Check for duplicate name
    if (project.files.some(f => f.name.trim().toLowerCase() === newFileName.trim().toLowerCase())) {
        setToastMessage("A file with this name already exists.");
        return;
    }

    setIsCreating(true);

    try {
        let initialBlocks: any[] = [];
        if (newFileIdea) {
            initialBlocks = await analyzeReference(newFileIdea);
        } else {
            // Create default blocks
            initialBlocks = [
                createDefaultBlockState(BlockType.SUBJECT),
                createDefaultBlockState(BlockType.BACKGROUND),
                createDefaultBlockState(BlockType.LIGHTING),
                createDefaultBlockState(BlockType.CAMERA),
                createDefaultBlockState(BlockType.STYLE)
            ];
        }

        const newFile: StarryFile = {
            id: `file-${Date.now()}`,
            name: newFileName,
            blocks: initialBlocks,
            seed: Math.floor(Math.random() * 999999),
            lastModified: Date.now(),
            aspectRatio: '1:1',
            roughIdea: newFileIdea,
            baseStyle: 'Photorealistic',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        };

        onUpdateProject({
            ...project,
            files: [...project.files, newFile]
        });
        
        setIsCreateModalOpen(false);
        setNewFileName('');
        setNewFileIdea('');
        setToastMessage(`Created "${newFileName}"`);
    } catch (e) {
        console.error(e);
        setToastMessage("Error creating file.");
    } finally {
        setIsCreating(false);
    }
  };

  const handleDuplicateFile = (e: React.MouseEvent, file: StarryFile) => {
      e.stopPropagation();
      const newFile: StarryFile = {
          ...JSON.parse(JSON.stringify(file)), // Deep copy
          id: `file-${Date.now()}`,
          name: `${file.name} (Copy)`,
          lastModified: Date.now(),
          history: [] // Reset history on copy
      };
      
      onUpdateProject({
          ...project,
          files: [...project.files, newFile]
      });
      setToastMessage(`Duplicated "${file.name}"`);
  };

  const handleDeleteFile = (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation();
      if (onDeleteFile) {
          onDeleteFile(fileId);
      } else if (confirm("Are you sure you want to delete this file? This cannot be undone.")) {
          // Fallback if no prop provided
          const updatedFiles = project.files.filter(f => f.id !== fileId);
          onUpdateProject({
              ...project,
              files: updatedFiles
          });
          setToastMessage("File deleted");
      }
  };

  const handleDeleteProject = () => {
      if (confirm(`Are you sure you want to delete project "${project.name}"? This will delete all files inside it.`)) {
          if (onDeleteProject) onDeleteProject();
      }
  };

  const handleSaveSettings = () => {
      onUpdateProject({
          ...project,
          name: settingsName,
          description: settingsDesc
      });
      setToastMessage("Project settings saved.");
  };

  // --- Global Block Management ---

  const addGlobalBlock = (type: BlockType) => {
    const def = BLOCK_DEFINITIONS[type];
    const existingCount = (project.globalBlocks || []).filter(b => b.type === type).length;
    let customLabel = def.label;
    if (!def.singleActiveInstance && existingCount > 0) {
        customLabel = `${def.label} ${existingCount + 1}`;
    }

    const newBlock = createDefaultBlockState(type);
    newBlock.customLabel = customLabel;

    let updatedBlocks = [...(project.globalBlocks || [])];

    if (def.singleActiveInstance) {
         updatedBlocks = updatedBlocks.map(b => {
            if (b.type === type && b.isActive) {
                return { ...b, isActive: false };
            }
            return b;
        });
    }

    updatedBlocks.push(newBlock);
    
    onUpdateProject({ ...project, globalBlocks: updatedBlocks });
    setSelectedGlobalBlockId(newBlock.id);
    setIsAddGlobalModalOpen(false);
    setToastMessage(`Added Global ${def.label}. Applied to all files.`);
  };

  const updateGlobalBlock = (updated: BlockState) => {
      const updatedBlocks = (project.globalBlocks || []).map(b => b.id === updated.id ? updated : b);
      onUpdateProject({ ...project, globalBlocks: updatedBlocks });
  };

  const removeGlobalBlock = (id: string) => {
      const updatedBlocks = (project.globalBlocks || []).filter(b => b.id !== id);
      onUpdateProject({ ...project, globalBlocks: updatedBlocks });
      if (selectedGlobalBlockId === id) setSelectedGlobalBlockId(null);
  };

  const selectedGlobalBlock = (project.globalBlocks || []).find(b => b.id === selectedGlobalBlockId);

  // --- Library Logic ---
  
  const libraryBlocks: Record<string, LibraryItem[]> = project.files.reduce((acc, file) => {
      file.blocks.forEach(block => {
          if (!acc[block.type]) acc[block.type] = [];
          acc[block.type].push({ 
              block, 
              sourceFile: file.name, 
              sourceFileId: file.id,
              sourcePreview: file.previewImage 
          });
      });
      return acc;
  }, {} as Record<string, LibraryItem[]>);

  (project.globalBlocks || []).forEach(block => {
      if (!libraryBlocks[block.type]) libraryBlocks[block.type] = [];
      libraryBlocks[block.type].unshift({ block, sourceFile: 'Global Styling', sourceFileId: 'global' });
  });

  const initiateAddTo = (block: BlockState, sourcePreview?: string) => {
      setBlockToAddTo(block);
      setSourcePreviewForAdd(sourcePreview);
      setIsAddToModalOpen(true);
      if(project.files.length > 0) setTargetFileId(project.files[0].id);
  };

  const initiateEditAndAdd = (block: BlockState, sourcePreview?: string) => {
      // Create a deep copy for temporary editing
      const copy = JSON.parse(JSON.stringify(block));
      // Attach reference image for the preview as well if available
      if (sourcePreview) copy.referenceImage = sourcePreview;
      
      setTempBlock(copy);
      setSourcePreviewForAdd(sourcePreview);
      setIsEditAddModalOpen(true);
      if(project.files.length > 0) setTargetFileId(project.files[0].id);
  };

  const confirmAddTo = (block: BlockState) => {
      if (!targetFileId) return;
      
      const updatedFiles = project.files.map(f => {
          if (f.id === targetFileId) {
              const def = BLOCK_DEFINITIONS[block.type];
              const newBlock: BlockState = { 
                  ...block, 
                  id: `lib-copy-${Date.now()}`,
                  // Ensure reference is attached if it wasn't already on the block object
                  referenceImage: block.referenceImage || sourcePreviewForAdd 
              };
              
              let newBlocks = [...f.blocks];
              // Handle single active instance logic
              if(def.singleActiveInstance) {
                  newBlocks = newBlocks.map(b => b.type === block.type ? { ...b, isActive: false } : b);
              }
              newBlocks.push(newBlock);
              
              return { ...f, blocks: newBlocks };
          }
          return f;
      });

      onUpdateProject({ ...project, files: updatedFiles });
      setToastMessage(`Added block to file.`);
      setIsAddToModalOpen(false);
      setIsEditAddModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background text-text-main font-sans">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* Header */}
      <div className="h-20 flex items-center px-8 border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-30">
        <button onClick={onBack} className="mr-6 p-2 text-text-muted hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full border border-white/5">
          <Icons.ArrowLeft size={18} />
        </button>
        <div className="flex-1">
           <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
           <p className="text-sm text-text-muted mt-0.5">{project.description || 'No description provided'}</p>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-text-dim px-3 py-1 bg-white/5 rounded-full border border-white/5">
                {project.files.length} ITEMS
            </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-border bg-surface sticky top-20 z-20">
         <div className="flex gap-8">
            {tabs.map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id 
                    ? 'border-primary-500 text-white' 
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
            >
                <tab.icon size={16} className={activeTab === tab.id ? 'text-primary-400' : ''} />
                {tab.label}
            </button>
            ))}
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-background">
        
        {/* FILES TAB */}
        {activeTab === 'files' && (
          <div className="p-8 h-full overflow-y-auto">
             <div className="max-w-7xl mx-auto animate-fade-in">
                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {/* Create New Card */}
                    <button 
                      onClick={() => setIsCreateModalOpen(true)}
                      className="group relative flex flex-col bg-surfaceHighlight/10 border border-dashed border-white/10 rounded-xl overflow-hidden hover:border-primary-500/50 hover:bg-surfaceHighlight/20 transition-all cursor-pointer text-left"
                    >
                        <div className="aspect-[4/3] flex items-center justify-center bg-white/5 group-hover:bg-primary-500/10 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-surfaceHighlight flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all text-text-muted shadow-lg ring-1 ring-white/5">
                                <Icons.Plus size={24} />
                            </div>
                        </div>
                        <div className="p-4 border-t border-transparent flex-1">
                             <h3 className="font-semibold text-text-muted group-hover:text-primary-400 text-sm">Create New File</h3>
                             <p className="text-[10px] text-text-dim mt-1 font-mono uppercase">Start from scratch</p>
                        </div>
                    </button>

                    {project.files.map(file => (
                      <div 
                        key={file.id} 
                        onClick={() => onOpenFile(file)}
                        className="group relative flex flex-col bg-surface border border-white/5 rounded-xl overflow-hidden hover:border-white/20 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer"
                      >
                        <div className="aspect-[4/3] bg-black/40 relative overflow-hidden">
                            {file.previewImage ? (
                                 <img src={file.previewImage} alt={file.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-text-dim bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10">
                                    <Icons.Image size={32} />
                                </div>
                            )}
                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2 gap-2">
                                <button 
                                    onClick={(e) => handleDuplicateFile(e, file)}
                                    className="p-1.5 bg-black/60 hover:bg-white text-white hover:text-black rounded-full backdrop-blur transition-colors"
                                    title="Duplicate File"
                                >
                                    <Icons.Copy size={14} />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteFile(e, file.id)}
                                    className="p-1.5 bg-black/60 hover:bg-red-500 text-white hover:text-white rounded-full backdrop-blur transition-colors"
                                    title="Delete File"
                                >
                                    <Icons.Trash2 size={14} />
                                </button>
                            </div>
                            
                            <div className="absolute bottom-3 right-3 flex gap-2">
                                 <span className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white font-mono border border-white/10 shadow-sm">
                                    {file.blocks.length} BLOCKS
                                 </span>
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/5 bg-surfaceHighlight/20 flex-1">
                          <h3 className="font-semibold text-text-main group-hover:text-white truncate text-sm">{file.name}</h3>
                          <p className="text-[10px] text-text-dim mt-1 font-mono uppercase">Edited {new Date(file.lastModified).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                 </div>
             </div>
          </div>
        )}
        
        {/* STYLING TAB - Refined "Global Editor" Layout */}
        {activeTab === 'styling' && (
            <div className="flex h-full animate-fade-in overflow-hidden">
                {/* Global Layer List */}
                <div className="w-80 border-r border-border bg-surface flex flex-col z-10 shadow-xl">
                    <div className="p-4 border-b border-border bg-surfaceHighlight/30 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Icons.Layers size={14} className="text-text-muted"/>
                            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Global Blocks</h3>
                         </div>
                         <Button size="sm" variant="icon" onClick={() => setIsAddGlobalModalOpen(true)}>
                             <Icons.Plus size={16} />
                         </Button>
                    </div>
                    
                    <div className="p-4 bg-primary-500/10 border-b border-primary-500/20">
                        <p className="text-[10px] text-primary-200 leading-relaxed">
                            <Icons.Info size={10} className="inline mr-1 mb-0.5"/>
                            Blocks defined here act as the default template for all files in this project.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                         {(project.globalBlocks || []).map(block => {
                            const def = BLOCK_DEFINITIONS[block.type];
                            const DefIcon = Icons[def.icon as keyof typeof Icons] as React.ElementType;
                            const isSelected = selectedGlobalBlockId === block.id;

                            return (
                                <div 
                                    key={block.id} 
                                    onClick={() => setSelectedGlobalBlockId(block.id)}
                                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all border group relative overflow-hidden ${
                                        isSelected 
                                        ? 'bg-white/5 border-white/10 shadow-md' 
                                        : 'bg-surfaceHighlight/20 border-transparent hover:bg-white/5 hover:border-white/5'
                                    }`}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${def.colorTheme}`} />
                                    
                                    <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center text-text-muted shrink-0 ml-1">
                                        {DefIcon && <DefIcon size={14} className={isSelected ? 'text-white' : ''} />}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-text-muted'}`}>
                                            {getSmartLabel(block)}
                                        </div>
                                        <div className="text-[9px] text-text-dim">{def.type}</div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removeGlobalBlock(block.id); }}
                                        className={`p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all ${isSelected ? 'text-text-dim' : 'text-transparent group-hover:text-text-dim'}`}
                                    >
                                        <Icons.Trash2 size={12} />
                                    </button>
                                </div>
                            );
                         })}
                         
                         {(project.globalBlocks || []).length === 0 && (
                             <div className="flex flex-col items-center justify-center py-10 text-text-dim opacity-50 space-y-2">
                                 <Icons.BoxSelect size={24} strokeWidth={1}/>
                                 <p className="text-xs">No global styles yet.</p>
                             </div>
                         )}
                    </div>
                </div>

                {/* Inspector Area */}
                <div className="flex-1 bg-black/20 flex flex-col relative">
                     {selectedGlobalBlock ? (
                        <div className="flex h-full">
                            <div className="flex-1 bg-black/40 flex items-center justify-center border-r border-white/5 relative overflow-hidden">
                                {/* Abstract Visualization of Global Style */}
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-black to-black"></div>
                                <div className="text-center p-8 z-10">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 mx-auto mb-4 flex items-center justify-center">
                                        <Icons.Palette size={32} className="text-white/50" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Global Property Editor</h3>
                                    <p className="text-sm text-text-dim max-w-sm mx-auto">
                                        Editing properties for <span className="text-white font-mono">{selectedGlobalBlock.customLabel}</span>.
                                        <br/>Changes propagate immediately.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Re-use BlockControls but styled for context */}
                            <div className="w-80 bg-surface border-l border-border h-full flex flex-col shadow-2xl">
                                <div className="h-10 border-b border-border flex items-center px-4 bg-surfaceHighlight/30">
                                     <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">Global Properties</span>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                     <BlockControls 
                                        block={selectedGlobalBlock}
                                        onChange={updateGlobalBlock}
                                        onDelete={() => removeGlobalBlock(selectedGlobalBlock.id)}
                                        allBlocks={project.globalBlocks || []} 
                                        isGlobal={true} // Acts as local here, but styled as master
                                     />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-text-dim text-sm space-y-4">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                                <Icons.MousePointer2 size={32} className="opacity-20" />
                            </div>
                            <p className="font-medium text-text-muted">Select a Global Block to configure</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* LIBRARY TAB - Simplified Grid */}
        {activeTab === 'library' && (
            <div className="p-8 h-full overflow-y-auto animate-fade-in">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-white">Block Library</h2>
                            <p className="text-text-muted text-sm mt-1">Unified asset repository across all files.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={14}/>
                                <Input 
                                    className="pl-9 w-64 h-9 rounded-full bg-surface border-white/10 focus:border-primary-500/50" 
                                    placeholder="Search blocks..."
                                    value={librarySearch}
                                    onChange={(e) => setLibrarySearch(e.target.value)}
                                />
                            </div>
                            <Badge variant="outline">{Object.values(libraryBlocks).reduce((a, b) => a + b.length, 0)} Blocks</Badge>
                        </div>
                    </div>

                    {Object.keys(libraryBlocks).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-text-dim border border-dashed border-white/10 rounded-xl bg-surface/30">
                            <Icons.Box size={32} className="mb-3 opacity-30"/>
                            <p>No blocks found in library.</p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {Object.entries(libraryBlocks).map(([type, items]) => {
                                const def = BLOCK_DEFINITIONS[type as BlockType];
                                const DefIcon = Icons[def.icon as keyof typeof Icons] as React.ElementType;
                                
                                const filteredItems = items.filter(i => 
                                    getSmartLabel(i.block).toLowerCase().includes(librarySearch.toLowerCase())
                                );

                                if (filteredItems.length === 0) return null;
                                
                                return (
                                    <div key={type} className="animate-slide-up">
                                        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/5">
                                            <div className={`p-1.5 rounded-md shadow-sm ${def.colorTheme.replace('bg-', 'bg-opacity-20 text-').replace('text-', 'bg-')}`}>
                                                {DefIcon && <DefIcon size={16} />}
                                            </div>
                                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{def.label}s</h3>
                                            <span className="text-[10px] text-text-dim bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{filteredItems.length}</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {filteredItems.map((item, idx) => (
                                                <div key={idx} className="bg-surface border border-white/5 rounded-lg overflow-hidden hover:border-white/10 hover:shadow-lg hover:-translate-y-0.5 transition-all group flex flex-col">
                                                    {/* Header Strip */}
                                                    <div className={`h-1 w-full ${def.colorTheme}`} />
                                                    
                                                    <div className="p-3 flex-1 flex flex-col">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="font-bold text-sm text-white truncate pr-2 flex items-center gap-2">
                                                                {getSmartLabel(item.block)}
                                                                {item.sourceFileId === 'global' && <Icons.Globe size={10} className="text-primary-400" />}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="space-y-1 mb-3 flex-1">
                                                             {/* Minimal Metadata */}
                                                            {Object.entries(item.block.sections).slice(0, 3).map(([secId, sec]) => {
                                                                // Grab first non-empty field
                                                                const firstField = Object.entries(sec.fields).find(([k,v]) => v && v !== 'None' && v !== false);
                                                                if(!firstField) return null;
                                                                return (
                                                                    <div key={secId} className="flex items-center justify-between text-[10px] border-b border-white/5 pb-0.5 last:border-0">
                                                                        <span className="text-text-dim capitalize">{firstField[0].replace('_', ' ')}</span>
                                                                        <span className="text-text-muted truncate max-w-[80px] text-right">
                                                                            {Array.isArray(firstField[1]) ? `[${firstField[1].length}]` : String(firstField[1])}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>

                                                        <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
                                                            <Button size="sm" variant="secondary" className="flex-1 h-7 text-xs" onClick={() => initiateAddTo(item.block, item.sourcePreview)}>
                                                                Add
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => initiateEditAndAdd(item.block, item.sourcePreview)}>
                                                                <Icons.Edit3 size={12} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* TEAM TAB - Placeholder */}
        {activeTab === 'team' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in text-center opacity-60">
                 <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                     <Icons.Construction size={32} className="text-text-dim" />
                 </div>
                 <h2 className="text-lg font-bold text-white mb-2">It is under build.</h2>
                 <p className="text-sm text-text-muted">Team collaboration features are coming for Pro users.</p>
            </div>
        )}
        
        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
            <div className="flex-1 flex flex-col items-center justify-center animate-fade-in p-8">
                 <div className="max-w-lg w-full bg-surface border border-white/5 rounded-xl p-8 shadow-2xl">
                     <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                         <Icons.Settings size={20} /> Project Settings
                     </h2>
                     <div className="space-y-6">
                         <div className="space-y-2">
                             <Label>Project Name</Label>
                             <Input value={settingsName} onChange={(e) => setSettingsName(e.target.value)} />
                         </div>
                         <div className="space-y-2">
                             <Label>Description</Label>
                             <Textarea value={settingsDesc} onChange={(e) => setSettingsDesc(e.target.value)} rows={3} />
                         </div>
                         <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                             <Button variant="danger" size="sm" onClick={handleDeleteProject}>
                                 <Icons.Trash2 size={14} /> Delete Project
                             </Button>
                             <Button onClick={handleSaveSettings}>Save Changes</Button>
                         </div>
                     </div>
                 </div>
            </div>
        )}

      </div>

      {/* Modals */}
      
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New File">
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} autoFocus placeholder="e.g. Hero Close-up" />
            </div>
            <div className="space-y-1.5">
                <Label>Idea (Optional)</Label>
                <Textarea value={newFileIdea} onChange={(e) => setNewFileIdea(e.target.value)} placeholder="Describe the scene to auto-generate blocks..." rows={4} />
            </div>
            <div className="flex justify-end pt-2 gap-2">
                 <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateFile} disabled={isCreating || !newFileName}>
                    {isCreating ? <Icons.Loader2 className="animate-spin" size={16} /> : 'Create File'}
                </Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isAddGlobalModalOpen} onClose={() => setIsAddGlobalModalOpen(false)} title="Add Master Block">
        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-2">
            {Object.values(BLOCK_DEFINITIONS).map(def => {
                 const DefIcon = Icons[def.icon as keyof typeof Icons] as React.ElementType;
                 return (
                    <button 
                        key={def.type} 
                        onClick={() => addGlobalBlock(def.type)} 
                        className="p-3 bg-surfaceHighlight/30 hover:bg-surfaceHighlight rounded flex items-center gap-3 border border-transparent hover:border-white/10 transition-all group"
                    >
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${def.colorTheme.replace('bg-', 'bg-opacity-20 text-').replace('text-', 'bg-')}`}>
                            {DefIcon && <DefIcon size={16} />}
                        </div>
                        <div className="text-left">
                            <span className="text-sm font-medium text-white block">{def.label}</span>
                            <span className="text-[10px] text-text-dim">{def.description}</span>
                        </div>
                        <Icons.Plus className="ml-auto text-text-dim group-hover:text-white" size={16} />
                    </button>
                 )
            })}
        </div>
      </Modal>

      <Modal isOpen={isAddToModalOpen} onClose={() => setIsAddToModalOpen(false)} title="Add Block to File">
        <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded border border-white/5 flex items-center gap-3">
                 <div className="w-8 h-8 bg-black/40 rounded flex items-center justify-center text-text-muted">
                     <Icons.Box size={16} />
                 </div>
                 <div>
                     <p className="text-xs font-bold text-white">{blockToAddTo ? getSmartLabel(blockToAddTo) : 'Block'}</p>
                     <p className="text-[10px] text-text-dim">Will be added as a local instance.</p>
                 </div>
            </div>
            <div className="space-y-2">
                <Label>Target File</Label>
                <Select value={targetFileId} onChange={(e) => setTargetFileId(e.target.value)}>
                    {project.files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsAddToModalOpen(false)}>Cancel</Button>
                <Button onClick={() => blockToAddTo && confirmAddTo(blockToAddTo)}>Add Block</Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isEditAddModalOpen} onClose={() => setIsEditAddModalOpen(false)} title="Customize & Add">
        <div className="h-[70vh] flex flex-col -m-4">
            <div className="flex-1 overflow-y-auto bg-surface relative p-4">
                {tempBlock && (
                    <BlockControls 
                        block={tempBlock} 
                        onChange={setTempBlock} 
                        onDelete={() => {}} 
                        allBlocks={[]} // Simplified context for library edit
                    />
                )}
            </div>
            <div className="p-4 border-t border-white/5 bg-surfaceHighlight/10 flex justify-between items-center shrink-0">
                 <div className="text-xs text-text-dim">
                     Adding to: <span className="text-white font-medium">{project.files.find(f => f.id === targetFileId)?.name}</span>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsEditAddModalOpen(false)}>Cancel</Button>
                    <Button onClick={() => tempBlock && confirmAddTo(tempBlock)}>Add to File</Button>
                 </div>
            </div>
        </div>
      </Modal>

    </div>
  );
};