import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase/config";

const MODEL_IDS = [
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
  "mistralai/mistral-large",
  "x-ai/grok-4-fast",
  "qwen/qwen-vl-max",
  "deepseek/deepseek-chat-v3.1",
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-4-scout",
  "qwen/qwen3-max",
  "google/gemma-3-27b-it",
  "openai/gpt-4.1",
  "meituan/longcat-flash-chat",
  "alibaba/tongyi-deepresearch-30b-a3b"
];

export const createEvalDocument = async (probad) => {
  try {
    // Create the predictions array
    const predictions = MODEL_IDS.map(model => ({
      model,
      prediction: null,
      fetch: 'false',
      evaluated_by: null,
      evaluated_at: null,
      semantic_score: null,
      cultural_score: null
    }));

    // Store the original probad document ID for reference
    const probadId = probad.id;

    // Add predictions to the probad object
    const evalDoc = {
      ...probad,
      probad_id: probadId,
      predictions,
      status: 'pending'
    };

    // Add to 'eval' collection
    const docRef = await addDoc(collection(db, "eval"), evalDoc);

    console.log("Eval document created with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating eval document:", error);
    throw error;
  }
};