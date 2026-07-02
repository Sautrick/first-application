import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MedicineAlternative {
  originalName: string;
  originalEstimatedPrice?: string;
  activeIngredient?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  alternatives: {
    name: string;
    description: string;
    estimatedPrice?: string;
    savingsPercentage?: string;
    manufacturer?: string;
    availabilityStatus?: string;
    purchaseLink?: string;
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
  const model = "gemini-3.5-flash";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: "You are an expert medical scribe and pharmacist. Analyze this handwritten prescription image. Doctors' handwriting can be notoriously difficult to read, so use your advanced medical knowledge, common drug databases, and the surrounding context of the prescription to accurately identify the text.\n\nExtract the following information:\n1. Doctor's name\n2. Patient's name and age\n3. Date of the prescription\n4. All medicines mentioned, including their active ingredient (chemical makeup), dosage, frequency, and duration.\n\nCRITICAL INSTRUCTIONS FOR HANDWRITING:\n- If a word is unclear, look at the first few letters and the medical context (e.g., if it starts with 'Amox' and is followed by a dosage like '500mg', it is likely 'Amoxicillin').\n- Cross-reference with common medication names to ensure accuracy.\n- If a medicine name is partially legible, provide your best professional estimate based on medical standards.\n\nPRICE COMPARISON & ALTERNATIVE FINDER INSTRUCTIONS:\n- For each prescribed medicine, provide an estimated current market price in Indian Rupees (INR) (e.g., '₹250.00').\n- Suggest 2-3 cheaper generic alternatives that have the EXACT SAME active ingredients and chemical makeup.\n- For each alternative, provide:\n  a. Alternative brand name\n  b. Estimated current market price in Indian Rupees (INR)\n  c. Percentage savings compared to the original (e.g., 'Save 45%')\n  d. Manufacturer name (e.g., Cipla, Abbott, Sun Pharma, Lupin, Dr. Reddy's)\n  e. Availability status ('In Stock', 'Limited Stock', 'Out of Stock')\n  f. A direct purchase link to search for the alternative drug on Netmeds or Tata 1mg (e.g., 'https://www.1mg.com/search/all?name=Amoxicillin' or similar search URL formatted cleanly with the alternative name)\n- Explain why they are equivalent (must mention it has the same active ingredient).\n\nProvide the output in a structured JSON format.",
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
                originalEstimatedPrice: { type: Type.STRING, description: "Estimated market price of the prescribed medicine." },
                activeIngredient: { type: Type.STRING, description: "The active chemical ingredient of the medicine." },
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
                      estimatedPrice: { type: Type.STRING, description: "Estimated market price of the alternative." },
                      savingsPercentage: { type: Type.STRING, description: "Percentage savings (e.g., '45%')." },
                      manufacturer: { type: Type.STRING, description: "The company manufacturing this alternative (e.g., Cipla Ltd)." },
                      availabilityStatus: { type: Type.STRING, description: "Availability status, usually 'In Stock' or 'Limited Stock'." },
                      purchaseLink: { type: Type.STRING, description: "A clean search URL to buy/order the drug (e.g. Tata 1mg search URL)." }
                    },
                    required: ["name", "description", "estimatedPrice", "savingsPercentage", "manufacturer", "availabilityStatus", "purchaseLink"]
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
}export async function searchMedicineByName(medicineName: string): Promise<MedicineAlternative | null> {
  const model = "gemini-3.5-flash";

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: `You are an expert pharmacist and medical database assistant. Analyze the medicine name: "${medicineName}".
            
            Identify:
            1. Its active ingredient/chemical compound.
            2. The estimated market price in Indian Rupees (INR) (e.g. "₹120.00").
            3. Provide 2-3 cheaper generic alternatives (containing the EXACT SAME active ingredient/compound) available in India.
            4. For each alternative, provide:
               - name: Brand name of the cheaper equivalent
               - description: Equivalence details
               - estimatedPrice: Estimated price in INR (e.g. "₹50.00")
               - savingsPercentage: e.g., "58%"
               - manufacturer: Name of the pharmaceutical company (e.g. Cipla, Sun Pharma, Abbott, Lupin, Dr. Reddy's)
               - availabilityStatus: 'In Stock' or 'Limited Stock'
               - purchaseLink: A formatted search URL to buy/order the drug (e.g. Tata 1mg search URL: "https://www.1mg.com/search/all?name={name}")
            5. Add dosage, frequency, and duration suggestions based on common guidelines (with a clear disclaimer that the doctor determines the actual dosage).

            Format the return exactly as a JSON object of MedicineAlternative shape.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          originalName: { type: Type.STRING, description: "The name of the queried medicine." },
          originalEstimatedPrice: { type: Type.STRING, description: "Estimated market price of the queried medicine." },
          activeIngredient: { type: Type.STRING, description: "The active chemical ingredient of the medicine." },
          dosage: { type: Type.STRING, description: "Typical primary dosage." },
          frequency: { type: Type.STRING, description: "Typical frequency." },
          duration: { type: Type.STRING, description: "Typical duration." },
          alternatives: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the cheaper alternative." },
                description: { type: Type.STRING, description: "Brief explanation of equivalence." },
                estimatedPrice: { type: Type.STRING, description: "Estimated market price of the alternative in INR." },
                savingsPercentage: { type: Type.STRING, description: "Percentage savings (e.g., '55%')." },
                manufacturer: { type: Type.STRING, description: "Pharma manufacturer name." },
                availabilityStatus: { type: Type.STRING, description: "Usually 'In Stock' or 'Limited Stock'." },
                purchaseLink: { type: Type.STRING, description: "URL to search on Tata 1mg or Netmeds." }
              },
              required: ["name", "description", "estimatedPrice", "savingsPercentage", "manufacturer", "availabilityStatus", "purchaseLink"]
            }
          }
        },
        required: ["originalName", "alternatives"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "null");
  } catch (e) {
    console.error("Failed to parse medicine search response", e);
    return null;
  }
}

export interface AlternativeProduct {
  productName: string;
  price: string;
  shortDescription: string;
  purchaseLink: string;
  availabilityStatus: 'In Stock' | 'Limited Stock' | 'Out of Stock' | string;
}

export interface ProductExtraction {
  productName: string;
  productUrl?: string;
  productDescription?: string;
  features: string[];
  productCategory: string;
  summary: string;
  similarProducts: AlternativeProduct[];
  budgetAlternatives: AlternativeProduct[];
}

export interface ScheduleItem {
  medicineName: string;
  dosage: string;
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  night: boolean;
  beforeMeal: boolean; // true = Before Meal, false = After Meal
  duration: string;
  additionalInstructions?: string;
  timesPerDay?: number;
  exactTimes?: string[];
}

export interface MedicationSchedule {
  doctorName?: string;
  patientName?: string;
  patientAge?: string;
  prescriptionDate?: string;
  summary?: string;
  schedule: ScheduleItem[];
}

export async function generateMedicationSchedule(
  doctorName?: string,
  patientName?: string,
  patientAge?: string,
  prescriptionDate?: string,
  medicinesList?: any[]
): Promise<MedicationSchedule | null> {
  const model = "gemini-3.5-flash";

  const rawMedicinesStr = medicinesList
    ? medicinesList.map(m => `${m.originalName || m.name} (Active: ${m.activeIngredient || ''}, Dosage: ${m.dosage || ''}, Duration: ${m.duration || ''}, Frequency: ${m.frequency || ''})`).join('\n')
    : "No medicines provided";

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: `You are an expert clinical pharmacologist and medical safety coordinator. Create a highly accurate, structured daily intake schedule for a patient.
            
            Inputs:
            - Doctor: ${doctorName || "Unknown Doctor"}
            - Patient: ${patientName || "Unknown Patient"}
            - Patient Age: ${patientAge || "Unknown Age"}
            - Prescription Date: ${prescriptionDate || "Today"}
            - Medicines parsed:
            ${rawMedicinesStr}

            Perform the following actions:
            1. Analyze each medicine's clinical guidelines, dosage notes, frequency, and standard safe medical advice.
            2. Match each medicine onto a daily checklist schedule indicating:
               - medicineName: Cleaned/readable name of the medicine.
               - dosage: Explicit, simple patient units (e.g., "1 Tablet", "1 Capsule", "5 ML").
               - morning: Boolean, should it be taken in morning (6:00 AM - 9:00 AM)?
               - afternoon: Boolean, afternoon (12:00 PM - 2:00 PM)?
               - evening: Boolean, evening (5:00 PM - 7:00 PM)?
               - night: Boolean, night (9:00 PM - 10:30 PM)?
               - beforeMeal: Boolean, true if best taken Before Meal, false if After Meal is optimal.
               - duration: Clear text timeline (e.g., "5 Days", "10 Days", "For 2 Weeks").
               - additionalInstructions: Helpful brief advice (e.g., "Take with light snack", "Avoid dairy products", "Ensure high water intake").
               - timesPerDay: Integer, how many times per day this medicine should be taken based on its prescription/frequency.
               - exactTimes: Array of strings representing the exact times at which it should be taken (e.g., ["08:30 AM"] if only once a day in the morning, or ["08:30 AM", "01:30 PM", "08:30 PM"] if three times a day).
            3. Write a brief overview summary explaining dietary or scheduling safety notes.

            Output MUST match the requested JSON schema.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          doctorName: { type: Type.STRING },
          patientName: { type: Type.STRING },
          patientAge: { type: Type.STRING },
          prescriptionDate: { type: Type.STRING },
          summary: { type: Type.STRING, description: "A summary or safety disclaimer advice for the intake schedule." },
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                medicineName: { type: Type.STRING },
                dosage: { type: Type.STRING },
                morning: { type: Type.BOOLEAN },
                afternoon: { type: Type.BOOLEAN },
                evening: { type: Type.BOOLEAN },
                night: { type: Type.BOOLEAN },
                beforeMeal: { type: Type.BOOLEAN },
                duration: { type: Type.STRING },
                additionalInstructions: { type: Type.STRING },
                timesPerDay: { type: Type.INTEGER, description: "Number of times per day this medicine should be taken." },
                exactTimes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Exact times to take this medicine, e.g., ['08:00 AM', '09:00 PM']."
                }
              },
              required: ["medicineName", "dosage", "morning", "afternoon", "evening", "night", "beforeMeal", "duration", "timesPerDay", "exactTimes"]
            },
            description: "Direct daily intake rows mapping medicines onto specific times."
          }
        },
        required: ["schedule", "summary"]
      }
    }
  });

  try {
    const rawResult = JSON.parse(response.text || "null");
    if (rawResult) {
      return {
        doctorName: rawResult.doctorName || doctorName || "Unknown Doctor",
        patientName: rawResult.patientName || patientName || "Patient",
        patientAge: rawResult.patientAge || patientAge || "",
        prescriptionDate: rawResult.prescriptionDate || prescriptionDate || "",
        summary: rawResult.summary || "Take all medicines as prescribed by your practitioner.",
        schedule: rawResult.schedule || []
      };
    }
    return null;
  } catch (e) {
    console.error("Failed to parse medication schedule response", e);
    return null;
  }
}

