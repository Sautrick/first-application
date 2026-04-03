import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MedicineAlternative {
  originalName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  alternatives: {
    name: string;
    description: string;
    estimatedPriceRange?: string;
  }[];
}

export interface PrescriptionAnalysis {
  doctorName?: string;
  patientName?: string;
  patientAge?: string;
  prescriptionDate?: string;
  medicines: MedicineAlternative[];
}

export async function analyzePrescription(base64Image: string): Promise<PrescriptionAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: "Analyze this handwritten prescription. Extract the following information if available:\n1. Doctor's name\n2. Patient's name and age\n3. Date of the prescription\n4. All medicines mentioned, including their dosage, frequency, and duration.\n\nFor each medicine, suggest 2-3 cheaper generic alternatives. Provide the output in a structured JSON format.",
          },
          {
            inlineData: {
              data: base64Image.split(",")[1],
              mimeType: "image/jpeg",
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          doctorName: { type: Type.STRING, description: "The name of the doctor who issued the prescription." },
          patientName: { type: Type.STRING, description: "The name of the patient." },
          patientAge: { type: Type.STRING, description: "The age of the patient." },
          prescriptionDate: { type: Type.STRING, description: "The date the prescription was issued." },
          medicines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalName: { type: Type.STRING, description: "The name of the medicine." },
                dosage: { type: Type.STRING, description: "The prescribed dosage." },
                frequency: { type: Type.STRING, description: "How often the medicine should be taken." },
                duration: { type: Type.STRING, description: "How long the medicine should be taken." },
                alternatives: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Name of the cheaper alternative." },
                      description: { type: Type.STRING, description: "Brief description of why it's a good alternative." },
                      estimatedPriceRange: { type: Type.STRING, description: "Optional price comparison." }
                    },
                    required: ["name", "description"]
                  }
                }
              },
              required: ["originalName", "alternatives"]
            }
          }
        },
        required: ["medicines"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return { medicines: [] };
  }
}
