
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StarryFile, BlockState, BlockType, SectionState, HistoryEntry, LabsState, LabsPreset } from '../types';
import { BLOCK_DEFINITIONS, getSmartLabel } from '../constants';
import * as Icons from 'lucide-react';
import { BlockControls } from './BlockControls';
import { Button, Badge, Input, Label, Select, Textarea, TabButton, Modal, Toggle, Toast, Accordion, HybridInput } from './UI';
import { constructPromptFromBlocks, generateImageFromBlocks, analyzeReference, refineBlocks, generateContextSuggestions, editImage, processTransparency, urlToBase64 } from '../services/geminiService';
import { LabsCanvas, LabsControls, DEFAULT_LABS_STATE } from './Labs';

// --- Syntax Highlighting Helper ---
const highlightJSON = (data: any) => {
    let json = JSON.stringify(data, null, 2);
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'text-amber-400'; // Number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-indigo-400 font-medium'; // Key
            } else {
                cls = 'text-emerald-400'; // String
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-rose-400 font-medium'; // Boolean
        } else if (/null/.test(match)) {
            cls = 'text-zinc-500 italic'; // Null
        }
        return `<span class="${cls}">${match}</span>`;
    });
};

// --- Change Detection Helper ---
const getChangeSummary = (oldBlocks: BlockState[], newBlocks: BlockState[]): string => {
    const changes: Set<string> = new Set();
    const oldMap = new Map(oldBlocks.map(b => [b.id, b]));
    const newMap = new Map(newBlocks.map(b => [b.id, b]));

    // Added Blocks
    newBlocks.forEach(b => {
        if (!oldMap.has(b.id)) changes.add(`Added ${getSmartLabel(b)}`);
    });

    // Removed Blocks
    oldBlocks.forEach(b => {
        if (!newMap.has(b.id)) changes.add(`Removed ${getSmartLabel(b)}`);
    });

    // Modified Blocks
    newBlocks.forEach(b => {
        const old = oldMap.get(b.id);
        if (old) {
            // Compare sections for deep content changes
            const sectionsChanged = JSON.stringify(b.sections) !== JSON.stringify(old.sections);
            const activeChanged = b.isActive !== old.isActive;
            const labelChanged = b.customLabel !== old.customLabel;
            const customChanged = JSON.stringify(b.customValues) !== JSON.stringify(old.customValues);
            
            if (sectionsChanged || activeChanged || labelChanged || customChanged) {
                changes.add(`Modified ${getSmartLabel(b)}`);
            }
        }
    });

    const changeList = Array.from(changes);
    
    if (changeList.length === 0) return "Regenerated";
    if (changeList.length === 1) return changeList[0];
    if (changeList.length === 2) return `${changeList[0]}, ${changeList[1]}`;
    return `${changeList.length} Changes (e.g. ${changeList[0]})`;
};

interface EditorProps {
  file: StarryFile;
  onSave: (file: StarryFile) => void;
  onBack: () => void;
  onDelete?: () => void;
  globalBlocks?: BlockState[]; // From Project
  onUpdateGlobalBlock?: (block: BlockState) => void;
  localLibrary?: { block: BlockState, sourceFile: string, sourceProject: string, sourcePreview?: string }[];
  externalLibrary?: { block: BlockState, sourceFile: string, sourceProject: string, sourcePreview?: string }[];
  existingFileNames?: string[]; // To check for duplicates
}

