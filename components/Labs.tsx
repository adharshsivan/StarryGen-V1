
import React, { useRef, useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { Button, NumberSlider, Label, Input, ColorInput, Select, Toggle, Accordion } from './UI';
import { LabsState, LabsPreset, TextOverlay } from '../types';

// --- Constants & Defaults ---

export const DEFAULT_LABS_STATE: LabsState = {
    filters: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        sepia: 0,
        grayscale: 0,
        blur: 0,
        hue: 0,
        vignette: 0,
        grain: 0
    },
    overlays: [],
    transform: {
        zoom: 1,
        x: 0,
        y: 0,
        rotation: 0
    }
};

const FONTS = [
    { label: 'Inter (Modern)', value: 'Inter, sans-serif' },
    { label: 'Impact (Meme)', value: 'Impact, sans-serif' },
    { label: 'Courier (Retro)', value: 'Courier New, monospace' },
    { label: 'Brush (Artistic)', value: 'Brush Script MT, cursive' },
    { label: 'Serif (Classic)', value: 'Georgia, serif' },
    { label: 'Cinematic (Wide)', value: 'Arial Black, sans-serif' }
];

const STANDARD_COLORS = [
    '#ffffff', // White
    '#000000', // Black
    '#94a3b8', // Slate 400 (Muted Blue-Grey)
    '#fbbf24', // Amber 400 (Professional Gold)
    '#f87171', // Red 400 (Soft Red)
    '#60a5fa', // Blue 400 (Tech Blue)
    '#34d399', // Emerald 400 (Green)
];

const createDefaultText = (text: string = 'New Text', y: number = 50): TextOverlay => ({
    id: `text-${Date.now()}-${Math.random()}`,
    text,
    x: 50,
    y: y,
    size: 40,
    color: '#ffffff',
    font: 'Inter, sans-serif',
    shadow: false, // Changed default to false as requested
    bg: 'transparent',
    letterSpacing: 0
});

const PRESETS: LabsPreset[] = [
    {
        id: 'default',
        name: 'Normal',
        state: JSON.parse(JSON.stringify(DEFAULT_LABS_STATE))
    },
    {
        id: 'meme',
        name: 'Meme',
        state: {
            ...JSON.parse(JSON.stringify(DEFAULT_LABS_STATE)),
            overlays: [
                { ...createDefaultText('TOP TEXT', 10), font: 'Impact, sans-serif', size: 60, shadow: true, color: '#ffffff' },
                { ...createDefaultText('BOTTOM TEXT', 90), font: 'Impact, sans-serif', size: 60, shadow: true, color: '#ffffff' }
            ]
        }
    },
    {
        id: 'noir',
        name: 'Noir Film',
        state: {
            ...JSON.parse(JSON.stringify(DEFAULT_LABS_STATE)),
            filters: { ...DEFAULT_LABS_STATE.filters, grayscale: 100, contrast: 120, brightness: 90, grain: 40, vignette: 60 }
        }
    },
    {
        id: 'vintage',
        name: 'Vintage 70s',
        state: {
            ...JSON.parse(JSON.stringify(DEFAULT_LABS_STATE)),
            filters: { ...DEFAULT_LABS_STATE.filters, sepia: 40, saturation: 80, contrast: 90, brightness: 105, grain: 20 }
        }
    },
    {
        id: 'cyber',
        name: 'Cyberpunk',
        state: {
            ...JSON.parse(JSON.stringify(DEFAULT_LABS_STATE)),
            filters: { ...DEFAULT_LABS_STATE.filters, saturation: 150, contrast: 130, hue: 10, vignette: 40 }
        }
    },
    {
        id: 'cinematic',
        name: 'Cinematic',
        state: {
            ...JSON.parse(JSON.stringify(DEFAULT_LABS_STATE)),
            filters: { ...DEFAULT_LABS_STATE.filters, saturation: 90, contrast: 110, brightness: 95, vignette: 30 }
        }
    }
];

// --- Sub-Components ---

