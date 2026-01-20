
// This service handles the Google Sign-In and authentication logic.
import { GOOGLE_CLIENT_ID, GOOGLE_DEVELOPER_KEY } from '../config';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';
const TOKEN_STORAGE_KEY = 'google_access_token';
const EXPIRY_STORAGE_KEY = 'google_token_expiry';

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(overrideConfig?: { prompt?: string }): void;
      }
      interface TokenResponse {
        access_token: string;
        expires_in: number;
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

// Wait for the Google Identity Services script to load
const waitForGoogleScript = (): Promise<void> => {
    return new Promise((resolve) => {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            resolve();
            return;
        }
        const interval = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
};

// Helper to save token to localStorage
const saveToken = (token: string, expiresInSeconds: number) => {
    const expiryTime = Date.now() + (expiresInSeconds * 1000);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(EXPIRY_STORAGE_KEY, expiryTime.toString());
};

// Helper to load token from localStorage
const loadToken = (): string | null => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(EXPIRY_STORAGE_KEY);
    
    if (token && expiry) {
        // Check if token is still valid (with 1 minute buffer)
        if (Date.now() < parseInt(expiry, 10) - 60000) {
            return token;
        }
    }
    // Clear if invalid or expired
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
    return null;
};

// Callback function to initialize the Google API client
export const initClient = async (callback: () => void) => {
    await waitForGoogleScript();

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                saveToken(tokenResponse.access_token, tokenResponse.expires_in || 3599);
                callback();
            }
        },
    });

    // Attempt to restore session from storage
    const storedToken = loadToken();
    if (storedToken) {
        accessToken = storedToken;
        callback();
    }
};

export const signIn = () => {
    if (!tokenClient) {
        console.error('Google API client not initialized. Waiting for script...');
        // Try to re-init if called prematurely
        initClient(() => {}).then(() => {
             tokenClient?.requestAccessToken({ prompt: 'consent' });
        });
        return;
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
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(EXPIRY_STORAGE_KEY);
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
            // Check if gapi is loaded, if not, wait a bit
             const interval = setInterval(() => {
                if (typeof (window as any).gapi !== 'undefined') {
                    clearInterval(interval);
                    (window as any).gapi.load('picker', { 'callback': () => {
                        pickerApiLoaded = true;
                        resolve();
                    }});
                }
            }, 100);
            return;
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