export const Editor: React.FC<EditorProps> = ({ 
    file, 
    onSave, 
    onBack, 
    onDelete, 
    globalBlocks = [], 
    onUpdateGlobalBlock,
    localLibrary = [],
    externalLibrary = [],
    existingFileNames = []
}) => {
  const [blocks, setBlocks] = useState<BlockState[]>(file.blocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(file.blocks.length > 0 ? file.blocks[0].id : 'general');
  const [generatedImage, setGeneratedImage] = useState<string | null>(file.previewImage || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [seed, setSeed] = useState(file.seed);
  const [isEditingSeed, setIsEditingSeed] = useState(false);
  
  // Editor UI State
  const [activeTab, setActiveTab] = useState<'preview' | 'prompt' | 'json' | 'labs' | 'history'>('preview');
  const [quickEditInstruction, setQuickEditInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isAddBlockModalOpen, setIsAddBlockModalOpen] = useState(false);
  const [addBlockTab, setAddBlockTab] = useState<'create' | 'project' | 'global'>('create');
  const [librarySearch, setLibrarySearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // General Section State
  const [fileName, setFileName] = useState(file.name);
  const [aspectRatio, setAspectRatio] = useState(file.aspectRatio || '1:1');
  const [baseStyle, setBaseStyle] = useState(file.baseStyle || '');
  const [useBaseStyle, setUseBaseStyle] = useState(file.useBaseStyle ?? true);
  const [roughIdea, setRoughIdea] = useState(file.roughIdea || '');
  const [dynamicSuggestions, setDynamicSuggestions] = useState<Record<string, string[]>>(file.dynamicSuggestions || {});
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(file.history || []);

  const handleCloseToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Labs State
  const migrateLabsState = (state?: LabsState): LabsState => {
      // Force deep copy of defaults to ensure no reference pollution
      const defaults = JSON.parse(JSON.stringify(DEFAULT_LABS_STATE));
      
      if (!state) return defaults;
      
      const newState = { ...defaults, ...state };
      
      if (newState.overlays) {
          newState.overlays = newState.overlays.map((o: any) => ({
              ...o,
              letterSpacing: o.padding ? o.padding / 2 : (o.letterSpacing || 0), 
          }));
      }

      if ((state as any).overlay && (!state.overlays || state.overlays.length === 0)) {
          if ((state as any).overlay.text) {
              newState.overlays = [{
                  ...(state as any).overlay,
                  id: `text-migrated-${Date.now()}`,
                  letterSpacing: (state as any).overlay.padding ? (state as any).overlay.padding / 2 : 0
              }];
          }
      }
      return newState;
  };

  const [labsState, setLabsState] = useState<LabsState>(migrateLabsState(file.labsState));
  const [labsPresets, setLabsPresets] = useState<LabsPreset[]>([]);
  const [autoApplyLabs, setAutoApplyLabs] = useState(false);
  const [selectedLabsLayerId, setSelectedLabsLayerId] = useState<string | null>(null);
  const labsCanvasRef = useRef<HTMLCanvasElement>(null);
  const [labsBaseImage, setLabsBaseImage] = useState<string | null>(file.previewImage || null);

  useEffect(() => {
    setLabsBaseImage(generatedImage);
  }, [generatedImage]);

  const effectiveBlocks = React.useMemo(() => {
      let combined: (BlockState & { isGlobal?: boolean })[] = [...blocks];
      
      if (useBaseStyle && globalBlocks.length > 0) {
          const localTypes = new Set(blocks.map(b => b.type));
          const relevantGlobals = globalBlocks.map(gb => ({...gb, isGlobal: true})).filter(gb => {
             const def = BLOCK_DEFINITIONS[gb.type];
             if (def.singleActiveInstance && localTypes.has(gb.type)) {
                 return false; 
             }
             return true; 
          });
          combined = [...relevantGlobals, ...blocks];
      }
      return combined;
  }, [blocks, globalBlocks, useBaseStyle]);

  // --- Auto-Transparency on Load ---
  useEffect(() => {
    const applyInitialTransparency = async () => {
        if (!generatedImage || !generatedImage.startsWith('http')) return;
        
        // Check if transparency is enabled in the blocks
        const backgroundBlock = effectiveBlocks.find(b => b.type === BlockType.BACKGROUND && b.isActive);
        const isTransparencyEnabled = backgroundBlock?.sections['transparency']?.fields['remove_bg'] === true;

        if (isTransparencyEnabled) {
             setIsGenerating(true);
             try {
                 const base64 = await urlToBase64(generatedImage);
                 if (base64) {
                     const processed = await processTransparency(base64);
                     setGeneratedImage(processed);
                     setLabsBaseImage(processed);
                     setToastMessage("Applied transparency to preview.");
                 }
             } catch (e) {
                 console.error("Auto-transparency failed", e);
             } finally {
                 setIsGenerating(false);
             }
        }
    };

    // Run only if the image matches the initial file preview (fresh load)
    if (file.previewImage && generatedImage === file.previewImage) {
        applyInitialTransparency();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]); // Trigger on new file load

  const [isDirty, setIsDirty] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const isFirstRender = useRef(true);

  const lastContextRef = useRef<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
    }
    setIsDirty(true);
  }, [blocks, generatedImage, fileName, aspectRatio, baseStyle, useBaseStyle, roughIdea, dynamicSuggestions, seed, history, labsState]);

  const handleSave = () => {
      // Uniqueness check for file name
      if (fileName.trim() !== file.name) {
          const isDuplicate = existingFileNames.some(
              name => name.toLowerCase() === fileName.trim().toLowerCase() && name.toLowerCase() !== file.name.toLowerCase()
          );
          if (isDuplicate) {
              setToastMessage("A file with this name already exists in the project.");
              return;
          }
      }

      onSave({ 
          ...file, 
          name: fileName,
          blocks, 
          seed,
          previewImage: generatedImage || undefined,
          aspectRatio,
          baseStyle,
          useBaseStyle,
          roughIdea,
          dynamicSuggestions,
          history,
          labsState 
      });
      setIsDirty(false);
      setToastMessage("File saved successfully.");
  };

  const handleBackCheck = () => {
      if (isDirty) {
          setShowExitModal(true);
      } else {
          onBack();
      }
  };

  const handleBlockSelect = (id: string) => {
      setSelectedBlockId(id);
      if (activeTab === 'labs') {
          setActiveTab('preview');
      }
  };

  const handleGeneralSettingsSelect = () => {
      setSelectedBlockId('general');
      setActiveTab('preview');
  };

  useEffect(() => {
    if (history.length === 0 && blocks.length > 0) {
        addToHistory('Initial State');
    }
  }, []);

  const addToHistory = (action: string) => {
    const newEntry: HistoryEntry = {
        id: `h-${Date.now()}`,
        timestamp: Date.now(),
        action,
        blocks: JSON.parse(JSON.stringify(blocks)),
        seed,
        previewImage: generatedImage || undefined,
        aspectRatio,
        labsState: JSON.parse(JSON.stringify(labsState))
    };
    setHistory(prev => [newEntry, ...prev]);
  };

  const restoreHistory = (entry: HistoryEntry) => {
      if(confirm(`Revert to version from ${new Date(entry.timestamp).toLocaleTimeString()}? Current unsaved changes will be lost.`)) {
          const restoredBlocks = JSON.parse(JSON.stringify(entry.blocks));
          const restoredLabs = migrateLabsState(entry.labsState ? JSON.parse(JSON.stringify(entry.labsState)) : undefined);
          const restoredImage = entry.previewImage || null;

          setBlocks(restoredBlocks);
          setSeed(entry.seed);
          setGeneratedImage(restoredImage);
          setLabsBaseImage(restoredImage);
          setAspectRatio(entry.aspectRatio);
          setLabsState(restoredLabs);
          
          setToastMessage("Restored previous version.");
          setActiveTab('preview');
      }
  };

  useEffect(() => {
    const contextParts: string[] = [];
    if (roughIdea) contextParts.push(`Core Idea: ${roughIdea}`);
    if (baseStyle && useBaseStyle) contextParts.push(`Style: ${baseStyle}`);
    
    blocks.forEach(b => {
        if (!b.isActive) return;
        if (b.type === BlockType.SUBJECT) {
            const cat = b.sections['core']?.fields['category'];
            const role = b.sections['core']?.fields['role'];
            contextParts.push(`Subject: ${cat} ${role}`);
        }
        if (b.type === BlockType.BACKGROUND) {
            const type = b.sections['setting']?.fields['type'];
            const env = b.sections['setting']?.fields['environment'];
            contextParts.push(`Setting: ${type} - ${env}`);
        }
    });

    const currentContextString = contextParts.join('|');

    if (currentContextString !== lastContextRef.current && currentContextString.length > 10) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        
        debounceTimerRef.current = setTimeout(async () => {
            lastContextRef.current = currentContextString;
            try {
                const readableContext = contextParts.join('. ');
                const newSuggestions = await generateContextSuggestions(readableContext);
                if (Object.keys(newSuggestions).length > 0) {
                    setDynamicSuggestions(prev => ({ ...prev, ...newSuggestions }));
                }
            } catch (e) {
                console.error("Brain update failed", e);
            }
        }, 2000);
    }

    return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [blocks, roughIdea, baseStyle, useBaseStyle]);

  const addBlock = (type: BlockType) => {
    const def = BLOCK_DEFINITIONS[type];
    const existingCount = blocks.filter(b => b.type === type).length;
    const newCount = existingCount + 1;
    let customLabel = `${def.label} ${newCount}`;

    const sections: Record<string, SectionState> = {};
    def.sections.forEach(s => {
        const fields: Record<string, any> = {};
        s.fields.forEach(f => {
            fields[f.id] = f.defaultValue;
        });
        sections[s.id] = {
            enabled: s.toggleable ? false : undefined, 
            fields
        };
    });

    const newBlock: BlockState = {
      id: `block-${Date.now()}`,
      type,
      isActive: true, 
      customLabel,
      sections
    };

    insertNewBlock(newBlock, def.singleActiveInstance);
  };
  
  const addBlockFromLibrary = (libraryBlock: BlockState, sourcePreview?: string) => {
      const def = BLOCK_DEFINITIONS[libraryBlock.type];
      // Use smart label to preserve custom names from library items
      const smartName = getSmartLabel(libraryBlock);
      const newBlock: BlockState = {
          ...JSON.parse(JSON.stringify(libraryBlock)), 
          id: `lib-block-${Date.now()}`,
          isActive: true,
          customLabel: smartName,
          referenceImage: sourcePreview // Attach visual reference to ensure consistency
      };
      insertNewBlock(newBlock, def.singleActiveInstance);
  };

  const insertNewBlock = (newBlock: BlockState, isSingleInstance?: boolean) => {
      let updatedBlocks = [...blocks];
      let deactivatedOther = false;
      if (isSingleInstance) {
          updatedBlocks = updatedBlocks.map(b => {
              if (b.type === newBlock.type && b.isActive) {
                  deactivatedOther = true;
                  return { ...b, isActive: false };
              }
              return b;
          });
      }
      updatedBlocks.push(newBlock);
      setBlocks(updatedBlocks);
      setSelectedBlockId(newBlock.id);
      setIsAddBlockModalOpen(false);

      if (deactivatedOther) {
          setToastMessage(`Switched active to new block.`);
      } else {
          setToastMessage(`Added block: ${newBlock.customLabel}`);
      }
  };

  const removeBlock = (id: string) => {
    const isGlobal = globalBlocks.some(gb => gb.id === id);
    if (isGlobal) {
        setToastMessage("Cannot delete Global Block here. Go to Project Settings.");
        return;
    }
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    if (selectedBlockId === id) setSelectedBlockId('general'); 
  };

  const duplicateBlock = (e: React.MouseEvent, block: BlockState) => {
      e.stopPropagation();
      const isGlobal = globalBlocks.some(gb => gb.id === block.id);
      if (isGlobal) {
           setToastMessage("Cannot duplicate Global Block here.");
           return;
      }
      const def = BLOCK_DEFINITIONS[block.type];
      const existingCount = blocks.filter(b => b.type === block.type).length;
      const newCount = existingCount + 1;
      const newLabel = `${def.label} ${newCount}`;
      const newBlock: BlockState = {
          ...JSON.parse(JSON.stringify(block)), 
          id: `block-${Date.now()}`,
          customLabel: newLabel,
          isActive: def.singleActiveInstance ? false : block.isActive 
      };
      
      const idx = blocks.findIndex(b => b.id === block.id);
      const newBlocks = [...blocks];
      newBlocks.splice(idx + 1, 0, newBlock); 
      setBlocks(newBlocks);
      setSelectedBlockId(newBlock.id);
  };

  const handlePromoteToGlobal = () => {
      setToastMessage("Saving as global block...");
  };

  const handleDetachGlobal = () => {};

  const handleDeleteFile = () => {
    if (confirm(`Are you sure you want to delete "${file.name}"? This cannot be undone.`)) {
        if (onDelete) onDelete();
    }
  };

  const updateBlock = (updated: BlockState) => {
    const isGlobal = globalBlocks.some(gb => gb.id === updated.id);
    if (isGlobal) {
        if (onUpdateGlobalBlock) {
             onUpdateGlobalBlock(updated);
        }
    } else {
        let nextBlocks = blocks.map(b => b.id === updated.id ? updated : b);

        if (updated.type === BlockType.SUBJECT) {
            const newInteractions = updated.sections['interactions'];
            const targetName = newInteractions?.fields['target_subject'];
            const action = newInteractions?.fields['interaction_type'];
            const isEnabled = newInteractions?.enabled;

            if (isEnabled && targetName && targetName !== 'None') {
                const targetBlockIndex = nextBlocks.findIndex(b => (b.customLabel || BLOCK_DEFINITIONS[b.type].label) === targetName);
                if (targetBlockIndex > -1) {
                    const targetBlock = nextBlocks[targetBlockIndex];
                    const targetInteractions = targetBlock.sections['interactions'];
                    const currentReciprocal = targetInteractions?.fields['target_subject'];
                    
                    if (currentReciprocal !== updated.customLabel || !targetInteractions?.enabled) {
                        const updatedTarget = {
                            ...targetBlock,
                            sections: {
                                ...targetBlock.sections,
                                interactions: {
                                    ...targetBlock.sections['interactions'],
                                    enabled: true,
                                    fields: {
                                        ...targetBlock.sections['interactions']?.fields,
                                        target_subject: updated.customLabel, 
                                        interaction_type: action 
                                    }
                                }
                            }
                        };
                        nextBlocks[targetBlockIndex] = updatedTarget;
                    }
                }
            }
        }
        setBlocks(nextBlocks);
    }
  };

  const toggleBlockActive = (e: React.MouseEvent, block: BlockState) => {
      e.stopPropagation();
      const def = BLOCK_DEFINITIONS[block.type];
      const willBeActive = !block.isActive;

      const isGlobal = globalBlocks.some(gb => gb.id === block.id);
      if (isGlobal) {
           const updated = { ...block, isActive: willBeActive };
           if (onUpdateGlobalBlock) {
               onUpdateGlobalBlock(updated);
           }
           return;
      }

      let updatedBlocks = [...blocks];
      let deactivatedOther = false;

      if (willBeActive && def.singleActiveInstance) {
          updatedBlocks = updatedBlocks.map(b => {
              if (b.type === block.type && b.id !== block.id && b.isActive) {
                  deactivatedOther = true;
                  return { ...b, isActive: false };
              }
              return b;
          });
      }

      updatedBlocks = updatedBlocks.map(b => b.id === block.id ? { ...b, isActive: willBeActive } : b);
      setBlocks(updatedBlocks);
      if (deactivatedOther) {
          setToastMessage(`Switched active ${def.label}. Only one allowed.`);
      }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const img = await generateImageFromBlocks(blocks, seed, aspectRatio, baseStyle, generatedImage, useBaseStyle, globalBlocks);
      
      if (img) {
          let effectiveForGen = [...blocks];
          if (useBaseStyle && globalBlocks.length > 0) {
              const localTypes = new Set(blocks.filter(b => b.isActive).map(b => b.type));
              const activeGlobals = globalBlocks.filter(gb => {
                  if (!gb.isActive) return false;
                  const def = BLOCK_DEFINITIONS[gb.type];
                  if (def.singleActiveInstance && localTypes.has(gb.type)) return false;
                  return true;
              });
              effectiveForGen = [...activeGlobals, ...blocks];
          }

          const backgroundBlock = effectiveForGen.find(b => b.type === BlockType.BACKGROUND && b.isActive);
          const isTransparencyEnabled = backgroundBlock?.sections['transparency']?.fields['remove_bg'] === true;

          let finalImg = img;
          if (isTransparencyEnabled) {
              finalImg = await processTransparency(img);
          }
          
          setGeneratedImage(finalImg);
          setLabsBaseImage(finalImg); 
          
          const prevBlocks = history.length > 0 ? history[0].blocks : [];
          const actionLabel = getChangeSummary(prevBlocks, blocks);
          addToHistory(actionLabel);
      }
    } catch (e: any) {
      console.error("Generation Error:", e);
      // Improved Error Handling Logic
      const msg = e.message || JSON.stringify(e);
      let friendlyMsg = "Generation failed.";
      
      if (msg.includes('API_KEY_MISSING')) {
          friendlyMsg = "Missing API Key. Click the indicator in the top right to add one.";
      } else if (msg.includes('QUOTA_EXHAUSTED')) {
          friendlyMsg = "Rate Limit Reached (429). If using a custom key, it may also be exhausted.";
      } else if (msg.includes('API_KEY_INVALID')) {
           friendlyMsg = "Invalid API Key. Please check your settings.";
      } else {
          friendlyMsg = msg.substring(0, 100); 
      }
      
      setToastMessage(friendlyMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRebuildBlocks = async () => {
      if (!roughIdea) return;
      setIsRebuilding(true);
      try {
          const newBlocks = await analyzeReference(roughIdea);
          setBlocks(newBlocks);
          if (newBlocks.length > 0) {
              setSelectedBlockId(newBlocks[0].id);
          }
          const suggestions = await generateContextSuggestions(roughIdea);
          setDynamicSuggestions(suggestions);
          setToastMessage("Context & suggestions updated.");
          addToHistory('Rebuilt Blocks from Concept');
      } catch (e: any) {
          const msg = e.message;
          if (msg.includes('API_KEY_MISSING')) setToastMessage("Missing API Key.");
          else if (msg.includes('QUOTA_EXHAUSTED')) setToastMessage("Quota Exceeded.");
          else setToastMessage(`Error rebuilding context: ${msg}`);
      } finally {
          setIsRebuilding(false);
      }
  };

  const handleQuickEdit = async () => {
    if (!quickEditInstruction) return;
    setIsRefining(true);
    try {
        const newBlocks = await refineBlocks(blocks, quickEditInstruction);
        setBlocks(newBlocks);
        setQuickEditInstruction('');
        
        setIsGenerating(true);
        const img = await generateImageFromBlocks(newBlocks, seed, aspectRatio, baseStyle, generatedImage, useBaseStyle, globalBlocks);
        if (img) {
             setGeneratedImage(img);
             setLabsBaseImage(img);
             addToHistory(`Edit: ${quickEditInstruction}`);
        }
        
    } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes('API_KEY_MISSING')) setToastMessage("Missing API Key.");
        else if (msg.includes('QUOTA_EXHAUSTED')) setToastMessage("Quota Exceeded.");
        else setToastMessage(`Refinement Failed: ${msg.substring(0, 50)}`);
    } finally {
        setIsRefining(false);
        setIsGenerating(false);
    }
  };

  // --- Labs Handlers ---

  const handleApplyLabs = () => {
      // FIX: Deselect active layer first so resize borders don't get saved
      setSelectedLabsLayerId(null);

      // Brief delay to allow React to re-render the canvas without UI elements
      setTimeout(() => {
          if (!labsCanvasRef.current) return;
          const dataUrl = labsCanvasRef.current.toDataURL('image/png');
          setGeneratedImage(dataUrl);
          setLabsBaseImage(dataUrl);
          
          // Reset Labs state to default after applying to avoid double-filtering
          setLabsState(JSON.parse(JSON.stringify(DEFAULT_LABS_STATE)));
          
          addToHistory("Labs Enhancement");
          setToastMessage("Image updated and Labs controls reset.");
      }, 50);
  };

  const handleResetLabs = () => {
      // Force deep copy to ensure new reference and clean state
      setLabsState(JSON.parse(JSON.stringify(DEFAULT_LABS_STATE)));
      setSelectedLabsLayerId(null);
  };

  const handleSaveLabsPreset = (preset: LabsPreset) => {
      setLabsPresets([...labsPresets, preset]);
      setToastMessage(`Saved preset: ${preset.name}`);
  };

  const handleLabsAIAction = async (action: 'remove-bg' | 'upscale') => {
      if (!labsBaseImage) return;
      
      setIsGenerating(true);
      setToastMessage(`Processing: ${action === 'remove-bg' ? 'Removing Background...' : 'Upscaling...'}`);

      try {
          const instruction = action === 'remove-bg' 
              ? "Change the background to a solid pure white color #FFFFFF. Keep the subject exactly as is. Do not crop." 
              : "Upscale image to 4k resolution. enhance details and sharpness.";
          
          let resultImg = await editImage(labsBaseImage, instruction);

          if (resultImg && action === 'remove-bg') {
               resultImg = await processTransparency(resultImg);
          }

          if (resultImg) {
              setLabsBaseImage(resultImg); 
              setToastMessage("Labs image updated. Apply to save to file.");
          } else {
              setToastMessage("AI processing failed.");
          }
      } catch (e: any) {
          const msg = e.message || '';
          if (msg.includes('QUOTA_EXHAUSTED')) setToastMessage("Quota Exceeded.");
          else setToastMessage(`Error: ${msg}`);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleDownload = () => {
      if (!generatedImage) return;
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `starrygen-${fileName.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleShare = () => {
      if (!generatedImage) return;
      navigator.clipboard.writeText(generatedImage).then(() => {
          setToastMessage("Image data copied to clipboard!");
      });
  };

  const handleOpenLibrary = () => {
      setIsAddBlockModalOpen(true);
      setAddBlockTab('global');
  };

  const selectedBlock = effectiveBlocks.find(b => b.id === selectedBlockId);
  const isSelectedGlobal = selectedBlock && globalBlocks.some(gb => gb.id === selectedBlock.id);
  const isGeneralSelected = selectedBlockId === 'general';

  const filteredLocalLibrary = localLibrary.filter(item => 
    getSmartLabel(item.block).toLowerCase().includes(librarySearch.toLowerCase())
  );
  
  const filteredExternalLibrary = externalLibrary.filter(item => {
      const label = getSmartLabel(item.block).toLowerCase();
      const file = item.sourceFile.toLowerCase();
      const project = item.sourceProject?.toLowerCase() || '';
      const query = librarySearch.toLowerCase();
      return label.includes(query) || file.includes(query) || project.includes(query);
  });

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-text-main">
      {toastMessage && <Toast message={toastMessage} onClose={handleCloseToast} />}

      <Modal isOpen={showExitModal} onClose={() => setShowExitModal(false)} title="UNSAVED CHANGES">
        <div className="space-y-4">
            <p className="text-sm text-text-muted">You have unsaved changes. Do you want to save them before leaving?</p>
            <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => { onBack(); }}>Discard & Exit</Button>
                <Button onClick={() => { handleSave(); onBack(); }}>Save & Exit</Button>
            </div>
        </div>
      </Modal>

      {/* LEFT PANEL: Blocks */}
      <div className="w-80 border-r border-border flex flex-col bg-surface z-20 shadow-xl shrink-0">
        <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-surfaceHighlight/30">
            <div className="flex items-center gap-2 overflow-hidden">
                <button onClick={handleBackCheck} className="text-text-muted hover:text-white transition-colors">
                    <Icons.ArrowLeft size={16}/>
                </button>
                <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm truncate">{fileName}</span>
                    {isDirty && <span className="text-[9px] text-amber-400 font-medium">Unsaved Changes</span>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleSave} 
                    className={`p-1.5 rounded transition-colors ${isDirty ? 'bg-primary-500/20 text-primary-300 hover:bg-primary-500 hover:text-white' : 'text-text-dim hover:text-white'}`}
                    title="Save File"
                >
                    <Icons.Save size={14} />
                </button>
                 {isEditingSeed ? (
                     <Input 
                        value={seed} 
                        onChange={(e) => setSeed(Number(e.target.value))} 
                        onBlur={() => setIsEditingSeed(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingSeed(false)}
                        autoFocus
                        className="w-16 text-[10px] h-6 py-0 font-mono"
                     />
                 ) : (
                     <button 
                        onClick={() => setIsEditingSeed(true)} 
                        className="text-[10px] font-mono text-text-dim px-2 py-1 bg-white/5 rounded border border-white/5 hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5"
                        title="Click to edit seed"
                     >
                        <Icons.Lock size={10} />
                        {seed}
                     </button>
                 )}
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col p-2 space-y-2 pb-20">
            {/* GENERAL BLOCK */}
            <div 
                onClick={handleGeneralSettingsSelect}
                className={`flex items-center gap-2 group/row animate-fade-in`}
            >
                <div 
                    className={`flex-1 relative flex items-center justify-between p-2 rounded-md cursor-pointer transition-all border overflow-hidden ${
                        isGeneralSelected
                        ? 'bg-white/5 border-white/10 shadow-lg' 
                        : 'bg-surfaceHighlight/30 border-transparent hover:bg-white/5 hover:border-white/5'
                    }`}
                >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-zinc-500`} />
                    <div className="flex items-center gap-3 overflow-hidden flex-1 pl-3">
                        <Icons.Settings2 size={14} className={isGeneralSelected ? 'text-white' : 'text-text-dim'} />
                        <div className="flex flex-col overflow-hidden min-w-0">
                            <span className={`text-xs font-medium truncate ${isGeneralSelected ? 'text-white' : 'text-text-muted group-hover:text-text-main'}`}>
                                General Settings
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-2 py-1 flex items-center justify-between border-t border-white/5 mt-2">
                 <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">
                    Blocks ({effectiveBlocks.length})
                </span>
            </div>

            {effectiveBlocks.map((block, index) => {
                const def = BLOCK_DEFINITIONS[block.type];
                const DefIcon = Icons[def.icon as keyof typeof Icons] as React.ElementType;
                const isSelected = selectedBlockId === block.id;
                const isGlobal = (block as any).isGlobal;

                return (
                    <div key={block.id} className="flex items-center gap-2 group/row animate-fade-in">
                        <button 
                            onClick={(e) => toggleBlockActive(e, block)}
                            className={`p-1.5 rounded-md transition-colors ${
                                block.isActive 
                                ? 'text-text-muted hover:text-white hover:bg-white/10' 
                                : 'text-text-dim opacity-40 hover:opacity-100 hover:text-white'
                            }`}
                            title={block.isActive ? "Hide Layer" : "Show Layer"}
                        >
                            {block.isActive ? <Icons.Eye size={14} /> : <Icons.EyeOff size={14} />}
                        </button>
                        <div 
                            onClick={() => handleBlockSelect(block.id)}
                            className={`flex-1 relative flex items-center justify-between p-2 rounded-md cursor-pointer transition-all border overflow-hidden ${
                                isSelected 
                                ? 'bg-white/5 border-white/10 shadow-lg' 
                                : 'bg-surfaceHighlight/30 border-transparent hover:bg-white/5 hover:border-white/5'
                            } ${!block.isActive && 'opacity-60 grayscale'}`}
                        >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${def.colorTheme}`} />
                            <div className="flex items-center gap-3 overflow-hidden flex-1 pl-3">
                                {DefIcon && <DefIcon size={14} className={isSelected ? 'text-white' : 'text-text-dim'} />}
                                <div className="flex flex-col overflow-hidden min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-text-muted group-hover/row:text-text-main'}`}>
                                            {block.customLabel || def.label}
                                        </span>
                                        {isGlobal && <Icons.Globe size={10} className="text-primary-400 shrink-0" />}
                                    </div>
                                </div>
                            </div>
                            {!isGlobal && (
                                <div className={`flex items-center gap-1 pl-2 bg-surface/80 backdrop-blur-sm rounded transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}>
                                    <button 
                                        onClick={(e) => duplicateBlock(e, block)}
                                        className="p-1 hover:bg-white/10 rounded text-text-dim hover:text-white transition-colors"
                                        title="Duplicate"
                                    >
                                        <Icons.Copy size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                                        className="p-1 hover:bg-red-500/10 rounded text-text-dim hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Icons.Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            <button
                onClick={() => {
                    setAddBlockTab('create');
                    setIsAddBlockModalOpen(true);
                }}
                className="w-full py-2.5 mt-2 flex items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10 hover:border-white/20 transition-all text-xs font-medium group"
            >
                <div className="p-0.5 rounded bg-white/10 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                    <Icons.Plus size={12} />
                </div>
                Add Block
            </button>
        </div>
      </div>

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col relative bg-black/50 overflow-hidden">
        <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-0 z-10 shadow-sm">
            <div className="flex items-center h-full">
                <TabButton active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={Icons.Eye}>Preview</TabButton>
                <TabButton active={activeTab === 'prompt'} onClick={() => setActiveTab('prompt')} icon={Icons.Terminal}>Prompt</TabButton>
                <TabButton active={activeTab === 'json'} onClick={() => setActiveTab('json')} icon={Icons.Code}>JSON</TabButton>
                <TabButton active={activeTab === 'labs'} onClick={() => setActiveTab('labs')} icon={Icons.FlaskConical}>Labs</TabButton>
                <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={Icons.History}>History</TabButton>
            </div>
            
            <div className="flex items-center gap-3 px-4">
                 <span className="text-xs text-text-dim font-mono border-r border-white/10 pr-3">{aspectRatio}</span>
                 {generatedImage && (
                    <div className="flex items-center gap-1 mr-2">
                        <Button variant="ghost" size="sm" onClick={handleDownload} title="Download Image">
                             <Icons.Download size={16} />
                        </Button>
                         <Button variant="ghost" size="sm" onClick={handleShare} title="Copy Image">
                             <Icons.Share2 size={16} />
                        </Button>
                    </div>
                 )}
                 <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className={isGenerating ? 'opacity-80' : ''}>
                    {isGenerating ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Sparkles size={16} />}
                    {generatedImage ? 'Regenerate' : 'Generate'}
                </Button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px] bg-background">
             {activeTab === 'preview' && (
                <div className="w-full h-full relative flex flex-col min-h-0">
                    <div className="flex-1 w-full h-full flex items-center justify-center p-4 pb-20 overflow-hidden min-h-0 min-w-0">
                        <div className="relative w-full h-full flex items-center justify-center">
                             {/* Checkerboard background for transparency visibility */}
                             <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-20">
                                 <div 
                                    style={{ 
                                        width: '100%', height: '100%', 
                                        backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                                        backgroundSize: '20px 20px',
                                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                                    }} 
                                 />
                             </div>

                             {generatedImage ? (
                                autoApplyLabs && labsBaseImage ? (
                                    <LabsCanvas 
                                        image={labsBaseImage} 
                                        state={labsState} 
                                        interactive={false} 
                                    />
                                ) : (
                                    <img 
                                        src={generatedImage} 
                                        alt="Generated" 
                                        className="max-w-full max-h-full object-contain shadow-2xl relative z-10" 
                                    />
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center text-text-dim opacity-50 relative z-10">
                                    <Icons.BoxSelect size={48} strokeWidth={1} className="mb-4" />
                                    <p className="text-sm font-light">Scene Preview</p>
                                </div>
                            )}
                            
                            {/* Premium Loader */}
                            {isGenerating && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
                                    <div className="relative flex flex-col items-center">
                                        {/* Outer Ring */}
                                        <div className="w-24 h-24 rounded-full border-4 border-white/5 border-t-primary-500 animate-spin absolute" />
                                        {/* Inner Ring */}
                                        <div className="w-16 h-16 rounded-full border-4 border-white/5 border-b-purple-500 animate-spin absolute top-4" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                                        
                                        {/* Center Icon */}
                                        <div className="w-24 h-24 flex items-center justify-center">
                                            <Icons.Sparkles size={24} className="text-white animate-pulse" />
                                        </div>

                                        <div className="mt-8 text-center space-y-2">
                                            <h3 className="text-sm font-bold text-white tracking-widest animate-pulse">GENERATING</h3>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
                        <div className="bg-surface/90 backdrop-blur-md border border-white/10 rounded-full shadow-2xl p-1.5 flex items-center gap-2 ring-1 ring-black/20 w-full max-w-lg pointer-events-auto group focus-within:ring-primary-500/30 transition-all">
                            <div className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center text-primary-400 shrink-0">
                                <Icons.Sparkles size={16} />
                            </div>
                            <input 
                                className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder-text-dim flex-1 h-full px-2 outline-none"
                                placeholder="Add, remove, or change anything..."
                                value={quickEditInstruction}
                                onChange={(e) => setQuickEditInstruction(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleQuickEdit()}
                            />
                            <Button 
                                size="sm" 
                                onClick={handleQuickEdit} 
                                disabled={isRefining || !quickEditInstruction}
                                className="rounded-full px-4"
                            >
                                {isRefining ? <Icons.Loader2 size={14} className="animate-spin" /> : 'Apply'}
                            </Button>
                        </div>
                    </div>
                </div>
             )}

             {activeTab === 'prompt' && (
                <div className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-3xl mx-auto space-y-4">
                        <div className="flex items-center justify-between">
                             <Label className="text-xs">CONSTRUCTED PROMPT</Label>
                             <Badge variant="outline">READ ONLY</Badge>
                        </div>
                        <div className="bg-surface border border-white/10 rounded-lg p-6 font-mono text-sm text-text-muted leading-relaxed select-all shadow-inner">
                            {constructPromptFromBlocks(blocks, baseStyle, useBaseStyle, globalBlocks)}
                        </div>
                    </div>
                </div>
             )}

             {activeTab === 'json' && (
                <div className="flex-1 p-0 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto p-8">
                        <div className="max-w-3xl mx-auto space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">BLOCK STRUCTURE</Label>
                                <Badge variant="outline">{blocks.length} BLOCKS</Badge>
                            </div>
                            <pre 
                                className="bg-[#0d0d0d] border border-white/10 rounded-lg p-6 font-mono text-xs text-zinc-500 overflow-x-auto shadow-inner"
                                dangerouslySetInnerHTML={{ __html: highlightJSON(blocks) }}
                            />
                        </div>
                    </div>
                </div>
             )}

             {activeTab === 'labs' && (
                 <div className="flex-1 h-full overflow-hidden flex items-center justify-center p-8">
                     {labsBaseImage ? (
                         <div className="w-full h-full relative shadow-2xl border border-white/10 bg-black/50">
                             {/* Checkerboard */}
                             <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ 
                                backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                             }} />
                             
                            <LabsCanvas 
                                image={labsBaseImage} 
                                state={labsState} 
                                onChange={setLabsState} 
                                interactive={true}
                                forwardRef={labsCanvasRef}
                                selectedId={selectedLabsLayerId}
                                onSelect={setSelectedLabsLayerId}
                            />
                            {isGenerating && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                                    <div className="text-center">
                                        <Icons.Loader2 size={40} className="animate-spin text-primary-400 mx-auto mb-2" />
                                        <p className="text-white font-medium">Processing...</p>
                                    </div>
                                </div>
                            )}
                         </div>
                     ) : (
                         <div className="flex flex-col items-center justify-center h-full text-text-dim opacity-50 p-8 text-center">
                            <Icons.FlaskConical size={48} className="mb-4" />
                            <p className="text-sm font-light">Generate an image first to use Labs features.</p>
                         </div>
                     )}
                 </div>
             )}

             {activeTab === 'history' && (
                 <div className="flex-1 p-8 overflow-y-auto">
                     <div className="max-w-3xl mx-auto space-y-6">
                         <div className="flex items-center justify-between mb-4">
                             <div>
                                <h3 className="text-white font-bold text-lg">Version History</h3>
                                <p className="text-text-muted text-sm">View previous generations and revert changes.</p>
                             </div>
                             <Badge variant="outline">{history.length} Versions</Badge>
                         </div>

                         <div className="space-y-4 relative">
                             <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/10 z-0" />
                             {history.map((entry, idx) => (
                                 <div key={entry.id} className="relative z-10 flex gap-6 animate-slide-up group">
                                     <div className={`w-8 h-8 rounded-full border-4 border-background shrink-0 flex items-center justify-center ${idx === 0 ? 'bg-primary-500 text-white' : 'bg-surfaceHighlight text-text-muted'}`}>
                                         {idx === 0 ? <Icons.Check size={14} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                                     </div>
                                     <div className="flex-1 bg-surface border border-white/5 rounded-xl p-4 hover:border-white/20 transition-all flex gap-4">
                                         <div className="w-24 h-24 bg-black/40 rounded-lg shrink-0 overflow-hidden border border-white/5">
                                             {entry.previewImage ? (
                                                 <img src={entry.previewImage} alt="Version" className="w-full h-full object-cover" />
                                             ) : (
                                                 <div className="w-full h-full flex items-center justify-center">
                                                     <Icons.BoxSelect size={20} className="text-text-dim" />
                                                 </div>
                                             )}
                                         </div>
                                         <div className="flex-1 flex flex-col justify-between">
                                             <div>
                                                 <div className="flex justify-between items-start">
                                                     <h4 className="font-bold text-white text-sm">{entry.action}</h4>
                                                     <span className="text-[10px] font-mono text-text-dim">{new Date(entry.timestamp).toLocaleString()}</span>
                                                 </div>
                                                 <p className="text-xs text-text-muted mt-1 line-clamp-2">
                                                     {entry.blocks.length} Blocks • Seed: {entry.seed} • {entry.aspectRatio}
                                                 </p>
                                                 {entry.labsState && (
                                                     <div className="flex gap-2 mt-2">
                                                         {entry.labsState.overlays.length > 0 && <Badge variant="outline">{entry.labsState.overlays.length} Text</Badge>}
                                                         {Object.values(entry.labsState.filters).some(v => v !== 0 && v !== 100) && <Badge variant="outline">Filters</Badge>}
                                                     </div>
                                                 )}
                                             </div>
                                             <div className="flex justify-end pt-2">
                                                 <Button size="sm" variant="secondary" onClick={() => restoreHistory(entry)}>
                                                     <Icons.RotateCcw size={14} /> Revert to this version
                                                 </Button>
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             {history.length === 0 && (
                                 <div className="text-center py-10 text-text-dim opacity-50">
                                     <Icons.History size={48} className="mx-auto mb-2" strokeWidth={1} />
                                     <p>No history yet.</p>
                                 </div>
                             )}
                         </div>
                     </div>
                 </div>
             )}
        </div>
      </div>

      {/* RIGHT PANEL: Inspector */}
      <div className="w-80 border-l border-border bg-surface z-20 flex flex-col shadow-xl shrink-0">
          
          {/* Dynamic Header */}
          {activeTab === 'labs' ? null : (
            <div className="h-14 border-b border-border flex items-center px-6 bg-surfaceHighlight/30">
                <span className="text-xs font-bold text-text-dim uppercase tracking-widest">
                    {isGeneralSelected ? 'General Properties' : 'Block Properties'}
                </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin">
              {activeTab === 'labs' ? (
                  // --- LABS CONTROLS ---
                  <LabsControls 
                      state={labsState}
                      onChange={(newState) => { setLabsState(newState); }}
                      onApply={handleApplyLabs}
                      onReset={handleResetLabs}
                      autoApply={autoApplyLabs}
                      onToggleAutoApply={setAutoApplyLabs}
                      savedPresets={labsPresets}
                      onSavePreset={handleSaveLabsPreset}
                      onAIAction={handleLabsAIAction}
                      selectedId={selectedLabsLayerId}
                      onSelect={setSelectedLabsLayerId}
                  />
              ) : isGeneralSelected ? (
                  // GENERAL SETTINGS INSPECTOR
                  <div className="p-0 animate-fade-in relative h-full flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-zinc-500" />
                        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent">
                            <h2 className="text-sm font-bold text-white uppercase tracking-widest">General Settings</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <Accordion title="File Info" isOpen={true}>
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-1.5">
                                        <Label>File Name</Label>
                                        <HybridInput value={fileName} onChange={setFileName} placeholder="Name this file..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Aspect Ratio</Label>
                                        <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                                            <option value="1:1">1:1 (Square)</option>
                                            <option value="16:9">16:9 (Landscape)</option>
                                            <option value="9:16">9:16 (Portrait)</option>
                                            <option value="4:3">4:3 (Standard)</option>
                                            <option value="3:4">3:4 (Portrait)</option>
                                        </Select>
                                    </div>
                                </div>
                            </Accordion>
                            <Accordion 
                                title="Global Style" 
                                isOpen={false}
                                rightElement={<Toggle checked={useBaseStyle} onChange={setUseBaseStyle} />}
                            >
                                <div className="space-y-4 pt-2">
                                    {!useBaseStyle && (
                                        <div className="space-y-1.5 animate-slide-up">
                                            <Label>Base Style Prompt</Label>
                                            <HybridInput 
                                                value={baseStyle} 
                                                onChange={setBaseStyle} 
                                                placeholder="e.g. Cinematic, Anime"
                                            />
                                        </div>
                                    )}
                                    {useBaseStyle && (
                                        <div className="p-3 bg-black/20 rounded border border-white/5">
                                            <p className="text-[10px] text-text-muted">
                                                Inheriting {globalBlocks.length} master blocks from project settings.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </Accordion>
                            <Accordion title="Context & Description" isOpen={false}>
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-1.5">
                                        <Label>Rough Idea / Reference</Label>
                                        <Textarea 
                                            value={roughIdea} 
                                            onChange={(e) => setRoughIdea(e.target.value)} 
                                            rows={4}
                                            className="resize-none"
                                            placeholder="Describe your scene in natural language..."
                                        />
                                    </div>
                                    <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        onClick={handleRebuildBlocks} 
                                        disabled={isRebuilding || !roughIdea}
                                        className="w-full"
                                    >
                                        {isRebuilding ? <Icons.Loader2 size={14} className="animate-spin"/> : <Icons.RefreshCw size={14} />}
                                        Rebuild Context & Blocks
                                    </Button>
                                </div>
                            </Accordion>
                             <Accordion title="Danger Zone" isOpen={false}>
                                <div className="pt-2">
                                    <p className="text-[10px] text-text-dim mb-3">
                                        Deleting this file cannot be undone.
                                    </p>
                                    <Button 
                                        variant="danger" 
                                        size="sm" 
                                        onClick={handleDeleteFile} 
                                        className="w-full"
                                    >
                                        <Icons.Trash2 size={14} /> Delete File
                                    </Button>
                                </div>
                            </Accordion>
                        </div>
                  </div>
              ) : selectedBlock ? (
                  <BlockControls 
                    key={selectedBlock.id} 
                    block={selectedBlock} 
                    onChange={updateBlock} 
                    onDelete={() => removeBlock(selectedBlock.id)}
                    dynamicSuggestions={dynamicSuggestions}
                    allBlocks={effectiveBlocks}
                    isGlobal={isSelectedGlobal}
                    onDetach={isSelectedGlobal ? handleDetachGlobal : undefined}
                    onPromote={!isSelectedGlobal ? handlePromoteToGlobal : undefined}
                    onOpenLibrary={handleOpenLibrary}
                  />
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-text-dim text-sm text-center p-8">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <Icons.SlidersHorizontal size={24} className="opacity-40" />
                      </div>
                      <p className="font-medium text-text-muted">No Selection</p>
                      <p className="text-xs mt-2 opacity-50">Select a block from the left panel to configure</p>
                  </div>
              )}
          </div>
      </div>

      <Modal 
        isOpen={isAddBlockModalOpen} 
        onClose={() => setIsAddBlockModalOpen(false)} 
        title="ADD NEW BLOCK"
      >
        <div className="space-y-4">
            {/* Modal Navigation Tabs - Sticky */}
            <div className="sticky top-[-1.5rem] bg-[#121214] z-10 pt-6 pb-2 mb-2 -mx-6 px-6 border-b border-white/5 -mt-6">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setAddBlockTab('create')}
                        className={`flex-1 text-center py-2 text-xs font-medium rounded-t transition-colors ${addBlockTab === 'create' ? 'text-white border-b-2 border-primary-500' : 'text-text-dim hover:text-text-main'}`}
                    >
                        Standard
                    </button>
                    <button
                        onClick={() => setAddBlockTab('project')}
                        className={`flex-1 text-center py-2 text-xs font-medium rounded-t transition-colors ${addBlockTab === 'project' ? 'text-white border-b-2 border-primary-500' : 'text-text-dim hover:text-text-main'}`}
                    >
                        Project Assets
                    </button>
                    <button
                        onClick={() => setAddBlockTab('global')}
                        className={`flex-1 text-center py-2 text-xs font-medium rounded-t transition-colors ${addBlockTab === 'global' ? 'text-white border-b-2 border-primary-500' : 'text-text-dim hover:text-text-main'}`}
                    >
                        Global Search
                    </button>
                </div>
            </div>
            
            <div className="min-h-[300px]">
                {addBlockTab === 'create' && (
                    <div className="space-y-2">
                        {Object.values(BLOCK_DEFINITIONS).map(def => {
                            const DefIcon = Icons[def.icon as keyof typeof Icons] as React.ElementType;
                            const alreadyExists = def.singleActiveInstance && effectiveBlocks.some(b => b.type === def.type);

                            return (
                                <button
                                    key={def.type}
                                    onClick={() => addBlock(def.type)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-surface/30 hover:bg-surfaceHighlight hover:border-white/10 text-left group transition-all relative overflow-hidden`}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${def.colorTheme} opacity-50 group-hover:opacity-100 transition-opacity`} />
                                    
                                    <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-black/40 text-white shadow-inner`}>
                                        {DefIcon && <DefIcon size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-text-main group-hover:text-primary-400 transition-colors truncate">
                                            {def.label}
                                        </div>
                                        <div className="text-[10px] text-text-dim leading-tight mt-0.5 line-clamp-1">
                                            {def.description}
                                        </div>
                                    </div>
                                    {alreadyExists && (
                                        <div className="text-primary-400 opacity-50" title="Existing instance found (will switch)">
                                            <Icons.ArrowLeftRight size={14} />
                                        </div>
                                    )}
                                    <Icons.Plus size={16} className="text-text-dim group-hover:text-primary-400" />
                                </button>
                            );
                        })}
                    </div>
                )}
                    
                {addBlockTab === 'project' && (
                    <>
                        <div className="relative mb-3 sticky top-[45px] z-10 bg-[#121214] pb-2">
                            <Icons.Search size={14} className="absolute left-3 top-2.5 text-text-dim" />
                            <input 
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-2 py-2 text-xs focus:outline-none focus:border-white/20"
                                placeholder="Filter local blocks..."
                                value={librarySearch}
                                onChange={(e) => setLibrarySearch(e.target.value)}
                            />
                        </div>
                        {filteredLocalLibrary.length > 0 ? (
                            <div className="space-y-2">
                                {filteredLocalLibrary.map((item, idx) => {
                                    const def = BLOCK_DEFINITIONS[item.block.type];
                                    const DefIcon = Icons[def.icon as keyof typeof Icons] as React.ElementType;
                                    const smartLabel = getSmartLabel(item.block);
                                    
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => addBlockFromLibrary(item.block, item.sourcePreview)}
                                            className="w-full flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-surface/30 hover:bg-surfaceHighlight hover:border-white/10 text-left group transition-all"
                                        >
                                            <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 bg-black/40 text-text-muted group-hover:text-white ${def.colorTheme.replace('bg-', 'text-').replace('-500', '-400')}`}>
                                                {DefIcon && <DefIcon size={14} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-text-main group-hover:text-white truncate">
                                                    {smartLabel}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] bg-white/10 text-text-muted px-1.5 py-0.5 rounded">{def.label}</span>
                                                    <span className="text-[10px] text-text-dim truncate">
                                                        From: {item.sourceFile}
                                                    </span>
                                                </div>
                                            </div>
                                            {item.sourcePreview && (
                                                <div title="Has visual reference">
                                                    <Icons.Image size={14} className="text-primary-400 opacity-60" />
                                                </div>
                                            )}
                                            <Icons.Plus size={14} className="text-text-dim group-hover:text-primary-400" />
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-text-dim text-xs">
                                No matching blocks in this project.
                            </div>
                        )}
                    </>
                )}

                {addBlockTab === 'global' && (
                    <>
                        <div className="relative mb-3 sticky top-[45px] z-10 bg-[#121214] pb-2">
                            <Icons.Search className="absolute left-3 top-2.5 text-text-dim" size={14}/>
                            <Input 
                                className="pl-9 py-2" 
                                placeholder="Search across all projects..."
                                value={librarySearch}
                                onChange={(e) => setLibrarySearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        <div className="space-y-2">
                            {filteredExternalLibrary.length === 0 ? (
                                <div className="text-center py-12 text-text-dim">
                                    <p className="text-xs">No matching blocks found in other projects.</p>
                                </div>
                            ) : (
                                filteredExternalLibrary.map((item, idx) => {
                                    const def = BLOCK_DEFINITIONS[item.block.type];
                                    const DefIcon = Icons[def.icon as keyof typeof Icons] as React.ElementType;
                                    const smartLabel = getSmartLabel(item.block);
                                    
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => addBlockFromLibrary(item.block, item.sourcePreview)}
                                            className="w-full flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-surface/30 hover:bg-surfaceHighlight hover:border-white/10 text-left group transition-all"
                                        >
                                            <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 bg-black/40 text-text-muted group-hover:text-white ${def.colorTheme.replace('bg-', 'text-').replace('-500', '-400')}`}>
                                                {DefIcon && <DefIcon size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-text-main group-hover:text-white truncate">
                                                    {smartLabel}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] bg-white/10 text-text-muted px-1.5 py-0.5 rounded">{def.label}</span>
                                                    <span className="text-[10px] text-text-dim truncate">
                                                        {item.sourceProject} / {item.sourceFile}
                                                    </span>
                                                </div>
                                            </div>
                                            {item.sourcePreview && (
                                                <div title="Has visual reference">
                                                    <Icons.Image size={14} className="text-primary-400 opacity-60" />
                                                </div>
                                            )}
                                            <Icons.Plus size={14} className="text-text-dim group-hover:text-primary-400" />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
      </Modal>
    </div>
  );
};