const HueSlider: React.FC<{ value: number; onChange: (val: number) => void }> = ({ value, onChange }) => {
    return (
        <div className="flex items-center gap-3 group">
             <div className="flex-1 h-5 relative rounded-full overflow-hidden ring-1 ring-white/10 shadow-inner">
                 <div 
                     className="absolute inset-0 opacity-90"
                     style={{
                         background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
                     }}
                 />
                 <input
                     type="range"
                     min={0}
                     max={360}
                     value={value}
                     onChange={(e) => onChange(Number(e.target.value))}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                 />
                 <div 
                     className="absolute top-0 bottom-0 w-2 bg-white ring-1 ring-black/20 shadow-md pointer-events-none transition-transform will-change-transform rounded-full"
                     style={{ left: `${(value / 360) * 100}%`, transform: 'translateX(-50%)' }}
                 />
             </div>
             <input 
                type="number"
                value={value}
                min={0}
                max={360}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-10 text-center bg-black/20 border border-white/10 rounded py-0.5 text-[10px] font-mono text-text-muted focus:text-white focus:border-primary-500 outline-none"
             />
        </div>
    );
};

interface LabsCanvasProps {
    image: string;
    state: LabsState;
    onChange?: (newState: LabsState) => void; 
    interactive?: boolean;
    forwardRef?: React.RefObject<HTMLCanvasElement | null>;
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
}

