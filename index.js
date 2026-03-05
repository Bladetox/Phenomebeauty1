
// Stock update endpoint
app.post('/api/stock/update', async (req, res) => {
  try {
    const { rowIndex, item, cost, stockOnHand, totalCost, notes } = req.body;
    
    const sheets = google.sheets({ version: 'v4', auth: await getAuthClient() });
    const sheetName = 'Stock';
    const rowNumber = rowIndex + 2; // +2 because row 0 is header, and sheets are 1-indexed
    
    const range = `${sheetName}!A${rowNumber}:E${rowNumber}`;
    const values = [[item, cost, stockOnHand, totalCost, notes]];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    
    res.json({ success: true, message: 'Stock updated' });
  } catch (error) {
    console.error('Stock update error:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});
