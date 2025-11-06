// TODO: Replace with your actual Google Cloud Client ID.

// 1. Get your Google Cloud Client ID.
//    - Go to https://console.cloud.google.com/apis/credentials
//    - Create an "OAuth 2.0 Client ID" for a "Web application".
//    - Copy the Client ID here.
export const GOOGLE_CLIENT_ID = '562552051436-ivq953n032gbnb8m0tofem38co0is8bd.apps.googleusercontent.com';

// --- TROUBLESHOOTING ---
// If you get a "400 Bad Request" or "origin_mismatch" error during sign-in:
//
// This is the most common setup issue. It means the URL you are running the app from
// has NOT been added to the list of authorized domains in your Google Cloud project.
//
// To fix this:
// 1. Copy the FULL URL from your browser's address bar where you are running the app.
//    (e.g., "http://localhost:5173" or "https://your-deployment-url.com")
//
// 2. Go back to your Google Cloud credentials page:
//    https://console.cloud.google.com/apis/credentials
//
// 3. Click the name of your OAuth 2.0 Client ID to edit it.
//
// 4. Under "Authorized JavaScript origins", click "+ ADD URI".
//
// 5. Paste the URL you copied in step 1.
//
// 6. Click "Save". It might take a few minutes for the changes to take effect.
// ---

// --- Google Picker API Key ---
// TODO: Replace with your actual Google Developer API Key.
// This key is required to use the Google Picker API (the file open dialog).
//
// To get this key:
// 1. Go to https://console.cloud.google.com/apis/credentials
// 2. Click "+ CREATE CREDENTIALS" and select "API key".
// 3. Copy the key and paste it here.
// 4. (Recommended) Restrict the key. Click the key name, and under
//    "API restrictions", select "Restrict key" and choose "Google Picker API".
export const GOOGLE_DEVELOPER_KEY = 'YOUR_DEVELOPER_KEY_HERE';


// NOTE: The Spreadsheet ID is no longer configured here.
// The application will now ask each user for their own Spreadsheet URL
// after they sign in for the first time.