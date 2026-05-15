import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, ActivityIndicator, TextInput, Alert, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const OCR_SPACE_API_KEY = ''; //Your Api Key from OCR.space
const GOOGLE_SHEETS_URL = ''; //Your web URL from Google Script

/*Im the first one that changes idea on colors, 
so this section its dedicated to assigning colors quickly and universally for the whole app*/
const COLORS = {
  background: '#27272A',
  surface: '#646771',
  surfaceLight: '#27272A',
  textPrimary: '#FFFFFF',
  textSecondary: '#888E9B',
  primary: '#C2FD03',
  textOnPrimary: '#0A0000',
  danger: '#D62424',
  buttonNormal: '#3F3F47',
  border: '#3F3F47'
};

/*the entire code is in Italian because i am Italian and i wanted to quickly debug everything without 
losing my mind over translation. Still i'll add in the documentation a quick description of every function in English.*/
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [foto, setFoto] = useState<any>(null);
  
  const [caricamento, setCaricamento] = useState(false);
  const [testoCaricamento, setTestoCaricamento] = useState('');
  
  const [nomeCarta, setNomeCarta] = useState('');
  const [espansioni, setEspansioni] = useState<any[]>([]);
  const [espansioneSelezionata, setEspansioneSelezionata] = useState('');
  
  const [lingua, setLingua] = useState('IT'); 
  const [condizione, setCondizione] = useState('');
  const [rarita, setRarita] = useState('');
  const [isGold, setIsGold] = useState(false);

  const [toastVisibile, setToastVisibile] = useState(false);
  const animazioneOpacita = useRef(new Animated.Value(0)).current; 

  const cameraRef = useRef<any>(null);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Per scansionare le carte serve il permesso della fotocamera.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Concedi Permesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mostraToastSuccesso = () => {
    setToastVisibile(true);
    Animated.sequence([
      Animated.timing(animazioneOpacita, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(animazioneOpacita, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setToastVisibile(false);
      resettaTutto();
    });
  };

  const elaborazioneAutomatica = async (base64Foto: string) => {
    setCaricamento(true);
    try {
      setTestoCaricamento('Lettura del testo in corso...');
      let formData = new FormData();
      formData.append('base64Image', `data:image/jpg;base64,${base64Foto}`);
      formData.append('apikey', OCR_SPACE_API_KEY);
      formData.append('language', 'ita');
      formData.append('OCREngine', '2');
      formData.append('scale', 'true');

      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });
      const ocrData = await ocrResponse.json();

      let nomeLetto = '';
      if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
        nomeLetto = ocrData.ParsedResults[0].ParsedText.split('\n')[0].trim();
        setNomeCarta(nomeLetto);
      } else {
        Alert.alert("Attenzione", "Nessun testo trovato.");
        setCaricamento(false);
        return; 
      }

      setTestoCaricamento(`Cerco "${nomeLetto}" nel DB...`);
      const dbResponse = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?language=it&name=${encodeURIComponent(nomeLetto)}`);
      const dbData = await dbResponse.json();

      if (dbData.data && dbData.data.length > 0 && dbData.data[0].card_sets) {
        setEspansioni(dbData.data[0].card_sets);
      } else {
        Alert.alert("Non trovata", `Nessuna espansione trovata.`);
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Errore", "Problema di rete.");
    } finally {
      setCaricamento(false);
    }
  };

  const scattaFoto = async () => {
    if (cameraRef.current) {
      resettaTutto();
      const photoData = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      setFoto(photoData);
      await elaborazioneAutomatica(photoData.base64);
    }
  };

  const cercaEspansioniManuale = async () => {
    if (!nomeCarta) return;
    setCaricamento(true);
    setTestoCaricamento('Ricerca in corso...');
    setEspansioni([]);
    setEspansioneSelezionata('');
    try {
      const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?language=it&name=${encodeURIComponent(nomeCarta)}`);
      const data = await response.json();
      if (data.data && data.data.length > 0 && data.data[0].card_sets) {
        setEspansioni(data.data[0].card_sets);
      } else {
        Alert.alert("Non trovata", "Controlla l'ortografia.");
      }
    } catch (error) { console.error(error); } finally { setCaricamento(false); }
  };

  const salvaSuExcel = async () => {
    setCaricamento(true);
    setTestoCaricamento('Salvataggio...');
    try {
      const raritaTrasmessa = isGold ? `Gold ${rarita}` : rarita;

      const datiCarta = {
        nome: nomeCarta.toLowerCase(),
        espansione: espansioneSelezionata,
        lingua: lingua,
        condizione: condizione,
        rarita: raritaTrasmessa
      };

      const response = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datiCarta)
      });

      const result = await response.text();
      if (result === "Successo") { mostraToastSuccesso(); }
    } catch (error) {
      console.error(error);
      Alert.alert("Errore", "Impossibile salvare.");
    } finally { setCaricamento(false); }
  };

  const resettaTutto = () => {
    setFoto(null);
    setNomeCarta('');
    setEspansioni([]);
    setEspansioneSelezionata('');
    setCondizione('');
    setRarita('');
    setIsGold(false);

  if (foto) {
    return (
      <View style={styles.previewContainer}>
        {toastVisibile && (
          <Animated.View style={[styles.toastContainer, { opacity: animazioneOpacita }]}>
            <Text style={styles.toastText}>Added! ✓</Text>
          </Animated.View>
        )}

        <View style={styles.topBar}>
          <TextInput
            style={styles.inputNome}
            value={nomeCarta}
            onChangeText={setNomeCarta}
            placeholder="Nome Carta"
            placeholderTextColor={COLORS.textSecondary}
          />
          <TouchableOpacity style={styles.searchButton} onPress={cercaEspansioniManuale}>
            <Text style={styles.searchButtonText}>Cerca</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centerImageContainer}>
          <Image source={{ uri: foto?.uri }} style={styles.cardImage} resizeMode="cover" />
        </View>

        <View style={styles.bottomSection}>
          {caricamento && !toastVisibile ? ( 
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{testoCaricamento}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              
              {!espansioneSelezionata && (
                <View style={{ flex: 1 }}>
                  {espansioni.length > 0 ? (
                    <>
                      <Text style={styles.label}>1. Seleziona l'Espansione:</Text>
                      <ScrollView style={styles.espansioniScroll}>
                        {espansioni.map((esp, index) => (
                          <TouchableOpacity key={index} style={styles.espansioneButton} onPress={() => setEspansioneSelezionata(esp.set_code)}>
                            <Text style={styles.espansioneText}>{esp.set_name} ({esp.set_code})</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <Text style={styles.emptyStateText}>Nessuna carta trovata. Modifica il nome in alto.</Text>
                    </View>
                  )}
                  <TouchableOpacity style={[styles.flatButton, styles.dangerButton, { marginTop: 15 }]} onPress={resettaTutto}>
                    <Text style={[styles.flatButtonText, { color: '#FFF' }]}>Annulla Scansione</Text>
                  </TouchableOpacity>
                </View>
              )}

              {espansioneSelezionata !== '' && (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.selectedExpContainer}>
                    <Text style={styles.selectedExpText}>Esp: {espansioneSelezionata}</Text>
                    <TouchableOpacity onPress={() => setEspansioneSelezionata('')}>
                      <Text style={styles.changeExpText}>Cambia</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sectionBlock}>
                    <Text style={styles.label}>2. Lingua:</Text>
                    <View style={styles.rowButtons}>
                      {['IT', 'EN'].map(lang => (
                        <TouchableOpacity key={lang} style={[styles.smallButton, lingua === lang && styles.selezionatoBg]} onPress={() => setLingua(lang)}>
                          <Text style={[styles.buttonTextSmall, lingua === lang && styles.testoSelezionato]}>{lang}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.label, {marginTop: 20}]}>3. Condizione:</Text>
                    <View style={styles.rowButtonsWrap}>
                      {['NearMint', 'SlightlyPlayed', 'ModeratelyPlayed', 'Played', 'Poor'].map(cond => (
                        <TouchableOpacity key={cond} style={[styles.condButton, condizione === cond && styles.selezionatoBg]} onPress={() => setCondizione(cond)}>
                          <Text style={[styles.buttonTextSmall, condizione === cond && styles.testoSelezionato]}>{cond}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <View style={styles.rarityHeader}>
                        <Text style={styles.label}>4. Rarità:</Text>
                        <TouchableOpacity 
                            style={[styles.goldBadge, isGold && styles.goldBadgeActive]} 
                            onPress={() => setIsGold(!isGold)}
                        >
                            <Text style={[styles.goldBadgeText, isGold && { color: COLORS.textOnPrimary }]}>GOLD</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.rowButtonsWrap}>
                      {['Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare', 'Ultimate Rare', 'Ghost Rare', 'Starfoil', 'Shutterfoil', 'Mosaic'].map(rar => (
                        <TouchableOpacity key={rar} style={[styles.condButton, rarita === rar && styles.selezionatoBg]} onPress={() => setRarita(rar)}>
                          <Text style={[styles.buttonTextSmall, rarita === rar && styles.testoSelezionato]}>{rar}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.flatButton, styles.successButton, (!condizione || !rarita) && styles.disabledButton]}
                      onPress={salvaSuExcel}
                      disabled={!condizione || !rarita}
                    >
                      <Text style={[styles.flatButtonText, { color: COLORS.textOnPrimary }]}>Salva su Excel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.flatButton, styles.dangerButton]} onPress={resettaTutto}>
                      <Text style={[styles.flatButtonText, { color: '#FFF' }]}>Annulla Scansione</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      <View style={styles.topBarOverlay}>
        <TouchableOpacity style={styles.backButtonCircular} onPress={() => Alert.alert("Back")}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.scanGuideLeft} />
      <View style={styles.scanGuideRight} />
      <View style={styles.scanButtonContainer}>
        <TouchableOpacity style={styles.scanActionBtn} onPress={scattaFoto}>
          <Text style={styles.scanActionText}>Scan Card</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  camera: { flex: 1 },
  
  permissionButton: { alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12 },
  buttonText: { fontSize: 18, fontWeight: '700', color: COLORS.textOnPrimary, letterSpacing: 1 },
  text: { textAlign: 'center', marginBottom: 20, fontSize: 18, paddingHorizontal: 20, color: COLORS.textPrimary, alignSelf: 'center', marginTop: '50%' },

  topBarOverlay: { position: 'absolute', top: 60, left: 25, zIndex: 10 },
  backButtonCircular: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scanGuideLeft: { position: 'absolute', top: '35%', left: 0, width: 6, height: 120, backgroundColor: 'rgba(255,255,255,0.4)', borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  scanGuideRight: { position: 'absolute', top: '35%', right: 0, width: 6, height: 120, backgroundColor: 'rgba(255,255,255,0.4)', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  scanButtonContainer: { position: 'absolute', bottom: 50, width: '100%', paddingHorizontal: 30 },
  scanActionBtn: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scanActionText: { color: COLORS.textOnPrimary, fontSize: 18, fontWeight: '800' },

  previewContainer: { flex: 1, backgroundColor: COLORS.background, paddingTop: 60 },
  topBar: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 15, alignItems: 'center' },
  inputNome: { flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 16, padding: 14, fontSize: 16, color: COLORS.textPrimary, marginRight: 10 },
  searchButton: { backgroundColor: COLORS.buttonNormal, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16 },
  searchButtonText: { color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 16 },
  
  centerImageContainer: { alignItems: 'center', justifyContent: 'center', paddingBottom: 15 },
  cardImage: { width: 160, height: 230, borderRadius: 16, borderWidth: 1, borderColor: COLORS.surface },
  
  bottomSection: { flex: 1, backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20 },
  sectionBlock: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10, letterSpacing: 1 },
  
  espansioniScroll: { flex: 1, borderRadius: 12 },
  espansioneButton: { padding: 14, backgroundColor: COLORS.surfaceLight, borderRadius: 12, marginBottom: 8 },
  espansioneText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyStateText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  selectedExpContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surfaceLight, padding: 15, borderRadius: 12, marginBottom: 20 },
  selectedExpText: { color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 15 },
  changeExpText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

  rowButtons: { flexDirection: 'row', gap: 10 },
  rowButtonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: COLORS.buttonNormal },
  condButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.buttonNormal },
  buttonTextSmall: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700' },
  
  selezionatoBg: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.primary },
  testoSelezionato: { color: COLORS.primary },
  
  rarityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  goldBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.textSecondary },
  goldBadgeActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  goldBadgeText: { fontSize: 11, fontWeight: '900', color: COLORS.textSecondary },

  actionButtons: { marginTop: 'auto', paddingTop: 10, gap: 10 },
  flatButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  successButton: { backgroundColor: COLORS.primary },
  dangerButton: { backgroundColor: COLORS.danger },
  disabledButton: { opacity: 0.4 },
  flatButtonText: { fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textPrimary, marginTop: 15, fontSize: 16, textAlign: 'center' },
  toastContainer: { position: 'absolute', top: '40%', alignSelf: 'center', backgroundColor: COLORS.primary, paddingVertical: 20, paddingHorizontal: 40, borderRadius: 100, elevation: 20, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, zIndex: 9999 },
  toastText: { color: COLORS.textOnPrimary, fontSize: 24, fontWeight: '900', letterSpacing: 2 }
});
