import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import fs from "fs-extra";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// הגדרת סכמות פלט
const SCHEMAS = {
  // טור אחד פשוט
  single_column: {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        page_number: { type: SchemaType.NUMBER, description: "The sequential number of the page in the batch (1-10)" },
        content: { type: SchemaType.STRING, description: "The full Hebrew text extracted from the page" }
      },
      required: ["page_number", "content"]
    }
  },
  
  // שני טורים שטוחים (הסכמה הישנה)
  double_column: {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        page_number: { type: SchemaType.NUMBER },
        right_column: { type: SchemaType.STRING, description: "Text from the right column" },
        left_column: { type: SchemaType.STRING, description: "Text from the left column" }
      },
      required: ["page_number", "right_column", "left_column"]
    }
  },

  // סכמה מורכבת - טורים כאובייקטים נפרדים במערך
  // זה מאפשר גמישות (טורים בצורת 'ר', 3 טורים וכו')
  complex_columns: {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        page_number: { type: SchemaType.NUMBER },
        columns: {
          type: SchemaType.ARRAY,
          description: "List of text columns/blocks identified on the page",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              side: { 
                type: SchemaType.STRING, 
                description: "Position of the column: 'right', 'left', or 'center'",
                enum: ["right", "left", "center"] 
              },
              text: { type: SchemaType.STRING, description: "The extracted text content" }
            },
            required: ["side", "text"]
          }
        }
      },
      required: ["page_number", "columns"]
    }
  }
};

/**
 * פונקציה להמרת קובץ לאובייקט שג'מיני מקבל
 */
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: fs.readFileSync(path).toString("base64"),
      mimeType
    },
  };
}

/**
 * עיבוד אצווה של תמונות באמצעות ג'מיני
 */
export async function processBatchWithGemini(imagePaths, layoutType, specificPrompt, examples = []) {
  const modelName = "gemini-1.5-pro"; // מודל חזק שמתאים ל-Structured Output
  
  const schema = SCHEMAS[layoutType] || SCHEMAS.single_column;

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1,
    },
  });

  const promptParts = [];

  promptParts.push(`
    You are an expert Hebrew OCR specialist specialized in holy Jewish texts (Sifrei Kodesh).
    Your task is to extract text from the provided images with extreme accuracy.
    Respect Rashi script, specialized fonts, and layout.
    
    Selected Layout Schema: ${layoutType}.
    ${specificPrompt ? `Specific Instructions: ${specificPrompt}` : ''}
    
    Output strictly valid JSON matching the schema.
    For 'complex_columns', analyze the page structure and split text into 'columns' objects with correct 'side' property.
  `);

  if (examples && examples.length > 0) {
    promptParts.push("Here are some examples of similar texts and their correct extraction:");
    
    for (const example of examples) {
        const fullExamplePath = path.join(process.cwd(), 'public', example.imagePath);
        if (fs.existsSync(fullExamplePath)) {
            promptParts.push(fileToGenerativePart(fullExamplePath, "image/jpeg"));
            promptParts.push(`Expected JSON Output: ${JSON.stringify(example.expectedOutput)}`);
        }
    }
  }

  promptParts.push("Now extract the text from the following images (return an array of page objects):");

  const imageParts = imagePaths.map(img => fileToGenerativePart(img, "image/jpeg"));
  
  try {
    const result = await model.generateContent([...promptParts, ...imageParts]);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (e) {
    console.error("Gemini Error:", e);
    return [];
  }
}