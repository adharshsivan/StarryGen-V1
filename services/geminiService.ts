import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { BlockType, BlockState, SectionState } from "../types";
import { BLOCK_DEFINITIONS } from "../constants";

// --- Interfaces for Gemini Output ---

interface ParsedSectionData {
    enabled?: boolean;
    fields: Record<string, any>;
}

interface ParsedBlockData {
  type: string;
  sections: Record<string, ParsedSectionData>;
}

// --- Constants ---
const NEGATIVE_PROMPT = "Avoid: text, watermark, signature, logo, split frame, multiple panels, blurry, low quality, deformed, bad anatomy, disfigured, cropped, extra limbs, mutation, missing limbs, floating limbs, disconnected limbs, malformed hands, blur, out of focus, long neck, long body, ugly, disgusting, poorly drawn, childish, cut off, cropped, frame, border.";

// --- Helper Functions ---

/**
 * Retrieves the API Key from Environment or Local Storage.
 * PRIORITY: Local Storage (User Custom Key) > Process Env (System Key)
 */
export const getEffectiveApiKey = (): string => {
    // 1. Priority: Check User Browser Storage (Custom Key)
    // This allows users to override the system key if it's exhausted or invalid.
    const localKey = localStorage.getItem('gemini_api_key');
    if (localKey && localKey.trim().length > 0) {
        return localKey.trim();
    }

    // 2. Fallback: Check Build/Env var (System Key)
    const envKey = process.env.API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.length > 0 && !envKey.includes('undefined')) {
        return envKey.trim();
    }
    
    return '';
};

/**
 * Retries an async operation with exponential backoff if it fails with specific status codes.
 */
