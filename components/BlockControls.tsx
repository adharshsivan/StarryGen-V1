
import React, { useState, useEffect } from 'react';
import { BlockState, BlockDefinition, SectionState, BlockType, CustomProperty } from '../types';
import { BLOCK_DEFINITIONS, createDefaultBlockState, getSmartLabel } from '../constants';
import { Label, Input, NumberSlider, Toggle, Accordion, VisualSelect, ColorInput, HybridInput, HybridSelect, TagInput, Checkbox, SegmentedControl, RadioGroup, Button, DetailedItemList, PositionPicker } from './UI';
import * as Icons from 'lucide-react';

interface BlockControlsProps {
  block: BlockState;
  onChange: (updatedBlock: BlockState) => void;
  onDelete: () => void;
  dynamicSuggestions?: Record<string, string[]>;
  allBlocks?: BlockState[]; // Required for cross-block conditions
  isGlobal?: boolean;
  onPromote?: () => void;
  onDetach?: () => void;
  onOpenLibrary?: () => void;
}

export const BlockControls: React.FC<BlockControlsProps> = ({ 
    block, 
    onChange, 
    onDelete, 
    dynamicSuggestions = {}, 
    allBlocks = [],
    isGlobal = false,
    onPromote,
    onOpenLibrary
}) => {
  const definition: BlockDefinition = BLOCK_DEFINITIONS[block.type];
  const [localName, setLocalName] = useState(block.customLabel || definition.label);
  const [isEditingName, setIsEditingName] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  
  // Sync local name if prop changes externally
  useEffect(() => {
    setLocalName(block.customLabel || definition.label);
  }, [block.customLabel, definition.label]);

  const updateField = (sectionId: string, fieldId: string, value: any) => {
    const sectionState = block.sections[sectionId] || { fields: {} };
    
    onChange({
      ...block,
      sections: {
        ...block.sections,
        [sectionId]: {
            ...sectionState,
            fields: {
                ...sectionState.fields,
                [fieldId]: value
            }
        }
      }
    });
  };

  const toggleSection = (sectionId: string, enabled: boolean) => {
    const sectionState = block.sections[sectionId] || { fields: {} };
    onChange({
        ...block,
        sections: {
            ...block.sections,
            [sectionId]: {
                ...sectionState,
                enabled
            }
        }
    });
  };

  const handleNameSave = () => {
      setIsEditingName(false);
      onChange({ ...block, customLabel: localName });
  };

  const handleReset = () => {
      if (confirm("Reset this block to default values?")) {
          const defaultBlock = createDefaultBlockState(block.type);
          onChange({
              ...defaultBlock,
              id: block.id,
              customLabel: block.customLabel, // preserve name
              customValues: [], // reset custom properties
              referenceImage: undefined // reset reference
          });
      }
  };

  // --- Reference Image Logic ---
  const handleRemoveReference = () => {
      if(confirm("Removing the reference image means this block will generate a new variation. Proceed?")) {
          onChange({ ...block, referenceImage: undefined });
      }
  };

  // --- Custom Property Logic ---

  const addCustomProperty = () => {
      const newCustomValues: CustomProperty[] = [
          ...(block.customValues || []),
          { 
              id: `custom-${Date.now()}`, 
              label: 'New Detail', 
              type: 'text', 
              value: '' 
          }
      ];
      onChange({ ...block, customValues: newCustomValues });
      setExpandedSectionId('custom-details'); // Auto expand custom section
  };

  const updateCustomProperty = (id: string, updates: Partial<CustomProperty>) => {
      const newCustomValues = (block.customValues || []).map(cp => 
          cp.id === id ? { ...cp, ...updates } : cp
      );
      onChange({ ...block, customValues: newCustomValues });
  };

  const handleCustomTypeChange = (id: string, newType: CustomProperty['type']) => {
      let newValue: any = '';
      if (newType === 'checkbox') newValue = false;
      if (newType === 'slider') newValue = 50;
      if (newType === 'color') newValue = '#000000';
      
      updateCustomProperty(id, { type: newType, value: newValue });
  };

  const removeCustomProperty = (id: string) => {
      const newCustomValues = (block.customValues || []).filter(cp => cp.id !== id);
      onChange({ ...block, customValues: newCustomValues });
  };

  if (!definition) return <div className="text-red-500 p-4">Unknown block type</div>;

  // We now render ALL sections sequentially, filtering only by visibility condition
  const visibleSections = definition.sections.filter(section => {
      if (!section.condition) return true;

      let controllingBlock = block;
      if (section.condition.blockType && allBlocks.length > 0) {
          const target = allBlocks.find(b => b.type === section.condition!.blockType && b.isActive);
          if (target) {
              controllingBlock = target;
          } else {
              return false; // Target block missing/inactive
          }
      }

      const controllingSection = controllingBlock.sections[section.condition.sectionId];
      const controllingValue = controllingSection?.fields?.[section.condition.fieldId];
      
      if (Array.isArray(section.condition.value)) {
          return section.condition.value.includes(controllingValue);
      } else {
          return controllingValue === section.condition.value;
      }
  });

  return (
    <div className="animate-fade-in pb-20 relative h-full flex flex-col bg-surface">
      {/* Visual Header */}
      <div className="relative shrink-0 z-10">
          <div className={`absolute top-0 left-0 w-1 h-full ${definition.colorTheme}`} />
          <div className="p-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent space-y-2">
            
            <div className="flex items-center justify-between">
                {isEditingName ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                        <Input 
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                            autoFocus
                        />
                        <button onClick={handleNameSave} className="text-primary-400 hover:text-white">
                            <Icons.Check size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <h2 
                            className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest cursor-pointer hover:text-primary-400 transition-colors"
                            onClick={() => setIsEditingName(true)}
                            title="Click to rename"
                        >
                            {block.customLabel || definition.label}
                            <Icons.Edit3 size={10} className="opacity-50" />
                        </h2>
                         {isGlobal && (
                            <div className="w-5 h-5 rounded-full bg-primary-500/10 border border-primary-500/30 flex items-center justify-center ml-2" title="Global Master Block">
                                <Icons.Globe size={12} className="text-primary-400" />
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex items-center gap-1">
                     {!isGlobal && onPromote && (
                        <button 
                            onClick={onPromote}
                            className="p-1.5 text-text-dim hover:text-primary-400 rounded hover:bg-white/10 transition-colors" 
                            title="Save as Global Block"
                        >
                            <Icons.Globe size={12} />
                        </button>
                     )}
                     <button 
                        onClick={handleReset}
                        className="p-1.5 text-text-dim hover:text-white rounded hover:bg-white/10 transition-colors" 
                        title="Reset to defaults"
                    >
                        <Icons.RotateCcw size={12} />
                    </button>
                     {!isGlobal && (
                        <button 
                            onClick={onDelete}
                            className="p-1.5 text-text-dim hover:text-red-400 rounded hover:bg-red-500/10 transition-colors" 
                            title="Delete Block"
                        >
                            <Icons.Trash2 size={12} />
                        </button>
                     )}
                </div>
            </div>
          </div>
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto">
            
            {/* Visual Reference Section */}
            {block.referenceImage && (
                <div className="p-4 border-b border-white/5 bg-primary-500/5 relative group">
                    <div className="flex items-center gap-2 mb-2">
                         <Icons.Link size={12} className="text-primary-400"/>
                         <Label className="mb-0 text-primary-300">Visual Reference Active</Label>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-16 h-16 rounded border border-primary-500/30 overflow-hidden bg-black/40 relative">
                             <img src={block.referenceImage} className="w-full h-full object-cover" alt="Reference" />
                        </div>
                        <div className="flex-1">
                             <p className="text-[10px] text-text-muted leading-tight mb-2">
                                 The AI is using this image to lock the appearance of this {block.type}.
                             </p>
                             <Button size="sm" variant="secondary" className="h-6 text-[10px]" onClick={handleRemoveReference}>
                                 <Icons.Trash2 size={10} /> Remove Reference
                             </Button>
                        </div>
                    </div>
                </div>
            )}

            {visibleSections.map(section => {
                const sectionState = block.sections[section.id] || { fields: {} };
                // Determine if section is disabled (toggleable state)
                const isDisabled = section.toggleable && sectionState.enabled === false;

                return (
                    <Accordion 
                        key={section.id} 
                        title={section.label}
                        isOpen={expandedSectionId === section.id}
                        onToggle={() => setExpandedSectionId(expandedSectionId === section.id ? null : section.id)}
                        rightElement={section.toggleable ? (
                             <Toggle 
                                checked={sectionState.enabled === true} 
                                onChange={(val) => {
                                    toggleSection(section.id, val);
                                    if (val) setExpandedSectionId(section.id);
                                }} 
                            />
                        ) : null}
                    >
                        <div className={`space-y-4 pt-2 ${isDisabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                            {section.fields.map(field => {
                                const value = sectionState.fields[field.id] ?? field.defaultValue;
                                
                                // Construct Dynamic Suggestion Key
                                const suggestionKey = `${block.type}:${section.id}:${field.id}`;
                                const contextSuggestions = dynamicSuggestions[suggestionKey] || [];
                                
                                const mergedSuggestions = Array.from(new Set([
                                    ...contextSuggestions,
                                    ...(field.suggestions || [])
                                ]));

                                // --- Dynamic Select Options for Interactions ---
                                let options = field.options;
                                if (field.id === 'target_subject' && block.type === BlockType.SUBJECT) {
                                    const subjectOptions = allBlocks
                                        .filter(b => b.type === BlockType.SUBJECT && b.id !== block.id && b.isActive)
                                        .map(b => getSmartLabel(b));
                                    
                                    // Ensure 'None' is available and there are no duplicates
                                    options = ['None', ...Array.from(new Set(subjectOptions))];
                                }

                                return (
                                    <div key={field.id} className="group">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <Label className="mb-0 text-text-dim group-hover:text-text-muted transition-colors">{field.label}</Label>
                                            {field.unit && <span className="text-[9px] text-text-dim">{field.unit}</span>}
                                        </div>
                                        
                                        {field.type === 'text' && (
                                            <HybridInput 
                                                value={value} 
                                                onChange={(val) => updateField(section.id, field.id, val)} 
                                                suggestions={mergedSuggestions}
                                            />
                                        )}

                                        {field.type === 'tags' && (
                                            <TagInput 
                                                value={Array.isArray(value) ? value : []} 
                                                onChange={(val) => updateField(section.id, field.id, val)} 
                                                suggestions={mergedSuggestions}
                                            />
                                        )}

                                        {field.type === 'detailed-list' && (
                                            <DetailedItemList 
                                                value={Array.isArray(value) ? value : []} 
                                                onChange={(val) => updateField(section.id, field.id, val)}
                                                suggestions={mergedSuggestions}
                                                allowedDetailTypes={field.allowedDetailTypes}
                                                maxItems={field.maxItems}
                                            />
                                        )}

                                        {field.type === 'select' && (
                                            <>
                                                <HybridSelect
                                                    value={value}
                                                    onChange={(val) => updateField(section.id, field.id, val)}
                                                    options={options}
                                                    suggestions={mergedSuggestions}
                                                />
                                                {/* Allow adding new subject from library if options are sparse */}
                                                {field.id === 'target_subject' && onOpenLibrary && (
                                                    <div className="mt-1 flex justify-end">
                                                        <button 
                                                            onClick={onOpenLibrary}
                                                            className="text-[9px] text-primary-400 hover:text-white transition-colors flex items-center gap-1"
                                                        >
                                                            <Icons.PlusCircle size={10} /> Add Subject from Library
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {field.type === 'segmented' && options && (
                                            <SegmentedControl 
                                                value={value} 
                                                options={options}
                                                onChange={(val) => updateField(section.id, field.id, val)}
                                            />
                                        )}

                                        {field.type === 'radio' && options && (
                                            <RadioGroup 
                                                value={value} 
                                                options={options}
                                                onChange={(val) => updateField(section.id, field.id, val)}
                                            />
                                        )}

                                        {field.type === 'checkbox' && (
                                            <Checkbox 
                                                checked={value} 
                                                label={field.label} 
                                                onChange={(val) => updateField(section.id, field.id, val)} 
                                            />
                                        )}

                                        {field.type === 'slider' && (
                                            <NumberSlider 
                                                value={value} 
                                                min={field.min} 
                                                max={field.max} 
                                                onChange={(val) => updateField(section.id, field.id, val)} 
                                            />
                                        )}

                                        {field.type === 'color' && (
                                            <ColorInput 
                                                value={value} 
                                                onChange={(val) => updateField(section.id, field.id, val)}
                                                suggestions={mergedSuggestions}
                                            />
                                        )}

                                        {field.type === 'toggle' && (
                                            <div className="flex justify-start pt-1">
                                                <Toggle 
                                                    checked={value} 
                                                    onChange={(val) => updateField(section.id, field.id, val)} 
                                                />
                                            </div>
                                        )}

                                        {field.type === 'visual-select' && field.visualOptions && (
                                            <VisualSelect
                                                value={value}
                                                options={field.visualOptions}
                                                onChange={(val) => updateField(section.id, field.id, val)}
                                            />
                                        )}
                                        
                                        {field.type === 'position-picker' && (
                                            <PositionPicker
                                                value={value}
                                                onChange={(val) => updateField(section.id, field.id, val)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Accordion>
                );
            })}

            {/* Custom Properties Accordion */}
            <Accordion 
                title="Custom Details"
                isOpen={expandedSectionId === 'custom-details'}
                onToggle={() => setExpandedSectionId(expandedSectionId === 'custom-details' ? null : 'custom-details')}
            >
                <div className="space-y-4 pt-2">
                    {block.customValues?.map((cp) => (
                        <div key={cp.id} className="flex flex-col gap-3 bg-black/20 p-3 rounded border border-white/5 group">
                            <div className="flex items-center gap-2">
                                <input 
                                    className="bg-transparent text-[10px] font-bold text-text-muted uppercase tracking-wide border-b border-transparent focus:border-primary-500 outline-none w-full placeholder-text-dim"
                                    value={cp.label}
                                    onChange={(e) => updateCustomProperty(cp.id, { label: e.target.value })}
                                    placeholder="PROPERTY NAME"
                                />
                                
                                <select 
                                    value={cp.type}
                                    onChange={(e) => handleCustomTypeChange(cp.id, e.target.value as any)}
                                    className="bg-white/5 border border-white/10 text-[9px] rounded text-text-dim px-1 py-0.5 focus:outline-none"
                                >
                                    <option value="text">Text</option>
                                    <option value="slider">Slider</option>
                                    <option value="checkbox">Toggle</option>
                                    <option value="color">Color</option>
                                </select>

                                <button 
                                    onClick={() => removeCustomProperty(cp.id)}
                                    className="text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Icons.X size={12} />
                                </button>
                            </div>

                            <div>
                                {cp.type === 'text' && (
                                    <HybridInput 
                                        value={cp.value}
                                        onChange={(val) => updateCustomProperty(cp.id, { value: val })}
                                        placeholder="Value..."
                                    />
                                )}
                                
                                {cp.type === 'color' && (
                                    <ColorInput
                                        value={cp.value}
                                        onChange={(val) => updateCustomProperty(cp.id, { value: val })}
                                    />
                                )}

                                {cp.type === 'checkbox' && (
                                    <Checkbox 
                                        checked={!!cp.value}
                                        label="Enabled"
                                        onChange={(val) => updateCustomProperty(cp.id, { value: val })}
                                    />
                                )}

                                {cp.type === 'slider' && (
                                    <div className="space-y-2">
                                        <NumberSlider 
                                            value={Number(cp.value) || 0}
                                            min={cp.min || 0}
                                            max={cp.max || 100}
                                            onChange={(val) => updateCustomProperty(cp.id, { value: val })}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    <Button variant="ghost" size="sm" onClick={addCustomProperty} className="w-full border-dashed border-white/10 hover:border-primary-500/50">
                        <Icons.Plus size={12} /> Add Custom Field
                    </Button>
                </div>
            </Accordion>
      </div>
    </div>
  );
};
