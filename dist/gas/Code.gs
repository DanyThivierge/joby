// Code.gs — Google Apps Script entry point for Joby
// Deploy as a Web App: Deploy → New deployment → Web app → Execute as Me → Anyone
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Joby | TELUS Health')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
