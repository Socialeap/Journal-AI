// This service handles the Google Sign-In and authentication logic.
import { GOOGLE_CLIENT_ID } from '../config';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(overrideConfig?: { prompt?: string }): void;
      }
      interface TokenResponse {
        access_token: string;
        error?: any;
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
let authChangeCallback: (() => void) | null = null;
const HAS_SIGNED_IN_KEY = 'google_has_signed_in_once';


// The initClient now takes two callbacks to decouple client readiness from auth state.
export const initClient = (onReady: () => void, onAuthChange: () => void) => {
    authChangeCallback = onAuthChange;

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
                localStorage.setItem(HAS_SIGNED_IN_KEY, 'true');
                if (authChangeCallback) authChangeCallback();
            } else if (tokenResponse.error) {
                // This can happen if a silent login fails (e.g., expired session).
                // Treat this as being signed out.
                console.warn("Silent auth failed:", tokenResponse.error);
                accessToken = null;
                localStorage.removeItem(HAS_SIGNED_IN_KEY);
                if (authChangeCallback) authChangeCallback();
            }
        },
    });

    // On load, check if the user has signed in before.
    if (localStorage.getItem(HAS_SIGNED_IN_KEY) === 'true') {
        // An empty prompt attempts a silent, non-interactive token request.
        tokenClient.requestAccessToken({ prompt: '' });
    }
    
    // Signal that the Google client is ready to be used.
    onReady();
};

export const signIn = () => {
    if (!tokenClient) {
        throw new Error('Google API client not initialized.');
    }
    // The 'consent' prompt is important for the first time to ensure the app
    // gets a refresh token for long-term offline access.
    tokenClient.requestAccessToken({ prompt: 'consent' });
};

export const signOut = () => {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Access token revoked.');
            accessToken = null;
            localStorage.removeItem(HAS_SIGNED_IN_KEY);
            if (authChangeCallback) authChangeCallback();
        });
    } else {
        // If there's no access token, just clear the flag and notify.
        localStorage.removeItem(HAS_SIGNED_IN_KEY);
        if (authChangeCallback) authChangeCallback();
    }
};

export const getAccessToken = (): string | null => {
    return accessToken;
};

export const isUserSignedIn = (): boolean => {
    return accessToken !== null;
};

export interface DriveFile {
    id: string;
    name: string;
}

export const findJournalSheetsInDrive = async (): Promise<DriveFile[]> => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and name contains 'AI Journal Sheet' and trashed = false");
    const fields = encodeURIComponent("files(id,name)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        // Handle specific API errors for better user guidance
        if (response.status === 403) {
            const errorData = await response.json().catch(() => null); // Safely parse JSON
            // Check if the error message indicates the API is not enabled
            if (errorData?.error?.message?.includes('Drive API has not been used') || errorData?.error?.details?.[0]?.reason === 'SERVICE_DISABLED') {
                throw new Error('The Google Drive API is not enabled for this project. Please go to your Google Cloud Console, search for the "Google Drive API," and enable it.');
            }
            throw new Error('Permission denied to search Google Drive. Please try signing out and signing back in to grant the necessary permissions.');
        }

        console.error("Failed to search for files in Google Drive", response);
        throw new Error('An unexpected error occurred while searching for journal sheets in Google Drive.');
    }

    const data = await response.json();
    return data.files || [];
};