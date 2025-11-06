
import type { JournalEntry, JournalSheet } from '../types';
import * as GoogleApiService from './googleApiService';

const SHEETS_API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3/files';
const SHEET_NAME = 'Journal'; // Convention for the sheet tab name
const FOLDER_NAME = 'AI Journal';

// Helper to construct API URLs dynamically
const getSheetsApiUrl = (spreadsheetId: string, path: string) => `${SHEETS_API_BASE_URL}/${spreadsheetId}${path}`;

// Gets the ID of the 'AI Journal' folder, creating it if it doesn't exist.
// This function is now self-healing: it verifies the stored ID is valid before using it.
const getOrCreateJournalFolderId = async (): Promise<string> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    let storedFolderId = localStorage.getItem('aiJournalFolderId');

    // If we have a stored ID, verify it still exists in Google Drive.
    if (storedFolderId) {
        const verifyResponse = await fetch(`${DRIVE_API_BASE_URL}/${storedFolderId}?fields=id`, {
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
        const createFolderResponse = await fetch(DRIVE_API_BASE_URL, {
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
    const createSheetResponse = await fetch(DRIVE_API_BASE_URL, {
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

    const batchUpdateResponse = await fetch(getSheetsApiUrl(spreadsheetId, ':batchUpdate'), {
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

export const findJournalSheetsInDrive = async (): Promise<JournalSheet[]> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const folderQuery = "mimeType='application/vnd.google-apps.folder' and name='AI Journal' and trashed=false";
    const folderSearchUrl = `${DRIVE_API_BASE_URL}?q=${encodeURIComponent(folderQuery)}&fields=files(id)`;
    
    const folderResponse = await fetch(folderSearchUrl, {
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
    
    const sheetsResponse = await fetch(sheetSearchUrl, {
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

// Maps a row from Google Sheets (array of strings) to a JournalEntry object
const mapRowToEntry = (row: any[], index: number): JournalEntry => {
    const [
        id = '',
        timestamp = new Date().toISOString(),
        entry = '',
        tags = '',
        type = 'note',
        taskStatus = 'none',
        dueDate = null,
        priority = 'none',
        aiSummary = null,
        aiInsight = null
    ] = row;

    const parsedTags = tags ? String(tags).split(',').map(t => t.trim()) : [];
    const hasAiContent = aiSummary || aiInsight;

    return {
        row: index + 2, // +1 for 0-based index, +1 for header row
        id,
        timestamp,
        entry,
        tags: parsedTags,
        type: type as JournalEntry['type'],
        taskStatus: taskStatus as JournalEntry['taskStatus'],
        dueDate,
        priority: priority as JournalEntry['priority'],
        aiSummary,
        aiInsight,
        status: hasAiContent ? 'complete' : 'new',
    };
};


export const getJournalEntries = async (spreadsheetId: string): Promise<JournalEntry[]> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const response = await fetch(getSheetsApiUrl(spreadsheetId, `/values/${SHEET_NAME}!A:J`), {
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
        throw new Error('Failed to fetch from Google Sheets');
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

    const range = `${SHEET_NAME}!${column}${row}`;
    const response = await fetch(getSheetsApiUrl(spreadsheetId, `/values/${range}?valueInputOption=USER_ENTERED`), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [[value]] }),
    });

    if (!response.ok) {
        throw new Error(`Failed to update field ${field} in Google Sheets.`);
    }
};



export const addJournalEntry = async (spreadsheetId: string, id: string, entryText: string): Promise<void> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const timestamp = new Date().toISOString();
    const values = [
        [id, timestamp, entryText, '', 'note', 'none', null, 'none', null, null]
    ];

    const response = await fetch(getSheetsApiUrl(spreadsheetId, `/values/${SHEET_NAME}!A:J:append?valueInputOption=USER_ENTERED`), {
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

    // Prepare the row data for the update. We are updating columns D through J.
    const values = [[
        aiData.tags.join(', '),
        aiData.type,
        aiData.taskStatus,
        aiData.dueDate,
        aiData.priority,
        aiData.summary,
        aiData.insight
    ]];

    const range = `${SHEET_NAME}!D${entry.row}:J${entry.row}`;

    const response = await fetch(getSheetsApiUrl(spreadsheetId, `/values/${range}?valueInputOption=USER_ENTERED`), {
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
