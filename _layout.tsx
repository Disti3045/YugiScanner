import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, ActivityIndicator, TextInput, Alert, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon, Line, Text as SvgText, Circle } from 'react-native-svg';
import * as Linking from 'expo-linking';

const OCR_SPACE_API_KEY = process.env.EXPO_PUBLIC_OCR_API_KEY as string; //Your Api Key from OCR.space
const GOOGLE_SHEETS_URL = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_URL as string; //Your web URL from Google Script
const GOOGLE_SHEETS_VIEW_URL = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_VIEW as string; //Your URL of the Google Sheet Document

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
  const [schermataCorrente, setSchermataCorrente] = useState<'home' | 'scan'>('home');
  const [caricamentoStats, setCaricamentoStats] = useState(false);
  const [statistiche, setStatistiche] = useState({ totalScanned: 0, totalSold: 0, radarData: [0, 0, 0, 0, 0] });

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

  const [popupVisibile, setPopupVisibile] = useState(false);
  const [erroreScansioneVisibile, setErroreScansioneVisibile] = useState(false);

  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (schermataCorrente === 'home') {
      fetchStatistiche();
    }
  }, [schermataCorrente]);

  const fetchStatistiche = async () => {
    setCaricamentoStats(true);
    try {
      const res = await fetch(GOOGLE_SHEETS_URL);
      const data = await res.json();
      setStatistiche(data);
    } catch (e) {
      console.log(e);
    } finally {
      setCaricamentoStats(false);
    }
  };

  
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

  const chiudiPopupSuccesso = () => {
    setPopupVisibile(false);
    resettaTutto();
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
        setErroreScansioneVisibile(true);
        setCaricamento(false);
        return; 
      }

      setTestoCaricamento(`Cerco "${nomeLetto}" nel DB...`);
      const dbResponse = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?language=it&name=${encodeURIComponent(nomeLetto)}`);
      const dbData = await dbResponse.json();

      if (dbData.data && dbData.data.length > 0 && dbData.data[0].card_sets) {
        setEspansioni(dbData.data[0].card_sets);
      } else {
        setErroreScansioneVisibile(true);
      }

    } catch (error) {
        setErroreScansioneVisibile(true);
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
        Alert.alert("Non trovata", "Controlla l'ortografia."); //change to fit overall app aesthetic
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
      if (result === "Successo") { 
        setPopupVisibile(true); 
      }
    } catch (error) {
      Alert.alert("Errore", "Impossibile salvare."); //change to fit overall app aesthetics
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
  };

  const renderRadarChart = () => {
    const size = 320;
    const center = size / 2;
    const radius = 115;
    const data = statistiche.radarData;
    const maxVal = Math.max(...data, 10); 

    const getPoint = (val: number, i: number, max: number) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const r = (val / max) * radius;
      return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
    };

    const labels = ["NM", "SP", "MP", "PL", "PO"];
    const axes = [0, 1, 2, 3, 4].map(i => getPoint(maxVal, i, maxVal));
    const dataPoints = data.map((val, i) => getPoint(val, i, maxVal));
    const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
    const livelli = [0.33, 0.66, 1];

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Svg height={size} width={size}>
          {axes.map((p, i) => (
            <Line key={`axis-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke={COLORS.border} strokeWidth="1" />
          ))}
          {livelli.map((livello, idx) => {
            const puntiLivello = [0, 1, 2, 3, 4].map(i => getPoint(maxVal * livello, i, maxVal));
            const puntiStr = puntiLivello.map(p => `${p.x},${p.y}`).join(' ');
            return <Polygon key={`web-${idx}`} points={puntiStr} fill="none" stroke={COLORS.border} strokeWidth="1" />
          })}
          <Polygon points={dataPolygon} fill="rgba(194, 253, 3, 0.3)" stroke={COLORS.primary} strokeWidth="3" strokeLinejoin="round" />
          {dataPoints.map((p, i) => (
             <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r="4" fill={COLORS.textPrimary} />
          ))}
          {axes.map((p, i) => {
             const offset = 20;
             const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
             const tx = center + (radius + offset) * Math.cos(angle);
             const ty = center + (radius + offset) * Math.sin(angle);
             return (
               <SvgText key={`label-${i}`} x={tx} y={ty + 4} fill={COLORS.textPrimary} fontSize="12" fontWeight="bold" textAnchor="middle">
                 {labels[i]}
               </SvgText>
             );
          })}
        </Svg>
        <View style={styles.legendContainer}>
           <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
           <Text style={[styles.legendText, { color: COLORS.primary }]}>Total Scanned</Text>
           <View style={[styles.legendDot, { backgroundColor: COLORS.textPrimary, marginLeft: 15 }]} />
           <Text style={styles.legendText}>Sold</Text>
        </View>
      </View>
    );
  };

  if (schermataCorrente === 'home') {
    return (
      <View style={styles.containerHome}>
              <TouchableOpacity style={styles.homeTopBtn} onPress={() => Linking.openURL(GOOGLE_SHEETS_VIEW_URL)}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.textOnPrimary} />
                <Text style={styles.homeTopBtnText}>Open Spreadsheet</Text>
              </TouchableOpacity>
              <View style={styles.homePanel}>
                {caricamentoStats ? (
                   <View style={{flex: 1, justifyContent: 'center'}}><ActivityIndicator size="large" color={COLORS.primary}/></View>
                ) : (
                   <>
                     {renderRadarChart()}
                     <View style={styles.statsCardsRow}>
                       <View style={styles.statCard}>
                         <Text style={styles.statCardLabel}>Total Scanned</Text>
                         <Text style={styles.statCardValue}>{statistiche.totalScanned}</Text>
                       </View>
                       <View style={styles.statCard}>
                         <Text style={styles.statCardLabel}>Total Sold</Text>
                         <Text style={styles.statCardValue}>{statistiche.totalSold}</Text>
                       </View>
                     </View>
                   </>
                )}
              </View>
              <TouchableOpacity style={styles.homeBottomBtn} onPress={() => setSchermataCorrente('scan')}>
                <Ionicons name="scan-outline" size={24} color={COLORS.textOnPrimary} />
                <Text style={styles.homeBottomBtnText}>Start Scanning</Text>
              </TouchableOpacity>
            </View>
          );
        }
      
        return (
          <View style={styles.container}>
            <CameraView style={styles.camera} facing="back" ref={cameraRef} />
            <View style={styles.topBarOverlay}>
              <TouchableOpacity style={styles.backButtonCircular} onPress={() => setSchermataCorrente('home')}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
      
            {foto && (
      
      <View style={styles.previewContainer}>
        <Modal visible={popupVisibile} transparent={true} animationType="fade">
                    <View style={styles.modalOverlay}>
                      <View style={styles.modalCard}>
                        <Ionicons name="checkmark-sharp" size={80} color={COLORS.primary} style={{ marginBottom: 10 }} />
                        <Text style={styles.modalTitle}>Success</Text>
                        <Text style={styles.modalSubtitle}>Card details have been successfully saved to your collection.</Text>
                        <TouchableOpacity style={styles.modalButton} onPress={chiudiPopupSuccesso}>
                          <Text style={styles.modalButtonText}>Got it</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
        
                  <Modal visible={erroreScansioneVisibile} transparent={true} animationType="fade">
                    <View style={styles.modalOverlay}>
                      <View style={styles.modalCard}>
                        <Ionicons name="close-sharp" size={90} color={COLORS.danger} style={{ marginBottom: 5 }} />
                        <Text style={[styles.modalTitle, { color: COLORS.danger, textTransform: 'uppercase', fontSize: 24 }]}>Scan Error</Text>
                        <Text style={styles.modalSubtitle}>Please check your network settings and confirm that you are connected to the internet before trying again. Make sure the network signal is strong.</Text>
                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.danger, marginBottom: 20 }]} onPress={() => { setErroreScansioneVisibile(false); resettaTutto(); }}>
                          <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Retry Scan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setErroreScansioneVisibile(false)}>
                          <Text style={styles.modalTextButton}>Insert Manually</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
        
        <View style={styles.topBar}>
          <TextInput style={styles.inputNome} value={nomeCarta} onChangeText={setNomeCarta} placeholder="Nome Carta" placeholderTextColor={COLORS.textSecondary} />
          <TouchableOpacity style={styles.searchButton} onPress={cercaEspansioniManuale}>
            <Text style={styles.searchButtonText}>Cerca</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centerImageContainer}>
          <Image source={{ uri: foto?.uri }} style={styles.cardImage} resizeMode="cover" />
        </View>

        <View style={styles.bottomSection}>
          {caricamento && !popupVisibile ? (
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
                        <TouchableOpacity style={[styles.goldBadge, isGold && styles.goldBadgeActive]} onPress={() => setIsGold(!isGold)}>
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
                    <TouchableOpacity style={[styles.flatButton, styles.successButton, (!condizione || !rarita) && styles.disabledButton]} onPress={salvaSuExcel} disabled={!condizione || !rarita}>
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
    )}

    {!foto && (
      <>
        <View style={styles.scanGuideLeft} />
        <View style={styles.scanGuideRight} />
        <View style={styles.scanButtonContainer}>
          <TouchableOpacity style={styles.scanActionBtn} onPress={scattaFoto}>
            <Text style={styles.scanActionText}>Scan Card</Text>
          </TouchableOpacity>
        </View>
      </>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerHome: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 30 },
  homeTopBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  homeTopBtnText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  homePanel: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, marginBottom: 20 },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  legendText: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  statsCardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },
  statCard: { backgroundColor: COLORS.buttonNormal, borderRadius: 12, padding: 15, width: '48%' },
  statCardLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 5 },
  statCardValue: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold' },
  homeBottomBtn: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  homeBottomBtnText: { color: COLORS.textOnPrimary, fontSize: 18, fontWeight: '800', marginLeft: 10 },
  
  container: { flex: 1, backgroundColor: COLORS.background },
  camera: { flex: 1 },
  
  topBarOverlay: { position: 'absolute', top: 60, left: 25, zIndex: 10 },
  backButtonCircular: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scanGuideLeft: { position: 'absolute', top: '35%', left: 0, width: 6, height: 120, backgroundColor: 'rgba(255,255,255,0.4)', borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  scanGuideRight: { position: 'absolute', top: '35%', right: 0, width: 6, height: 120, backgroundColor: 'rgba(255,255,255,0.4)', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  scanButtonContainer: { position: 'absolute', bottom: 50, width: '100%', paddingHorizontal: 30 },
  scanActionBtn: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  scanActionText: { color: COLORS.textOnPrimary, fontSize: 18, fontWeight: '800' },

  permissionButton: { alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12 },
  previewContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.background, paddingTop: 60, zIndex: 20 },
  topBar: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 15 },
  buttonText: { fontSize: 18, fontWeight: '700', color: COLORS.textOnPrimary, letterSpacing: 1 },
  text: { textAlign: 'center', marginBottom: 20, fontSize: 18, paddingHorizontal: 20, color: COLORS.textPrimary, alignSelf: 'center', marginTop: '50%' },

  inputNome: { flex: 1, backgroundColor: COLORS.buttonNormal, borderRadius: 16, padding: 14, color: '#FFF', marginRight: 10 },
  searchButton: { backgroundColor: COLORS.buttonNormal, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, justifyContent: 'center' },
  searchButtonText: { color: '#FFF', fontWeight: 'bold' },
  centerImageContainer: { alignItems: 'center', paddingBottom: 15 },
  
  cardImage: { width: 160, height: 230, borderRadius: 16, borderWidth: 1, borderColor: COLORS.surface },
  
  bottomSection: { flex: 1, backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20 },
  sectionBlock: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10, letterSpacing: 1 },
  
  espansioniScroll: { flex: 1 },
  espansioneButton: { padding: 14, backgroundColor: COLORS.buttonNormal, borderRadius: 12, marginBottom: 8 },
  espansioneText: { fontSize: 14, color: '#FFF', fontWeight: '600' },
  
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyStateText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  selectedExpContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.buttonNormal, padding: 15, borderRadius: 12, marginBottom: 15 },
  selectedExpText: { color: '#FFF', fontWeight: 'bold' },
  changeExpText: { color: COLORS.primary, fontWeight: '600' },

  rowButtons: { flexDirection: 'row', gap: 10 },
  rowButtonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: COLORS.buttonNormal },
  condButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.buttonNormal },
  buttonTextSmall: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  
  selezionatoBg: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.primary },
  testoSelezionato: { color: COLORS.primary },
  
  rarityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  goldBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.textSecondary },
  goldBadgeActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  goldBadgeText: { fontSize: 11, fontWeight: '900', color: COLORS.textSecondary },

  actionButtons: { marginTop: 'auto', gap: 10 },
  flatButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  successButton: { backgroundColor: COLORS.primary },
  dangerButton: { backgroundColor: COLORS.danger },
  disabledButton: { opacity: 0.3 },
  flatButtonText: { fontSize: 16, fontWeight: 'bold' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', marginTop: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.buttonNormal, width: '85%', borderRadius: 24, padding: 30, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  modalTitle: { fontSize: 26, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 10 },
  modalSubtitle: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  modalButton: { backgroundColor: COLORS.primary, width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalButtonText: { color: COLORS.textOnPrimary, fontSize: 18, fontWeight: 'bold' },
  modalTextButton: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' }
});