const retryWithBackoff = async <T>(
    operation: () => Promise<T>, 
    retries: number = 3, 
    initialDelay: number = 2000
): Promise<T> => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        throw new Error("API_KEY_MISSING");
    }

    let delay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            // Check for 429 (Too Many Requests) or 503 (Service Unavailable)
            const status = error?.status || error?.response?.status;
            const msg = (error?.message || JSON.stringify(error)).toLowerCase();
            
            const isQuotaError = status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted');
            const isServerBusy = status === 503 || msg.includes('503') || msg.includes('overloaded');

            if (isQuotaError) {
                // Fail fast on quota errors if we want to inform user immediately.
                // We throw a specific error for the UI to handle (e.g., show Toast to add custom key).
                throw new Error("QUOTA_EXHAUSTED");
            }

            if (isServerBusy && i < retries - 1) {
                console.warn(`Gemini API Busy (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; 
                continue;
            }
            
            // If invalid key
            if ((status === 400 || status === 403) && msg.includes('key')) {
                throw new Error("API_KEY_INVALID");
            }

            throw error;
        }
    }
    throw new Error("Max retries exceeded");
};

// --- Service Functions ---

/**
 * Analyzes text or image input to generate a list of Block configurations with deep section nesting.
 */
export const analyzeReference = async (
  textInput: string, 
  imageBase64?: string
): Promise<BlockState[]> => {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");
  
  const ai = new GoogleGenAI({ apiKey });

  // Construct a "Brain Dump" of the definitions to help Gemini understand the structure
  let structureDocs = "";
  Object.values(BLOCK_DEFINITIONS).forEach(def => {
      structureDocs += `Block: ${def.type}\n`;
      def.sections.forEach(sec => {
          structureDocs += `  Section ID: "${sec.id}" (${sec.toggleable ? 'Toggleable' : 'Required'})`;
          if (sec.condition) {
              structureDocs += ` [Requires ${sec.condition.fieldId} == ${JSON.stringify(sec.condition.value)} in ${sec.condition.sectionId}]`;
          }
          structureDocs += `\n    Fields: ${sec.fields.map(f => `${f.id} (${f.type})`).join(', ')}\n`;
      });
      structureDocs += "\n";
  });

  const promptText = `
    Analyze the following input and break it down into a structured visual description.
    
    Output a JSON array of Blocks.
    For the 'Subject' block, pay attention to the 'category'. If category is Human, populate 'human_physique' etc. If Animal, populate 'creature_traits'.
    For 'clothing_desc' and 'accessories', provide an array of objects: { name: "ItemName", details: ["Adjective1", "Adjective2"] }.
    
    Structure Definitions:
    ${structureDocs}
    
    Input Context:
    ${textInput}
  `;

  const contents: any[] = [];
  if (imageBase64) {
    contents.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
  }
  contents.push({ text: promptText });

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      // Always use explicit parts structure to avoid TS undefined/union errors
      contents: { parts: contents },
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are a visual director. Return purely valid JSON.",
      }
    }));

    const jsonStr = response.text;
    if (!jsonStr) return [];

    // Cleanup potential markdown wrapping
    const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawBlocks = JSON.parse(cleanJson);
    return parseRawBlocksToState(rawBlocks);

  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

/**
 * Updates existing blocks based on a user instruction.
 */
export const refineBlocks = async (
    currentBlocks: BlockState[], 
    instruction: string
): Promise<BlockState[]> => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) throw new Error("API_KEY_MISSING");
    const ai = new GoogleGenAI({ apiKey });
  
    // Simplified docs for refinement
    const structureDocs = Object.values(BLOCK_DEFINITIONS).map(d => d.type).join(", ");
  
    const prompt = `
      Current State (JSON):
      ${JSON.stringify(currentBlocks, null, 2)}
  
      User Instruction: "${instruction}"
  
      Task: Update the Current State to reflect the User Instruction.
      - If adding a new element (like a second character), add a new SUBJECT block.
      - If modifying environment, update the existing BACKGROUND block (do not add a second one).
      - Respect the conditions: e.g. don't set 'hair_color' if category is 'Robot'.
      - For detailed-list fields (like accessories), ensure structure is {name, details[]}.
      
      Return ONLY the valid JSON array of the new BlockState.
    `;
  
    try {
      const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are a state manager. Return purely valid JSON.",
        }
      }));
  
      const jsonStr = response.text;
      if (!jsonStr) return currentBlocks;
  
      // Cleanup potential markdown wrapping
      const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const rawBlocks = JSON.parse(cleanJson);
      return parseRawBlocksToState(rawBlocks);
  
    } catch (error) {
      console.error("Refinement Error:", error);
      throw error;
    }
};

/**
 * Generates context-aware suggestions for inputs based on the rough idea OR current block state.
 */
export const generateContextSuggestions = async (contextDescription: string): Promise<Record<string, string[]>> => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) return {}; // Fail silently for background tasks if no key
    
    const ai = new GoogleGenAI({ apiKey });

    // We define a target schema of fields we want creative suggestions for
    // Format: BlockType:SectionId:FieldId
    const targets = [
        `${BlockType.SUBJECT}:core:role`,
        `${BlockType.SUBJECT}:human_attire:attire_outer`,
        `${BlockType.SUBJECT}:human_attire:attire_inner`,
        `${BlockType.SUBJECT}:human_physique:hair_style`,
        `${BlockType.SUBJECT}:pose_action:action`,
        `${BlockType.SUBJECT}:pose_action:pose`,
        `${BlockType.BACKGROUND}:setting:environment`,
        `${BlockType.LIGHTING}:key_light:source`,
        `${BlockType.MOOD}:emotion:primary`,
        `${BlockType.STYLE}:render:engine`
    ];

    const prompt = `
        Context / Current State: "${contextDescription}"

        Task: Provide creative, context-aware suggestions for the following fields in a visual generation tool.
        Avoid generic answers. Keep suggestions concise (1-5 words max).
        Example:
        - If context is "Robot Detective in Cyberpunk City", suggestions should contain "Neon-lit trenchcoat", "Plating" for attire.
        
        Target Fields (use these IDs exactly):
        ${targets.join('\n')}
    `;

    try {
        const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            fieldId: {
                                type: Type.STRING,
                                description: "The ID of the field to suggest values for"
                            },
                            suggestions: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "List of creative text suggestions"
                            }
                        },
                        required: ["fieldId", "suggestions"]
                    }
                },
                systemInstruction: "You are a creative director. Return a valid JSON array matching the schema.",
            }
        }));

        let jsonStr = response.text;
        if (!jsonStr) return {};

        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        
        if (firstBracket !== -1 && lastBracket !== -1) {
            jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
        } else {
             jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        const rawList = JSON.parse(jsonStr) as { fieldId: string, suggestions: string[] }[];
        
        const result: Record<string, string[]> = {};
        if (Array.isArray(rawList)) {
            rawList.forEach(item => {
                if (item.fieldId && Array.isArray(item.suggestions)) {
                    result[item.fieldId] = item.suggestions;
                }
            });
        }

        return result;

    } catch (error) {
        console.error("Context Suggestion Error:", error);
        return {};
    }
};

// Helper to convert raw JSON (from AI) into strict BlockState with defaults
const parseRawBlocksToState = (rawBlocks: any[]): BlockState[] => {
    return rawBlocks.map((rb: any, idx: number) => {
        const safeSections: Record<string, SectionState> = {};
        
        const def = BLOCK_DEFINITIONS[rb.type as BlockType];
        if (def) {
            def.sections.forEach(secDef => {
                const incomingSec = rb.sections?.[secDef.id];
                
                const finalFields: Record<string, any> = {};
                secDef.fields.forEach(f => {
                    finalFields[f.id] = incomingSec?.fields?.[f.id] ?? f.defaultValue;
                });

                safeSections[secDef.id] = {
                    enabled: secDef.toggleable ? (incomingSec?.enabled ?? false) : undefined,
                    fields: finalFields
                };
            });
        }

        const id = rb.id && rb.id.startsWith('b-') ? rb.id : `generated-${Date.now()}-${idx}`;

        return {
            id: id,
            type: rb.type as BlockType,
            isActive: true,
            sections: safeSections
        };
    }).filter((b: BlockState) => Object.values(BlockType).includes(b.type));
}

/**
 * Generates the image prompt string from blocks by traversing sections.
 */
export const constructPromptFromBlocks = (
    localBlocks: BlockState[], 
    baseStyle?: string, 
    useBaseStyle?: boolean,
    globalBlocks?: BlockState[],
    aspectRatio?: string
): string => {
  let promptParts: string[] = [];
  
  if (useBaseStyle && baseStyle) {
      promptParts.push(`Style: ${baseStyle}.`);
  }

  let blocksToProcess = [...localBlocks];
  if (useBaseStyle && globalBlocks && globalBlocks.length > 0) {
      const localTypes = new Set(localBlocks.filter(b => b.isActive).map(b => b.type));
      const activeGlobals = globalBlocks.filter(gb => {
          if (!gb.isActive) return false;
          const def = BLOCK_DEFINITIONS[gb.type];
          if (def.singleActiveInstance && localTypes.has(gb.type)) return false;
          return true;
      });
      blocksToProcess = [...activeGlobals, ...localBlocks];
  }
  
  const backgroundBlock = blocksToProcess.find(b => b.type === BlockType.BACKGROUND && b.isActive);
  const isTransparencyEnabled = backgroundBlock?.sections['transparency']?.fields['remove_bg'] === true;

  if (isTransparencyEnabled) {
      promptParts.push("Isolated on a solid pure white background (#FFFFFF). No shadows, no environment, clean edges for cutout.");
  }

  const TYPE_PRIORITY: Record<string, number> = {
      [BlockType.SUBJECT]: 0,
      [BlockType.CAMERA]: 1, 
      [BlockType.LIGHTING]: 2,
      [BlockType.BACKGROUND]: 3,
      [BlockType.FX]: 4,
      [BlockType.STYLE]: 5,
      [BlockType.POST_PROCESSING]: 6,
      [BlockType.MOOD]: 7
  };

  const sortedBlocks = blocksToProcess.sort((a, b) => {
      const pA = TYPE_PRIORITY[a.type] ?? 99;
      const pB = TYPE_PRIORITY[b.type] ?? 99;
      return pA - pB;
  });

  sortedBlocks.filter(b => b.isActive).forEach(block => {
    const def = BLOCK_DEFINITIONS[block.type];
    if (!def) return;

    const activeSections = Object.entries(block.sections).filter(([secId, secState]) => {
        const secDef = def.sections.find(s => s.id === secId);
        if (!secDef) return false;
        if (secDef.toggleable && !secState.enabled) return false;
        
        if (secDef.condition) {
            let controllingBlock = block;
            if (secDef.condition.blockType) {
                const target = sortedBlocks.find(b => b.type === secDef.condition!.blockType && b.isActive);
                if (target) controllingBlock = target;
                else return false;
            }
            const controllingSection = controllingBlock.sections[secDef.condition.sectionId];
            const controllingValue = controllingSection?.fields?.[secDef.condition.fieldId];
            
            if (Array.isArray(secDef.condition.value)) {
                if (!secDef.condition.value.includes(controllingValue)) return false;
            } else {
                if (controllingValue !== secDef.condition.value) return false;
            }
        }
        return true;
    });

    let blockDescParts: string[] = [];
    let subjectName = block.customLabel || 'The Subject';
    let interactions = "";

    if (block.type === BlockType.CAMERA) {
        const shotSize = activeSections.find(([id]) => id === 'composition')?.[1].fields['shot_size'];
        const isWideRatio = aspectRatio === '16:9' || aspectRatio === '21:9';
        
        if (shotSize === 'Extreme Close-up') {
            blockDescParts.push(`FRAMING: MACRO SHOT. Focus exclusively on details. If aspect ratio is wide, fill the frame horizontally with the subject's face/detail. Do not zoom out.`);
        } else if (shotSize === 'Close-up') {
            if (isWideRatio) {
                blockDescParts.push(`FRAMING: ANAMORPHIC CLOSE-UP. Subject dominates the foreground. Crop top of head/chin if needed to fill width. Do not show wide environment.`);
            } else {
                blockDescParts.push(`FRAMING: CLOSE-UP. Subject fills the frame.`);
            }
        }
    }

    activeSections.forEach(([secId, secState]) => {
        const secDef = def.sections.find(s => s.id === secId);
        
        if (secId === 'interactions') {
             const target = secState.fields['target_subject'];
             const action = secState.fields['interaction_type'];
             if (target && target !== 'None') {
                 interactions = ` [INTERACTION: ${subjectName} is ${action} ${target}]`;
             }
             return; 
        }

        let fieldsDesc = "";
        Object.entries(secState.fields).forEach(([fieldId, val]) => {
            if (val === 'None' || val === false || val === '' || (Array.isArray(val) && val.length === 0)) return;
            
            const fieldDef = secDef?.fields.find(f => f.id === fieldId);

            if (fieldId === 'subject_distance') {
                const dist = Number(val);
                let distLabel = "Foreground";
                if (dist < 25) distLabel = "Extreme Foreground, close to lens";
                else if (dist < 45) distLabel = "Foreground";
                else if (dist < 65) distLabel = "Mid-ground";
                else if (dist < 85) distLabel = "Background";
                else distLabel = "Far Distance";
                fieldsDesc += `Depth: ${distLabel}, `;
                return;
            }

            if (fieldId === 'subject_size') {
                 fieldsDesc += `Visual Scale: Subject occupies approx ${val}% of the image frame, `;
                 return;
            }
            
            if (fieldDef?.type === 'position-picker' && typeof val === 'object' && val.label) {
                if (val.label === 'Center') {
                    fieldsDesc += `Position: Perfectly Centered in the middle of the frame, `;
                } else {
                    fieldsDesc += `Frame Position: ${val.label}, `;
                }
                return;
            }

            if (val === true) {
                fieldsDesc += `${fieldId}, `;
            } else if (Array.isArray(val)) {
                if (fieldDef?.type === 'detailed-list') {
                     const items = val.map((item: any) => {
                         const details = item.details && item.details.length > 0 ? `${item.details.join(' ')} ` : '';
                         return `${details}${item.name}`;
                     });
                     if (items.length > 0) {
                         fieldsDesc += `${fieldDef.label}: ${items.join(', ')}, `;
                     }
                } else if (fieldDef) {
                    fieldsDesc += `${fieldDef.label}: ${val.join(', ')}, `;
                }
            } else {
                if (fieldDef) {
                    fieldsDesc += `${fieldDef.label}: ${val}, `;
                }
            }
        });
        
        if (fieldsDesc) {
            blockDescParts.push(`${fieldsDesc.slice(0, -2)}`);
        }
    });

    if (block.customValues && block.customValues.length > 0) {
        let customDesc = "";
        block.customValues.forEach(cv => {
            if (cv.label && cv.value !== undefined && cv.value !== '') {
                let valStr = `${cv.value}`;
                if (cv.type === 'checkbox') valStr = cv.value ? 'Yes' : 'No';
                if (cv.type === 'checkbox' && !cv.value) return; 
                customDesc += `${cv.label}: ${valStr}, `;
            }
        });
        if (customDesc) blockDescParts.push(`Custom Details: ${customDesc.slice(0, -2)}`);
    }

    if (blockDescParts.length > 0 || interactions) {
        const label = block.customLabel && block.customLabel !== 'Subject' ? `"${block.customLabel}"` : subjectName;
        promptParts.push(`[${block.type} - ${label}]: ${blockDescParts.join(" | ")}${interactions}`);
    }
  });

  return promptParts.join(". ");
};

