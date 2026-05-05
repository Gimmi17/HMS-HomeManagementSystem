# HMS — Proposal di Miglioramento
*Report indagine: 24 Aprile 2025 | URL: http://192.168.1.52:5052*

---

## 1. Problema Centrale: Assenza di Identità

HMS è un contenitore di funzioni senza un'anima. Il nome
**Home Management System** suona come un ERP domestico anonimo.
L'utente non capisce *perché* usarlo invece di un foglio Excel.

L'elemento più sofisticato (Compound Lab) è nascosto in un
sottomenu. Il posizionamento reale è molto più potente di quello
dichiarato.

---

## 2. Posizionamento Proposto: Da Gestionale Casa a HQ

**Nuovo claim**: HMS è il *quartier generale della tua economia personale*.
La casa non è un fine, è il mezzo. Le scelte quotidiane (cosa comprare,
cosa mangiare, quando scade il latte) alimentano le proiezioni
finanziarie a lungo termine.

**Option A**: HMS — Home Money & Stocks
**Option B**: HMS — Il tuo HQ domestico
**Option C**: mantieni HMS, aggiungi payoff sotto al logo

---

## 3. Struttura Menu — Da 13 Voci a 4 Aree

**Attuale** (13 voci disordinate nel sidebar):
Dashboard, Pasti, Ricette, Lista Spesa, Giacenze, Aree, Salute,
Finanza, Compound Lab, Investimenti, Anagrafiche, Impostazioni, Esci

**Proposto** (4 aree tematiche):

```
VITA QUOTIDIANA
  ├─ Pasti & Ricette
  ├─ Lista Spesa
  └─ Giacenze (scadenze + zone)

CASA
  ├─ Aree & Zone
  └─ Anagrafiche (prodotti, negozi, brand, categorie)

FINANZE
  ├─ Dashboard (riepilogo: entrate, uscite, avanzo, autonomia mesi)
  ├─ Movimenti (ex Storico + Ricorrenti + Importa)
  ├─ Proiezione (ex Compound Lab — rinominato)
  └─ Portafoglio (ex Investimenti — PAC, pensione, investimenti)

IO
  ├─ Salute
  └─ Profilo / Impostazioni
```

**Azioni concrete**:
- Rimuovere Revolut dal tab di primo livello → diventa sorgente importazione
- Rinominare Compound Lab → **Proiezione** o **Simulatore**
- Unire Investimenti e Compound Lab sotto Finanze
- Spostare Anagrafiche sotto Casa (non è una sezione di navigazione primaria)

---

## 4. Flussi di Dati tra i Moduli

Oggi le sezioni sono isolati. I dati dovrebbero fluire:

```
Lista Spesa ──(costo mensile)──> Finanza → Uscite/mese
Giacenze ───(sprechi alimentari)──> Finanza → budget investimenti
Scadenze ──(notifica + costo)──> Finanza
Entrate/Uscite ──(budget reale)──> Compound Lab (Proiezione)
Compound Lab ──(risultato)──> Dashboard Finanza come widget
```

**Esempio concreto**:
> Il simulatore potrebbe mostrare: *Se riduci gli sprechi alimentari di
> 100 euro/mese, il tuo early payoff anticipa di X mesi.*

---

## 5. Compound Lab — Il Gioiello Nascosto

Questa è la feature più sofisticata dell'intero sistema. Va messa
in evidenza, non nascosta in un sottomenu.

**Azioni**:
- Portare Compound Lab come widget nella dashboard finanziaria
- Aggiungere un toggle **«Usa i miei dati reali»** che prende il
  budget da Entrate - Uscite calcolate automaticamente
- Mostrare il risultato principale in modo più visibile nella
  dashboard: *«Raggiungi 1000€/mese di cashflow tra 32 mesi»*
- Rinominarlo **Proiezione** o **Simulatore Finanziario** (il nome
  «lab» è figo ma non comunica la funzione)

