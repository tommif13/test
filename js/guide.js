/**
 * Guida Metodologica — Fonti Dati e Strategia di Ricerca
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

        <h3><i class="fas fa-database"></i> Fonti Dati Primarie</h3>

        <div class="source-card">
            <h4>1. Catasto — Agenzia delle Entrate / Sister</h4>
            <p>Visure catastali per identificare proprietari, consistenza, rendita, e data ultimo aggiornamento.</p>
            <p><a href="https://sister.agenziaentrate.gov.it" target="_blank">sister.agenziaentrate.gov.it</a> — Accesso professionale tramite convenzione.</p>
            <p><strong>Dati estratti:</strong> Intestatari, quote proprietà, categoria catastale, superficie, rendita, storico variazioni.</p>
        </div>

        <div class="source-card">
            <h4>2. Conservatoria dei Registri Immobiliari</h4>
            <p>Visure ipotecarie per verificare: trascrizioni (compravendite, donazioni, successioni), iscrizioni (ipoteche, pignoramenti).</p>
            <p><strong>Dati estratti:</strong> Successioni, donazioni recenti, ipoteche, pignoramenti, procedure esecutive.</p>
        </div>

        <div class="source-card">
            <h4>3. Tribunale di Milano — Aste e Fallimenti</h4>
            <p>Portale vendite pubbliche e tribunale per aste immobiliari e procedure concorsuali.</p>
            <p><a href="https://pvp.giustizia.it" target="_blank">pvp.giustizia.it</a> — Portale Vendite Pubbliche</p>
            <p><a href="https://www.astegiudiziarie.it" target="_blank">astegiudiziarie.it</a> — Aggregatore aste</p>
            <p><strong>Dati estratti:</strong> Immobili all'asta, base d'asta, stato procedura, CTU, perizie.</p>
        </div>

        <div class="source-card">
            <h4>4. Camera di Commercio di Milano</h4>
            <p>Visure camerali per società proprietarie: stato (attiva, in liquidazione, cessata, fallita).</p>
            <p><a href="https://www.registroimprese.it" target="_blank">registroimprese.it</a></p>
            <p><strong>Dati estratti:</strong> Stato società, bilanci, sedi, liquidazioni, procedure concorsuali.</p>
        </div>

        <div class="source-card">
            <h4>5. Comune di Milano — Anagrafe e Urbanistica</h4>
            <p>PGT (Piano di Governo del Territorio), destinazioni d'uso, concessioni edilizie.</p>
            <p><a href="https://www.comune.milano.it/servizi/pgt" target="_blank">comune.milano.it — PGT</a></p>
            <p><strong>Dati estratti:</strong> Destinazione urbanistica, volumetrie, vincoli, varianti in corso.</p>
        </div>

        <div class="source-card">
            <h4>6. Osservatorio del Mercato Immobiliare (OMI)</h4>
            <p>Valori di mercato per zona, tipologia e stato di conservazione.</p>
            <p><a href="https://www.agenziaentrate.gov.it/portale/web/guest/schede/fabbricatiterreni/omi" target="_blank">Agenzia Entrate — OMI</a></p>
            <p><strong>Dati estratti:</strong> Valori €/mq per zona, trend, quotazioni.</p>
        </div>

        <h3><i class="fas fa-search-plus"></i> Fonti Dati Secondarie (OSINT)</h3>

        <div class="source-card">
            <h4>7. Google Maps / Street View</h4>
            <p>Verifica visiva dello stato dell'immobile. Confronto storico delle immagini per valutare degrado nel tempo.</p>
        </div>

        <div class="source-card">
            <h4>8. Portali Immobiliari (per esclusione)</h4>
            <p>Immobiliare.it, Idealista, Casa.it — per <strong>escludere</strong> immobili già in vendita dal dataset.</p>
        </div>

        <div class="source-card">
            <h4>9. Registro Successioni</h4>
            <p>Presso il Tribunale di Milano, registro delle successioni aperte. Identificare decessi recenti con patrimonio immobiliare.</p>
        </div>

        <div class="source-card">
            <h4>10. Necrologi locali e Anagrafe</h4>
            <p>Incrociare decessi recenti di over-75 con proprietà immobiliari catastali a Milano.</p>
        </div>

        <h3><i class="fas fa-cogs"></i> Processo Operativo</h3>
        <ol>
            <li><strong>Estrazione bulk dal Catasto:</strong> Richiedere elenco immobili per categoria (A/10 uffici, C/6 garage, D/ capannoni) nel comune di Milano.</li>
            <li><strong>Incrocio con Conservatoria:</strong> Verificare successioni, donazioni e trascrizioni degli ultimi 5 anni.</li>
            <li><strong>Filtro per stato società:</strong> Controllare su Camera di Commercio le società proprietarie in liquidazione/cessate/fallite.</li>
            <li><strong>Esclusione immobili in vendita:</strong> Scraping portali immobiliari per rimuovere immobili già listati.</li>
            <li><strong>Scoring automatico:</strong> Applicare l'algoritmo di scoring a ogni immobile rimasto.</li>
            <li><strong>Verifica visiva:</strong> Google Street View per confermare stato dell'immobile.</li>
            <li><strong>Contatto proprietari:</strong> Prioritizzare per score. Approccio diretto o tramite intermediari.</li>
        </ol>

        <h3><i class="fas fa-balance-scale"></i> Note Legali</h3>
        <p>Tutte le fonti dati indicate sono <strong>pubbliche</strong> e accessibili a operatori del settore immobiliare.
        Le visure catastali e ipotecarie sono atti pubblici consultabili da chiunque.
        I dati anagrafici dei proprietari sono trattati nel rispetto del GDPR e della normativa sulla privacy.
        L'utilizzo è finalizzato esclusivamente a proposte commerciali lecite nel settore immobiliare.</p>

        <h3><i class="fas fa-tools"></i> Strumenti Consigliati per Automazione</h3>
        <div class="source-card">
            <h4>Per lo scraping e raccolta dati</h4>
            <p><strong>Python + Selenium/Playwright</strong> per automazione visure su Sister e portali pubblici.</p>
            <p><strong>API Agenzia Entrate</strong> (dove disponibili) per query catastali massive.</p>
            <p><strong>BeautifulSoup / Scrapy</strong> per monitorare portali aste e immobiliari.</p>
        </div>
        <div class="source-card">
            <h4>Per l'analisi e scoring</h4>
            <p><strong>Questa dashboard</strong> per visualizzazione e prioritizzazione.</p>
            <p><strong>Google Sheets / Airtable</strong> per gestione collaborativa del CRM proprietari.</p>
            <p><strong>Zapier/Make</strong> per automazioni e notifiche su nuove successioni/aste.</p>
        </div>
        `;
    }
};
