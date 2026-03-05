
const { google } = require('googleapis');

// Stock update endpoint
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'PUT') {
    try {
      const { rowIndex, item, cost, stockOnHand, totalCost, notes } = req.body;
      
      // Initialize Google Sheets
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = process.env.SPREADSHEET_ID;
      
      // Update the specific row (rowIndex + 2 because of header and 0-indexing)
      const range = `Stock!A${rowIndex + 2}:E${rowIndex + 2}`;
      const values = [[item, cost, stockOnHand, totalCost, notes]];
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      
      return res.status(200).json({ success: true, message: 'Stock updated successfully' });
    } catch (error) {
      console.error('Stock update error:', error);
      return res.status(500).json({ error: 'Failed to update stock: ' + error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
