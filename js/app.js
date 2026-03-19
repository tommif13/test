/**
 * App principale — Dashboard Prospecting Immobiliare
 * Gruppo Contrino — project & real estate since 1930
 *
 * SOLO DATI REALI Open Data:
 * - EDIFICI_DEGRADATI (ds503) — Edifici degradati/abbandonati (Comune di Milano)
 * - ASTE_PUBBLICHE (ds616) — Aste di vendita immobili pubblici (Comune di Milano)
 * - BENI_CONFISCATI (ds147) — Beni immobili confiscati (Comune di Milano)
 * - CASCINE_MILANO (ds1448) — Cascine (Comune di Milano)
 * - QUOTAZIONI_OMI (ds2940) — Quotazioni mercato (Agenzia Entrate)
 * - CENED_STATS — Certificazione energetica (Regione Lombardia)
 */

(function () {
    'use strict';

    // === State ===
    let map;
    let layerDegradati;
    let layerAste;
    let layerConfiscati;
    let layerCascine;
    let allDegradati = [];
    let filteredDegradati = [];
    let currentSort = { field: 'municipio', direction: 'asc' };

    // === Init ===
    function init() {
        if (typeof EDIFICI_DEGRADATI !== 'undefined') {
            allDegradati = EDIFICI_DEGRADATI.map(e => ({ ...e }));
        }
        filteredDegradati = [...allDegradati];

        initMap();
        applyFilters();
        renderLayers();
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

        layerDegradati = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: '<div style="background:#f97316;color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">' + count + '</div>',
                    className: '',
                    iconSize: [40, 40]
                });
            }
        });

        layerAste = L.layerGroup();
        layerConfiscati = L.layerGroup();
        layerCascine = L.layerGroup();

        map.addLayer(layerDegradati);
    }

    // === Render layers ===
    function renderLayers() {
        renderAsteLayer();
        renderConfiscatiLayer();
        renderCascineLayer();
    }

    function makeDotIcon(color, icon) {
        return L.divIcon({
            html: '<div style="background:' + color + ';width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"><i class="fas ' + icon + '" style="color:white;font-size:10px;transform:none"></i></div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -14]
        });
    }

    function renderDegradatiMarkers() {
        layerDegradati.clearLayers();

        const icon = makeDotIcon('#f97316', 'fa-house-crack');

        filteredDegradati.forEach(e => {
            if (!e.lat || !e.lng) return;
            const marker = L.marker([e.lat, e.lng], { icon });

            const omiValue = lookupOMI(e.nil);

            marker.bindPopup(`
                <div class="popup-content">
                    <h3 style="color:#f97316"><i class="fas fa-house-crack"></i> Edificio Degradato</h3>
                    <span class="status-tag tag-abbandono">Open Data Comune MI — ds503</span>
                    <div class="popup-info">
                        <strong>${e.indirizzo}</strong><br>
                        Tipo: ${e.tipoMacro}<br>
                        Municipio: ${e.municipio} — ${e.nil}<br>
                        Codice: ${e.codice}
                        ${omiValue ? '<br><strong style="color:#16a34a">Valore OMI zona: ' + omiValue + '</strong>' : ''}
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
                    <span class="status-tag tag-fallimento">Open Data Comune MI — ds616</span>
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
                    <button class="popup-btn" style="background:#8b5cf6" onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent(a.indirizzo + ' Milano')}','_blank')">
                        <i class="fas fa-map"></i> Google Maps
                    </button>
                </div>
            `, { maxWidth: 320 });

            layerAste.addLayer(marker);
        });
    }

    function renderConfiscatiLayer() {
        layerConfiscati.clearLayers();
        if (typeof BENI_CONFISCATI === 'undefined') return;

        const icon = makeDotIcon('#ec4899', 'fa-ban');

        // Beni confiscati hanno solo indirizzo, non coordinate GPS reali.
        // Li mostriamo solo nella lista, non sulla mappa, per non dare posizioni false.
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
                    <span class="status-tag" style="background:#ccfbf1;color:#14b8a6">Open Data Comune MI — ds1448</span>
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
        const abitazioni = QUOTAZIONI_OMI.filter(q =>
            q.tipologia && q.tipologia.toLowerCase().includes('abitazion') && q.comprMin > 0
        );
        if (abitazioni.length === 0) return null;
        const avgMin = Math.round(abitazioni.reduce((s, q) => s + q.comprMin, 0) / abitazioni.length);
        const avgMax = Math.round(abitazioni.reduce((s, q) => s + q.comprMax, 0) / abitazioni.length);
        return avgMin.toLocaleString('it-IT') + ' - ' + avgMax.toLocaleString('it-IT') + ' \u20AC/mq';
    }

    // === Stats ===
    function updateStats() {
        document.getElementById('stat-degradati').textContent = filteredDegradati.length;
        document.getElementById('stat-aste').textContent = typeof ASTE_PUBBLICHE !== 'undefined' ? ASTE_PUBBLICHE.length : 0;
        document.getElementById('stat-confiscati').textContent = typeof BENI_CONFISCATI !== 'undefined' ? BENI_CONFISCATI.length : 0;
        document.getElementById('stat-cascine').textContent = typeof CASCINE_MILANO !== 'undefined' ? CASCINE_MILANO.length : 0;
    }

    function updateDataCount() {
        const counts = [];
        if (typeof EDIFICI_DEGRADATI !== 'undefined') counts.push(EDIFICI_DEGRADATI.length + ' degradati');
        if (typeof ASTE_PUBBLICHE !== 'undefined') counts.push(ASTE_PUBBLICHE.length + ' aste');
        if (typeof BENI_CONFISCATI !== 'undefined') counts.push(BENI_CONFISCATI.length + ' confiscati');
        if (typeof CASCINE_MILANO !== 'undefined') counts.push(CASCINE_MILANO.length + ' cascine');
        if (typeof QUOTAZIONI_OMI !== 'undefined') counts.push(QUOTAZIONI_OMI.length + ' quotaz. OMI');

        const el = document.getElementById('data-count-badge');
        if (el && counts.length > 0) {
            el.textContent = counts.join(' | ');
        }
    }

    // === Filters ===
    function applyFilters() {
        const tipoMacro = document.getElementById('filter-tipo').value;
        const municipio = document.getElementById('filter-municipio').value;
        const searchText = document.getElementById('search-input').value.toLowerCase().trim();

        filteredDegradati = allDegradati.filter(e => {
            if (tipoMacro !== 'all' && e.tipoMacro !== tipoMacro) return false;
            if (municipio !== 'all' && String(e.municipio) !== municipio) return false;
            if (searchText) {
                const searchIn = [e.indirizzo, e.nil, e.codice, e.tipoMacro].join(' ').toLowerCase();
                if (!searchIn.includes(searchText)) return false;
            }
            return true;
        });

        filteredDegradati.sort((a, b) => {
            const valA = a[currentSort.field];
            const valB = b[currentSort.field];
            const dir = currentSort.direction === 'desc' ? -1 : 1;
            if (typeof valA === 'number') return (valA - valB) * dir;
            return String(valA || '').localeCompare(String(valB || '')) * dir;
        });

        renderDegradatiMarkers();
        renderList();
        updateStats();
    }

    // === List View ===
    function renderList() {
        const tbody = document.getElementById('property-list');
        tbody.innerHTML = filteredDegradati.map(e => {
            const omiValue = lookupOMI(e.nil);
            return `
            <tr data-id="${e.id}" onclick="window.showDetail(${e.id})">
                <td><span class="status-tag tag-abbandono">${e.tipoMacro}</span></td>
                <td><strong>${e.indirizzo}</strong><br><small style="color:#64748b">${e.nil}</small></td>
                <td>${e.municipio}</td>
                <td>${e.codice}</td>
                <td>${omiValue || '\u2014'}</td>
                <td>
                    <button class="btn-icon" title="Google Maps" onclick="event.stopPropagation();window.open('https://www.google.com/maps/search/${encodeURIComponent(e.indirizzo + ' Milano')}','_blank')">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <button class="btn-icon" title="Dettaglio" onclick="event.stopPropagation();window.showDetail(${e.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    // === Detail Panel ===
    window.showDetail = function (id) {
        const e = allDegradati.find(item => item.id === id);
        if (!e) return;

        const panel = document.getElementById('detail-panel');
        const title = document.getElementById('detail-title');
        const content = document.getElementById('detail-content');

        title.textContent = e.indirizzo;

        const omiValue = lookupOMI(e.nil);

        content.innerHTML = `
            <div class="streetview-container">
                <div class="streetview-placeholder">
                    <i class="fas fa-map-marked-alt"></i>
                    <a href="https://www.google.com/maps/@${e.lat},${e.lng},18z" target="_blank" style="color:var(--primary);text-decoration:none;">
                        Apri in Google Maps
                    </a><br>
                    <a href="https://www.google.com/maps/@${e.lat},${e.lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192" target="_blank" style="color:var(--primary);text-decoration:none;font-size:11px;">
                        Vedi Street View
                    </a>
                </div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-house-crack" style="color:#f97316"></i> Edificio Degradato — Open Data</h4>
                <div class="detail-row"><span class="label">Fonte</span><span class="value">Comune di Milano — ds503</span></div>
                <div class="detail-row"><span class="label">Indirizzo</span><span class="value">${e.indirizzo}, Milano</span></div>
                <div class="detail-row"><span class="label">Tipo Macro</span><span class="value">${e.tipoMacro}</span></div>
                <div class="detail-row"><span class="label">Municipio</span><span class="value">${e.municipio}</span></div>
                <div class="detail-row"><span class="label">NIL (Quartiere)</span><span class="value">${e.nil}</span></div>
                <div class="detail-row"><span class="label">Codice</span><span class="value">${e.codice}</span></div>
                <div class="detail-row"><span class="label">Coordinate</span><span class="value">${e.lat.toFixed(6)}, ${e.lng.toFixed(6)}</span></div>
            </div>

            ${omiValue ? '<div class="detail-section"><h4><i class="fas fa-chart-line" style="color:#7c3aed"></i> Quotazione OMI Zona</h4><div class="detail-row"><span class="label">Valore medio abitazioni</span><span class="value" style="color:#7c3aed">' + omiValue + '</span></div><p style="font-size:11px;color:var(--text-secondary);margin-top:6px">Fonte: Agenzia Entrate OMI</p></div>' : ''}

            <div class="detail-section">
                <h4><i class="fas fa-search"></i> Prossimi Passi</h4>
                <p style="font-size:13px;line-height:1.7;color:#475569">
                    Per approfondire questo immobile, consulta:<br>
                    1. <strong>Catasto (Sister)</strong> — visura per identificare il proprietario<br>
                    2. <strong>Conservatoria</strong> — visura ipotecaria per successioni/passaggi<br>
                    3. <strong>Camera di Commercio</strong> — se proprietario \u00e8 societ\u00e0, verificare stato<br>
                    4. <strong>Tribunale</strong> — verificare eventuali procedure
                </p>
            </div>

            <div class="action-buttons">
                <button class="btn btn-primary" onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent(e.indirizzo + ' Milano')}', '_blank')">
                    <i class="fas fa-map"></i> Maps
                </button>
                <button class="btn btn-info" onclick="window.open('https://sister.agenziaentrate.gov.it', '_blank')">
                    <i class="fas fa-file-alt"></i> Visura Catastale
                </button>
                <button class="btn btn-success" onclick="window.copyPropertyInfo(${e.id})">
                    <i class="fas fa-copy"></i> Copia
                </button>
            </div>
        `;

        panel.classList.remove('hidden');
        map.setView([e.lat, e.lng], 16, { animate: true });
    };

    window.copyPropertyInfo = function (id) {
        const e = allDegradati.find(item => item.id === id);
        if (!e) return;

        const omiValue = lookupOMI(e.nil);
        const text = 'EDIFICIO DEGRADATO: ' + e.indirizzo + ', Milano\n' +
            'Tipo: ' + e.tipoMacro + '\n' +
            'Municipio: ' + e.municipio + ' \u2014 ' + e.nil + '\n' +
            'Codice: ' + e.codice + '\n' +
            (omiValue ? 'Valore OMI zona: ' + omiValue + '\n' : '') +
            'Fonte: Open Data Comune di Milano (ds503)\n' +
            '---\n' +
            'Gruppo Contrino \u2014 Prospecting Immobiliare Milano';

        navigator.clipboard.writeText(text).then(() => {
            alert('Informazioni copiate negli appunti!');
        });
    };

    // === Analytics ===
    function showAnalytics() {
        const content = document.getElementById('analytics-content');

        const totalDataPoints = (typeof EDIFICI_DEGRADATI !== 'undefined' ? EDIFICI_DEGRADATI.length : 0)
            + (typeof ASTE_PUBBLICHE !== 'undefined' ? ASTE_PUBBLICHE.length : 0)
            + (typeof BENI_CONFISCATI !== 'undefined' ? BENI_CONFISCATI.length : 0)
            + (typeof CASCINE_MILANO !== 'undefined' ? CASCINE_MILANO.length : 0);

        const cenedTotal = typeof CENED_STATS !== 'undefined' ? CENED_STATS.totale : 0;
        const omiCount = typeof QUOTAZIONI_OMI !== 'undefined' ? QUOTAZIONI_OMI.length : 0;

        let omiAvgMin = 0, omiAvgMax = 0;
        if (typeof QUOTAZIONI_OMI !== 'undefined') {
            const abit = QUOTAZIONI_OMI.filter(q => q.tipologia && q.tipologia.toLowerCase().includes('abitazion') && q.comprMin > 0);
            if (abit.length > 0) {
                omiAvgMin = Math.round(abit.reduce((s, q) => s + q.comprMin, 0) / abit.length);
                omiAvgMax = Math.round(abit.reduce((s, q) => s + q.comprMax, 0) / abit.length);
            }
        }

        let degradatiByTipo = {};
        let degradatiByMunicipio = {};
        if (typeof EDIFICI_DEGRADATI !== 'undefined') {
            EDIFICI_DEGRADATI.forEach(e => {
                degradatiByTipo[e.tipoMacro] = (degradatiByTipo[e.tipoMacro] || 0) + 1;
                const m = 'Mun. ' + e.municipio;
                degradatiByMunicipio[m] = (degradatiByMunicipio[m] || 0) + 1;
            });
        }

        content.innerHTML = `
            <div class="analytics-kpi">
                <div class="kpi-card">
                    <div class="kpi-value">${totalDataPoints.toLocaleString()}</div>
                    <div class="kpi-label">Record Open Data</div>
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
                    <div class="analytics-stat"><span class="label">Quotazioni OMI</span><span class="value">${omiCount} record</span></div>
                    <div class="analytics-stat"><span class="label">CENED certificazioni</span><span class="value">${cenedTotal.toLocaleString()} record</span></div>
                </div>
                <div class="analytics-card">
                    <h4><i class="fas fa-map-pin"></i> Distribuzione Degradati per NIL</h4>
                    <canvas id="chart-degradati-nil"></canvas>
                </div>
            </div>
        `;

        document.getElementById('modal-analytics').classList.remove('hidden');

        setTimeout(() => renderCharts(degradatiByTipo, degradatiByMunicipio), 100);
    }

    function renderCharts(degradatiByTipo, degradatiByMunicipio) {
        const colors = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

        new Chart(document.getElementById('chart-degradati-tipo'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(degradatiByTipo),
                datasets: [{ data: Object.values(degradatiByTipo), backgroundColor: colors.slice(0, Object.keys(degradatiByTipo).length) }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
        });

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

        // Degradati per NIL (top 15)
        if (typeof EDIFICI_DEGRADATI !== 'undefined') {
            const nilMap = {};
            EDIFICI_DEGRADATI.forEach(e => {
                nilMap[e.nil] = (nilMap[e.nil] || 0) + 1;
            });
            const nilEntries = Object.entries(nilMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
            new Chart(document.getElementById('chart-degradati-nil'), {
                type: 'bar',
                data: {
                    labels: nilEntries.map(e => e[0]),
                    datasets: [{ data: nilEntries.map(e => e[1]), backgroundColor: '#dc2626', borderRadius: 4 }]
                },
                options: {
                    responsive: true, indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                }
            });
        }
    }

    // === Events ===
    function bindEvents() {
        document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);

        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            document.getElementById('filter-tipo').value = 'all';
            document.getElementById('filter-municipio').value = 'all';
            document.getElementById('search-input').value = '';
            applyFilters();
        });

        let searchTimeout;
        document.getElementById('search-input').addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 300);
        });

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

        document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
            setTimeout(() => map.invalidateSize(), 350);
        });

        document.getElementById('btn-close-detail').addEventListener('click', () => {
            document.getElementById('detail-panel').classList.add('hidden');
        });

        document.getElementById('btn-guide').addEventListener('click', () => {
            document.getElementById('guide-content').innerHTML = GuideContent.render();
            document.getElementById('modal-guide').classList.remove('hidden');
        });

        document.getElementById('btn-analytics').addEventListener('click', showAnalytics);

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

        document.getElementById('btn-export').addEventListener('click', exportCSV);

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

        bindLayerToggle('layer-degradati', layerDegradati);
        bindLayerToggle('layer-aste', layerAste);
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

        if (!cb.checked && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    }

    // === Export ===
    function exportCSV() {
        const headers = ['Codice', 'Indirizzo', 'Tipo Macro', 'Municipio', 'NIL', 'Latitudine', 'Longitudine', 'Fonte'];

        const rows = filteredDegradati.map(e => [
            e.codice,
            '"' + e.indirizzo.replace(/"/g, '""') + '"',
            e.tipoMacro,
            e.municipio,
            '"' + (e.nil || '').replace(/"/g, '""') + '"',
            e.lat,
            e.lng,
            'Comune di Milano ds503'
        ]);

        let csv = '\uFEFF';
        csv += headers.join(';') + '\n';
        rows.forEach(row => {
            csv += row.join(';') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edifici_degradati_milano_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // === Helpers ===
    function formatEuro(val) {
        if (!val) return '\u2014';
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    }

    // === Start ===
    document.addEventListener('DOMContentLoaded', init);
})();