export const urlToBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to fetch image URL for conversion", e);
        return "";
    }
};

/**
 * Perform generic image editing actions via Gemini
 */
export const editImage = async (
    imageBase64: string,
    instruction: string
): Promise<string | null> => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) throw new Error("API_KEY_MISSING");
    const ai = new GoogleGenAI({ apiKey });
    
    // Convert URL if needed
    let imageData = imageBase64;
    let mimeType = 'image/png';
    
    if (imageBase64.startsWith('http')) {
        const converted = await urlToBase64(imageBase64);
        if (converted) imageData = converted;
    }

    if (imageData.startsWith('data:')) {
         const match = imageData.match(/^data:(image\/\w+);base64,/);
         mimeType = match ? match[1] : 'image/png';
         imageData = imageData.replace(/^data:image\/\w+;base64,/, "");
    }

    const prompt = `
        Edit this image according to the following instruction: "${instruction}".
        Maintain the highest possible quality.
        If asking to remove background, make the background pure solid white (#FFFFFF) for chroma keying.
    `;

    try {
        const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    { text: prompt }
                ]
            }
        }));

        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Edit Image Error:", error);
        throw error;
    }
}

/**
 * Client-side helper to remove pure white background
 */
export const processTransparency = async (base64Image: string): Promise<string> => {
    return new Promise<string>((resolve) => {
        if (!base64Image) return resolve(base64Image);
        
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(base64Image);
                ctx.drawImage(img, 0, 0);
                const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = frame.data;
                
                // Chroma Key Logic (White)
                // Uses Euclidean distance to detect "near-white" colors caused by compression artifacts
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Calculate distance from pure white (255, 255, 255)
                    const dist = Math.sqrt(
                        Math.pow(255 - r, 2) + 
                        Math.pow(255 - g, 2) + 
                        Math.pow(255 - b, 2)
                    );

                    // Threshold of 50 catches compression noise around white
                    // while preserving light colors that are distinct enough.
                    if (dist < 50) {
                        data[i + 3] = 0; // Set Alpha to 0
                    }
                }
                
                ctx.putImageData(frame, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Canvas processing failed", e);
                resolve(base64Image);
            }
        };
        img.onerror = () => {
            console.error("Failed to load image for transparency processing");
            resolve(base64Image); // Return original on failure
        };
        
        // Handle race conditions where onload might not fire for cached images if src set before onload
        img.src = base64Image;
    });
};

