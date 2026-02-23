import { getSheetData } from "./sheet.js";

// This handler serves as your main API endpoint
export default async function handler(req, res) {
  try {
    // Replace with your actual Google Sheet ID
    const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";

    // Optional: pick a range if you want something specific
    const RANGE = "Sheet1!A1:E10";

    // Fetch data from sheet.js
    const data = await getSheetData(SPREADSHEET_ID, RANGE);

    // Respond with JSON
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
