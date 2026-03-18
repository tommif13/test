/**
 * Guida Metodologica — Fonti Dati e Strategia di Ricerca
 * Aggiornata con fonti reali Open Data integrate
 */

const GuideContent = {
    render() {
        return `
        <h3><i class="fas fa-crosshairs"></i> Strategia di Prospecting</h3>
        <p>L'obiettivo è identificare immobili <strong>non ancora sul mercato</strong> ma con alta probabilità di essere venduti.
        Ci concentriamo su segnali deboli che indicano una predisposizione alla vendita prima che l'immobile venga listato.</p>

        <h3><i class="fas fa-brain"></i> Logica di Scoring (0-100)</h3>
        <p>Ogni immobile riceve un punteggio basato su 7 fattori ponderati:</p>
        <ol>
            <li><strong>Età del Proprietario (peso 20%)</strong> — Proprietari over 75 hanno maggiore probabilità di cessione. Over 85 = score massimo.</li>
            <li><strong>Stato dell'Immobile (peso 20%)</strong> — Immobili abbandonati o in pessimo stato indicano disinteresse del proprietario.</li>
            <li><strong>Successione Recente (peso 18%)</strong> — Eredi che ricevono un immobile lo vendono nel 60-70% dei casi entro 3 anni.</li>
            <li><strong>Fallimento/Asta (peso 15%)</strong> — Procedure concorsuali = vendita quasi certa. Le aste sono opportunità dirette.</li>
            <li><strong>Vetustà Ristrutturazione (peso 12%)</strong> — Nessuna ristrutturazione da 20+ anni indica proprietà "dimenticata".</li>
            <li><strong>Immobile Fermo (peso 10%)</strong> — Nessuna attività catastale/commerciale da anni. Immobile "dormiente".</li>
            <li><strong>Assenza Eredi (peso 5%)</strong> — Proprietario senza eredi noti = futura gestione complessa, incentivo alla vendita.</li>
        </ol>
        <p><em>Bonus combinazioni: proprietario anziano + immobile degradato, successione + immobile fermo, anziano senza eredi. Fino a +17 punti extra.</em></p>

        <h3 style="color:#16a34a"><i class="fas fa-check-circle"></i> Dati Reali Integrati (Open Data)</h3>
        <p>Questa dashboard integra <strong>dati reali</strong> da fonti pubbliche Open Data:</p>

        <div class="source-card" style="border-left-color:#f97316">
            <h4>1. Edifici Degradati/Abbandonati (ds503) — Comune di Milano</h4>
            <p>174 edifici e aree in stato di degrado/abbandono mappati dal PGT Milano 2030. Include coordinate, tipologia (produttivo, terziario, residenziale) e quartiere (NIL).</p>
            <p><a href="https://dati.comune.milano.it/dataset/ds503_edifici-e-aree-in-degrado" target="_blank">dati.comune.milano.it — ds503</a></p>
        </div>

        <div class="source-card" style="border-left-color:#8b5cf6">
            <h4>2. Aste Immobili Pubblici (ds616) — Comune di Milano</h4>
            <p>14 aste di vendita di immobili pubblici con base d'asta, superficie, destinazione, classe energetica e localizzazione.</p>
            <p><a href="https://dati.comune.milano.it" target="_blank">dati.comune.milano.it — ds616</a></p>
        </div>

        <div class="source-card" style="border-left-color:#ec4899">
            <h4>3. Beni Immobili Confiscati (ds147) — Comune di Milano</h4>
            <p>267 unità immobiliari confiscate alla criminalità organizzata, con tipologia, destinazione d'uso e ente assegnatario.</p>
            <p><a href="https://dati.comune.milano.it" target="_blank">dati.comune.milano.it — ds147</a></p>
        </div>

        <div class="source-card" style="border-left-color:#14b8a6">
            <h4>4. Cascine di Milano (ds1448) — Comune di Milano</h4>
            <p>42 cascine storiche nel territorio comunale con localizzazione GPS. Potenziale per recupero e valorizzazione.</p>
            <p><a href="https://dati.comune.milano.it" target="_blank">dati.comune.milano.it — ds1448</a></p>
        </div>

        <div class="source-card" style="border-left-color:#7c3aed">
            <h4>5. Quotazioni OMI 2024/2 — Agenzia delle Entrate</h4>
            <p>446 quotazioni immobiliari ufficiali per Milano: valore min/max €/mq per zona, tipologia e stato di conservazione. Semestre 2024/2.</p>
            <p><a href="https://www.agenziaentrate.gov.it/portale/web/guest/schede/fabbricatiterreni/omi" target="_blank">Agenzia Entrate — OMI</a></p>
        </div>

        <div class="source-card" style="border-left-color:#eab308">
            <h4>6. Certificazione Energetica CENED — Regione Lombardia</h4>
            <p>72.000+ certificazioni energetiche per Milano con classe energetica, emissioni CO2, anno costruzione e destinazione d'uso.</p>
            <p><a href="https://www.dati.lombardia.it/Energia/CENED-Certificazione-ENergetica-degli-EDifici/rsg3-xhvk" target="_blank">dati.lombardia.it — CENED</a></p>
        </div>

        <div class="source-card" style="border-left-color:#0ea5e9">
            <h4>7. Patrimonio Immobiliare Comunale — Comune di Milano</h4>
            <p>22.618 immobili di proprietà del Comune di Milano con localizzazione, foglio catastale e piano alienazione.</p>
        </div>

        <div class="source-card" style="border-left-color:#64748b">
            <h4>8. Fabbricati e Aree Demanio — Agenzia del Demanio 2025</h4>
            <p>Elenco fabbricati e aree di proprietà statale in Lombardia con superfici e categoria patrimoniale.</p>
        </div>

        <h3><i class="fas fa-database"></i> Fonti Dati Professionali (Accesso con Convenzione)</h3>

        <div class="source-card">
            <h4>Catasto — Agenzia delle Entrate / Sister</h4>
            <p>Visure catastali per identificare proprietari, consistenza, rendita, e data ultimo aggiornamento.</p>
            <p><a href="https://sister.agenziaentrate.gov.it" target="_blank">sister.agenziaentrate.gov.it</a> — Accesso professionale tramite convenzione.</p>
        </div>

        <div class="source-card">
            <h4>Conservatoria dei Registri Immobiliari</h4>
            <p>Visure ipotecarie per verificare: trascrizioni (compravendite, donazioni, successioni), iscrizioni (ipoteche, pignoramenti).</p>
        </div>

        <div class="source-card">
            <h4>Tribunale di Milano — Aste e Fallimenti</h4>
            <p><a href="https://pvp.giustizia.it" target="_blank">pvp.giustizia.it</a> — Portale Vendite Pubbliche</p>
            <p><a href="https://www.astegiudiziarie.it" target="_blank">astegiudiziarie.it</a> — Aggregatore aste</p>
        </div>

        <div class="source-card">
            <h4>Camera di Commercio di Milano</h4>
            <p>Visure camerali per società proprietarie: stato (attiva, in liquidazione, cessata, fallita).</p>
            <p><a href="https://www.registroimprese.it" target="_blank">registroimprese.it</a></p>
        </div>

        <h3><i class="fas fa-cogs"></i> Processo Operativo</h3>
        <ol>
            <li><strong>Analisi dati Open Data:</strong> Layer edifici degradati + aste + confiscati + cascine come base di prospecting.</li>
            <li><strong>Incrocio con OMI:</strong> Quotazioni di mercato per valutare il potenziale di ogni immobile target.</li>
            <li><strong>Verifica CENED:</strong> Classe energetica per stimare costi di riqualificazione.</li>
            <li><strong>Estrazione bulk dal Catasto:</strong> Identificare proprietari effettivi degli immobili target.</li>
            <li><strong>Incrocio con Conservatoria:</strong> Verificare successioni, donazioni e trascrizioni degli ultimi 5 anni.</li>
            <li><strong>Filtro per stato società:</strong> Controllare su Camera di Commercio le società proprietarie in liquidazione/cessate/fallite.</li>
            <li><strong>Esclusione immobili in vendita:</strong> Scraping portali immobiliari per rimuovere immobili già listati.</li>
            <li><strong>Scoring automatico:</strong> Applicare l'algoritmo di scoring a ogni immobile rimasto.</li>
            <li><strong>Verifica visiva:</strong> Google Street View per confermare stato dell'immobile.</li>
            <li><strong>Contatto proprietari:</strong> Prioritizzare per score. Approccio diretto o tramite intermediari.</li>
        </ol>

        <h3><i class="fas fa-balance-scale"></i> Note Legali</h3>
        <p>Tutti i dataset integrati provengono da <strong>fonti Open Data pubbliche</strong> (Comune di Milano, Agenzia delle Entrate, Regione Lombardia).
        Le visure catastali e ipotecarie sono atti pubblici consultabili da chiunque.
        I dati anagrafici dei proprietari sono trattati nel rispetto del GDPR e della normativa sulla privacy.
        L'utilizzo è finalizzato esclusivamente a proposte commerciali lecite nel settore immobiliare.</p>
        `;
    }
};