export const generateImageFromBlocks = async (
    blocks: BlockState[], 
    seed: number,
    aspectRatio: string = '1:1',
    baseStyle: string = '',
    previousImageBase64: string | null = null,
    useBaseStyle: boolean = true,
    globalBlocks: BlockState[] = [],
    changeDescription: string = ''
): Promise<string | null> => {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");
  const ai = new GoogleGenAI({ apiKey });
  
  const structuredPrompt = constructPromptFromBlocks(blocks, baseStyle, useBaseStyle, globalBlocks, aspectRatio);
  
  let finalPrompt = "";
  const activeBlocks = useBaseStyle ? [...globalBlocks, ...blocks] : blocks;
  
  // Check if we have active Reference Images
  const hasReferenceImages = activeBlocks.some(b => b.isActive && b.referenceImage);

  if (previousImageBase64) {
      // Find the Background description to emphasize change
      let backgroundDescription = "Background as defined.";
      const bgBlock = activeBlocks.find(b => b.type === BlockType.BACKGROUND && b.isActive);
      if (bgBlock) {
          const env = bgBlock.sections['setting']?.fields['environment'] || '';
          const type = bgBlock.sections['setting']?.fields['type'] || '';
          const time = bgBlock.sections['setting']?.fields['time'] || '';
          backgroundDescription = `${type} ${env} at ${time}`;
      }

      let referenceInstruction = "1. Maintain the Subject Identity and Poses from the provided IMAGE TO EDIT (unless instructed otherwise).";
      
      // If we have explicit references, we need to instruct the model to prioritize those for identity
      if (hasReferenceImages) {
          referenceInstruction = "1. CRITICAL: For subjects with a 'REFERENCE IMAGE' provided above, you MUST prioritize the facial features, identity, and clothing of that REFERENCE IMAGE over the 'IMAGE TO EDIT'. Use the 'IMAGE TO EDIT' only for composition and pose, but swap the identity to match the REFERENCE IMAGE.";
      }

      let changeFocus = "";
      if (changeDescription && changeDescription !== 'Regenerated') {
          changeFocus = `USER ACTION: ${changeDescription}. IMPORTANT: You MUST apply this change visibly.`;
          
          // Logic to preserve background if not modified (Addresses the "Background Consistency" issue)
          if (!changeDescription.toLowerCase().includes('background')) {
              changeFocus += ` PRESERVE the existing background/environment from the image. Only modify the ${changeDescription.replace('Modified ', '').replace('Added ', '')}.`;
          }
      }

      finalPrompt = `Edit the provided 'IMAGE TO EDIT' to match this description: ${structuredPrompt}. 
      ${changeFocus}
      ${NEGATIVE_PROMPT}
      
      INSTRUCTIONS:
      ${referenceInstruction}
      2. REPLACE the Background/Environment if the text description differs from the image. The text description "${backgroundDescription}" takes PRIORITY over the image background.
      3. If the text says "Forest" and image is "City", make it a Forest.
      4. Apply the Visual Style defined.
      Render quality: Ultra-realistic, 8k.`;
  } else {
      finalPrompt = `${structuredPrompt} \n${NEGATIVE_PROMPT} \nRender quality: Ultra-realistic, 8k, highly detailed.`;
  }

  try {
    const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    const finalAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "1:1";

    const contentParts: any[] = [];
    
    // 1. ADD BLOCK VISUAL REFERENCES
    // This loops through active blocks and checks if they have a reference image attached.
    // If so, it passes that image to the model to ensure visual consistency.
    for (const block of activeBlocks) {
        if (block.isActive && block.referenceImage) {
            let refData = block.referenceImage;
            let refMime = 'image/png';
            
            // Handle URL conversion
            if (refData.startsWith('http')) {
                refData = await urlToBase64(refData);
            }
             // Handle Base64 stripping
            if (refData.startsWith('data:')) {
                 const match = refData.match(/^data:(image\/\w+);base64,/);
                 refMime = match ? match[1] : 'image/png';
                 refData = refData.replace(/^data:image\/\w+;base64,/, "");
            }

            if(refData) {
                contentParts.push({ text: `REFERENCE IMAGE for [${block.type} - ${block.customLabel}]:` });
                contentParts.push({
                    inlineData: { mimeType: refMime, data: refData }
                });
                contentParts.push({ text: `Instruction: strictly maintain the visual characteristics (identity, face, appearance) of the reference image above for the ${block.type} element.` });
            }
        }
    }

    // 2. Add Previous Image (Editing Mode)
    if (previousImageBase64) {
        let imageData = previousImageBase64;
        let mimeType = 'image/png'; 
        
        if (previousImageBase64.startsWith('http')) {
            const converted = await urlToBase64(previousImageBase64);
            if (converted) {
                imageData = converted;
            } else {
                console.warn("Could not convert URL to base64, proceeding with text only.");
            }
        }

        if (imageData.startsWith('data:')) {
             const match = imageData.match(/^data:(image\/\w+);base64,/);
             mimeType = match ? match[1] : 'image/png';
             imageData = imageData.replace(/^data:image\/\w+;base64,/, "");
             
             contentParts.push({ text: "IMAGE TO EDIT:" });
             contentParts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: imageData
                }
            });
        }
    }

    // 3. Add Final Text Prompt
    contentParts.push({ text: finalPrompt });

    const config: any = {
        seed: Math.floor(seed),
        imageConfig: {
            aspectRatio: finalAspectRatio
        }
    };

    // Wrap the generation call in retry logic
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: {
        parts: contentParts
      },
      config: config
    }));

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;

  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};