export const LabsCanvas: React.FC<LabsCanvasProps> = ({ 
    image, state, onChange, interactive = false, forwardRef, selectedId, onSelect 
}) => {
    const localRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (forwardRef || localRef) as React.RefObject<HTMLCanvasElement>;
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Interaction State
    const [dragMode, setDragMode] = useState<'none' | 'move' | 'resize'>('none');
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialOverlayState, setInitialOverlayState] = useState<TextOverlay | null>(null);

    // State to hold the loaded image object to prevent reloading/decoding on every render
    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

    // Load Image Effect
    useEffect(() => {
        if (!image) return;
        
        let active = true;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = image;
        
        img.onload = () => {
            if (active) setLoadedImage(img);
        };
        
        return () => { active = false; };
    }, [image]);

    // Draw Logic
    useEffect(() => {
        if (!loadedImage || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure canvas dimensions match image
        if (canvas.width !== loadedImage.width || canvas.height !== loadedImage.height) {
            canvas.width = loadedImage.width;
            canvas.height = loadedImage.height;
        }

        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // 0. Crop & Transform
        const t = state.transform || { zoom: 1, x: 0, y: 0, rotation: 0 };
        
        // Apply transformations
        ctx.save();
        const cx = w / 2;
        const cy = h / 2;
        
        ctx.translate(cx, cy);
        if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
        if (t.zoom && t.zoom !== 1) ctx.scale(t.zoom, t.zoom);
        if (t.x || t.y) {
                const panXPx = (t.x / 100) * w;
                const panYPx = (t.y / 100) * h;
                ctx.translate(panXPx, panYPx);
        }
        ctx.translate(-cx, -cy);

        // 1. Draw Image with Filters
        const f = state.filters;
        ctx.filter = `
            brightness(${f.brightness}%) 
            contrast(${f.contrast}%) 
            saturate(${f.saturation}%) 
            sepia(${f.sepia}%) 
            grayscale(${f.grayscale}%) 
            blur(${f.blur}px)
            hue-rotate(${f.hue}deg)
        `;
        ctx.drawImage(loadedImage, 0, 0, w, h);
        ctx.filter = 'none';

        ctx.restore();

        // 2. Grain
        if (f.grain > 0) {
                const imageData = ctx.getImageData(0, 0, w, h);
                const data = imageData.data;
                const factor = (f.grain / 100) * 255 * 0.2; 
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i+3] === 0) continue; 
                    const noise = (Math.random() - 0.5) * factor;
                    data[i] += noise;
                    data[i+1] += noise;
                    data[i+2] += noise;
                }
                ctx.putImageData(imageData, 0, 0);
        }

        // 3. Vignette
        if (f.vignette > 0) {
            const gradient = ctx.createRadialGradient(w/2, h/2, Math.max(w,h) * 0.3, w/2, h/2, Math.max(w,h) * 0.8);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, `rgba(0,0,0,${f.vignette / 100})`);
            
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
        }

        // 4. Text Overlays
        const scaleFactor = w / 1000;

        state.overlays.forEach(o => {
            const fontSize = o.size * scaleFactor * 1.5;
            ctx.font = `bold ${fontSize}px ${o.font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if ('letterSpacing' in ctx) {
                    // @ts-ignore
                    ctx.letterSpacing = `${o.letterSpacing * scaleFactor}px`;
            }

            const textX = (o.x / 100) * w;
            const textY = (o.y / 100) * h;
            
            const metrics = ctx.measureText(o.text);
            const textWidth = metrics.width;
            const textHeight = fontSize; 
            const visualPadding = 10 * scaleFactor;

            // Background
            if (o.bg && o.bg !== 'transparent') {
                ctx.fillStyle = o.bg;
                const bgX = textX - (textWidth/2) - visualPadding;
                const bgY = textY - (textHeight/2) - visualPadding;
                const bgW = textWidth + (visualPadding * 2);
                const bgH = textHeight + (visualPadding * 2);
                
                if (ctx.roundRect) ctx.roundRect(bgX, bgY, bgW, bgH, 10 * scaleFactor);
                else ctx.fillRect(bgX, bgY, bgW, bgH);
                ctx.fill();
            }

            // Text Shadow & Fill
            ctx.fillStyle = o.color;
            if (o.shadow) {
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4 * scaleFactor;
                ctx.shadowOffsetX = 2 * scaleFactor;
                ctx.shadowOffsetY = 2 * scaleFactor;
                ctx.lineWidth = 3 * scaleFactor;
                ctx.strokeStyle = 'black';
                ctx.strokeText(o.text, textX, textY);
                ctx.shadowColor = 'transparent';
            }
            ctx.fillText(o.text, textX, textY);

            // Selection UI (Strictly checked against selectedId)
            if (interactive && o.id === selectedId) {
                    const bgX = textX - (textWidth/2) - visualPadding;
                    const bgY = textY - (textHeight/2) - visualPadding;
                    const bgW = textWidth + (visualPadding * 2);
                    const bgH = textHeight + (visualPadding * 2);

                    ctx.save();
                    ctx.strokeStyle = '#6366f1'; 
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(bgX - 5, bgY - 5, bgW + 10, bgH + 10);
                    ctx.restore();

                    // Resize Handle
                    ctx.fillStyle = '#6366f1';
                    const handleSize = 12 * scaleFactor;
                    const handleX = bgX + bgW + 5 - (handleSize/2);
                    const handleY = bgY + bgH + 5 - (handleSize/2);
                    
                    ctx.beginPath();
                    ctx.arc(handleX, handleY, handleSize, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1;
                    ctx.stroke();
            }

            if ('letterSpacing' in ctx) {
                    // @ts-ignore
                    ctx.letterSpacing = '0px';
            }
        });
    }, [loadedImage, state, selectedId, interactive]);

    const getHitInfo = (e: React.PointerEvent) => {
        if (!canvasRef.current) return null;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        const scaleFactor = canvas.width / 1000;

        for (let i = state.overlays.length - 1; i >= 0; i--) {
            const o = state.overlays[i];
            const ctx = canvas.getContext('2d')!;
            
            const fontSize = o.size * scaleFactor * 1.5;
            ctx.font = `bold ${fontSize}px ${o.font}`;
            // @ts-ignore
            if ('letterSpacing' in ctx) ctx.letterSpacing = `${o.letterSpacing * scaleFactor}px`;

            const metrics = ctx.measureText(o.text);
            const textWidth = metrics.width;
            const textHeight = fontSize;
            const visualPadding = 10 * scaleFactor;

            const textX = (o.x / 100) * canvas.width;
            const textY = (o.y / 100) * canvas.height;

            const bgX = textX - (textWidth/2) - visualPadding;
            const bgY = textY - (textHeight/2) - visualPadding;
            const bgW = textWidth + (visualPadding * 2);
            const bgH = textHeight + (visualPadding * 2);

            if (o.id === selectedId) {
                 const handleSize = 20 * scaleFactor; 
                 const handleX = bgX + bgW + 5;
                 const handleY = bgY + bgH + 5;
                 
                 const dist = Math.sqrt(Math.pow(clickX - handleX, 2) + Math.pow(clickY - handleY, 2));
                 if (dist < handleSize) {
                     return { type: 'resize', id: o.id, overlay: o };
                 }
            }

            if (
                clickX >= bgX - 5 && clickX <= bgX + bgW + 5 &&
                clickY >= bgY - 5 && clickY <= bgY + bgH + 5
            ) {
                return { type: 'move', id: o.id, overlay: o };
            }
        }
        return null;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!interactive || !onChange) return;
        
        const hit = getHitInfo(e);
        
        if (hit) {
            e.currentTarget.setPointerCapture(e.pointerId);
            if (onSelect) onSelect(hit.id);
            setDragMode(hit.type as any);
            setDragStart({ x: e.clientX, y: e.clientY });
            setInitialOverlayState(hit.overlay);
        } else {
            if (onSelect) onSelect(null);
            setDragMode('none');
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragMode === 'none' || !initialOverlayState || !canvasRef.current || !onChange) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        const deltaPctX = (deltaX / rect.width) * 100;
        const deltaPctY = (deltaY / rect.height) * 100;

        if (dragMode === 'move') {
            const newX = Math.max(0, Math.min(100, initialOverlayState.x + deltaPctX));
            const newY = Math.max(0, Math.min(100, initialOverlayState.y + deltaPctY));
            
            const updatedOverlays = state.overlays.map(o => 
                o.id === initialOverlayState.id ? { ...o, x: newX, y: newY } : o
            );
            onChange({ ...state, overlays: updatedOverlays });
        } else if (dragMode === 'resize') {
            const scaleDelta = (deltaX + deltaY) / 2; 
            const newSize = Math.max(10, Math.min(300, initialOverlayState.size + (scaleDelta * 0.5)));
            
            const updatedOverlays = state.overlays.map(o => 
                o.id === initialOverlayState.id ? { ...o, size: newSize } : o
            );
            onChange({ ...state, overlays: updatedOverlays });
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/50 shadow-inner select-none">
            <canvas 
                ref={canvasRef}
                className={`max-w-full max-h-full object-contain relative z-10 ${interactive ? 'cursor-auto' : 'cursor-default'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => setDragMode('none')}
                style={{ touchAction: 'none' }}
            />
            {interactive && selectedId && (
                 <div className="absolute top-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] text-text-muted flex items-center gap-2 border border-white/10 pointer-events-none opacity-50 z-20">
                    <Icons.Move size={12} /> Drag to move • Drag corner to resize
                 </div>
            )}
        </div>
    );
};


