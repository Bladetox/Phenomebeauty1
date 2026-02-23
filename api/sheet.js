import { google } from "googleapis";

// Read the service account from environment variable
const serviceAccountJson = process.env.GOOGLE_SERVICE_KEY;
if (!serviceAccountJson) {
  throw new Error("GOOGLE_SERVICE_KEY is not set in Vercel environment variables.");
}

// Parse JSON to get credentials
const serviceAccount = JSON.parse(serviceAccountJson);

// Setup Google Sheets auth
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// Example function to get sheet data
export async function getSheetData(spreadsheetId, range = "Sheet1!A1:E10") {
  try {
    const client = await auth.getClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      auth: client,
    });
    return response.data.values;
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw error;
  }
}

// Example API handler to use in index.js or a separate endpoint
export default async function handler(req, res) {
  try {
    const data = await getSheetData("YOUR_SPREADSHEET_ID"); // replace with your ID
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
