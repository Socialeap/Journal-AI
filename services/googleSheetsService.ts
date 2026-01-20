
import type { JournalEntry, JournalSheet } from '../types';
import * as GoogleApiService from './googleApiService';

const SHEETS_API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3/files';
const SHEET_NAME = 'Journal'; // Convention for the sheet tab name
const FOLDER_NAME = 'AI Journal';

// Helper to construct API URLs dynamically
const getSheetsApiUrl = (spreadsheetId: string, path: string) => `${SHEETS_API_BASE_URL}/${spreadsheetId}${path}`;

// Retry helper for robust API calls
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        
        // If successful, return immediately
        if (response.ok) return response;
        
        // If client error (4xx) other than 429, do not retry.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            return response;
        }

        // Retry on 5xx (server errors) or 429 (rate limiting)
        if (retries > 0) {
            console.warn(`Request failed with status ${response.status}. Retrying in ${backoff}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        
        return response;
    } catch (error) {
        // Retry on network errors (e.g., DNS failure, offline)
        if (retries > 0) {
            console.warn(`Network request failed. Retrying in ${backoff}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw error;
    }
};

// Gets the ID of the 'AI Journal' folder, creating it if it doesn't exist.
// This function is now self-healing: it verifies the stored ID is valid before using it.
const getOrCreateJournalFolderId = async (): Promise<string> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    let storedFolderId = localStorage.getItem('aiJournalFolderId');

    // If we have a stored ID, verify it still exists in Google Drive.
    if (storedFolderId) {
        const verifyResponse = await fetchWithRetry(`${DRIVE_API_BASE_URL}/${storedFolderId}?fields=id`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        // If verification fails (e.g., 404), the folder was deleted. Clear the bad ID.
        if (!verifyResponse.ok) {
            console.warn("Verification of stored folder ID failed. The folder may have been deleted. A new one will be created.");
            localStorage.removeItem('aiJournalFolderId');
            storedFolderId = null;
        }
    }

    // If we don't have a valid ID by now, create a new folder.
    if (!storedFolderId) {
        console.log("Creating new 'AI Journal' folder in Google Drive.");
        const createFolderResponse = await fetchWithRetry(DRIVE_API_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
            }),
        });
        
        if (!createFolderResponse.ok) {
            throw new Error('Failed to create "AI Journal" folder in Google Drive.');
        }

        const folder = await createFolderResponse.json();
        localStorage.setItem('aiJournalFolderId', folder.id);
        return folder.id;
    }
    
    return storedFolderId;
};


export const createJournalSheet = async (journalName: string): Promise<string> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const folderId = await getOrCreateJournalFolderId();

    // 1. Create the spreadsheet within the folder using the Drive API
    const createSheetResponse = await fetchWithRetry(DRIVE_API_BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: journalName,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [folderId],
        }),
    });

    if (!createSheetResponse.ok) {
        throw new Error('Failed to create Google Sheet. Please ensure you have granted Google Drive permissions.');
    }

    const newSheet = await createSheetResponse.json();
    const spreadsheetId = newSheet.id;

    // 2. Format the newly created sheet using the Sheets API
    const headers = [
        "ID", "Date Created", "Entry", "Tags", "Type", "Status",
        "Due Date", "Priority", "AI Summary", "AI Insight"
    ];

    const batchUpdateRequest = {
        requests: [
            {
                updateSheetProperties: {
                    properties: { sheetId: 0, title: SHEET_NAME },
                    fields: 'title',
                }
            },
            {
                updateCells: {
                    start: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
                    rows: [{
                        values: headers.map(header => ({
                            userEnteredValue: { stringValue: header },
                            userEnteredFormat: { textFormat: { bold: true } }
                        }))
                    }],
                    fields: 'userEnteredValue,userEnteredFormat.textFormat.bold',
                }
            },
            // Validation for Status (Column F / Index 5)
            {
                setDataValidation: {
                    range: {
                        sheetId: 0,
                        startRowIndex: 1, // Start after header
                        startColumnIndex: 5, // Column F
                        endColumnIndex: 6,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: 'Pending ✨' },
                                { userEnteredValue: 'Extended ⏳' },
                                { userEnteredValue: 'Completed ✔️' },
                                { userEnteredValue: 'Neglected ⚠️' },
                                { userEnteredValue: 'Archived 🗄️' },
                            ]
                        },
                        strict: false, 
                        showCustomUi: true,
                    }
                }
            },
            // Validation for Priority (Column H / Index 7)
            {
                setDataValidation: {
                    range: {
                        sheetId: 0,
                        startRowIndex: 1, // Start after header
                        startColumnIndex: 7, // Column H
                        endColumnIndex: 8,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: 'Critical' },
                                { userEnteredValue: 'High' },
                                { userEnteredValue: 'Medium' },
                                { userEnteredValue: 'Low' },
                            ]
                        },
                        strict: true,
                        showCustomUi: true,
                    }
                }
            }
        ]
    };

    const batchUpdateResponse = await fetchWithRetry(getSheetsApiUrl(spreadsheetId, ':batchUpdate'), {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchUpdateRequest)
    });

    if (!batchUpdateResponse.ok) {
        throw new Error('Created sheet but failed to format it. Please try again.');
    }
    
    return spreadsheetId;
};

