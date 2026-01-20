
import { GoogleGenAI, Type } from "@google/genai";

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: "A concise, one-sentence summary of the journal entry.",
        },
        insight: {
            type: Type.STRING,
            description: "A deeper insight, pattern, or reflection based on the entry. If a pattern is detected, mention it.",
        },
        tags: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            },
            description: "An array of 3 to 5 relevant tags (keywords) for the entry.",
        },
        type: {
            type: Type.STRING,
            description: "Classify the entry. Choose one: 'personal', 'work', 'task', 'note'. Default to 'note' if unsure."
        },
        taskStatus: {
            type: Type.STRING,
            description: "If type is 'task', set status. Choose one: 'todo', 'in-progress', 'done', 'none'. Default is 'none'."
        },
        dueDate: {
            type: Type.STRING,
            description: "If type is 'task' and a due date is mentioned, provide it in 'YYYY-MM-DD' format. Otherwise, null."
        },
        priority: {
            type: Type.STRING,
            description: "If type is 'task', infer priority. Choose one: 'low', 'medium', 'high', 'none'. Default is 'none'."
        }
    },
    required: ["summary", "insight", "tags", "type", "taskStatus", "dueDate", "priority"],
};


interface AIData {
    summary: string;
    insight: string;
    tags: string[];
    type: 'personal' | 'work' | 'task' | 'note';
    taskStatus: 'todo' | 'in-progress' | 'done' | 'none';
    dueDate: string | null;
    priority: 'low' | 'medium' | 'high' | 'none';
}


export const generateSummaryAndInsight = async (entry: string): Promise<AIData | null> => {
    // Initialize the client inside the function to ensure process.env.API_KEY is available at runtime.
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set. Please ensure you have configured your API key.");
        return null;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const prompt = `Analyze the following journal entry. Classify its type, and if it's a task, extract its status, due date, and priority. Provide a JSON response with a summary, an insight, relevant tags, and the classification details. Entry:\n\n"${entry}"`;
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = response.text;
        if (!jsonText) {
             throw new Error("No text returned from model.");
        }

        const data = JSON.parse(jsonText.trim());
        
        // Ensure the returned data conforms to the AIData interface
        return {
            summary: data.summary,
            insight: data.insight,
            tags: data.tags,
            type: data.type,
            taskStatus: data.taskStatus,
            dueDate: data.dueDate,
            priority: data.priority,
        };

    } catch (error) {
        console.error("Error generating content from Gemini:", error);
        return null;
    }
};
