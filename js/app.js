/**
 * App principale — Dashboard Prospecting Immobiliare
 * Studio Contrino & Studio Bottinelli
 */

(function () {
    'use strict';

    // === State ===
    let map;
    let markersLayer;
    let allProperties = [];
    let filteredProperties = [];
    let currentSort = { field: 'score', direction: 'desc' };
    let selectedProperty = null;

    // === Init ===
    function init() {
        // Process properties with scoring
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
        updateStats();
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

        // Tile layer — CartoDB Positron (clean, light style)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        // Marker cluster group
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

        map.addLayer(markersLayer);
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
            // Exclude properties already on sale
            if (p.inVendita) return false;

            // Tipologia
            if (tipologie.length > 0 && !tipologie.includes(p.tipologia)) return false;

            // Score
            if (p.score < minScore) return false;

            // Zona
            if (zona !== 'all' && p.zona !== zona) return false;

            // Superficie
            if (p.superficie < mqMin || p.superficie > mqMax) return false;

            // Stato filters
            if (stati.length > 0) {
                let matchesStato = false;
                if (stati.includes(p.statoImmobile)) matchesStato = true;
                if (stati.includes('successione') && p.successioneRecente) matchesStato = true;
                if (stati.includes('fallimento') && (p.fallimento || p.asta)) matchesStato = true;
                if (!matchesStato) return false;
            }

            // Search
            if (searchText) {
                const searchIn = [p.indirizzo, p.proprietario, p.quartiere, p.note].join(' ').toLowerCase();
                if (!searchIn.includes(searchText)) return false;
            }

            return true;
        });

        // Sort
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
                <td>${p.etaProprietario || '—'}</td>
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

        // Score breakdown
        const breakdownHtml = p.dettaglio.map(d => {
            const barClass = d.score >= 70 ? 'hot' : d.score >= 40 ? 'warm' : 'cold';
            return `
            <div class="score-factor">
                <span>${d.nome}</span>
                <div class="bar"><div class="bar-fill ${barClass}" style="width:${d.score}%"></div></div>
                <span>+${d.contributo}</span>
            </div>`;
        }).join('');

        // Google Maps Static embed (satellite view of the area)
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
                <div class="detail-row"><span class="label">Piano</span><span class="value">${p.piani || '—'}</span></div>
                <div class="detail-row"><span class="label">Anno Costruzione</span><span class="value">${p.annoCostruzione || '—'}</span></div>
                <div class="detail-row"><span class="label">Stato</span><span class="value">${formatStato(p.statoImmobile)}</span></div>
                <div class="detail-row"><span class="label">Ultima Ristrutturazione</span><span class="value">${p.anniUltimaRistrutturazione ? p.anniUltimaRistrutturazione + ' anni fa' : 'N/D'}</span></div>
                <div class="detail-row"><span class="label">Valore Stimato</span><span class="value" style="color:var(--success);font-size:15px">${formatEuro(p.valoreStimato)}</span></div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-user"></i> Proprietario</h4>
                <div class="detail-row"><span class="label">Nome</span><span class="value">${p.proprietario}</span></div>
                <div class="detail-row"><span class="label">Tipo</span><span class="value">${formatTipoProprietario(p.tipoProprietario)}</span></div>
                <div class="detail-row"><span class="label">Età</span><span class="value">${p.etaProprietario ? p.etaProprietario + ' anni' : '—'}</span></div>
                <div class="detail-row"><span class="label">Eredi Noti</span><span class="value">${p.erediNoti === true ? 'Si' : p.erediNoti === false ? 'No' : '—'}</span></div>
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

        // Pan map to property
        map.setView([p.lat, p.lng], 16, { animate: true });
    };

    window.copyPropertyInfo = function (id) {
        const p = allProperties.find(prop => prop.id === id);
        if (!p) return;

        const text = `IMMOBILE: ${p.indirizzo}, Milano (${p.quartiere})
Tipologia: ${capitalize(p.tipologia)} — ${p.superficie} mq
Proprietario: ${p.proprietario}${p.etaProprietario ? ' (età ' + p.etaProprietario + ')' : ''}
Score: ${p.score}/100 (${p.livello.toUpperCase()})
Valore Stimato: ${formatEuro(p.valoreStimato)}
Stato: ${formatStato(p.statoImmobile)}
Note: ${p.note}
---
Studio Contrino — Prospecting Immobiliare Milano`;

        navigator.clipboard.writeText(text).then(() => {
            alert('Informazioni copiate negli appunti!');
        });
    };

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

        document.querySelector('.modal-close').addEventListener('click', () => {
            document.getElementById('modal-guide').classList.add('hidden');
        });

        document.getElementById('modal-guide').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('modal-guide').classList.add('hidden');
            }
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
    }

    // === Export ===
    function exportCSV() {
        const headers = ['Score', 'Indirizzo', 'CAP', 'Quartiere', 'Tipologia', 'Superficie mq', 'Proprietario', 'Tipo Proprietario', 'Età Proprietario', 'Stato Immobile', 'Anni Ultima Ristrutturazione', 'Successione', 'Anni da Successione', 'Fallimento', 'Asta', 'Anni Fermo', 'Eredi Noti', 'Valore Stimato', 'Note'];

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
        if (!val) return '—';
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    }

    function formatStato(stato) {
        const map = {
            'abbandonato': 'Abbandonato',
            'semiabbandonato': 'Semiabbandonato',
            'pessimo': 'Pessimo',
            'da_ristrutturare': 'Da Ristrutturare',
            'mediocre': 'Mediocre',
            'discreto': 'Discreto',
            'buono': 'Buono',
            'ottimo': 'Ottimo'
        };
        return map[stato] || stato;
    }

    function formatTipoProprietario(tipo) {
        const map = {
            'persona_fisica': 'Persona Fisica',
            'società': 'Società',
            'eredi': 'Eredi',
            'ente': 'Ente/Fondazione'
        };
        return map[tipo] || tipo;
    }

    // === Start ===
    document.addEventListener('DOMContentLoaded', init);
})();
