function doPost(e) {
  var idFoglio = ""; //Your google sheets sheet id
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

function doGet(e) {
  var idFoglio = ""; //Your google sheets sheet id
  var sheet = SpreadsheetApp.openById(idFoglio).getActiveSheet();
  var datiFoglio = sheet.getDataRange().getValues();

  var stats = {
    totalScanned: 0,
    totalSold: 0,
    radarData: [0, 0, 0, 0, 0]
  };

  for (var i = 1; i < datiFoglio.length; i++) {
    var riga = datiFoglio[i];
    var condizione = riga[3];
    var quantita = Number(riga[5]) || 1;
    var venduta = riga[6] ? 1 : 0;
    stats.totalScanned += quantita;
    stats.totalSold += venduta;

    if (condizione === 'NearMint') stats.radarData[0] += quantita;
    else if (condizione === 'SlightlyPlayed') stats.radarData[1] += quantita;
    else if (condizione === 'ModeratelyPlayed') stats.radarData[2] += quantita;
    else if (condizione === 'Played') stats.radarData[3] += quantita;
    else if (condizione === 'Poor') stats.radarData[4] += quantita;
  }

  return ContentService.createTextOutput(JSON.stringify(stats)).setMimeType(ContentService.MimeType.JSON);
}