// Lists ALL spreadsheets visible to the user, ordered by last modified.
// Used for the custom file picker.
export const listAllSpreadsheets = async (): Promise<JournalSheet[]> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    // Query for all spreadsheets, not trashed
    const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
    const searchUrl = `${DRIVE_API_BASE_URL}?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,modifiedTime)`;
    
    const response = await fetchWithRetry(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch files from Google Drive.');
    }

    const data = await response.json();
    if (!data.files) {
        return [];
    }

    return data.files.map((file: { id: string; name: string }) => ({ id: file.id, name: file.name }));
};

export const findJournalSheetsInDrive = async (): Promise<JournalSheet[]> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const folderQuery = "mimeType='application/vnd.google-apps.folder' and name='AI Journal' and trashed=false";
    const folderSearchUrl = `${DRIVE_API_BASE_URL}?q=${encodeURIComponent(folderQuery)}&fields=files(id)`;
    
    const folderResponse = await fetchWithRetry(folderSearchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!folderResponse.ok) throw new Error('Failed to search for AI Journal folder.');
    
    const folderData = await folderResponse.json();
    if (!folderData.files || folderData.files.length === 0) {
        console.log("AI Journal folder not found. No journals to discover.");
        return [];
    }
    
    const folderId = folderData.files[0].id;

    const sheetQuery = `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const sheetSearchUrl = `${DRIVE_API_BASE_URL}?q=${encodeURIComponent(sheetQuery)}&fields=files(id,name)`;
    
    const sheetsResponse = await fetchWithRetry(sheetSearchUrl, {
         headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!sheetsResponse.ok) throw new Error('Failed to search for journals in folder.');
    
    const sheetsData = await sheetsResponse.json();
    if (!sheetsData.files) {
        return [];
    }

    return sheetsData.files.map((file: { id: string; name: string }) => ({ id: file.id, name: file.name }));
};

const COLUMN_MAP: { [key: string]: string } = {
    id: 'A',
    timestamp: 'B',
    entry: 'C',
    tags: 'D',
    type: 'E',
    taskStatus: 'F',
    dueDate: 'G',
    priority: 'H',
    aiSummary: 'I',
    aiInsight: 'J'
};

// Helper function to normalize priority values for app usage (lowercase)
const normalizePriority = (p: string | null): JournalEntry['priority'] => {
    if (!p) return 'none';
    const lower = p.toLowerCase();
    if (['high', 'medium', 'low', 'none'].includes(lower)) return lower as JournalEntry['priority'];
    return 'none';
};

// Helper function to format priority values for Google Sheets (Capitalized)
// This ensures we match the Data Validation rules: Critical, High, Medium, Low
const formatPriorityForSheet = (p: string | null | undefined): string => {
    if (!p || p.toLowerCase() === 'none') return ''; // Return empty string for 'none' to avoid validation errors
    // Capitalize first letter
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};


// Maps a row from Google Sheets (array of strings) to a JournalEntry object
const mapRowToEntry = (row: any[], index: number): JournalEntry => {
    const [
        id = '',
        timestamp = new Date().toISOString(),
        entry = '',
        tags = '',
        type = 'note',
        rawStatus = 'none',
        dueDate = null,
        priority = 'none',
        aiSummary = null,
        aiInsight = null
    ] = row;

    const parsedTags = tags ? String(tags).split(',').map(t => t.trim()) : [];
    const hasAiContent = aiSummary || aiInsight;

    // Migrate old values to new Emoji values if necessary
    let taskStatus = rawStatus;
    if (taskStatus === 'todo') taskStatus = 'Pending ✨';
    if (taskStatus === 'in-progress') taskStatus = 'Pending ✨'; // Map old in-progress to Pending for simplicity
    if (taskStatus === 'NEW ✨') taskStatus = 'Pending ✨'; // Migration from previous step
    if (taskStatus === 'done') taskStatus = 'Completed ✔️';
    
    // Auto-detect "Neglected ⚠️"
    // If there is a due date, it's not completed/archived, and the date is in the past.
    if (dueDate && taskStatus !== 'Completed ✔️' && taskStatus !== 'Archived 🗄️') {
        const today = new Date();
        today.setHours(0,0,0,0);
        const due = new Date(dueDate);
        // We compare timestamps to avoid timezone complexity issues for simple dates
        if (!isNaN(due.getTime()) && due < today) {
            taskStatus = 'Neglected ⚠️';
        }
    }

    return {
        row: index + 2, // +1 for 0-based index, +1 for header row
        id,
        timestamp,
        entry,
        tags: parsedTags,
        type: type as JournalEntry['type'],
        taskStatus: taskStatus as JournalEntry['taskStatus'],
        dueDate,
        priority: normalizePriority(priority),
        aiSummary,
        aiInsight,
        status: hasAiContent ? 'complete' : 'new',
    };
};


export const getJournalEntries = async (spreadsheetId: string): Promise<JournalEntry[]> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const response = await fetchWithRetry(getSheetsApiUrl(spreadsheetId, `/values/${SHEET_NAME}!A:J`), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        if (response.status === 400) {
            throw new Error(`Failed to read the sheet. This is usually due to a missing or incorrect header row. Please ensure your sheet has a tab named "Journal" with the exact 10 columns specified in the setup instructions.`);
        }
        if (response.status === 403) {
            throw new Error(`Permission denied. Make sure you have enabled the Google Sheets API in your Google Cloud project.`);
        }
        if (response.status === 404) {
             throw new Error(`Spreadsheet not found. Make sure the ID is correct.`);
        }
        if (response.status === 503) {
            throw new Error(`Google Sheets Service Unavailable (503). Please try again later.`);
        }
        throw new Error(`Failed to fetch from Google Sheets (Status: ${response.status})`);
    }

    const data = await response.json();
    if (!data.values || data.values.length <= 1) {
        return []; // No entries beyond the header
    }

    // Skip header row (index 0)
    const entries = data.values.slice(1)
        .map(mapRowToEntry)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return entries;
};


export const findEntries = async (spreadsheetId: string, query: string): Promise<JournalEntry[]> => {
    const allEntries = await getJournalEntries(spreadsheetId);
    if (!query) {
        // If no query, return the 5 most recent entries
        return allEntries.slice(0, 5);
    }
    const lowerCaseQuery = query.toLowerCase();
    return allEntries.filter(entry => entry.entry.toLowerCase().includes(lowerCaseQuery));
};


export const updateJournalEntry = async (
    spreadsheetId: string,
    row: number,
    field: keyof typeof COLUMN_MAP,
    value: string | null
): Promise<void> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const column = COLUMN_MAP[field];
    if (!column) {
        throw new Error(`Invalid field provided for update: ${field}`);
    }

    let valueToSend = value;
    // Special handling for Priority to ensure it matches Data Validation (Capitalized)
    if (field === 'priority') {
        valueToSend = formatPriorityForSheet(value);
    }

    const range = `${SHEET_NAME}!${column}${row}`;
    const response = await fetchWithRetry(getSheetsApiUrl(spreadsheetId, `/values/${range}?valueInputOption=USER_ENTERED`), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [[valueToSend]] }),
    });

    if (!response.ok) {
        throw new Error(`Failed to update field ${field} in Google Sheets.`);
    }
};

export interface EntryMetadata {
    type?: JournalEntry['type'];
    taskStatus?: JournalEntry['taskStatus'];
    priority?: JournalEntry['priority'];
    dueDate?: string | null;
}

/**
 * Appends a journal entry and returns the row number where it was added.
 */
export const addJournalEntry = async (
    spreadsheetId: string, 
    id: string, 
    entryText: string,
    metadata: EntryMetadata = {}
): Promise<number> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const timestamp = new Date().toISOString();
    
    // Extract metadata with defaults
    const { 
        type = 'note', 
        taskStatus = 'none', 
        priority = 'none', 
        dueDate = null 
    } = metadata;

    const formattedPriority = formatPriorityForSheet(priority);

    const values = [
        [id, timestamp, entryText, '', type, taskStatus, dueDate, formattedPriority, null, null]
    ];

    const response = await fetchWithRetry(getSheetsApiUrl(spreadsheetId, `/values/${SHEET_NAME}!A:J:append?valueInputOption=USER_ENTERED`), {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
    });

    if (!response.ok) {
        throw new Error('Failed to add entry to Google Sheets');
    }

    const json = await response.json();
    // Parse the updatedRange to get the row number (e.g., "Journal!A10:J10")
    // Format is usually SheetName!ColRow:ColRow
    const range: string = json.updates?.updatedRange || '';
    const match = range.match(/[A-Z]+(\d+)/);
    
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    
    // Fallback if parsing fails (should rarely happen if API is standard)
    throw new Error('Entry added, but could not determine row number.');
};

export const updateEntryWithAI = async (
    spreadsheetId: string,
    entry: JournalEntry,
    aiData: {
        summary: string;
        insight: string;
        tags: string[];
        type: JournalEntry['type'];
        taskStatus: JournalEntry['taskStatus'];
        dueDate: string | null;
        priority: JournalEntry['priority'];
    }
): Promise<void> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    // MAPPING: Ensure AI 'todo' or 'done' maps to new Emoji strings
    // Note: The calling code (JournalView) now handles the mapping from 'todo' -> 'Pending ✨', etc.
    // before calling this function. We just rely on aiData.taskStatus being the correct enum value.
    const statusToSave = aiData.taskStatus;

    // Prepare the row data for the update. We are updating columns D through J.
    const values = [[
        aiData.tags.join(', '),
        aiData.type,
        statusToSave,
        aiData.dueDate,
        formatPriorityForSheet(aiData.priority), // Format priority for sheet
        aiData.summary,
        aiData.insight
    ]];

    const range = `${SHEET_NAME}!D${entry.row}:J${entry.row}`;

    const response = await fetchWithRetry(getSheetsApiUrl(spreadsheetId, `/values/${range}?valueInputOption=USER_ENTERED`), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
    });

    if (!response.ok) {
        throw new Error('Failed to update entry in Google Sheets');
    }
};
