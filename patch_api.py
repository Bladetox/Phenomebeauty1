import shutil, pathlib
FILE = pathlib.Path('api/index.js')
shutil.copy(FILE, FILE.with_suffix('.js.bak'))
src = FILE.read_text(encoding='utf-8')
ANCHOR = 'module.exports = app;'
NEW = """
app.get('/api/admin/loyalty', adminOnly, async (req, res) => {
    try {
        const sheet = req.doc.sheetsByTitle['Loyalty Tracker'];
        if (!sheet) return res.json([]);
        const rows = await sheet.getRows();
        res.json(rows.filter(r=>(r.get('Client Name')||'').trim()).map(r=>({
            clientName:r.get('Client Name')||'',whatsappLink:r.get('WhatsApp Link')||'',
            phone:r.get('Phone Number')||'',packProgress:r.get('Pack Progress')||'',
            lastWaxDate:r.get('Last Wax Date')||'',nextDueDate:r.get('Next Due Date')||'',
            status:r.get('Status')||'',notes:r.get('Notes')||'',location:r.get('Location')||''
        })));
    } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/admin/stock', adminOnly, async (req, res) => {
    try {
        const sheet = req.doc.sheetsByTitle['Stock'];
        if (!sheet) return res.json([]);
        const rows = await sheet.getRows();
        res.json(rows.filter(r=>(r.get('Product Name')||r.get('Item')||r.get('Name')||'').trim()).map(r=>({
            name:r.get('Product Name')||r.get('Item')||r.get('Name')||'',
            category:r.get('Category')||'',quantity:r.get('Quantity')||r.get('Stock')||'0',
            minStock:r.get('Min Stock')||r.get('Minimum')||'0',unit:r.get('Unit')||'',notes:r.get('Notes')||''
        })));
    } catch(e){res.status(500).json({error:e.message});}
});
"""
if '/api/admin/loyalty' in src:
    print('[=] Already patched')
else:
    src = src.replace(ANCHOR, NEW + ANCHOR)
    FILE.write_text(src, encoding='utf-8')
    print('[+] Endpoints added. Backup: api/index.js.bak')
