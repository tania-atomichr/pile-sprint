// Google Sheets as the pile and the place the answers go back to.
// Extensions > Apps Script, paste this, Deploy > New deployment > Web app (execute as you, access: anyone with the
// link, or your domain). Then point fromEndpoint() and webhook() at the web app URL.
//
// The first row of the sheet is the header: id, title, subtitle, body, then any columns you like.
// Saving writes the answer into a column called "decision" (made if it is missing).

const SHEET = 'Pile';

function doGet() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const [head, ...rows] = sh.getDataRange().getValues();
  const col = head.indexOf('decision');
  const items = rows
    .filter(r => col < 0 || !r[col])                 // only rows nobody decided yet
    .map(r => {
      const o = { fields: [] };
      head.forEach((h, i) => {
        if (['id', 'title', 'subtitle', 'body', 'image', 'link'].includes(h)) o[h] = String(r[i]);
        else if (h !== 'decision' && r[i] !== '') o.fields.push([h, String(r[i])]);
      });
      return o;
    });
  return ContentService.createTextOutput(JSON.stringify({ items })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);       // { format: "pile-sprint/1", decisions: [{ id, decision }] }
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const values = sh.getDataRange().getValues();
  const head = values[0];
  let col = head.indexOf('decision');
  if (col < 0) { col = head.length; sh.getRange(1, col + 1).setValue('decision'); }
  const idCol = head.indexOf('id');
  const byId = {};
  body.decisions.forEach(d => { if (d.decision !== 'later') byId[d.id] = d.decision; });
  values.slice(1).forEach((r, i) => {
    if (byId[String(r[idCol])]) sh.getRange(i + 2, col + 1).setValue(byId[String(r[idCol])]);
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