export async function extractProductInformation(
  productName: string,
  productUrl: string,
  productDescription: string
): Promise<ProductExtraction | null> {
  const model = "gemini-3.5-flash";

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: `You are an expert product analyst and data extraction assistant. Given the following inputs:
            - Product Name: "${productName}"
            - Product URL: "${productUrl}"
            - Product Description: "${productDescription}"

            Perform the following actions:
            1. Extract the main product features / highlights. List at least 3-7 key features as distinct, concise strings.
            2. Determine the most accurate general category of this product (e.g., Pharmaceuticals, Wellness & Nutrition, Medical Devices, Personal Care, Smart Health Gadgets, etc.).
            3. Provide a brief, professional 1-2 sentence summary of the product.
            4. Recommend 2 to 3 **Similar Products** in the same market or category.
            5. Recommend 2 to 3 **Budget Alternatives** that are significantly cheaper options but offer comparable features/utility.

            For each recommended alternative (similar or budget), provide:
            - productName: Name of the product
            - price: Estimated market price (with currency symbol e.g. ₹ or $)
            - shortDescription: Brief 1-sentence explanation of equivalent functionality/merit
            - purchaseLink: A shopping search or product URL (e.g. "https://www.google.com/search?q=buy+" + encoded name)
            - availabilityStatus: Current availability, must be "In Stock", "Limited Stock", or "Out of Stock".

            Ensure the response strictly complies with the requested JSON schema.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING, description: "Name of the product." },
          features: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of key features of the product."
          },
          productCategory: { type: Type.STRING, description: "The broad category this product belongs to." },
          summary: { type: Type.STRING, description: "A brief professional summary of the product." },
          similarProducts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                price: { type: Type.STRING },
                shortDescription: { type: Type.STRING },
                purchaseLink: { type: Type.STRING },
                availabilityStatus: { type: Type.STRING }
              },
              required: ["productName", "price", "shortDescription", "purchaseLink", "availabilityStatus"]
            },
            description: "Products similar to the target product."
          },
          budgetAlternatives: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                price: { type: Type.STRING },
                shortDescription: { type: Type.STRING },
                purchaseLink: { type: Type.STRING },
                availabilityStatus: { type: Type.STRING }
              },
              required: ["productName", "price", "shortDescription", "purchaseLink", "availabilityStatus"]
            },
            description: "Pocket-safe budget alternatives."
          }
        },
        required: ["productName", "features", "productCategory", "summary", "similarProducts", "budgetAlternatives"]
      }
    }
  });

  try {
    const rawResult = JSON.parse(response.text || "null");
    if (rawResult) {
      return {
        productName: rawResult.productName || productName,
        productUrl,
        productDescription,
        features: rawResult.features || [],
        productCategory: rawResult.productCategory || "Miscellaneous",
        summary: rawResult.summary || "No summary available.",
        similarProducts: rawResult.similarProducts || [],
        budgetAlternatives: rawResult.budgetAlternatives || []
      };
    }
    return null;
  } catch (e) {
    console.error("Failed to parse product extraction response", e);
    return null;
  }
}

