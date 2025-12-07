

import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';

// --- Primitives ---

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon', size?: 'sm' | 'md' | 'lg' }> = ({ variant = 'primary', size = 'md', className, children, ...props }) => {
  const baseStyle = "font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-1 focus:ring-primary-500/50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20 border border-primary-500",
    secondary: "bg-surfaceHighlight hover:bg-zinc-700 text-text-main border border-white/10 hover:border-white/20",
    ghost: "bg-transparent hover:bg-white/5 text-text-muted hover:text-text-main",
    danger: "bg-red-900/20 hover:bg-red-900/40 text-red-200 border border-red-900/50",
    icon: "bg-transparent hover:bg-white/10 text-text-muted hover:text-white p-1"
  };

  const sizes = {
    sm: "text-xs px-2.5 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-6 py-3"
  };

  // Override size for icon variant
  const finalSize = variant === 'icon' ? '' : sizes[size];

  return (
    <button className={`${baseStyle} ${variants[variant]} ${finalSize} ${className || ''}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input 
    className={`w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-text-main placeholder-text-dim focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 focus:outline-none transition-all ${className}`} 
    {...props} 
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea 
    className={`w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-text-main placeholder-text-dim focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 focus:outline-none transition-all ${className}`} 
    {...props} 
  />
);

export const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <label className={`block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1.5 ${className}`}>
    {children}
  </label>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className={`bg-[#121214] border border-white/10 rounded-xl shadow-2xl ${maxWidth} w-full flex flex-col max-h-[85vh] animate-slide-up ring-1 ring-white/5`}>
        <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/5 shrink-0">
          <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
            <Icons.X size={16}/>
          </button>
        </div>
        {/* Content Area - allows children to handle scrolling or scroll itself if needed */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 relative scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
};

export const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ElementType }> = ({ active, onClick, children, icon: Icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-all h-full ${
            active
                ? 'border-primary-500 text-white bg-white/5'
                : 'border-transparent text-text-muted hover:text-text-main hover:bg-white/5'
        }`}
    >
        {Icon && <Icon size={14} className={active ? 'text-primary-400' : ''} />}
        {children}
    </button>
);

export const Toast: React.FC<{ 
    message: string; 
    onClose: () => void;
    action?: { label: string; onClick: () => void; }
}> = ({ message, onClose, action }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000); // Increased duration slightly for Undo
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed bottom-6 right-6 z-[110] animate-slide-up">
            <div className="bg-surfaceHighlight border border-white/10 text-white pl-4 pr-3 py-3 rounded-lg shadow-2xl flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <Icons.Info size={16} className="text-primary-400" />
                    <span className="text-sm font-medium">{message}</span>
                </div>
                {action && (
                    <button 
                        onClick={action.onClick}
                        className="text-xs font-bold text-primary-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors"
                    >
                        {action.label}
                    </button>
                )}
                {!action && (
                     <button onClick={onClose} className="text-text-dim hover:text-white">
                        <Icons.X size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

// --- Form Elements ---

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => {
  return (
    <div className="relative w-full">
      <select 
        className={`w-full appearance-none bg-black/40 border border-white/10 rounded px-2 py-1.5 pr-8 text-xs text-text-main focus:border-primary-500 focus:outline-none transition-colors cursor-pointer hover:bg-white/5 ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-text-muted">
        <Icons.ChevronDown size={12} />
      </div>
    </div>
  );
};

// Precise Number Slider
export const NumberSlider: React.FC<{ value: number; min?: number; max?: number; onChange: (val: number) => void }> = ({ value, min = 0, max = 100, onChange }) => {
  return (
    <div className="flex items-center gap-3 group">
      <div className="flex-1 h-5 flex items-center relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer focus:outline-none hover:bg-white/20 transition-colors"
        />
      </div>
      <input 
         type="number"
         value={value}
         min={min}
         max={max}
         onChange={(e) => onChange(Number(e.target.value))}
         className="w-12 text-center bg-black/20 border border-white/10 rounded py-0.5 text-[10px] font-mono text-text-muted focus:text-white focus:border-primary-500 outline-none"
      />
    </div>
  );
};

export const Slider: React.FC<{ value: number; min?: number; max?: number; onChange: (val: number) => void }> = ({ value, min = 0, max = 100, onChange }) => {
  return <NumberSlider value={value} min={min} max={max} onChange={onChange} />
};

export const Toggle: React.FC<{ checked: boolean; onChange: (val: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    className={`w-8 h-4 rounded-full relative transition-colors border ${checked ? 'bg-primary-600 border-primary-500' : 'bg-surfaceHighlight border-white/10 hover:border-white/20'}`}
  >
    <div className={`absolute top-0.5 left-0.5 bg-white w-2.5 h-2.5 rounded-full transition-transform shadow-sm ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

export const Checkbox: React.FC<{ checked: boolean; onChange: (val: boolean) => void; label?: string }> = ({ checked, onChange, label }) => (
    <div 
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => onChange(!checked)}
    >
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
            checked 
            ? 'bg-primary-600 border-primary-500 text-white' 
            : 'bg-black/20 border-white/10 group-hover:border-white/30'
        }`}>
            {checked && <Icons.Check size={10} strokeWidth={3} />}
        </div>
        {label && <span className="text-xs text-text-muted group-hover:text-text-main select-none">{label}</span>}
    </div>
);

export const SegmentedControl: React.FC<{ 
    value: string; 
    options: string[]; 
    onChange: (val: string) => void 
}> = ({ value, options, onChange }) => {
    return (
        <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
            {options.map(opt => (
                <button
                    key={opt}
                    onClick={() => onChange(opt)}
                    className={`flex-1 py-1 px-2 text-[10px] font-medium rounded transition-all capitalize ${
                        value === opt 
                        ? 'bg-primary-600 text-white shadow-sm' 
                        : 'text-text-muted hover:text-text-main hover:bg-white/5'
                    }`}
                >
                    {opt}
                </button>
            ))}
        </div>
    );
};

export const RadioGroup: React.FC<{ 
    value: string; 
    options: string[]; 
    onChange: (val: string) => void 
}> = ({ value, options, onChange }) => {
    return (
        <div className="flex flex-col gap-1.5">
            {options.map(opt => (
                <div 
                    key={opt}
                    onClick={() => onChange(opt)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors border ${
                        value === opt 
                        ? 'bg-primary-500/10 border-primary-500/30' 
                        : 'border-transparent hover:bg-white/5'
                    }`}
                >
                    <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                        value === opt 
                        ? 'border-primary-500' 
                        : 'border-white/20'
                    }`}>
                        {value === opt && <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                    </div>
                    <span className={`text-xs ${value === opt ? 'text-primary-200' : 'text-text-muted'}`}>{opt}</span>
                </div>
            ))}
        </div>
    );
};

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'outline' }> = ({ children, variant = 'default' }) => {
  const styles = variant === 'default' 
    ? "bg-primary-500/10 text-primary-400 border border-primary-500/20" 
    : "bg-white/5 text-text-muted border border-white/10";
    
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide ${styles}`}>
      {children}
    </span>
  );
};

export const VisualSelect: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; image: string }[];
}> = ({ value, onChange, options }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative group flex flex-col items-center gap-2 p-1 rounded-lg border transition-all text-left overflow-hidden ${
            value === opt.value
              ? 'bg-primary-500/10 border-primary-500 ring-1 ring-primary-500/50'
              : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className="w-full aspect-video rounded overflow-hidden bg-black/40 relative">
            <img src={opt.image} alt={opt.label} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
             {value === opt.value && (
                <div className="absolute inset-0 bg-primary-500/20 mix-blend-overlay flex items-center justify-center">
                    <Icons.CheckCircle2 className="text-white drop-shadow-md" size={20} />
                </div>
             )}
          </div>
          <span className={`text-[9px] font-medium uppercase tracking-wider text-center w-full truncate ${
              value === opt.value ? 'text-primary-300' : 'text-text-muted'
          }`}>
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export const Accordion: React.FC<{ 
    title: string; 
    children: React.ReactNode; 
    isOpen?: boolean; 
    onToggle?: () => void;
    rightElement?: React.ReactNode; 
}> = ({ title, children, isOpen = false, onToggle, rightElement }) => {
    const [localOpen, setLocalOpen] = useState(isOpen);
    const isExpanded = onToggle ? isOpen : localOpen;
    const handleToggle = () => onToggle ? onToggle() : setLocalOpen(!localOpen);

    return (
        <div className="border-b border-white/5 last:border-0">
            <div 
                className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-white/5' : 'hover:bg-white/5'}`}
                onClick={handleToggle}
            >
                <div className="flex items-center gap-2">
                    <Icons.ChevronRight size={12} className={`text-text-dim transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className={`text-xs font-medium tracking-wide ${isExpanded ? 'text-white' : 'text-text-muted'}`}>{title}</span>
                </div>
                {rightElement && (
                    <div className="flex items-center">
                        {rightElement}
                    </div>
                )}
            </div>
            {isExpanded && (
                <div className="px-4 py-3 bg-black/20 animate-slide-up">
                    {children}
                </div>
            )}
        </div>
    );
};

// ... existing helpers ...
export const HybridInput: React.FC<{ 
    value: string; 
    onChange: (val: string) => void; 
    suggestions?: string[];
    placeholder?: string;
}> = ({ value, onChange, suggestions = [], placeholder }) => {
    return (
        <div className="space-y-2">
            <Input 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                placeholder={placeholder || 'Type custom value...'}
            />
            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(s => (
                        <button
                            key={s}
                            onClick={() => onChange(s)}
                            title={s}
                            className={`px-2 py-1 text-[10px] rounded border transition-all max-w-[150px] truncate ${
                                value === s 
                                ? 'bg-primary-500/20 border-primary-500/50 text-primary-300 shadow-sm' 
                                : 'bg-white/5 border-white/5 text-text-muted hover:bg-white/10 hover:border-white/10 hover:text-white'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const TagInput: React.FC<{
    value: string[];
    onChange: (val: string[]) => void;
    suggestions?: string[];
    placeholder?: string;
}> = ({ value = [], onChange, suggestions = [], placeholder }) => {
    const [inputValue, setInputValue] = useState('');

    const addTag = (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
            setInputValue('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(value.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(inputValue);
        }
    };

    return (
        <div className="space-y-2">
             <div className="flex flex-wrap gap-1.5 p-1.5 bg-black/40 border border-white/10 rounded min-h-[34px]">
                {value.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-500/20 border border-primary-500/30 text-primary-300 text-[10px]">
                        {tag}
                        <button 
                            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                            className="hover:text-white"
                        >
                            <Icons.X size={10} />
                        </button>
                    </span>
                ))}
                <input 
                    className="flex-1 bg-transparent border-none text-xs text-text-main placeholder-text-dim focus:outline-none min-w-[60px]"
                    placeholder={value.length === 0 ? (placeholder || 'Add item...') : ''}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        if(inputValue) addTag(inputValue);
                    }}
                />
            </div>
            
             {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(s => {
                        const isSelected = value.includes(s);
                        return (
                            <button
                                key={s}
                                onClick={() => isSelected ? removeTag(s) : addTag(s)}
                                title={s}
                                className={`px-2 py-1 text-[10px] rounded border transition-all max-w-[160px] inline-flex items-center justify-center ${
                                    isSelected
                                    ? 'bg-primary-500/20 border-primary-500/50 text-primary-300 shadow-sm opacity-50' 
                                    : 'bg-white/5 border-white/5 text-text-muted hover:bg-white/10 hover:border-white/10 hover:text-white'
                                }`}
                            >
                                {isSelected && <Icons.Check size={8} className="mr-1 shrink-0"/>}
                                <span className="truncate">{s}</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export interface DetailedItem {
    name: string;
    details: string[];
}

const DetailAdder: React.FC<{ 
    onAdd: (val: string) => void; 
    allowedTypes?: ('text' | 'color' | 'slider')[]; 
}> = ({ onAdd, allowedTypes = ['text', 'color', 'slider'] }) => {
    const [mode, setMode] = useState<'text' | 'color' | 'slider'>(allowedTypes[0] || 'text');
    const [textVal, setTextVal] = useState('');
    const [colorVal, setColorVal] = useState('#000000');
    const [sliderLabel, setSliderLabel] = useState('');
    const [sliderVal, setSliderVal] = useState(50);

    const handleAdd = () => {
        if (mode === 'text' && textVal.trim()) {
            onAdd(textVal.trim());
            setTextVal('');
        } else if (mode === 'color') {
            onAdd(colorVal); 
        } else if (mode === 'slider') {
            const label = sliderLabel.trim() || 'Value';
            onAdd(`${label}: ${sliderVal}%`);
            setSliderLabel('');
            setSliderVal(50);
        }
    };

    useEffect(() => {
        if (mode === 'text' && allowedTypes.includes('color')) {
            const hexPattern = /^#([0-9A-F]{3}){1,2}$/i;
            if (hexPattern.test(textVal)) {
                setMode('color');
                setColorVal(textVal);
                setTextVal('');
            }
        }
    }, [textVal, mode, allowedTypes]);

    const showSwitcher = allowedTypes.length > 1;

    return (
        <div className="flex items-center gap-2 p-1 bg-black/40 rounded border border-white/5">
            {showSwitcher && (
                <div className="flex bg-white/5 rounded p-0.5 shrink-0">
                    {allowedTypes.includes('text') && (
                        <button 
                            onClick={() => setMode('text')} 
                            className={`p-1 rounded transition-colors ${mode === 'text' ? 'bg-primary-500 text-white shadow-sm' : 'text-text-dim hover:text-white'}`}
                            title="Text"
                        >
                            <Icons.Type size={10} />
                        </button>
                    )}
                    {allowedTypes.includes('color') && (
                        <button 
                            onClick={() => setMode('color')} 
                            className={`p-1 rounded transition-colors ${mode === 'color' ? 'bg-primary-500 text-white shadow-sm' : 'text-text-dim hover:text-white'}`}
                            title="Color"
                        >
                            <Icons.Palette size={10} />
                        </button>
                    )}
                    {allowedTypes.includes('slider') && (
                        <button 
                            onClick={() => setMode('slider')} 
                            className={`p-1 rounded transition-colors ${mode === 'slider' ? 'bg-primary-500 text-white shadow-sm' : 'text-text-dim hover:text-white'}`}
                            title="Value"
                        >
                            <Icons.SlidersHorizontal size={10} />
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 min-w-0">
                {mode === 'text' && (
                    <div className="flex items-center gap-1">
                        <input 
                            value={textVal} 
                            onChange={(e) => setTextVal(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder="Add detail..."
                            className="w-full bg-transparent border-none text-[10px] text-white placeholder-text-dim focus:ring-0 focus:outline-none h-6"
                        />
                    </div>
                )}

                {mode === 'color' && (
                    <div className="flex items-center gap-2">
                         <div className="relative w-4 h-4 rounded-full border border-white/20 overflow-hidden shrink-0">
                            <input 
                                type="color" 
                                value={colorVal.startsWith('#') ? colorVal : '#000000'}
                                onChange={(e) => setColorVal(e.target.value)}
                                className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 m-0 border-0 cursor-pointer opacity-0"
                            />
                            <div className="w-full h-full" style={{ backgroundColor: colorVal }} />
                         </div>
                         <input 
                            value={colorVal} 
                            onChange={(e) => setColorVal(e.target.value)}
                            className="w-16 bg-transparent border-none text-[10px] font-mono text-white focus:ring-0 focus:outline-none h-6"
                        />
                    </div>
                )}

                {mode === 'slider' && (
                    <div className="flex items-center gap-2">
                         <input 
                            value={sliderLabel} 
                            onChange={(e) => setSliderLabel(e.target.value)} 
                            placeholder="Label"
                            className="w-12 bg-transparent border-b border-white/10 text-[10px] text-white focus:border-primary-500 focus:outline-none h-5"
                        />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={sliderVal}
                            onChange={(e) => setSliderVal(Number(e.target.value))}
                            className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                         <span className="text-[9px] font-mono text-text-muted w-6 text-right">{sliderVal}%</span>
                    </div>
                )}
            </div>
            
            <button 
                onClick={handleAdd}
                disabled={mode === 'text' && !textVal}
                className="w-6 h-6 flex items-center justify-center rounded bg-white/5 hover:bg-primary-500 hover:text-white text-text-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
                <Icons.Plus size={12} />
            </button>
        </div>
    );
};

export const DetailedItemList: React.FC<{
    value: DetailedItem[];
    onChange: (val: DetailedItem[]) => void;
    suggestions?: string[]; // Suggestions for the Item Name
    placeholder?: string;
    allowedDetailTypes?: ('text' | 'color' | 'slider')[];
    maxItems?: number;
}> = ({ value = [], onChange, suggestions = [], placeholder, allowedDetailTypes, maxItems }) => {
    const [newItemName, setNewItemName] = useState('');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const isLimitReached = maxItems !== undefined && value.length >= maxItems;

    const availableSuggestions = suggestions.filter(s => 
        !value.some(v => v.name.toLowerCase() === s.toLowerCase())
    );

    const addItem = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (isLimitReached) return;
        
        if (value.some(v => v.name.toLowerCase() === trimmed.toLowerCase())) {
            return; 
        }

        onChange([...value, { name: trimmed, details: [] }]);
        setNewItemName('');
        setExpandedIndex(value.length); 
    };

    const removeItem = (e: React.MouseEvent, idx: number) => {
        e.stopPropagation();
        const next = [...value];
        next.splice(idx, 1);
        onChange(next);
        if (expandedIndex === idx) setExpandedIndex(null);
    };

    const addDetailToItem = (idx: number, detail: string) => {
        const next = [...value];
        const currentDetails = next[idx].details || [];
        if (!currentDetails.includes(detail)) {
            next[idx] = { ...next[idx], details: [...currentDetails, detail] };
            onChange(next);
        }
    };

    const removeDetailFromItem = (idx: number, detailToRemove: string) => {
        const next = [...value];
        next[idx] = { 
            ...next[idx], 
            details: next[idx].details.filter(d => d !== detailToRemove) 
        };
        onChange(next);
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                {value.map((item, idx) => {
                    const isExpanded = expandedIndex === idx;
                    return (
                        <div key={idx} className="bg-black/30 border border-white/5 rounded-lg group overflow-hidden transition-all">
                            <div 
                                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                                className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-white/5 transition-colors ${isExpanded ? 'bg-white/5' : ''}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isExpanded ? 'bg-primary-500' : 'bg-white/20'}`}></div>
                                    <span className={`text-xs font-medium ${isExpanded ? 'text-white' : 'text-text-muted'}`}>{item.name}</span>
                                    
                                    {!isExpanded && item.details && item.details.length > 0 && (
                                        <span className="text-[9px] text-text-dim px-1.5 py-0.5 rounded bg-black/40 border border-white/5">
                                            {item.details.length} details
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={(e) => removeItem(e, idx)}
                                        className="text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        title="Remove Item"
                                    >
                                        <Icons.Trash2 size={12} />
                                    </button>
                                    <Icons.ChevronRight size={12} className={`text-text-dim transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="p-3 bg-black/20 border-t border-white/5 animate-slide-up">
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {item.details && item.details.map(detail => (
                                            <span key={detail} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-text-muted text-[10px]">
                                                {detail.startsWith('#') && (
                                                    <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: detail }} />
                                                )}
                                                {detail}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); removeDetailFromItem(idx, detail); }}
                                                    className="hover:text-white ml-1"
                                                >
                                                    <Icons.X size={8} />
                                                </button>
                                            </span>
                                        ))}
                                        {(!item.details || item.details.length === 0) && (
                                            <span className="text-[10px] text-text-dim italic">No details added yet.</span>
                                        )}
                                    </div>

                                    <DetailAdder onAdd={(val) => addDetailToItem(idx, val)} allowedTypes={allowedDetailTypes} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {!isLimitReached && (
                <>
                    <div className="relative">
                        <Input 
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={placeholder || "Add new item..."}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addItem(newItemName);
                                }
                            }}
                            className="pr-8"
                        />
                        <button 
                            onClick={() => addItem(newItemName)}
                            disabled={!newItemName}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-primary-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <Icons.Plus size={14} />
                        </button>
                    </div>

                    {availableSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {availableSuggestions.map(s => (
                                <button
                                    key={s}
                                    onClick={() => addItem(s)}
                                    title={s}
                                    className="px-2 py-1 text-[10px] rounded border bg-white/5 border-white/5 text-text-muted hover:bg-white/10 hover:border-white/10 hover:text-white transition-all max-w-[150px] truncate"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
            
            {isLimitReached && (
                <div className="text-[10px] text-text-dim text-center py-2 bg-white/5 rounded border border-white/5 border-dashed">
                    Slot filled (Max {maxItems}). Remove item to add new.
                </div>
            )}
        </div>
    );
};

export const HybridSelect: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options?: string[];
    suggestions?: string[];
    placeholder?: string;
}> = ({ value, onChange, options = [], suggestions = [], placeholder }) => {
    const [isCustom, setIsCustom] = useState(false);
    
    const allOptions = Array.from(new Set([...options, ...suggestions]));

    useEffect(() => {
        if (value && !allOptions.includes(value)) {
            setIsCustom(true);
        }
    }, [value, allOptions]);

    return (
        <div className="space-y-2">
            {!isCustom ? (
                <div className="flex gap-1">
                    <Select 
                        value={value} 
                        onChange={(e) => {
                            if (e.target.value === '__custom__') {
                                setIsCustom(true);
                                onChange(''); 
                            } else {
                                onChange(e.target.value);
                            }
                        }}
                    >
                        {allOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="__custom__" className="font-bold text-primary-400">+ Custom Value...</option>
                    </Select>
                </div>
            ) : (
                <div className="relative">
                    <Input 
                        value={value} 
                        onChange={(e) => onChange(e.target.value)} 
                        placeholder={placeholder || "Type custom value..."}
                        autoFocus
                    />
                    <button 
                        onClick={() => setIsCustom(false)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                        title="Back to list"
                    >
                        <Icons.X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};

export const ColorInput: React.FC<{
    value: string;
    onChange: (val: string) => void;
    suggestions?: string[];
}> = ({ value, onChange, suggestions = [] }) => {
    return (
        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-full border border-white/20 shadow-sm overflow-hidden shrink-0 group cursor-pointer">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMzMzMiLz48cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjNDQ0Ii8+PHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzQ0NCIvPjwvc3ZnPg==')] opacity-20" />
                     <div className="absolute inset-0 transition-opacity" style={{ backgroundColor: value }} />
                     <input 
                        type="color" 
                        value={value.startsWith('#') && value.length === 7 ? value : '#000000'}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 m-0 border-0 cursor-pointer opacity-0"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                         <Icons.Pipette size={14} className="text-white drop-shadow-md" />
                    </div>
                </div>
                
                <div className="flex-1">
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-dim text-[10px] font-mono">#</span>
                        <input 
                            value={value.replace('#', '')} 
                            onChange={(e) => onChange('#' + e.target.value)} 
                            className="w-full bg-transparent border-none text-xs font-mono text-text-main focus:outline-none pl-4 uppercase"
                            placeholder="000000"
                        />
                    </div>
                </div>
            </div>
            
            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
                    {suggestions.map(s => (
                        <button
                            key={s}
                            onClick={() => onChange(s)}
                            className={`w-6 h-6 rounded-full border border-white/10 hover:scale-110 transition-transform relative group ${value === s ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-[#27272a]' : ''}`}
                            title={s}
                        >
                             <div className="absolute inset-0 rounded-full overflow-hidden">
                                 <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMzMzMiLz48cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjNDQ0Ii8+PHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzQ0NCIvPjwvc3ZnPg==')] opacity-20" />
                                 <div className="absolute inset-0" style={{ backgroundColor: s }} />
                             </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const PositionPicker: React.FC<{
  value: { x: number; y: number; label: string };
  onChange: (val: { x: number; y: number; label: string }) => void;
}> = ({ value, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    let x = (clientX - rect.left) / rect.width * 100;
    let y = (clientY - rect.top) / rect.height * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    let labelX = 'Center';
    let labelY = 'Center';

    if (x < 33) labelX = 'Left';
    else if (x > 66) labelX = 'Right';

    if (y < 33) labelY = 'Top';
    else if (y > 66) labelY = 'Bottom';

    let label = `${labelY} ${labelX}`.replace('Center Center', 'Center').trim();
    if (label === 'Center Left') label = 'Left';
    if (label === 'Center Right') label = 'Right';
    if (label === 'Top Center') label = 'Top';
    if (label === 'Bottom Center') label = 'Bottom';

    onChange({ x, y, label });
  };

  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-2">
        <div 
            ref={containerRef}
            className="w-full aspect-video bg-[#121214] border border-white/10 rounded-lg relative overflow-hidden cursor-crosshair shadow-inner group"
            onMouseDown={(e) => { setIsDragging(true); handleDrag(e); }}
            onMouseMove={(e) => { if (isDragging) handleDrag(e); }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onTouchStart={(e) => { setIsDragging(true); handleDrag(e); }}
            onTouchMove={(e) => { if (isDragging) handleDrag(e); }}
            onTouchEnd={() => setIsDragging(false)}
        >
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                 style={{ 
                    backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px),
                                      linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                    backgroundSize: '33.3% 33.3%'
                 }}
            />
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 pointer-events-none" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-white/10 pointer-events-none" />

            <div 
                className="absolute w-4 h-4 -ml-2 -mt-2 bg-primary-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] border-2 border-white cursor-grab active:cursor-grabbing transition-transform"
                style={{ left: `${value.x}%`, top: `${value.y}%` }}
            />
            
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[9px] font-mono text-primary-300 pointer-events-none border border-white/5 backdrop-blur-sm">
                {value.label}
            </div>
        </div>
        <div className="flex justify-between text-[10px] text-text-dim px-1">
             <span>Back (Depth)</span>
             <span>Front (Depth)</span>
        </div>
    </div>
  );
};