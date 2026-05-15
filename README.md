# YugiScanner

YugiScanner è un'applicazione mobile sviluppata in React Native. Permette di scansionare rapidamente le carte con la fotocamera del telefono, riconoscerne il nome tramite OCR e catalogarle automaticamente in un foglio Google Sheets, aggiornando le quantità in caso di doppioni.

## Funzionalità Principali
Utilizzo della fotocamera dello smartphone per inquadrare la carta. Estrae automaticamente il nome della carta utilizzando l'API di OCR.space. 
Cerca il nome estratto nel database ufficiale di YGOPRODeck per fornire l'elenco esatto delle espansioni in cui la carta è stata stampata. Flusso in due passaggi per selezionare in modo più sicuro l'espansione, la lingua (IT/EN) e la condizione della carta (NearMint, Played, ecc.). Invio dei dati direttamente a un tuo file Google Sheets tramite Google Apps Script. Il backend gestisce automaticamente la presenza di doppioni nella collezione (raggruppati per condizione, lingua e nome).

## Stack: 
Utilizzati i linguaggi React Native, Expo, TypeScript per il frontend, il riconoscimento è realizzato grazie all'api OCR.space, Google Apps Script per il backend.
