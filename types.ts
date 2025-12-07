

export interface Project {
  id: string;
  name: string;
  description: string;
  lastModified: number;
  files: StarryFile[];
  tags?: string[];
  globalBlocks: BlockState[]; // Master blocks applied to all files if useBaseStyle is true
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string; // e.g., "Generated Image", "Initial State"
  blocks: BlockState[];
  seed: number;
  previewImage?: string;
  aspectRatio: string;
  labsState?: LabsState; // Added for restoring Labs filters/overlays
}

export interface StarryFile {
  id: string;
  name: string;
  previewImage?: string; // URL or Base64
  blocks: BlockState[];
  seed: number;
  lastModified: number;
  aspectRatio: string; // e.g. "1:1", "16:9"
  roughIdea: string;
  baseStyle: string;
  useBaseStyle: boolean; // Toggle for global style application
  dynamicSuggestions: Record<string, string[]>; // Key: "BlockType:SectionId:FieldId", Value: ["Suggestion 1", "Suggestion 2"]
  history: HistoryEntry[];
  // Labs State Persistence
  labsState?: LabsState; 
}

export interface TextOverlay {
    id: string;
    text: string;
    x: number; // %
    y: number; // %
    size: number; // px
    color: string;
    font: string;
    shadow: boolean;
    bg: string; // Background color for text box
    letterSpacing: number; // Replaces padding
}

export interface LabsState {
    filters: {
        brightness: number; // 100%
        contrast: number; // 100%
        saturation: number; // 100%
        sepia: number; // 0%
        grayscale: number; // 0%
        blur: number; // 0px
        hue: number; // 0deg
        vignette: number; // 0-100%
        grain: number; // 0-100%
    };
    // Replaced single overlay object with array
    overlays: TextOverlay[];
    // New transform state for Cropping/Rotating
    transform?: {
        zoom: number; // 1 = 100%
        x: number; // Offset X
        y: number; // Offset Y
        rotation: number; // Degrees
    };
    // Backwards compatibility field (optional) - deprecated
    overlay?: any; 
}

export interface LabsPreset {
    id: string;
    name: string;
    state: LabsState;
}

export enum BlockType {
  SUBJECT = 'Subject',
  BACKGROUND = 'Background & Atmosphere',
  MOOD = 'Mood & Emotion',
  LIGHTING = 'Lighting',
  CAMERA = 'Camera & Composition',
  STYLE = 'Art Style',
  POST_PROCESSING = 'Post-Processing',
  FX = 'Special Effects'
}

export interface BlockDefinition {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  colorTheme: string; // Tailwind color class (e.g. 'bg-blue-500')
  sections: BlockSectionDefinition[];
  singleActiveInstance?: boolean; // If true, multiple allowed but only one can be active at a time
}

export interface BlockSectionDefinition {
  id: string; // Unique key for the section (e.g., 'fog', 'key_light')
  label: string;
  group?: 'Core' | 'Details' | 'Advanced' | 'Settings'; // UI Grouping
  toggleable?: boolean; // If true, the section has an on/off switch
  defaultOpen?: boolean; // UI initial state
  fields: BlockField[];
  // If present, this section is hidden unless the condition is met
  condition?: {
      blockType?: BlockType; // Optional: If defined, look at this block type instead of current block
      sectionId: string; // The ID of the section containing the controlling field
      fieldId: string;   // The ID of the controlling field
      value: string | string[]; // The required value(s) to show this section
  };
}

export interface BlockField {
  id: string; // Unique key for the field (e.g., 'intensity', 'color')
  label: string;
  type: 'select' | 'text' | 'slider' | 'color' | 'toggle' | 'visual-select' | 'tags' | 'radio' | 'segmented' | 'checkbox' | 'detailed-list' | 'position-picker';
  options?: string[]; // For select, radio, segmented inputs
  visualOptions?: { value: string; label: string; image: string }[]; // For visual-select inputs
  suggestions?: string[]; // Quick pick values (colors or text)
  min?: number;
  max?: number;
  defaultValue: any;
  unit?: string; // e.g., '%', 'px', 'K'
  allowedDetailTypes?: ('text' | 'color' | 'slider')[]; // For detailed-list only
  maxItems?: number; // Limit number of items in a detailed-list (e.g. 1 coat)
}

export interface CustomProperty {
    id: string;
    label: string;
    type: 'text' | 'slider' | 'checkbox' | 'color';
    value: any;
    min?: number;
    max?: number;
}

export interface BlockState {
  id: string;
  type: BlockType;
  customLabel?: string; // User defined name (e.g. "Main Hero")
  isActive: boolean;
  // State is now nested by section
  sections: Record<string, SectionState>;
  // User defined custom properties
  customValues?: CustomProperty[]; 
  // Visual Consistency: Reference image URL/Base64 to lock look
  referenceImage?: string; 
}

export interface SectionState {
  enabled?: boolean; // For toggleable sections
  fields: Record<string, any>; // Keyed by BlockField.id
}

export interface GenerationRequest {
  blocks: BlockState[];
  seed: number;
}