**Futuro**:
- Collegare PAC reali al simulatore
- Aggiungere scenario «Cosa succede se...» (aumento affitto, figlio, mutuo)
- Esporta PDF del piano finanziario

---

## 6. Identità Visiva e Copy

**Nel login**:
- Sostituire il sottotitolo generico con un payoff:
  *«Il quartier generale della tua economia domestica»*

**Nella UI**:
- **Leftover** → **Avanzo**
- **Runway** → **Autonomia finanziaria (mesi)**
- **Compound Lab** → **Proiezione**
- Aggiungere tooltip/icona `ⓘ` sui termini tecnici
  (Leftover, Runway, Compound)

**Nei menu**:
- Usare etichette italiane coerenti
- Evitare di mescolare italiano nella UI e inglese negli URL

---

## 7. Stati Vuoti — Nessuna Azione Suggerita

**Attuale** (passivo):
- «Nessuna transazione»
- «0 articoli»
- «Nessun investimento ancora.»

**Proposto** (con CTA):
- **Finanza vuota**: *«Inizia dal tuo primo movimento»* → pulsante
  *«+ Aggiungi»* oppure *«Importa da Revolut»*
- **Giacenze vuota**: *«La tua dispensa è vuota. Aggiungi i primi
  5 prodotti di base»* → lista rapida suggerita
  (Pasta, Latte, Uova, Pane, Caffè)
- **Investimenti vuoto**: già buono (link «Aggiungi il primo»)

---

## 8. Sezione Salute — Isola senza Collegamento

**Attuale**: Salute è separato da tutto.

**Proposto** — collegalo al resto:
- Nutrizione da Pasti → calorie/settimana nella dashboard
- Budget salute → spese mediche in Finanza
- **«Costo della tua dieta»**: quanto spendi per mangiare sano vs take-away

---

## 9. Onboarding — Da Wizard a Flusso Guidato

Il wizard 4-step (Benvenuto, Casa, Panoramica, Fine) è forzato ma
non popola i dati.

**Proposto**:
1. Chiedi il nome utente
2. Collega Finanza (importa da Revolut? inserisci manualmente?)
3. Popola la dispensa (template base: 10 prodotti)
4. Crea la prima lista della spesa
5. Mostra il risultato: *«Il tuo primo mese costerà circa X euro»*

---

## 10. Roadmap Suggerita

**Fase 1 — Identità** *(subito, 1-2 giorni)*
- [ ] Aggiungi payoff sotto al logo nella pagina di login
- [ ] Rinomina Compound Lab → Proiezione
- [ ] Rinomina Leftover → Avanzo, Runway → Autonomia finanziaria
- [ ] Ristruttura il menu in 4 aree

**Fase 2 — Flussi** *(1-2 settimane)*
- [ ] Lista spesa genera transazione automatica in Finanza
- [ ] Scadenze alimentari → notifica + costo stimato
- [ ] Budget reale alimenta il simulatore Proiezione

**Fase 3 — Simulatore in Evidenza** *(2-3 settimane)*
- [ ] Widget Proiezione nella dashboard Finanza
- [ ] Toggle «Usa i miei dati reali»
- [ ] Risultato principale in evidenza

**Fase 4 — Investimenti** *(futuro)*
- [ ] Collega PAC reali al simulatore
- [ ] Tracking reale vs simulato
- [ ] Esporta PDF piano finanziario

---

## 11. Mappa URL Attuale

| Sezione | URL |
|---|---|
| Login | /login |
| Dashboard | / |
| Lista Spesa | /shopping-lists |
| Giacenze | /giacenze |
| Finanza | /finance |
| Compound Lab | /finance/compound-lab |
| Investimenti | /investments |
| Anagrafiche | /anagrafiche |

---

## 12. Nota sulla Terminologia

Usare un glossario interno per mantenere consistenza:
- `Avanzo` invece di `Leftover`
- `Autonomia finanziaria` invece di `Runway`
- `Proiezione` invece di `Compound Lab`
- `Portafoglio` invece di `Investimenti`
- `Movimenti` invece di `Storico`