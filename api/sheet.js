const { GoogleSpreadsheet } = require('google-spreadsheet');

async function handleSheet() {
  const doc = new GoogleSpreadsheet('1G4pWPXsqCkUlpuEhmRT5sj7GE6NOxcp_OSCs1wqrRfk'); // Your Sheet ID
  // Auth added later; skip for now

  await doc.loadInfo(); // Loads document metadata, including all sheets

  // Access by title (recommended—human-readable, from your data: Settings, Services, Bookings, Availability)
  const settingsSheet = doc.sheetsByTitle['Settings'];
  const servicesSheet = doc.sheetsByTitle['Services'];
  const bookingsSheet = doc.sheetsByTitle['Bookings'];
  const availabilitySheet = doc.sheetsByTitle['Availability'];

  // Or by index (0-based, matches your data: Settings=0, Services=1, etc.)
  // const settingsSheet = doc.sheetsByIndex[0];

  // Or by GID (internal sheet ID, e.g., from URL #gid=1016178406 for one tab)
  // const someSheet = doc.sheetsById['1016178406']; // Replace with actual GID if needed

  // Example: Read rows from each (adapt to your GAS logic, e.g., get settings values)
  await settingsSheet.loadCells('A1:C16'); // Load specific range for efficiency
  const calendarName = settingsSheet.getCellByA1('B2').value; // e.g., 'phenomebeautys@gmail.com'
  console.log('Calendar Name:', calendarName);

  const servicesRows = await servicesSheet.getRows(); // All rows, like getDataRange().getValues()
  console.log('First Service:', servicesRows[0]); // { ID: 'S001', Name: 'Hollywood', ... }

  // Add a booking row (example)
  await bookingsSheet.addRow({
    'Booking ID': 'BKG-EXAMPLE',
    'Date': new Date().toISOString(),
    // Add other columns as needed
  });

  // Check availability (example read)
  const availRows = await availabilitySheet.getRows();
  console.log('Monday Slot:', availRows[0].get('Time Slot')); // '19:00-20:00'
}

handleSheet().catch(console.error);
