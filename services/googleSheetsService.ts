import type { JournalEntry } from '../types';
import * as GoogleApiService from './googleApiService';

const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET_NAME = 'Journal'; // Convention for the sheet tab name

// Helper to construct API URLs dynamically
const getApiUrl = (spreadsheetId: string, path: string) => `${API_BASE_URL}/${spreadsheetId}${path}`;

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

export const createJournalSheet = async (): Promise<string> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    // 1. Create the spreadsheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            properties: {
                title: 'AI Journal Sheet'
            }
        })
    });

    if (!createResponse.ok) {
        throw new Error('Failed to create Google Sheet. Please ensure you have granted Google Drive permissions.');
    }

    const newSheet = await createResponse.json();
    const spreadsheetId = newSheet.spreadsheetId;

    // 2. Batch update to rename sheet and add headers
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
            }
        ]
    };

    const batchUpdateResponse = await fetch(getApiUrl(spreadsheetId, ':batchUpdate'), {
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


export const getJournalEntries = async (spreadsheetId: string): Promise<JournalEntry[]> => {
    const accessToken = GoogleApiService.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const response = await fetch(getApiUrl(spreadsheetId, `/values/${SHEET_NAME}!A:J`), {
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


export const findEntries = async (
    spreadsheetId: string, 
    query: string,
    startDate?: string,
    endDate?: string
): Promise<JournalEntry[]> => {
    let entries = await getJournalEntries(spreadsheetId);

    // 1. Filter by text query if provided
    if (query) {
        const lowerCaseQuery = query.toLowerCase();
        entries = entries.filter(entry => entry.entry.toLowerCase().includes(lowerCaseQuery));
    }

    // 2. Filter by date range if provided
    if (startDate || endDate) {
        entries = entries.filter(entry => {
            if (!entry.dueDate) {
                return false; // Entry must have a due date to be included in date range search
            }
            try {
                // A simple string comparison works for YYYY-MM-DD format.
                const entryDueDate = entry.dueDate;
                const isAfterStartDate = startDate ? entryDueDate >= startDate : true;
                const isBeforeEndDate = endDate ? entryDueDate <= endDate : true;
                return isAfterStartDate && isBeforeEndDate;
            } catch (e) {
                // If date parsing fails, exclude the entry from the results.
                console.warn(`Could not parse due date "${entry.dueDate}" for an entry.`, e);
                return false;
            }
        });
    }

    // If no filters were applied at all, return the 5 most recent entries
    if (!query && !startDate && !endDate) {
        return entries.slice(0, 5);
    }
    
    return entries;
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
    const response = await fetch(getApiUrl(spreadsheetId, `/values/${range}?valueInputOption=USER_ENTERED`), {
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

    const response = await fetch(getApiUrl(spreadsheetId, `/values/${SHEET_NAME}!A:J:append?valueInputOption=USER_ENTERED`), {
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

    const response = await fetch(getApiUrl(spreadsheetId, `/values/${range}?valueInputOption=USER_ENTERED`), {
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