interface LabsControlsProps {
    state: LabsState;
    onChange: (s: LabsState) => void;
    onApply: () => void;
    onReset: () => void;
    autoApply: boolean;
    onToggleAutoApply: (v: boolean) => void;
    savedPresets?: LabsPreset[];
    onSavePreset?: (p: LabsPreset) => void;
    onAIAction?: (action: 'remove-bg' | 'upscale') => void;
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
}

export const LabsControls: React.FC<LabsControlsProps> = ({ 
    state, onChange, onApply, onReset, autoApply, onToggleAutoApply, savedPresets = [], onSavePreset, onAIAction, selectedId, onSelect 
}) => {
    
    const [presetName, setPresetName] = useState('');
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [newTextValue, setNewTextValue] = useState('');
    
    const textSectionRef = useRef<HTMLDivElement>(null);
    const textPropertiesRef = useRef<HTMLDivElement>(null);

    const allPresets = [...PRESETS, ...savedPresets];

    const applyPreset = (preset: LabsPreset) => {
        onChange(JSON.parse(JSON.stringify(preset.state))); 
    };

    const handleSaveNewPreset = () => {
        if(!presetName || !onSavePreset) return;
        onSavePreset({
            id: `user-${Date.now()}`,
            name: presetName,
            state: JSON.parse(JSON.stringify(state))
        });
        setPresetName('');
        setIsSavingPreset(false);
    };

    const updateFilter = (key: keyof LabsState['filters'], val: number) => {
        onChange({
            ...state,
            filters: { ...state.filters, [key]: val }
        });
    };

    const updateTransform = (key: keyof NonNullable<LabsState['transform']>, val: number) => {
        const currentTransform = state.transform || { zoom: 1, x: 0, y: 0, rotation: 0 };
        onChange({
            ...state,
            transform: { ...currentTransform, [key]: val }
        });
    };

    const addTextOverlay = () => {
        const txt = newTextValue.trim() || 'New Text Layer';
        const newText = createDefaultText(txt);
        onChange({
            ...state,
            overlays: [...state.overlays, newText]
        });
        if (onSelect) onSelect(newText.id);
        setNewTextValue('');
    };

    const removeTextOverlay = (id: string) => {
        onChange({
            ...state,
            overlays: state.overlays.filter(o => o.id !== id)
        });
        if (selectedId === id && onSelect) onSelect(null);
    };

    const updateSelectedOverlay = (key: keyof TextOverlay, val: any) => {
        if (!selectedId) return;
        onChange({
            ...state,
            overlays: state.overlays.map(o => o.id === selectedId ? { ...o, [key]: val } : o)
        });
    };

    const selectedOverlay = state.overlays.find(o => o.id === selectedId);

    // Accordion State
    const [openSection, setOpenSection] = useState<string | null>(null);
    const toggleSection = (id: string) => setOpenSection(openSection === id ? null : id);

    // Auto-open text section when a text layer is selected and Scroll to it
    useEffect(() => {
        if (selectedId) {
            setOpenSection('text');
            // Allow a small delay for accordion animation
            setTimeout(() => {
                if (textPropertiesRef.current) {
                    textPropertiesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (textSectionRef.current) {
                     textSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }, [selectedId]);

    const transform = state.transform || { zoom: 1, x: 0, y: 0, rotation: 0 };

    return (
        <div className="flex flex-col h-full bg-surface">
             {/* Header */}
             <div className="p-4 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-transparent flex items-center justify-between">
                 <div className="flex items-center gap-2">
                     <Icons.FlaskConical size={16} className="text-purple-400" />
                     <h2 className="text-sm font-bold text-white uppercase tracking-widest">Labs</h2>
                 </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-6">

                 {/* Top Toggle Row */}
                 <div className="flex items-center justify-between bg-black/20 p-3 rounded border border-white/5">
                     <span className="text-xs font-medium text-text-muted">Apply effects on Preview</span>
                     <Toggle checked={autoApply} onChange={onToggleAutoApply} />
                 </div>
                 
                 {/* 1. AI Enhancements */}
                 <div className="space-y-3">
                     <Label className="text-text-muted">AI Enhancements</Label>
                     <div className="grid grid-cols-2 gap-2">
                         <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => onAIAction && onAIAction('remove-bg')}
                            className="bg-purple-900/10 hover:bg-purple-900/20 border-purple-500/20"
                         >
                            <Icons.Scissors size={14} /> Remove BG
                         </Button>
                         <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => onAIAction && onAIAction('upscale')}
                            className="bg-indigo-900/10 hover:bg-indigo-900/20 border-indigo-500/20"
                         >
                            <Icons.ArrowUpCircle size={14} /> Upscale
                         </Button>
                     </div>
                 </div>

                 {/* 2. Presets */}
                 <div className="space-y-3 pt-4 border-t border-white/5">
                     <Label className="text-text-muted">Presets</Label>
                     <div className="grid grid-cols-2 gap-2">
                         {allPresets.map(p => (
                             <button
                                key={p.id}
                                onClick={() => applyPreset(p)}
                                className="px-3 py-2 bg-black/20 hover:bg-white/10 border border-white/5 rounded text-xs text-text-muted hover:text-white transition-all text-left truncate"
                                title={p.name}
                             >
                                 {p.name}
                             </button>
                         ))}
                     </div>
                     
                     {isSavingPreset ? (
                         <div className="flex gap-2 animate-slide-up mt-2">
                             <Input 
                                value={presetName} 
                                onChange={(e) => setPresetName(e.target.value)} 
                                placeholder="Preset Name..." 
                                className="h-7 text-xs"
                                autoFocus
                             />
                             <Button size="sm" onClick={handleSaveNewPreset} disabled={!presetName} className="px-2">Save</Button>
                         </div>
                     ) : (
                         <Button variant="ghost" size="sm" onClick={() => setIsSavingPreset(true)} className="w-full border border-dashed border-white/10 mt-2">
                             <Icons.Plus size={12} /> Save Current as Preset
                         </Button>
                     )}
                 </div>

                 {/* 3. Crop & Transform */}
                 <Accordion title="Crop & Transform" isOpen={openSection === 'transform'} onToggle={() => toggleSection('transform')}>
                     <div className="space-y-6 pt-4 px-1">
                         <div className="space-y-2">
                            <Label>Zoom</Label>
                            <NumberSlider value={transform.zoom} min={1} max={3} onChange={(v) => updateTransform('zoom', v)} />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Pan X</Label>
                                <NumberSlider value={transform.x} min={-50} max={50} onChange={(v) => updateTransform('x', v)} />
                             </div>
                             <div className="space-y-2">
                                <Label>Pan Y</Label>
                                <NumberSlider value={transform.y} min={-50} max={50} onChange={(v) => updateTransform('y', v)} />
                             </div>
                         </div>
                         <div className="space-y-2">
                            <Label>Rotate</Label>
                            <NumberSlider value={transform.rotation} min={-180} max={180} onChange={(v) => updateTransform('rotation', v)} />
                         </div>
                     </div>
                 </Accordion>

                 {/* 4. Filters & Color */}
                 <Accordion title="Filters & Color" isOpen={openSection === 'filters'} onToggle={() => toggleSection('filters')}>
                     <div className="space-y-6 pt-4 px-1">
                         <div className="space-y-2">
                            <Label>Brightness</Label>
                            <NumberSlider value={state.filters.brightness} min={0} max={200} onChange={(v) => updateFilter('brightness', v)} />
                         </div>
                         <div className="space-y-2">
                            <Label>Contrast</Label>
                            <NumberSlider value={state.filters.contrast} min={0} max={200} onChange={(v) => updateFilter('contrast', v)} />
                         </div>
                         <div className="space-y-2">
                            <Label>Saturation</Label>
                            <NumberSlider value={state.filters.saturation} min={0} max={200} onChange={(v) => updateFilter('saturation', v)} />
                         </div>
                         <div className="space-y-2">
                            <Label>Hue Shift</Label>
                            <HueSlider value={state.filters.hue} onChange={(v) => updateFilter('hue', v)} />
                         </div>
                     </div>
                 </Accordion>

                 {/* 5. Effects (FX) */}
                 <Accordion title="Effects (FX)" isOpen={openSection === 'effects'} onToggle={() => toggleSection('effects')}>
                     <div className="space-y-6 pt-4 px-1">
                        <div className="space-y-2">
                            <Label>Vignette</Label>
                            <NumberSlider value={state.filters.vignette} min={0} max={100} onChange={(v) => updateFilter('vignette', v)} />
                         </div>
                         <div className="space-y-2">
                            <Label>Film Grain</Label>
                            <NumberSlider value={state.filters.grain} min={0} max={100} onChange={(v) => updateFilter('grain', v)} />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Blur</Label>
                                <NumberSlider value={state.filters.blur} min={0} max={20} onChange={(v) => updateFilter('blur', v)} />
                             </div>
                             <div className="space-y-2">
                                <Label>Sepia</Label>
                                <NumberSlider value={state.filters.sepia} min={0} max={100} onChange={(v) => updateFilter('sepia', v)} />
                             </div>
                         </div>
                     </div>
                 </Accordion>

                 {/* 6. Text Layers - REDESIGNED */}
                 <Accordion title="Text Layers" isOpen={openSection === 'text'} onToggle={() => toggleSection('text')}>
                    <div className="space-y-6 pt-4 px-1" ref={textSectionRef}>
                        
                        {/* 1. Quick Add - Improved UI */}
                        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5 focus-within:border-primary-500/50 transition-colors">
                            <Icons.Type className="text-text-dim ml-2" size={14} />
                            <input
                                value={newTextValue}
                                onChange={(e) => setNewTextValue(e.target.value)}
                                placeholder="Add text layer..."
                                className="bg-transparent border-none text-xs w-full focus:outline-none text-white placeholder-text-dim py-1.5"
                                onKeyDown={(e) => e.key === 'Enter' && addTextOverlay()}
                            />
                            <button 
                                onClick={addTextOverlay}
                                className="bg-white/5 hover:bg-primary-500 hover:text-white text-text-muted p-1.5 rounded-md transition-all shrink-0"
                            >
                                <Icons.Plus size={14} />
                            </button>
                        </div>

                        {/* 2. Layer List */}
                        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                             {state.overlays.length === 0 && (
                                <div className="text-[10px] text-text-dim text-center py-3 bg-white/5 rounded border border-dashed border-white/10">
                                    No layers yet.
                                </div>
                             )}
                             {state.overlays.map(o => (
                                <div 
                                    key={o.id}
                                    onClick={() => onSelect && onSelect(o.id)}
                                    className={`flex items-center justify-between px-3 py-2 rounded border cursor-pointer transition-all ${
                                        o.id === selectedId 
                                        ? 'bg-primary-500/20 border-primary-500/50 shadow-sm' 
                                        : 'bg-black/20 border-white/5 hover:bg-white/5'
                                    }`}
                                >
                                    <span className={`text-xs truncate max-w-[180px] ${o.id === selectedId ? 'text-white font-medium' : 'text-text-muted'}`}>
                                        {o.text}
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removeTextOverlay(o.id); }}
                                        className="text-text-dim hover:text-red-400 p-1 rounded hover:bg-white/10 transition-colors"
                                    >
                                        <Icons.Trash2 size={12} />
                                    </button>
                                </div>
                             ))}
                        </div>

                        {/* 3. Properties Panel (Only if selected) */}
                        {selectedOverlay && (
                            <div 
                                ref={textPropertiesRef}
                                className="border-t border-white/10 pt-4 mt-2 -mx-4 px-4 bg-black/20 pb-4 shadow-inner"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Icons.Edit3 size={12} className="text-primary-400"/>
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Edit Properties</span>
                                    </div>
                                    <span className="text-[9px] text-text-dim font-mono bg-white/5 px-1.5 py-0.5 rounded">
                                        {selectedOverlay.text.slice(0, 15)}...
                                    </span>
                                </div>

                                <div className="space-y-5">
                                    {/* Content */}
                                    <div className="space-y-2">
                                        <Label>Content</Label>
                                        <Input 
                                            value={selectedOverlay.text} 
                                            onChange={(e) => updateSelectedOverlay('text', e.target.value)} 
                                        />
                                    </div>

                                    {/* Font */}
                                    <div className="space-y-2">
                                        <Label>Font</Label>
                                        <Select 
                                            value={selectedOverlay.font} 
                                            onChange={(e) => updateSelectedOverlay('font', e.target.value)}
                                        >
                                            {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </Select>
                                    </div>

                                    {/* Size & Spacing (Grouped) */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Size</Label>
                                            <NumberSlider value={selectedOverlay.size} min={10} max={300} onChange={(v) => updateSelectedOverlay('size', v)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Spacing</Label>
                                            <NumberSlider value={selectedOverlay.letterSpacing || 0} min={-10} max={50} onChange={(v) => updateSelectedOverlay('letterSpacing', v)} />
                                        </div>
                                    </div>

                                    {/* Text Color */}
                                    <div className="space-y-2">
                                        <Label>Text Color</Label>
                                        <ColorInput 
                                            value={selectedOverlay.color} 
                                            onChange={(v) => updateSelectedOverlay('color', v)} 
                                            suggestions={STANDARD_COLORS} 
                                        />
                                    </div>

                                    {/* Background */}
                                    <div className="space-y-2">
                                        <Label>Background</Label>
                                        <ColorInput 
                                            value={selectedOverlay.bg} 
                                            onChange={(v) => updateSelectedOverlay('bg', v)} 
                                            suggestions={['transparent', ...STANDARD_COLORS.slice(0,3)]} 
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 pt-1">
                                        <Toggle checked={selectedOverlay.shadow} onChange={(v) => updateSelectedOverlay('shadow', v)} />
                                        <span className="text-xs text-text-muted">Drop Shadow</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                 </Accordion>
             </div>

             <div className="p-4 border-t border-border bg-surfaceHighlight/10 flex justify-end gap-3 mt-auto">
                 <Button onClick={onReset} variant="secondary" size="sm">
                    Reset
                 </Button>
                 <Button onClick={onApply} size="sm" variant="primary">
                     <Icons.Save size={14} /> Save New Image
                 </Button>
             </div>
        </div>
    );
};
