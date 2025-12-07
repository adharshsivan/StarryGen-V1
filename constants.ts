

import { BlockType, BlockDefinition, Project, BlockState, LabsState } from './types';

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
    overlays: []
};

export const createDefaultBlockState = (type: BlockType, overrides: Partial<any> = {}): BlockState => {
    const def = BLOCK_DEFINITIONS[type];
    const sections: Record<string, any> = {};
    
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

    // Apply overrides
    if (overrides) {
        Object.keys(overrides).forEach(secId => {
            if (sections[secId]) {
                 // Deep merge fields
                 sections[secId].fields = { ...sections[secId].fields, ...overrides[secId].fields };
                 if (overrides[secId].enabled !== undefined) {
                     sections[secId].enabled = overrides[secId].enabled;
                 }
            }
        });
    }

    return {
        id: `b-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        isActive: true,
        customLabel: def.label,
        sections
    };
};

// Helper to generate smart labels for blocks
export const getSmartLabel = (block: BlockState) => {
    const def = BLOCK_DEFINITIONS[block.type];
    
    // If user has renamed it, prioritize that custom name
    if (block.customLabel && block.customLabel !== def.label && !block.customLabel.startsWith(def.label + ' ')) {
        return block.customLabel;
    }

    if (block.type === BlockType.SUBJECT) {
         const role = block.sections['core']?.fields['role'];
         const category = block.sections['core']?.fields['category'];
         // Return Role directly if available (e.g. "Ronin", "Detective")
         if(role && role !== 'Subject' && role !== 'Description/Role') return role;
         // Fallback to specific category (e.g. "Robot", "Creature")
         if(category) return category;
    }
    if (block.type === BlockType.BACKGROUND) {
         const env = block.sections['setting']?.fields['environment'];
         const type = block.sections['setting']?.fields['type'];
         if(env && env !== 'Environment') return env;
         if(type) return `${type} Scene`;
    }
    if (block.type === BlockType.LIGHTING) {
         const source = block.sections['key_light']?.fields['source'];
         if(source) return `${source} Light`;
    }
    // Fallback
    return block.customLabel || def.label;
};

// The "Brain" of StarryGen - A massive library of parameters.
export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  [BlockType.SUBJECT]: {
    type: BlockType.SUBJECT,
    label: 'Subject',
    icon: 'User',
    colorTheme: 'bg-blue-500',
    description: 'Define a character, object, or focal point.',
    singleActiveInstance: false, 
    sections: [
      {
        id: 'core',
        label: 'Identity',
        group: 'Core',
        defaultOpen: true,
        fields: [
          { id: 'category', label: 'Type', type: 'select', options: ['Human', 'Animal', 'Creature', 'Robot', 'Object', 'Vehicle'], defaultValue: 'Human' },
          { id: 'count', label: 'Number', type: 'radio', options: ['Single', 'Duo', 'Group', 'Crowd'], defaultValue: 'Single' },
          { id: 'role', label: 'Description/Role', type: 'text', defaultValue: '', suggestions: ['Hero', 'Villain', 'Sidekick', 'NPC', 'Monster', 'Pilot', 'Detective', 'Wizard'] }
        ]
      },
      // --- NEW: PLACEMENT & DEPTH (Shared by all) ---
      {
        id: 'placement',
        label: 'Placement & Depth',
        group: 'Core',
        defaultOpen: true,
        fields: [
             { id: 'frame_position', label: 'Frame Position', type: 'position-picker', defaultValue: { x: 50, y: 50, label: 'Center' } },
             { id: 'subject_size', label: 'Size', type: 'slider', min: 10, max: 150, defaultValue: 80, unit: '%' },
             // UPDATED DEFAULT: 50 (Mid-ground) instead of 30 (Foreground)
             { id: 'subject_distance', label: 'Distance from Camera', type: 'slider', min: 0, max: 100, defaultValue: 50, unit: '%' }
        ]
      },
      // --- HUMAN SECTIONS ---
      {
        id: 'human_physique',
        label: 'Body & Looks',
        group: 'Details',
        condition: { sectionId: 'core', fieldId: 'category', value: 'Human' },
        fields: [
          { id: 'age', label: 'Age', type: 'text', defaultValue: '', suggestions: ['Child', 'Teen', 'Young Adult', 'Middle Aged', 'Elderly', 'Immortal', 'Ancient'] },
          { id: 'gender', label: 'Gender', type: 'select', defaultValue: 'Female', options: ['Female', 'Male', 'Non-binary', 'Androgynous'] },
          { id: 'ethnicity', label: 'Ethnicity', type: 'text', defaultValue: '', suggestions: ['Caucasian', 'Asian', 'Black/African', 'Latino', 'Middle Eastern', 'South Asian', 'Indigenous'] },
          { id: 'body_type', label: 'Physique', type: 'select', options: ['Slim', 'Athletic', 'Muscular', 'Heavy', 'Average'], suggestions: ['Bodybuilder', 'Gaunt', 'Curvy', 'Robotic Implants'], defaultValue: 'Average' },
          { id: 'hair_style', label: 'Hair Style', type: 'text', defaultValue: '', suggestions: ['Long straight', 'Short messy', 'Bald', 'Ponytail', 'Mohawk', 'Bob cut', 'Braids', 'Afro', 'Dreadlocks'] },
          { id: 'hair_color', label: 'Hair Color', type: 'color', defaultValue: '#000000', suggestions: ['#000000', '#fafafa', '#4a2c2a', '#e0ac69', '#ff0000', '#60a5fa', '#f472b6'] }
        ]
      },
      {
        id: 'human_attire',
        label: 'Wearables',
        group: 'Details',
        condition: { sectionId: 'core', fieldId: 'category', value: 'Human' },
        fields: [
          { id: 'style', label: 'Fashion Style', type: 'select', options: ['Casual', 'Formal', 'Sci-Fi', 'Fantasy', 'Tactical', 'Streetwear', 'Historical'], defaultValue: 'Casual' },
          // Clothing Slots Logic - DEFAULTS SET TO EMPTY ARRAYS
          { 
              id: 'attire_head', 
              label: 'Headwear', 
              type: 'detailed-list', 
              defaultValue: [], 
              suggestions: ['Hat', 'Helmet', 'Cap', 'Crown', 'Glasses', 'Mask'],
              allowedDetailTypes: ['text', 'color'],
              maxItems: 2
          },
          { 
              id: 'attire_inner', 
              label: 'Upper Body (Inner)', 
              type: 'detailed-list', 
              defaultValue: [], 
              suggestions: ['T-shirt', 'Shirt', 'Blouse', 'Vest', 'Corset', 'Tank Top'],
              allowedDetailTypes: ['text', 'color'],
              maxItems: 1 
          },
          { 
              id: 'attire_outer', 
              label: 'Outerwear (Coat/Jacket)', 
              type: 'detailed-list', 
              defaultValue: [], 
              suggestions: ['Jacket', 'Coat', 'Trenchcoat', 'Robe', 'Cape', 'Armor', 'Hoodie'],
              allowedDetailTypes: ['text', 'color', 'slider'],
              maxItems: 1 
          },
          { 
              id: 'attire_lower', 
              label: 'Lower Body', 
              type: 'detailed-list', 
              defaultValue: [], 
              suggestions: ['Jeans', 'Pants', 'Skirt', 'Shorts', 'Trousers', 'Leggings'],
              allowedDetailTypes: ['text', 'color', 'slider'],
              maxItems: 1
          },
          { 
              id: 'attire_feet', 
              label: 'Footwear', 
              type: 'detailed-list', 
              defaultValue: [], 
              suggestions: ['Sneakers', 'Boots', 'Shoes', 'Heels', 'Sandals'],
              allowedDetailTypes: ['text', 'color'],
              maxItems: 1
          },
          { 
              id: 'accessories', 
              label: 'Props / Extras', 
              type: 'detailed-list', 
              defaultValue: [], 
              suggestions: ['Jewelry', 'Scarf', 'Headphones', 'Weapon', 'Backpack', 'Gun', 'Phone'],
              allowedDetailTypes: ['text', 'color']
          }
        ]
      },
      // --- CREATURE SECTIONS ---
      {
        id: 'creature_traits',
        label: 'Traits',
        group: 'Details',
        condition: { sectionId: 'core', fieldId: 'category', value: ['Animal', 'Creature', 'Robot'] },
        fields: [
          { id: 'species', label: 'Species', type: 'text', defaultValue: '', suggestions: ['Wolf', 'Tiger', 'Dragon', 'Android', 'Alien', 'Cat', 'Dog', 'Phoenix'] },
          { id: 'texture', label: 'Skin/Surface', type: 'select', options: ['Fur', 'Scales', 'Metal', 'Skin', 'Feathers', 'Exoskeleton', 'Slime'], defaultValue: 'Fur' },
          { id: 'color_pattern', label: 'Color', type: 'text', defaultValue: '', suggestions: ['Solid Black', 'Striped', 'Spotted', 'Camouflage', 'Metallic Silver', 'Glowing'] }
        ]
      },
      // --- OBJECT SECTIONS ---
      {
        id: 'object_specs',
        label: 'Details',
        group: 'Details',
        condition: { sectionId: 'core', fieldId: 'category', value: ['Object', 'Vehicle'] },
        fields: [
          { id: 'material_type', label: 'Material', type: 'select', options: ['Matte Plastic', 'Polished Metal', 'Wood', 'Glass', 'Ceramic', 'Concrete', 'Fabric'], defaultValue: 'Matte Plastic' },
          { id: 'condition', label: 'Condition', type: 'segmented', options: ['Brand New', 'Used', 'Damaged', 'Rusty'], defaultValue: 'Brand New' }
        ]
      },
      // --- SHARED: Sentient Poses ---
      {
        id: 'pose_action',
        label: 'Action & Pose',
        group: 'Core',
        condition: { sectionId: 'core', fieldId: 'category', value: ['Human', 'Animal', 'Creature', 'Robot'] },
        fields: [
          { id: 'pose', label: 'Pose', type: 'text', defaultValue: '', suggestions: ['Standing', 'Sitting', 'Kneeling', 'Floating', 'Action Pose', 'Running', 'Flying', 'Meditation'] },
          { id: 'view_angle', label: 'Angle', type: 'select', options: ['Front', 'Side', 'Back', 'Three-Quarter', 'Dynamic'], defaultValue: 'Front' },
          { id: 'action', label: 'Activity', type: 'text', defaultValue: '', suggestions: ['Looking at camera', 'Looking away', 'Laughing', 'Screaming', 'Fighting', 'Sleeping', 'Eating', 'Driving'] }
        ]
      },
      // --- SHARED: Object Orientation (No Poses) ---
      {
        id: 'object_view',
        label: 'Orientation',
        group: 'Core',
        condition: { sectionId: 'core', fieldId: 'category', value: ['Object', 'Vehicle'] },
        fields: [
             { id: 'placement_context', label: 'Context', type: 'text', defaultValue: '', suggestions: ['On table', 'Floating', 'On floor', 'Against wall'] },
             { id: 'rotation', label: 'Angle', type: 'radio', options: ['Front facing', 'Side profile', 'Top down', 'Isometric'], defaultValue: 'Front facing' }
        ]
      },
      // --- NEW: INTERACTIONS ---
      {
          id: 'interactions',
          label: 'Interactions',
          group: 'Core',
          toggleable: true,
          condition: { sectionId: 'core', fieldId: 'category', value: ['Human', 'Animal', 'Creature', 'Robot'] },
          fields: [
              { 
                  id: 'target_subject', 
                  label: 'With Whom?', 
                  type: 'select', 
                  options: [], 
                  defaultValue: 'None' 
              },
              { 
                  id: 'interaction_type', 
                  label: 'Doing What?', 
                  type: 'text', 
                  defaultValue: '', 
                  suggestions: ['Fighting', 'Talking to', 'Looking at', 'Running from', 'Holding hands with', 'Chasing', 'Dancing with'] 
              }
          ]
      }
    ]
  },
  [BlockType.BACKGROUND]: {
    type: BlockType.BACKGROUND,
    label: 'Background',
    icon: 'ImageIcon',
    colorTheme: 'bg-green-500',
    description: 'Global environment settings. Only one active.',
    singleActiveInstance: true,
    sections: [
      {
        id: 'setting',
        label: 'Location',
        group: 'Core',
        defaultOpen: true,
        fields: [
          { id: 'type', label: 'Type', type: 'select', options: ['Indoor', 'Outdoor', 'Space', 'Abstract', 'Studio', 'Void'], defaultValue: 'Outdoor' },
          { id: 'environment', label: 'Setting', type: 'text', defaultValue: '', suggestions: ['City street', 'Forest', 'Mountain', 'Desert', 'Bedroom', 'Office', 'Cyberpunk City', 'Underwater', 'Volcano'] },
          { id: 'time', label: 'Time', type: 'select', options: ['Day', 'Night', 'Sunset', 'Sunrise', 'Golden Hour', 'Blue Hour', 'Midnight'], defaultValue: 'Day' }
        ]
      },
      {
        id: 'weather',
        label: 'Weather',
        group: 'Advanced',
        toggleable: true,
        fields: [
          { id: 'precip_type', label: 'Condition', type: 'select', options: ['None', 'Rain', 'Snow', 'Hail'], suggestions: ['Acid Rain', 'Ash Fall'], defaultValue: 'None' },
          { id: 'intensity', label: 'Intensity', type: 'slider', min: 0, max: 100, defaultValue: 50 },
          { id: 'wetness', label: 'Wetness', type: 'slider', min: 0, max: 100, defaultValue: 50 }
        ]
      },
      {
        id: 'fog',
        label: 'Atmosphere (Fog)',
        group: 'Advanced',
        toggleable: true,
        fields: [
          { id: 'density', label: 'Density', type: 'slider', min: 0, max: 100, defaultValue: 30 },
          { id: 'color', label: 'Color', type: 'color', defaultValue: '#a1a1aa', suggestions: ['#ffffff', '#a1a1aa', '#52525b', '#000000', '#fef3c7', '#86efac'] }
        ]
      },
      {
        id: 'transparency',
        label: 'Background Removal',
        group: 'Settings',
        toggleable: true,
        fields: [
            { id: 'remove_bg', label: 'Transparent BG', type: 'toggle', defaultValue: false },
        ]
      }
    ]
  },
  [BlockType.LIGHTING]: {
    type: BlockType.LIGHTING,
    label: 'Lighting',
    icon: 'Sun',
    colorTheme: 'bg-yellow-500',
    description: 'Global lighting setup. Only one active.',
    singleActiveInstance: true,
    sections: [
      {
        id: 'key_light',
        label: 'Main Light',
        group: 'Core',
        defaultOpen: true,
        fields: [
          { id: 'source', label: 'Source', type: 'select', options: ['Sun', 'Moon', 'Lamp', 'Neon', 'Fire', 'Softbox'], defaultValue: 'Sun' },
          { id: 'direction', label: 'Direction', type: 'select', options: ['Front', 'Side', 'Back', 'Top', 'Bottom'], defaultValue: 'Side' },
          { id: 'intensity', label: 'Brightness', type: 'slider', min: 0, max: 100, defaultValue: 80 },
          { id: 'color', label: 'Color', type: 'color', defaultValue: '#ffffff', suggestions: ['#ffffff', '#fef3c7', '#bfdbfe', '#f87171', '#a78bfa', '#fbbf24'] },
          { id: 'quality', label: 'Softness', type: 'segmented', options: ['Soft', 'Hard', 'Diffused'], defaultValue: 'Soft' }
        ]
      },
      {
        id: 'fill_light',
        label: 'Fill Light',
        group: 'Advanced',
        toggleable: true,
        fields: [
          { id: 'intensity', label: 'Brightness', type: 'slider', min: 0, max: 100, defaultValue: 40 },
          { id: 'color', label: 'Color', type: 'color', defaultValue: '#b0b0b0', suggestions: ['#ffffff', '#9ca3af', '#60a5fa'] }
        ]
      },
      {
        id: 'rim_light',
        label: 'Rim / Back Light',
        group: 'Advanced',
        toggleable: true,
        fields: [
          { id: 'intensity', label: 'Brightness', type: 'slider', min: 0, max: 100, defaultValue: 70 },
          { id: 'color', label: 'Color', type: 'color', defaultValue: '#ffffff', suggestions: ['#ffffff', '#60a5fa', '#f472b6', '#34d399'] }
        ]
      }
    ]
  },
  [BlockType.MOOD]: {
    type: BlockType.MOOD,
    label: 'Mood',
    icon: 'Heart',
    colorTheme: 'bg-pink-500',
    description: 'Emotional tone.',
    singleActiveInstance: true,
    sections: [
        {
            id: 'emotion',
            label: 'Emotion',
            group: 'Core',
            defaultOpen: true,
            condition: { 
                blockType: BlockType.SUBJECT, 
                sectionId: 'core', 
                fieldId: 'category', 
                value: ['Human', 'Animal', 'Creature', 'Robot'] 
            },
            fields: [
                { id: 'primary', label: 'Feeling', type: 'text', defaultValue: '', suggestions: ['Happy', 'Sad', 'Angry', 'Fearful', 'Surprised', 'Disgusted', 'Neutral', 'Romantic'] },
                { id: 'intensity', label: 'Intensity', type: 'slider', min: 0, max: 100, defaultValue: 50 }
            ]
        },
        {
            id: 'atmosphere',
            label: 'Vibe',
            group: 'Core',
            fields: [
                { id: 'vibe', label: 'Atmosphere', type: 'text', defaultValue: '', suggestions: ['Calm', 'Chaotic', 'Eerie', 'Energetic', 'Melancholic', 'Whimsical', 'Tense'] }
            ]
        }
    ]
  },
  [BlockType.CAMERA]: {
    type: BlockType.CAMERA,
    label: 'Camera',
    icon: 'Camera',
    colorTheme: 'bg-purple-500',
    description: 'Lens choice and composition.',
    singleActiveInstance: true,
    sections: [
      {
        id: 'composition',
        label: 'Framing',
        group: 'Core',
        defaultOpen: true,
        fields: [
          { 
              id: 'shot_size', 
              label: 'Shot Size', 
              type: 'select', 
              defaultValue: 'Medium Shot',
              options: ['Extreme Close-up', 'Close-up', 'Medium Shot', 'Full Shot', 'Wide Shot']
          },
          { 
              id: 'angle', 
              label: 'Angle', 
              type: 'select', 
              defaultValue: 'Eye Level',
              options: ['Eye Level', 'Low Angle (Hero)', 'High Angle', 'Dutch Angle (Tilt)', 'Overhead']
          }
        ]
      },
      {
        id: 'optics',
        label: 'Lens & Focus',
        group: 'Advanced',
        fields: [
          { id: 'focal_length', label: 'Zoom Level', type: 'select', options: ['14mm Ultra Wide', '24mm Wide', '35mm Street', '50mm Portrait', '85mm Portrait', '135mm Tele', '200mm Sniper'], defaultValue: '50mm Portrait' },
          { id: 'aperture', label: 'Blur Background', type: 'radio', options: ['f/1.4 (Blurry BG)', 'f/2.8', 'f/5.6', 'f/11 (Sharp)'], defaultValue: 'f/2.8' }
        ]
      }
    ]
  },
  [BlockType.STYLE]: {
    type: BlockType.STYLE,
    label: 'Art Style',
    icon: 'Palette',
    colorTheme: 'bg-indigo-500',
    description: 'Visual style and medium.',
    singleActiveInstance: true,
    sections: [
        {
            id: 'render',
            label: 'Look & Feel',
            group: 'Core',
            defaultOpen: true,
            fields: [
                { id: 'medium', label: 'Medium', type: 'select', options: ['Photography', 'Digital Art', 'Oil Painting', '3D Render', 'Anime', 'Concept Art', 'Sketch'], defaultValue: 'Photography' },
                { id: 'engine', label: 'Engine/Tool', type: 'text', defaultValue: '', suggestions: ['Unreal Engine 5', 'Octane Render', 'Cinema 4D', 'Blender Cycles', 'Analog Film', 'Watercolor', 'Ink'] }
            ]
        },
        {
            id: 'film_stock',
            label: 'Film Look',
            group: 'Advanced',
            condition: { sectionId: 'render', fieldId: 'medium', value: 'Photography' },
            fields: [
                { id: 'film_type', label: 'Stock', type: 'text', defaultValue: '', suggestions: ['Kodak Portra 400', 'Fujifilm Velvia', 'Cinestill 800T', 'Ilford HP5 (B&W)', 'Polaroid'] },
                { id: 'grain', label: 'Grain', type: 'slider', min: 0, max: 100, defaultValue: 20 }
            ]
        }
    ]
  },
  [BlockType.POST_PROCESSING]: {
    type: BlockType.POST_PROCESSING,
    label: 'Color Grade',
    icon: 'Sliders',
    colorTheme: 'bg-teal-500',
    description: 'Final touches.',
    singleActiveInstance: true,
    sections: [
        {
            id: 'grading',
            label: 'Colors',
            group: 'Core',
            defaultOpen: true,
            fields: [
                { id: 'tone', label: 'Tone', type: 'select', options: ['Natural', 'Warm', 'Cool', 'Sepia', 'Black & White', 'Vibrant', 'Muted'], defaultValue: 'Natural' },
                { id: 'contrast', label: 'Contrast', type: 'slider', min: 0, max: 100, defaultValue: 50 },
                { id: 'saturation', label: 'Saturation', type: 'slider', min: 0, max: 100, defaultValue: 50 }
            ]
        }
    ]
  },
  [BlockType.FX]: {
    type: BlockType.FX,
    label: 'Effects',
    icon: 'Sparkles',
    colorTheme: 'bg-red-500',
    description: 'Particles and glitches.',
    singleActiveInstance: false,
    sections: [
        {
            id: 'particles',
            label: 'Particles',
            group: 'Core',
            fields: [
                { id: 'type', label: 'Type', type: 'select', options: ['Dust', 'Embers', 'Sparks', 'Leaves', 'Confetti', 'Bokeh'], defaultValue: 'Dust' },
                { id: 'amount', label: 'Amount', type: 'slider', min: 0, max: 100, defaultValue: 40 }
            ]
        }
    ]
  }
};

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Noir Thriller',
    description: 'Dark, high-contrast detective story set in 1940s NYC. Strictly Black & White Film style.',
    lastModified: Date.now(),
    tags: ['Template'],
    globalBlocks: [
        createDefaultBlockState(BlockType.BACKGROUND, { setting: { fields: { type: 'Outdoor', environment: 'New York City 1940s', time: 'Night' } }, weather: { enabled: true, fields: { precip_type: 'Rain', wetness: 80 } } }),
        createDefaultBlockState(BlockType.STYLE, { render: { fields: { medium: 'Photography' } }, film_stock: { fields: { film_type: 'Ilford HP5 (B&W)', grain: 60 } } }),
        createDefaultBlockState(BlockType.POST_PROCESSING, { grading: { fields: { tone: 'Black & White', contrast: 90 } } }),
    ],
    files: [
        {
            id: 'f1-1',
            name: 'Detective Portrait',
            // High contrast, sharp focus, rain
            previewImage: 'https://image.pollinations.ai/prompt/film%20noir%20portrait%20of%20a%20male%20detective%20in%20trenchcoat%20and%20fedora%20smoking%20cigarette%20rainy%20night%20new%20york%201940s%20black%20and%20white%20ilford%20film%20grain%20high%20contrast%20dramatic%20shadows?width=1024&height=1024&seed=42&nologo=true',
            blocks: [
                createDefaultBlockState(BlockType.SUBJECT, { 
                    core: { fields: { category: 'Human', role: 'Hard-boiled Detective' } }, 
                    human_physique: { fields: { gender: 'Male', age: 'Middle Aged', body_type: 'Average' } },
                    human_attire: { fields: { 
                        style: 'Historical', 
                        attire_outer: [{name: 'Trenchcoat', details: ['Beige', 'Worn']}],
                        attire_inner: [{name: 'Suit', details: ['Pinstripe']}],
                        attire_head: [{name: 'Fedora', details: ['Grey']}],
                        accessories: [{name: 'Cigarette', details: ['Lit']}] 
                    } },
                    pose_action: { fields: { view_angle: 'Front', action: 'Looking suspicious' } }
                }),
                createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { source: 'Streetlight', direction: 'Side', quality: 'Hard' } } }),
                createDefaultBlockState(BlockType.CAMERA, { composition: { fields: { shot_size: 'Close-up' } }, optics: { fields: { aperture: 'f/1.4 (Blurry BG)' } } })
            ],
            seed: 42, // Locked for Male
            lastModified: Date.now(),
            aspectRatio: '1:1',
            roughIdea: 'Detective smoking in the rain',
            baseStyle: 'Film Noir Black and White',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        },
        {
            id: 'f1-2',
            name: 'The Meeting',
            previewImage: 'https://image.pollinations.ai/prompt/film%20noir%20two%20men%20meeting%20under%20brooklyn%20bridge%20night%20fog%20silhouette%20vintage%20car%20headlights%20black%20and%20white%20cinematic%20wide%20shot?width=1024&height=576&seed=101&nologo=true',
            blocks: [
                createDefaultBlockState(BlockType.SUBJECT, { core: { fields: { category: 'Human', count: 'Duo', role: 'Mobsters' } }, human_attire: { fields: { attire_outer: [{name: 'Overcoat', details: ['Heavy']}], attire_head: [{name: 'Fedora', details: []}] } } }),
                createDefaultBlockState(BlockType.BACKGROUND, { setting: { fields: { environment: 'Under Brooklyn Bridge' } }, fog: { enabled: true, fields: { density: 60 } } }),
                createDefaultBlockState(BlockType.CAMERA, { composition: { fields: { shot_size: 'Wide Shot', angle: 'Low Angle (Hero)' } } }),
                createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { source: 'Car Headlights', direction: 'Back', quality: 'Hard' } } })
            ],
            seed: 101,
            lastModified: Date.now(),
            aspectRatio: '16:9',
            roughIdea: 'Secret meeting under the bridge',
            baseStyle: 'Film Noir Black and White',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        },
        {
            id: 'f1-3',
            name: 'Midnight Docks',
            previewImage: 'https://image.pollinations.ai/prompt/film%20noir%20wide%20shot%20shipping%20docks%20new%20york%20city%20skyline%20midnight%20fog%20reflection%20water%20black%20and%20white%20cinematic%20gloomy?width=1024&height=576&seed=404&nologo=true',
            blocks: [
                 createDefaultBlockState(BlockType.BACKGROUND, { 
                     setting: { fields: { type: 'Outdoor', environment: 'Shipping Docks' } },
                     fog: { enabled: true, fields: { density: 80 } }
                 }),
                 createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { source: 'Moon', direction: 'Back', intensity: 30 } } }),
                 createDefaultBlockState(BlockType.CAMERA, { composition: { fields: { shot_size: 'Wide Shot' } } })
            ],
            seed: 404, 
            lastModified: Date.now(),
            aspectRatio: '16:9',
            roughIdea: 'Foggy docks at midnight with city skyline',
            baseStyle: 'Film Noir Black and White',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        }
    ]
  },
  {
    id: 'p2',
    name: 'Skeleton Game',
    description: 'Cohesive Low-poly Isometric 3D asset pack. Consistent lighting and transparent background.',
    lastModified: Date.now() - 100000,
    tags: ['Template'],
    globalBlocks: [
        createDefaultBlockState(BlockType.STYLE, { render: { fields: { medium: '3D Render', engine: 'Blender Cycles' } } }),
        createDefaultBlockState(BlockType.CAMERA, { composition: { fields: { angle: 'High Angle' } }, object_view: { fields: { rotation: 'Isometric' } } }),
    ],
    files: [
        {
            id: 'f2-1',
            name: 'Skeleton Warrior',
            // Updated preview prompt for high contrast dark skeleton on white
            previewImage: 'https://image.pollinations.ai/prompt/isometric%20skeleton%20warrior%20dark%20grey%20bone%20armor%20rusty%20sword%20high%20contrast%20isolated%20on%20solid%20pure%20white%20background%203d%20render?width=1024&height=1024&seed=55&nologo=true',
            blocks: [
                createDefaultBlockState(BlockType.SUBJECT, { 
                    core: { fields: { category: 'Creature', role: 'Skeleton Warrior' } }, 
                    creature_traits: { fields: { species: 'Skeleton', texture: 'Bone' } },
                    human_attire: { fields: { accessories: [{name: 'Sword', details: ['Rusty']}, {name: 'Shield', details: ['Round', 'Wooden']}] } } 
                }),
                createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { source: 'Softbox', direction: 'Top' } } }),
                createDefaultBlockState(BlockType.BACKGROUND, { 
                    setting: { fields: { type: 'Studio', environment: 'White Void' } }, 
                    transparency: { enabled: true, fields: { remove_bg: true } } // Explicitly enabled
                })
            ],
            seed: 55,
            lastModified: Date.now(),
            aspectRatio: '1:1',
            roughIdea: 'Isometric Skeleton enemy isolated',
            baseStyle: 'Low Poly 3D',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        },
        {
            id: 'f2-2',
            name: 'Dungeon Portal',
            // Restored preview
            previewImage: 'https://image.pollinations.ai/prompt/isometric%20magic%20stone%20portal%20glowing%20blue%20sparks%20white%20background%203d%20render?width=1024&height=1024&seed=88&nologo=true',
            blocks: [
                createDefaultBlockState(BlockType.SUBJECT, { 
                    core: { fields: { category: 'Object', role: 'Magic Portal' } }, 
                    object_specs: { fields: { material_type: 'Stone', condition: 'Brand New' } } 
                }),
                createDefaultBlockState(BlockType.FX, { particles: { fields: { type: 'Sparks', amount: 30 } } }),
                createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { color: '#60a5fa' } } }),
                createDefaultBlockState(BlockType.BACKGROUND, { 
                    setting: { fields: { type: 'Studio', environment: 'White Void' } }, 
                    transparency: { enabled: true, fields: { remove_bg: true } } 
                })
            ],
            seed: 88,
            lastModified: Date.now(),
            aspectRatio: '1:1',
            roughIdea: 'Magical stone portal tile isolated',
            baseStyle: 'Low Poly 3D',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        },
        {
            id: 'f2-3',
            name: 'Crystal Obelisk',
            // Updated prompt for dark obsidian obelisk (high contrast) to ensure transparency works
            previewImage: 'https://image.pollinations.ai/prompt/isometric%20dark%20obsidian%20obelisk%20glowing%20purple%20runes%20high%20contrast%20solid%20white%20background%203d%20render%20blender?width=1024&height=1024&seed=77&nologo=true',
            blocks: [
                createDefaultBlockState(BlockType.SUBJECT, { 
                    core: { fields: { category: 'Object', role: 'Ancient Obelisk' } },
                    object_specs: { fields: { material_type: 'Polished Metal', condition: 'Brand New' } }
                }),
                createDefaultBlockState(BlockType.FX, { particles: { fields: { type: 'Sparks', amount: 20 } } }),
                createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { color: '#a78bfa', intensity: 90 } } }),
                createDefaultBlockState(BlockType.BACKGROUND, { 
                    setting: { fields: { type: 'Studio', environment: 'White Void' } }, 
                    transparency: { enabled: true, fields: { remove_bg: true } } 
                })
            ],
            seed: 77,
            lastModified: Date.now(),
            aspectRatio: '1:1',
            roughIdea: 'Floating crystal obelisk with glowing runes isolated',
            baseStyle: 'Low Poly 3D',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        }
    ]
  },
  {
    id: 'p3',
    name: 'Samurai Warrior',
    description: 'Cinematic visual exploration of Feudal Japan. High detail, historical accuracy.',
    lastModified: Date.now() - 200000,
    tags: ['Template'],
    globalBlocks: [
        createDefaultBlockState(BlockType.STYLE, { render: { fields: { medium: 'Photography' } } }),
        createDefaultBlockState(BlockType.BACKGROUND, { setting: { fields: { type: 'Outdoor', environment: 'Feudal Japan' } } })
    ],
    files: [
        {
            id: 'f3-1',
            name: 'Ronin Portrait',
            previewImage: 'https://image.pollinations.ai/prompt/cinematic%20portrait%20of%20a%20gritty%20japanese%20ronin%20samurai%20scarred%20face%20beard%20kimono%20sunset%20feudal%20japan%20detailed%20eyes%20photography%208k?width=1024&height=1024&seed=777&nologo=true',
            blocks: [
                 createDefaultBlockState(BlockType.SUBJECT, { 
                     core: { fields: { category: 'Human', role: 'Ronin' } },
                     human_physique: { fields: { gender: 'Male', age: 'Middle Aged', hair_style: 'Topknot' } },
                     human_attire: { fields: { 
                         style: 'Historical', 
                         attire_inner: [{name: 'Kimono', details: ['Worn', 'Textured']}],
                         accessories: [{name: 'Katana', details: []}] 
                    } },
                     pose_action: { fields: { view_angle: 'Front', action: 'Staring intensely' } }
                 }),
                 createDefaultBlockState(BlockType.BACKGROUND, { setting: { fields: { environment: 'Sunset Field' } } }),
                 createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { source: 'Sun', color: '#fbbf24', direction: 'Side' } } }), // Golden hour
                 createDefaultBlockState(BlockType.CAMERA, { composition: { fields: { shot_size: 'Close-up' } }, optics: { fields: { focal_length: '85mm Portrait' } } })
            ],
            seed: 777,
            lastModified: Date.now(),
            aspectRatio: '1:1',
            roughIdea: 'Portrait of a gritty Ronin',
            baseStyle: 'Cinematic Historical',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        },
        {
            id: 'f3-2',
            name: 'Temple Duel',
            previewImage: 'https://image.pollinations.ai/prompt/wide%20shot%20two%20samurai%20fighting%20in%20front%20of%20japanese%20temple%20falling%20cherry%20blossom%20petals%20dynamic%20action%20swords%20clashing%20cinematic?width=1024&height=576&seed=202&nologo=true',
            blocks: [
                createDefaultBlockState(BlockType.SUBJECT, { core: { fields: { category: 'Human', count: 'Duo', role: 'Samurai Warriors' } }, pose_action: { fields: { action: 'Fighting with Katana' } } }),
                createDefaultBlockState(BlockType.BACKGROUND, { setting: { fields: { environment: 'Ancient Temple Courtyard' } } }),
                createDefaultBlockState(BlockType.FX, { particles: { fields: { type: 'Leaves', amount: 80 } } }), // Cherry blossoms
                createDefaultBlockState(BlockType.CAMERA, { composition: { fields: { shot_size: 'Wide Shot' } } })
            ],
            seed: 202,
            lastModified: Date.now(),
            aspectRatio: '16:9',
            roughIdea: 'Action shot of samurai duel at a temple',
            baseStyle: 'Cinematic Action',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        },
        {
            id: 'f3-3',
            name: 'Himeji Castle',
            previewImage: 'https://image.pollinations.ai/prompt/wide%20cinematic%20shot%20majesty%20japanese%20himeji%20castle%20cherry%20blossoms%20sunrise%20mountains%20fog%20feudal%20japan%20photography%208k?width=1024&height=576&seed=505&nologo=true',
            blocks: [
                createDefaultBlockState(BlockType.BACKGROUND, { 
                    setting: { fields: { type: 'Outdoor', environment: 'Himeji Castle with Cherry Blossoms' } },
                    fog: { enabled: true, fields: { density: 20 } }
                }),
                createDefaultBlockState(BlockType.LIGHTING, { key_light: { fields: { source: 'Sun', color: '#fbbf24', direction: 'Back' } } }), // Sunrise
                createDefaultBlockState(BlockType.CAMERA, { composition: { fields: { shot_size: 'Wide Shot', angle: 'Low Angle (Hero)' } } })
            ],
            seed: 505,
            lastModified: Date.now(),
            aspectRatio: '16:9',
            roughIdea: 'Majestic Japanese castle at sunrise',
            baseStyle: 'Cinematic Historical',
            useBaseStyle: true,
            dynamicSuggestions: {},
            history: []
        }
    ]
  }
];