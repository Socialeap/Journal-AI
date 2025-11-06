// This service handles the Google Sign-In and authentication logic.
import { GOOGLE_CLIENT_ID, GOOGLE_DEVELOPER_KEY } from '../config';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';

// FIX: Replaced `declare const google: any` with a more specific type declaration
// for the Google Identity Services client to resolve TypeScript errors.
// This object is provided by the Google Identity Services script loaded in the browser.
declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(overrideConfig?: { prompt?: string }): void;
      }
      interface TokenResponse {
        access_token: string;
      }
      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (tokenResponse: TokenResponse) => void;
      }
      function initTokenClient(config: TokenClientConfig): TokenClient;
      function revoke(accessToken: string, callback: () => void): void;
    }
  }
}

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;

// Callback function to initialize the Google API client
export const initClient = (callback: () => void) => {
    if (typeof google === 'undefined' || typeof google.accounts === 'undefined') {
        console.error("Google Identity Services script not loaded.");
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                callback();
            }
        },
    });
};

export const signIn = () => {
    if (!tokenClient) {
        throw new Error('Google API client not initialized.');
    }
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({ prompt: 'consent' });
};

export const signOut = () => {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Access token revoked.');
        });
        accessToken = null;
    }
};

export const getAccessToken = (): string | null => {
    return accessToken;
};

export const isUserSignedIn = (): boolean => {
    return accessToken !== null;
};

// --- Google Picker API Functions ---

let pickerApiLoaded = false;

// Loads the Google Picker API script
const loadPickerApi = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (typeof (window as any).gapi === 'undefined') {
            return reject(new Error("Google API script (gapi) not loaded."));
        }
        (window as any).gapi.load('picker', { 'callback': () => {
            pickerApiLoaded = true;
            resolve();
        }});
    });
};

// Shows the Google Picker dialog and returns the selected sheet
export const showPicker = async (): Promise<{id: string, name: string}> => {
    if (!pickerApiLoaded) {
        await loadPickerApi();
    }
    
    const token = getAccessToken();
    const developerKey = GOOGLE_DEVELOPER_KEY;

    if (!token) {
        throw new Error("Authentication token not found.");
    }
    if (!developerKey || developerKey === 'YOUR_DEVELOPER_KEY_HERE') {
        throw new Error("Google Developer Key is not configured in config.ts. Please add it to enable file selection.");
    }

    return new Promise((resolve, reject) => {
        const view = new (window as any).google.picker.View((window as any).google.picker.ViewId.SPREADSHEETS);
        
        const picker = new (window as any).google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(token)
            .setDeveloperKey(developerKey)
            .setCallback((data: any) => {
                const action = data[(window as any).google.picker.Response.ACTION];
                if (action === (window as any).google.picker.Action.PICKED) {
                    const doc = data[(window as any).google.picker.Response.DOCUMENTS][0];
                    const id = doc[(window as any).google.picker.Document.ID];
                    const name = doc[(window as any).google.picker.Document.NAME];
                    resolve({ id, name });
                } else if (action === (window as any).google.picker.Action.CANCEL) {
                    reject(new Error("User cancelled the file selection."));
                }
            })
            .build();
        picker.setVisible(true);
    });
};
