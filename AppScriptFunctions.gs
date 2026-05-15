function doPost(e) {
  var idFoglio = ""; //ID del tuo Google Sheets File
  var sheet = SpreadsheetApp.openById(idFoglio).getActiveSheet();
  var dati = JSON.parse(e.postData.contents);
  
  var nome = dati.nome;
  var espansione = dati.espansione;
  var lingua = dati.lingua;
  var condizione = dati.condizione;
  var rarita = dati.rarita;

  var datiFoglio = sheet.getDataRange().getValues();
  var cartaTrovata = false;

  for (var i = 1; i < datiFoglio.length; i++) {
    var rigaCorrente = datiFoglio[i];

    if (rigaCorrente[0] === nome && rigaCorrente[1] === espansione && rigaCorrente[2] === lingua && rigaCorrente[3] === condizione && rigaCorrente[4] === rarita) {
      
      var quantitaAttuale = Number(rigaCorrente[5]);
      sheet.getRange(i + 1, 6).setValue(quantitaAttuale + 1);
      
      cartaTrovata = true;
      break;
    }
  }

  if (!cartaTrovata) {
    sheet.appendRow([nome, espansione, lingua, condizione, rarita, 1]);
  }

  return ContentService.createTextOutput("Successo").setMimeType(ContentService.MimeType.TEXT);
}
