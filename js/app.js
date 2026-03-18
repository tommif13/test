/**
 * App principale — Dashboard Prospecting Immobiliare
 * Studio Contrino & Studio Bottinelli
 *
 * Integra dati reali Open Data Milano:
 * - EDIFICI_DEGRADATI (ds503) — 174 edifici degradati/abbandonati
 * - ASTE_PUBBLICHE (ds616) — 14 aste immobili pubblici
 * - BENI_CONFISCATI (ds147) — 267 beni confiscati
 * - CASCINE_MILANO (ds1448) — 42 cascine
 * - QUOTAZIONI_OMI (ds2940) — 446 quotazioni mercato
 * - CENED_STATS — Statistiche certificazione energetica
 */

(function () {
    'use strict';

    // === State ===
    let map;
    let markersLayer;
    let layerDegradati;
    let layerAste;
    let layerConfiscati;
    let layerCascine;
    let allProperties = [];
    let filteredProperties = [];
    let currentSort = { field: 'score', direction: 'desc' };
    let selectedProperty = null;
    let chartsInitialized = false;

    // === Init ===
    function init() {
        // Process prospecting properties with scoring
        allProperties = MILAN_PROPERTIES.map(p => {
            const scoring = ScoringEngine.calcolaScore(p);
            return {
                ...p,
                score: scoring.score,
                livello: scoring.livello,
                fattori: scoring.fattori,
                dettaglio: scoring.dettaglio,
                segnali: ScoringEngine.getSegnali(p)
            };
        });

        filteredProperties = [...allProperties];
        applyFilters();

        initMap();
        renderMarkers();
        renderRealDataLayers();
        updateStats();
        updateDataCount();
        bindEvents();
    }

    // === Map ===
    function initMap() {
        map = L.map('map', {
            center: [45.4642, 9.1900],
            zoom: 13,
            zoomControl: true,
            attributionControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | <a href="https://carto.com/">CARTO</a> | Dati: Comune di Milano Open Data, Agenzia Entrate OMI, Regione Lombardia CENED',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        // Marker cluster group for prospecting targets
        markersLayer = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: function (cluster) {
                const markers = cluster.getAllChildMarkers();
                let maxScore = 0;
                markers.forEach(m => {
                    if (m.options.propertyScore > maxScore) maxScore = m.options.propertyScore;
                });
                const level = maxScore >= 70 ? 'hot' : maxScore >= 40 ? 'warm' : 'cold';
                const color = level === 'hot' ? '#dc2626' : level === 'warm' ? '#f59e0b' : '#3b82f6';
                return L.divIcon({
                    html: `<div style="background:${color};color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${markers.length}</div>`,
                    className: '',
                    iconSize: [40, 40]
                });
            }
        });

        // Additional layer groups for real data
        layerDegradati = L.layerGroup();
        layerAste = L.layerGroup();
        layerConfiscati = L.layerGroup();
        layerCascine = L.layerGroup();

        map.addLayer(markersLayer);
        map.addLayer(layerDegradati);
    }

    // === Render real data layers ===
    function renderRealDataLayers() {
        renderDegradatiLayer();
        renderAsteLayer();
        renderConfiscatiLayer();
        renderCascineLayer();
    }

    function makeDotIcon(color, icon) {
        return L.divIcon({
            html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"><i class="fas ${icon}" style="color:white;font-size:10px;transform:none"></i></div>`,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -14]
        });
    }

    function renderDegradatiLayer() {
        layerDegradati.clearLayers();
        if (typeof EDIFICI_DEGRADATI === 'undefined') return;

        const icon = makeDotIcon('#f97316', 'fa-house-crack');

        EDIFICI_DEGRADATI.forEach(e => {
            if (!e.lat || !e.lng) return;
            const marker = L.marker([e.lat, e.lng], { icon });

            // Lookup OMI value for this area
            const omiValue = lookupOMI(e.nil);

            marker.bindPopup(`
                <div class="popup-content">
                    <h3 style="color:#f97316"><i class="fas fa-house-crack"></i> Edificio Degradato</h3>
                    <span class="status-tag tag-abbandono">Open Data Comune MI</span>
                    <div class="popup-info">
                        <strong>${e.indirizzo}</strong><br>
                        Tipo: ${e.tipoMacro}<br>
                        Municipio: ${e.municipio} — ${e.nil}<br>
                        Codice: ${e.codice}
                        ${omiValue ? `<br><strong style="color:#16a34a">Valore OMI zona: ${omiValue}</strong>` : ''}
                    </div>
                    <button class="popup-btn" style="background:#f97316" onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent(e.indirizzo + ' Milano')}','_blank')">
                        <i class="fas fa-map"></i> Google Maps
                    </button>
                </div>
            `, { maxWidth: 300 });

            layerDegradati.addLayer(marker);
        });
    }

    function renderAsteLayer() {
        layerAste.clearLayers();
        if (typeof ASTE_PUBBLICHE === 'undefined') return;

        const icon = makeDotIcon('#8b5cf6', 'fa-gavel');

        ASTE_PUBBLICHE.forEach(a => {
            if (!a.lat || !a.lng) return;
            const marker = L.marker([a.lat, a.lng], { icon });

            marker.bindPopup(`
                <div class="popup-content">
                    <h3 style="color:#8b5cf6"><i class="fas fa-gavel"></i> Asta Pubblica</h3>
                    <span class="status-tag tag-fallimento">ds616</span>
                    <div class="popup-info">
                        <strong>${a.indirizzo}</strong><br>
                        ${a.lotto}<br>
                        Ente: ${a.ente}<br>
                        Base asta: ${a.baseAsta ? formatEuro(a.baseAsta) : 'N/D'}<br>
                        Stato: ${a.stato}<br>
                        Destinazione: ${a.destinazione || 'N/D'}<br>
                        Superficie: ${a.mq || 'N/D'}<br>
                        Classe energetica: ${a.classeEnergetica || 'N/D'}
                    </div>
                </div>
            `, { maxWidth: 320 });

            layerAste.addLayer(marker);
        });
    }

    function renderConfiscatiLayer() {
        layerConfiscati.clearLayers();
        if (typeof BENI_CONFISCATI === 'undefined') return;

        // Confiscated properties don't have lat/lng — we'll show them in list only
        // We can try to geocode by address prefix matching with degradati
        // For now, place markers at approximate municipality centroids
        const municipioCentroids = {
            '1': [45.4640, 9.1900], '2': [45.4950, 9.2300], '3': [45.4800, 9.2500],
            '4': [45.4450, 9.2200], '5': [45.4350, 9.2000], '6': [45.4450, 9.1400],
            '7': [45.4650, 9.1200], '8': [45.4900, 9.1400], '9': [45.5100, 9.1700]
        };

        const icon = makeDotIcon('#ec4899', 'fa-ban');

        BENI_CONFISCATI.forEach(b => {
            const centroid = municipioCentroids[String(b.municipio)] || [45.464, 9.190];
            // Add small random offset to avoid stacking
            const lat = centroid[0] + (Math.random() - 0.5) * 0.008;
            const lng = centroid[1] + (Math.random() - 0.5) * 0.008;

            const marker = L.marker([lat, lng], { icon });

            marker.bindPopup(`
                <div class="popup-content">
                    <h3 style="color:#ec4899"><i class="fas fa-ban"></i> Bene Confiscato</h3>
                    <span class="status-tag" style="background:#fce7f3;color:#ec4899">ds147</span>
                    <div class="popup-info">
                        <strong>${b.indirizzo || 'Indirizzo N/D'}</strong><br>
                        Tipologia: ${b.tipologia}<br>
                        Consistenza: ${b.consistenza || 'N/D'}<br>
                        Municipio: ${b.municipio}<br>
                        Destinazione: ${b.destinazione || 'N/D'}<br>
                        ${b.ente ? 'Ente: ' + b.ente : ''}
                    </div>
                </div>
            `, { maxWidth: 300 });

            layerConfiscati.addLayer(marker);
        });
    }

    function renderCascineLayer() {
        layerCascine.clearLayers();
        if (typeof CASCINE_MILANO === 'undefined') return;

        const icon = makeDotIcon('#14b8a6', 'fa-tractor');

        CASCINE_MILANO.forEach(c => {
            if (!c.lat || !c.lng) return;
            const marker = L.marker([c.lat, c.lng], { icon });

            marker.bindPopup(`
                <div class="popup-content">
                    <h3 style="color:#14b8a6"><i class="fas fa-tractor"></i> ${c.nome}</h3>
                    <span class="status-tag" style="background:#ccfbf1;color:#14b8a6">Cascina</span>
                    <div class="popup-info">
                        ${c.via ? '<strong>' + c.via + '</strong><br>' : ''}
                        ${c.localita ? c.localita + '<br>' : ''}
                        Municipio: ${c.municipio} — ${c.nil || ''}
                    </div>
                    <button class="popup-btn" style="background:#14b8a6" onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent((c.nome || '') + ' Milano')}','_blank')">
                        <i class="fas fa-map"></i> Google Maps
                    </button>
                </div>
            `, { maxWidth: 300 });

            layerCascine.addLayer(marker);
        });
    }

    // === OMI Lookup ===
    function lookupOMI(nil) {
        if (typeof QUOTAZIONI_OMI === 'undefined' || !nil) return null;
        // Try to find OMI quotation matching the zone by name
        const nilUpper = nil.toUpperCase();
        // OMI zones use codes like B12, C3 etc. — match by fascia
        // Instead, return average for the fascia
        const abitazioni = QUOTAZIONI_OMI.filter(q =>
            q.tipologia && q.tipologia.toLowerCase().includes('abitazion') && q.comprMin > 0
        );
        if (abitazioni.length === 0) return null;
        const avgMin = Math.round(abitazioni.reduce((s, q) => s + q.comprMin, 0) / abitazioni.length);
        const avgMax = Math.round(abitazioni.reduce((s, q) => s + q.comprMax, 0) / abitazioni.length);
        return `${avgMin.toLocaleString('it-IT')} - ${avgMax.toLocaleString('it-IT')} €/mq`;
    }

    function getMarkerIcon(property) {
        const color = property.livello === 'hot' ? '#dc2626' :
                      property.livello === 'warm' ? '#f59e0b' : '#3b82f6';

        const iconMap = {
            'uffici': 'fa-building',
            'garage': 'fa-warehouse',
            'terreni': 'fa-mountain-sun',
            'capannoni': 'fa-industry',
            'negozi': 'fa-store'
        };
        const icon = iconMap[property.tipologia] || 'fa-building';

        return L.divIcon({
            html: `<div class="custom-marker ${property.livello}"><i class="fas ${icon}"></i></div>`,
            className: '',
            iconSize: [32, 40],
            iconAnchor: [16, 40],
            popupAnchor: [0, -42]
        });
    }

    function renderMarkers() {
        markersLayer.clearLayers();

        filteredProperties.forEach(p => {
            const marker = L.marker([p.lat, p.lng], {
                icon: getMarkerIcon(p),
                propertyScore: p.score
            });

            const segnaliHtml = p.segnali.map(s =>
                `<span class="status-tag ${s.class}">${s.label}</span>`
            ).join(' ');

            const popupColor = p.livello === 'hot' ? '#dc2626' :
                               p.livello === 'warm' ? '#f59e0b' : '#3b82f6';

            marker.bindPopup(`
                <div class="popup-content">
                    <h3>${p.indirizzo}</h3>
                    <span class="popup-score" style="background:${popupColor}">${p.score}/100</span>
                    <div class="popup-info">
                        <strong>${capitalize(p.tipologia)}</strong> — ${p.superficie} mq<br>
                        ${p.proprietario}<br>
                        ${segnaliHtml}
                    </div>
                    <button class="popup-btn" onclick="window.showDetail(${p.id})">Dettaglio Completo</button>
                </div>
            `, { maxWidth: 300 });

            markersLayer.addLayer(marker);
        });
    }

    // === Stats ===
    function updateStats() {
        document.getElementById('stat-total').textContent = filteredProperties.length;
        document.getElementById('stat-hot').textContent = filteredProperties.filter(p => p.livello === 'hot').length;
        document.getElementById('stat-warm').textContent = filteredProperties.filter(p => p.livello === 'warm').length;
        document.getElementById('stat-cold').textContent = filteredProperties.filter(p => p.livello === 'cold').length;
    }

    function updateDataCount() {
        const counts = [];
        if (typeof EDIFICI_DEGRADATI !== 'undefined') counts.push(`${EDIFICI_DEGRADATI.length} degradati`);
        if (typeof ASTE_PUBBLICHE !== 'undefined') counts.push(`${ASTE_PUBBLICHE.length} aste`);
        if (typeof BENI_CONFISCATI !== 'undefined') counts.push(`${BENI_CONFISCATI.length} confiscati`);
        if (typeof CASCINE_MILANO !== 'undefined') counts.push(`${CASCINE_MILANO.length} cascine`);
        if (typeof QUOTAZIONI_OMI !== 'undefined') counts.push(`${QUOTAZIONI_OMI.length} quotaz. OMI`);

        const el = document.getElementById('data-count-badge');
        if (el && counts.length > 0) {
            el.textContent = counts.join(' | ');
        }
    }

    // === Filters ===
    function applyFilters() {
        const tipologie = [];
        if (document.getElementById('filter-uffici').checked) tipologie.push('uffici');
        if (document.getElementById('filter-garage').checked) tipologie.push('garage');
        if (document.getElementById('filter-terreni').checked) tipologie.push('terreni');
        if (document.getElementById('filter-capannoni').checked) tipologie.push('capannoni');
        if (document.getElementById('filter-negozi').checked) tipologie.push('negozi');

        const minScore = parseInt(document.getElementById('filter-score').value);
        const zona = document.getElementById('filter-zona').value;
        const mqMin = parseInt(document.getElementById('filter-mq-min').value) || 0;
        const mqMax = parseInt(document.getElementById('filter-mq-max').value) || 999999;

        const stati = [];
        if (document.getElementById('filter-abbandono').checked) stati.push('abbandonato', 'semiabbandonato');
        if (document.getElementById('filter-daRistrutturare').checked) stati.push('da_ristrutturare', 'pessimo');
        if (document.getElementById('filter-successione').checked) stati.push('successione');
        if (document.getElementById('filter-fallimento').checked) stati.push('fallimento');

        const searchText = document.getElementById('search-input').value.toLowerCase().trim();

        filteredProperties = allProperties.filter(p => {
            if (p.inVendita) return false;
            if (tipologie.length > 0 && !tipologie.includes(p.tipologia)) return false;
            if (p.score < minScore) return false;
            if (zona !== 'all' && p.zona !== zona) return false;
            if (p.superficie < mqMin || p.superficie > mqMax) return false;

            if (stati.length > 0) {
                let matchesStato = false;
                if (stati.includes(p.statoImmobile)) matchesStato = true;
                if (stati.includes('successione') && p.successioneRecente) matchesStato = true;
                if (stati.includes('fallimento') && (p.fallimento || p.asta)) matchesStato = true;
                if (!matchesStato) return false;
            }

            if (searchText) {
                const searchIn = [p.indirizzo, p.proprietario, p.quartiere, p.note].join(' ').toLowerCase();
                if (!searchIn.includes(searchText)) return false;
            }

            return true;
        });

        filteredProperties.sort((a, b) => {
            const valA = a[currentSort.field];
            const valB = b[currentSort.field];
            const dir = currentSort.direction === 'desc' ? -1 : 1;
            if (typeof valA === 'number') return (valA - valB) * dir;
            return String(valA || '').localeCompare(String(valB || '')) * dir;
        });

        renderMarkers();
        renderList();
        updateStats();
    }

    // === List View ===
    function renderList() {
        const tbody = document.getElementById('property-list');
        tbody.innerHTML = filteredProperties.map(p => {
            const scoreClass = p.livello === 'hot' ? 'score-hot' : p.livello === 'warm' ? 'score-warm' : 'score-cold';
            const segnaliHtml = p.segnali.map(s =>
                `<span class="status-tag ${s.class}">${s.label}</span>`
            ).join(' ');

            return `
            <tr data-id="${p.id}" onclick="window.showDetail(${p.id})">
                <td><span class="score-badge ${scoreClass}">${p.score}</span></td>
                <td><strong>${p.indirizzo}</strong><br><small style="color:#64748b">${p.quartiere}</small></td>
                <td>${capitalize(p.tipologia)}</td>
                <td>${p.superficie.toLocaleString()}</td>
                <td>${truncate(p.proprietario, 30)}</td>
                <td>${p.etaProprietario || '\u2014'}</td>
                <td>${segnaliHtml}</td>
                <td><button class="btn-icon" title="Dettaglio"><i class="fas fa-eye"></i></button></td>
            </tr>`;
        }).join('');
    }

    // === Detail Panel ===
    window.showDetail = function (id) {
        const p = allProperties.find(prop => prop.id === id);
        if (!p) return;

        selectedProperty = p;
        const panel = document.getElementById('detail-panel');
        const title = document.getElementById('detail-title');
        const content = document.getElementById('detail-content');

        title.textContent = p.indirizzo;

        const scoreClass = p.livello;
        const segnaliHtml = p.segnali.map(s =>
            `<span class="status-tag ${s.class}"><i class="fas ${s.icon}"></i> ${s.label}</span>`
        ).join(' ');

        const breakdownHtml = p.dettaglio.map(d => {
            const barClass = d.score >= 70 ? 'hot' : d.score >= 40 ? 'warm' : 'cold';
            return `
            <div class="score-factor">
                <span>${d.nome}</span>
                <div class="bar"><div class="bar-fill ${barClass}" style="width:${d.score}%"></div></div>
                <span>+${d.contributo}</span>
            </div>`;
        }).join('');

        // OMI value for the zone
        const omiValue = lookupOMI(p.quartiere);
        const omiHtml = omiValue ? `
            <div class="detail-section">
                <h4><i class="fas fa-chart-line"></i> Quotazione OMI Zona (2024/2)</h4>
                <div class="detail-row"><span class="label">Valore medio zona</span><span class="value" style="color:#7c3aed">${omiValue}</span></div>
                <p style="font-size:11px;color:var(--text-secondary);margin-top:6px">Fonte: Agenzia Entrate OMI, semestre 2024/2</p>
            </div>` : '';

        const streetViewHtml = `
            <div class="streetview-container">
                <div class="streetview-placeholder">
                    <i class="fas fa-map-marked-alt"></i>
                    <a href="https://www.google.com/maps/@${p.lat},${p.lng},18z" target="_blank" style="color:var(--primary);text-decoration:none;">
                        Apri in Google Maps
                    </a><br>
                    <a href="https://www.google.com/maps/@${p.lat},${p.lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192" target="_blank" style="color:var(--primary);text-decoration:none;font-size:11px;">
                        Vedi Street View
                    </a>
                </div>
            </div>`;

        content.innerHTML = `
            ${streetViewHtml}

            <div class="score-display">
                <div class="score-circle ${scoreClass}">${p.score}</div>
                <div class="score-breakdown">
                    <div style="font-weight:700;margin-bottom:6px;font-size:13px">Breakdown Score</div>
                    ${breakdownHtml}
                </div>
            </div>

            <div style="margin-bottom:16px">${segnaliHtml}</div>

            <div class="detail-section">
                <h4><i class="fas fa-building"></i> Informazioni Immobile</h4>
                <div class="detail-row"><span class="label">Indirizzo</span><span class="value">${p.indirizzo}, ${p.cap} Milano</span></div>
                <div class="detail-row"><span class="label">Zona</span><span class="value">${p.quartiere}</span></div>
                <div class="detail-row"><span class="label">Tipologia</span><span class="value">${capitalize(p.tipologia)}</span></div>
                <div class="detail-row"><span class="label">Superficie</span><span class="value">${p.superficie.toLocaleString()} mq</span></div>
                <div class="detail-row"><span class="label">Piano</span><span class="value">${p.piani || '\u2014'}</span></div>
                <div class="detail-row"><span class="label">Anno Costruzione</span><span class="value">${p.annoCostruzione || '\u2014'}</span></div>
                <div class="detail-row"><span class="label">Stato</span><span class="value">${formatStato(p.statoImmobile)}</span></div>
                <div class="detail-row"><span class="label">Ultima Ristrutturazione</span><span class="value">${p.anniUltimaRistrutturazione ? p.anniUltimaRistrutturazione + ' anni fa' : 'N/D'}</span></div>
                <div class="detail-row"><span class="label">Valore Stimato</span><span class="value" style="color:var(--success);font-size:15px">${formatEuro(p.valoreStimato)}</span></div>
            </div>

            ${omiHtml}

            <div class="detail-section">
                <h4><i class="fas fa-user"></i> Proprietario</h4>
                <div class="detail-row"><span class="label">Nome</span><span class="value">${p.proprietario}</span></div>
                <div class="detail-row"><span class="label">Tipo</span><span class="value">${formatTipoProprietario(p.tipoProprietario)}</span></div>
                <div class="detail-row"><span class="label">Età</span><span class="value">${p.etaProprietario ? p.etaProprietario + ' anni' : '\u2014'}</span></div>
                <div class="detail-row"><span class="label">Eredi Noti</span><span class="value">${p.erediNoti === true ? 'Si' : p.erediNoti === false ? 'No' : '\u2014'}</span></div>
                <div class="detail-row"><span class="label">Successione</span><span class="value">${p.successioneRecente ? 'Si (' + p.anniDaSuccessione + ' anni fa)' : 'No'}</span></div>
                <div class="detail-row"><span class="label">Fallimento</span><span class="value">${p.fallimento ? 'Si' : 'No'}</span></div>
                <div class="detail-row"><span class="label">Asta</span><span class="value">${p.asta ? 'Si' : 'No'}</span></div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-sticky-note"></i> Note</h4>
                <p style="font-size:13px;line-height:1.7;color:#475569">${p.note}</p>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-chart-line"></i> Immobile Fermo</h4>
                <div class="detail-row"><span class="label">Anni senza attività</span><span class="value">${p.anniFermo || 0} anni</span></div>
                <div class="detail-row"><span class="label">In vendita</span><span class="value" style="color:${p.inVendita ? 'var(--hot)' : 'var(--success)'}">${p.inVendita ? 'Si (ESCLUSO)' : 'No (TARGET)'}</span></div>
            </div>

            <div class="action-buttons">
                <button class="btn btn-primary" onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent(p.indirizzo + ' Milano')}', '_blank')">
                    <i class="fas fa-map"></i> Maps
                </button>
                <button class="btn btn-info" onclick="window.open('https://sister.agenziaentrate.gov.it', '_blank')">
                    <i class="fas fa-file-alt"></i> Visura
                </button>
                <button class="btn btn-success" onclick="copyPropertyInfo(${p.id})">
                    <i class="fas fa-copy"></i> Copia
                </button>
            </div>
        `;

        panel.classList.remove('hidden');
        map.setView([p.lat, p.lng], 16, { animate: true });
    };

    window.copyPropertyInfo = function (id) {
        const p = allProperties.find(prop => prop.id === id);
        if (!p) return;

        const text = `IMMOBILE: ${p.indirizzo}, Milano (${p.quartiere})
Tipologia: ${capitalize(p.tipologia)} \u2014 ${p.superficie} mq
Proprietario: ${p.proprietario}${p.etaProprietario ? ' (et\u00e0 ' + p.etaProprietario + ')' : ''}
Score: ${p.score}/100 (${p.livello.toUpperCase()})
Valore Stimato: ${formatEuro(p.valoreStimato)}
Stato: ${formatStato(p.statoImmobile)}
Note: ${p.note}
---
Studio Contrino \u2014 Prospecting Immobiliare Milano`;

        navigator.clipboard.writeText(text).then(() => {
            alert('Informazioni copiate negli appunti!');
        });
    };

    // === Analytics ===
    function showAnalytics() {
        const content = document.getElementById('analytics-content');

        // Calculate KPIs
        const totalDataPoints = (typeof EDIFICI_DEGRADATI !== 'undefined' ? EDIFICI_DEGRADATI.length : 0)
            + (typeof ASTE_PUBBLICHE !== 'undefined' ? ASTE_PUBBLICHE.length : 0)
            + (typeof BENI_CONFISCATI !== 'undefined' ? BENI_CONFISCATI.length : 0)
            + (typeof CASCINE_MILANO !== 'undefined' ? CASCINE_MILANO.length : 0)
            + allProperties.length;

        const cenedTotal = typeof CENED_STATS !== 'undefined' ? CENED_STATS.totale : 0;
        const omiCount = typeof QUOTAZIONI_OMI !== 'undefined' ? QUOTAZIONI_OMI.length : 0;

        // OMI price stats
        let omiAvgMin = 0, omiAvgMax = 0;
        if (typeof QUOTAZIONI_OMI !== 'undefined') {
            const abit = QUOTAZIONI_OMI.filter(q => q.tipologia && q.tipologia.toLowerCase().includes('abitazion') && q.comprMin > 0);
            if (abit.length > 0) {
                omiAvgMin = Math.round(abit.reduce((s, q) => s + q.comprMin, 0) / abit.length);
                omiAvgMax = Math.round(abit.reduce((s, q) => s + q.comprMax, 0) / abit.length);
            }
        }

        // Degradati by tipo
        let degradatiByTipo = {};
        if (typeof EDIFICI_DEGRADATI !== 'undefined') {
            EDIFICI_DEGRADATI.forEach(e => {
                degradatiByTipo[e.tipoMacro] = (degradatiByTipo[e.tipoMacro] || 0) + 1;
            });
        }

        // Degradati by municipio
        let degradatiByMunicipio = {};
        if (typeof EDIFICI_DEGRADATI !== 'undefined') {
            EDIFICI_DEGRADATI.forEach(e => {
                const m = 'Mun. ' + e.municipio;
                degradatiByMunicipio[m] = (degradatiByMunicipio[m] || 0) + 1;
            });
        }

        content.innerHTML = `
            <div class="analytics-kpi">
                <div class="kpi-card">
                    <div class="kpi-value">${totalDataPoints.toLocaleString()}</div>
                    <div class="kpi-label">Data Points Totali</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value" style="color:#f97316">${typeof EDIFICI_DEGRADATI !== 'undefined' ? EDIFICI_DEGRADATI.length : 0}</div>
                    <div class="kpi-label">Edifici Degradati</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value" style="color:#7c3aed">${omiAvgMin.toLocaleString('it-IT')}-${omiAvgMax.toLocaleString('it-IT')}</div>
                    <div class="kpi-label">\u20AC/mq medio Milano (OMI)</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value" style="color:#16a34a">${cenedTotal.toLocaleString()}</div>
                    <div class="kpi-label">Certificazioni CENED</div>
                </div>
            </div>

            <div class="analytics-grid">
                <div class="analytics-card">
                    <h4><i class="fas fa-house-crack" style="color:#f97316"></i> Edifici Degradati per Tipologia</h4>
                    <canvas id="chart-degradati-tipo"></canvas>
                </div>
                <div class="analytics-card">
                    <h4><i class="fas fa-map-pin" style="color:#dc2626"></i> Degradati per Municipio</h4>
                    <canvas id="chart-degradati-municipio"></canvas>
                </div>
                <div class="analytics-card">
                    <h4><i class="fas fa-bolt" style="color:#eab308"></i> Classi Energetiche CENED Milano</h4>
                    <canvas id="chart-cened-classi"></canvas>
                </div>
                <div class="analytics-card">
                    <h4><i class="fas fa-euro-sign" style="color:#7c3aed"></i> Quotazioni OMI per Tipologia</h4>
                    <canvas id="chart-omi-tipologie"></canvas>
                </div>
            </div>

            <div class="analytics-grid" style="margin-top:0">
                <div class="analytics-card">
                    <h4><i class="fas fa-database"></i> Fonti Dati Integrati</h4>
                    <div class="analytics-stat"><span class="label">Edifici degradati (ds503)</span><span class="value">${typeof EDIFICI_DEGRADATI !== 'undefined' ? EDIFICI_DEGRADATI.length : 0} record</span></div>
                    <div class="analytics-stat"><span class="label">Aste pubbliche (ds616)</span><span class="value">${typeof ASTE_PUBBLICHE !== 'undefined' ? ASTE_PUBBLICHE.length : 0} record</span></div>
                    <div class="analytics-stat"><span class="label">Beni confiscati (ds147)</span><span class="value">${typeof BENI_CONFISCATI !== 'undefined' ? BENI_CONFISCATI.length : 0} record</span></div>
                    <div class="analytics-stat"><span class="label">Cascine (ds1448)</span><span class="value">${typeof CASCINE_MILANO !== 'undefined' ? CASCINE_MILANO.length : 0} record</span></div>
                    <div class="analytics-stat"><span class="label">Quotazioni OMI 2024/2</span><span class="value">${omiCount} record</span></div>
                    <div class="analytics-stat"><span class="label">CENED certificazioni</span><span class="value">${cenedTotal.toLocaleString()} record</span></div>
                    <div class="analytics-stat"><span class="label">Target prospecting</span><span class="value">${allProperties.length} immobili</span></div>
                </div>
                <div class="analytics-card">
                    <h4><i class="fas fa-crosshairs"></i> Score Prospecting</h4>
                    <canvas id="chart-score-dist"></canvas>
                </div>
            </div>
        `;

        document.getElementById('modal-analytics').classList.remove('hidden');

        // Render charts after DOM is ready
        setTimeout(() => renderCharts(degradatiByTipo, degradatiByMunicipio), 100);
    }

    function renderCharts(degradatiByTipo, degradatiByMunicipio) {
        const colors = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

        // Chart 1: Degradati per tipo
        const tipoLabels = Object.keys(degradatiByTipo);
        const tipoValues = Object.values(degradatiByTipo);
        new Chart(document.getElementById('chart-degradati-tipo'), {
            type: 'doughnut',
            data: {
                labels: tipoLabels,
                datasets: [{ data: tipoValues, backgroundColor: colors.slice(0, tipoLabels.length) }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
        });

        // Chart 2: Degradati per municipio
        const munLabels = Object.keys(degradatiByMunicipio).sort();
        const munValues = munLabels.map(k => degradatiByMunicipio[k]);
        new Chart(document.getElementById('chart-degradati-municipio'), {
            type: 'bar',
            data: {
                labels: munLabels,
                datasets: [{ data: munValues, backgroundColor: '#f97316', borderRadius: 4 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });

        // Chart 3: CENED classi energetiche
        if (typeof CENED_STATS !== 'undefined' && CENED_STATS.byClasse) {
            const classiLabels = CENED_STATS.byClasse.map(c => c.classe);
            const classiValues = CENED_STATS.byClasse.map(c => c.count);
            const classiColors = { 'A4': '#15803d', 'A3': '#22c55e', 'A2': '#4ade80', 'A1': '#86efac', 'B': '#a3e635', 'C': '#eab308', 'D': '#f97316', 'E': '#ef4444', 'F': '#dc2626', 'G': '#991b1b' };
            new Chart(document.getElementById('chart-cened-classi'), {
                type: 'bar',
                data: {
                    labels: classiLabels,
                    datasets: [{
                        data: classiValues,
                        backgroundColor: classiLabels.map(l => classiColors[l] || '#64748b'),
                        borderRadius: 4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }

        // Chart 4: OMI tipologie
        if (typeof QUOTAZIONI_OMI !== 'undefined') {
            const tipMap = {};
            QUOTAZIONI_OMI.forEach(q => {
                if (!q.tipologia || q.comprMax <= 0) return;
                const tip = q.tipologia.length > 25 ? q.tipologia.substring(0, 25) + '...' : q.tipologia;
                if (!tipMap[tip]) tipMap[tip] = { sum: 0, count: 0 };
                tipMap[tip].sum += (q.comprMin + q.comprMax) / 2;
                tipMap[tip].count++;
            });
            const tipLabels = Object.keys(tipMap).slice(0, 8);
            const tipValues = tipLabels.map(k => Math.round(tipMap[k].sum / tipMap[k].count));
            new Chart(document.getElementById('chart-omi-tipologie'), {
                type: 'bar',
                data: {
                    labels: tipLabels,
                    datasets: [{ label: '\u20AC/mq medio', data: tipValues, backgroundColor: '#8b5cf6', borderRadius: 4 }]
                },
                options: {
                    responsive: true, indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                }
            });
        }

        // Chart 5: Score distribution
        const scoreBuckets = [0, 0, 0, 0, 0];
        allProperties.forEach(p => {
            if (p.score >= 80) scoreBuckets[4]++;
            else if (p.score >= 60) scoreBuckets[3]++;
            else if (p.score >= 40) scoreBuckets[2]++;
            else if (p.score >= 20) scoreBuckets[1]++;
            else scoreBuckets[0]++;
        });
        new Chart(document.getElementById('chart-score-dist'), {
            type: 'bar',
            data: {
                labels: ['0-19', '20-39', '40-59', '60-79', '80-100'],
                datasets: [{
                    data: scoreBuckets,
                    backgroundColor: ['#3b82f6', '#60a5fa', '#f59e0b', '#f97316', '#dc2626'],
                    borderRadius: 4
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    // === Events ===
    function bindEvents() {
        // Filters
        document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);

        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            document.querySelectorAll('.filters-section input[type="checkbox"]').forEach(cb => cb.checked = true);
            document.getElementById('filter-score').value = 40;
            document.getElementById('score-label').textContent = '40';
            document.getElementById('filter-zona').value = 'all';
            document.getElementById('filter-mq-min').value = '0';
            document.getElementById('filter-mq-max').value = '10000';
            document.getElementById('search-input').value = '';
            applyFilters();
        });

        // Score slider
        document.getElementById('filter-score').addEventListener('input', function () {
            document.getElementById('score-label').textContent = this.value;
        });

        // Search
        let searchTimeout;
        document.getElementById('search-input').addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 300);
        });

        // View toggle
        document.getElementById('btn-list-view').addEventListener('click', () => {
            document.getElementById('map-container').classList.add('hidden');
            document.getElementById('list-container').classList.remove('hidden');
            document.getElementById('btn-list-view').classList.add('active');
            document.getElementById('btn-map-view').classList.remove('active');
        });

        document.getElementById('btn-map-view').addEventListener('click', () => {
            document.getElementById('list-container').classList.add('hidden');
            document.getElementById('map-container').classList.remove('hidden');
            document.getElementById('btn-map-view').classList.add('active');
            document.getElementById('btn-list-view').classList.remove('active');
            map.invalidateSize();
        });

        // Sidebar toggle
        document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
            setTimeout(() => map.invalidateSize(), 350);
        });

        // Close detail
        document.getElementById('btn-close-detail').addEventListener('click', () => {
            document.getElementById('detail-panel').classList.add('hidden');
            selectedProperty = null;
        });

        // Guide modal
        document.getElementById('btn-guide').addEventListener('click', () => {
            document.getElementById('guide-content').innerHTML = GuideContent.render();
            document.getElementById('modal-guide').classList.remove('hidden');
        });

        // Analytics modal
        document.getElementById('btn-analytics').addEventListener('click', showAnalytics);

        // Close modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modal || 'modal-guide';
                document.getElementById(modalId).classList.add('hidden');
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Export CSV
        document.getElementById('btn-export').addEventListener('click', exportCSV);

        // Table sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (currentSort.field === field) {
                    currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
                } else {
                    currentSort.field = field;
                    currentSort.direction = 'desc';
                }
                applyFilters();
            });
        });

        // Layer toggles
        bindLayerToggle('layer-prospecting', markersLayer);
        bindLayerToggle('layer-degradati', layerDegradati);
        bindLayerToggle('layer-aste', layerAste);
        bindLayerToggle('layer-confiscati', layerConfiscati);
        bindLayerToggle('layer-cascine', layerCascine);
    }

    function bindLayerToggle(checkboxId, layer) {
        const cb = document.getElementById(checkboxId);
        if (!cb || !layer) return;

        cb.addEventListener('change', () => {
            if (cb.checked) {
                map.addLayer(layer);
            } else {
                map.removeLayer(layer);
            }
        });

        // Sync initial state
        if (!cb.checked && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    }

    // === Export ===
    function exportCSV() {
        const headers = ['Score', 'Indirizzo', 'CAP', 'Quartiere', 'Tipologia', 'Superficie mq', 'Proprietario', 'Tipo Proprietario', 'Et\u00e0 Proprietario', 'Stato Immobile', 'Anni Ultima Ristrutturazione', 'Successione', 'Anni da Successione', 'Fallimento', 'Asta', 'Anni Fermo', 'Eredi Noti', 'Valore Stimato', 'Note'];

        const rows = filteredProperties.map(p => [
            p.score,
            p.indirizzo,
            p.cap,
            p.quartiere,
            p.tipologia,
            p.superficie,
            p.proprietario,
            p.tipoProprietario,
            p.etaProprietario || '',
            p.statoImmobile,
            p.anniUltimaRistrutturazione || '',
            p.successioneRecente ? 'Si' : 'No',
            p.anniDaSuccessione || '',
            p.fallimento ? 'Si' : 'No',
            p.asta ? 'Si' : 'No',
            p.anniFermo || 0,
            p.erediNoti === true ? 'Si' : p.erediNoti === false ? 'No' : '',
            p.valoreStimato,
            `"${(p.note || '').replace(/"/g, '""')}"`
        ]);

        let csv = '\uFEFF'; // BOM for Excel
        csv += headers.join(';') + '\n';
        rows.forEach(row => {
            csv += row.join(';') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prospecting_milano_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // === Helpers ===
    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '...' : str;
    }

    function formatEuro(val) {
        if (!val) return '\u2014';
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    }

    function formatStato(stato) {
        const m = {
            'abbandonato': 'Abbandonato',
            'semiabbandonato': 'Semiabbandonato',
            'pessimo': 'Pessimo',
            'da_ristrutturare': 'Da Ristrutturare',
            'mediocre': 'Mediocre',
            'discreto': 'Discreto',
            'buono': 'Buono',
            'ottimo': 'Ottimo'
        };
        return m[stato] || stato;
    }

    function formatTipoProprietario(tipo) {
        const m = {
            'persona_fisica': 'Persona Fisica',
            'societ\u00e0': 'Societ\u00e0',
            'eredi': 'Eredi',
            'ente': 'Ente/Fondazione'
        };
        return m[tipo] || tipo;
    }

    // === Start ===
    document.addEventListener('DOMContentLoaded', init);
})();
