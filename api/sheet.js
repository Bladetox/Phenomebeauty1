import { google } from "googleapis";

// 1️⃣ Read the service account JSON from Vercel environment
const serviceAccountJson = process.env.GOOGLE_SERVICE_KEY;

if (!serviceAccountJson) {
  throw new Error(
    "GOOGLE_SERVICE_KEY is not set in Vercel environment variables."
  );
}

// 2️⃣ Parse it to get the credentials
const serviceAccount = JSON.parse(serviceAccountJson);

// 3️⃣ Setup Google Sheets auth
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// 4️⃣ Function to fetch sheet data
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

// 5️⃣ Optional: export a handler if you want a direct API endpoint
export default async function handler(req, res) {
  try {
    const data = await getSheetData("1G4pWPXsqCkUlpuEhmRT5sj7GE6NOxcp_OSCs1wqrRfk"); // Replace with your actual ID
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
