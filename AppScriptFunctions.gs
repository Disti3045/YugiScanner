function doPost(e) {
  var idFoglio = ""; //ID del tuo Google Sheets File
  var sheet = SpreadsheetApp.openById(idFoglio).getActiveSheet();
  var dati = JSON.parse(e.postData.contents);
  
  var nome = dati.nome;
  var espansione = dati.espansione;
  var lingua = dati.lingua;
  var condizione = dati.condizione;

  var datiFoglio = sheet.getDataRange().getValues();
  var cartaTrovata = false;

  for (var i = 1; i < datiFoglio.length; i++) {
    var rigaCorrente = datiFoglio[i];

    if (rigaCorrente[0] === nome && rigaCorrente[1] === espansione && rigaCorrente[2] === lingua && rigaCorrente[3] === condizione) {
      
      var quantitaAttuale = Number(rigaCorrente[4]);
      var nuovaQuantita = quantitaAttuale + 1;
      
      sheet.getRange(i + 1, 5).setValue(nuovaQuantita);
      
      cartaTrovata = true;
      break;
    }
  }

  if (!cartaTrovata) {
    sheet.appendRow([nome, espansione, lingua, condizione, 1]);
  }

  return ContentService.createTextOutput("Successo").setMimeType(ContentService.MimeType.TEXT);
}
