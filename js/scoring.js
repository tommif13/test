/**
 * Scoring Engine per Prospecting Immobiliare
 * Studio Contrino & Studio Bottinelli
 *
 * Calcola la probabilità di vendita di un immobile basandosi su:
 * - Età del proprietario e situazione anagrafica
 * - Stato di manutenzione dell'immobile
 * - Anni dall'ultima ristrutturazione
 * - Successioni recenti
 * - Fallimenti/procedure concorsuali
 * - Immobile "fermo" (nessuna attività catastale/commerciale)
 * - Tipologia (uffici/garage/terreni sono più liquidi)
 */

const ScoringEngine = {

    // Pesi dei fattori (totale = 100)
    WEIGHTS: {
        etaProprietario: 20,       // Età avanzata del proprietario
        statoImmobile: 20,         // Stato di manutenzione/abbandono
        anniUltimaRistrutturazione: 12, // Tempo dall'ultima ristrutturazione
        successioneRecente: 18,    // Successione avvenuta di recente
        fallimentoAsta: 15,        // Procedure concorsuali/aste
        immobileFermo: 10,         // Nessuna attività sull'immobile
        assenzaEredi: 5            // Proprietario senza eredi noti
    },

    /**
     * Calcola lo score complessivo di un immobile (0-100)
     */
    calcolaScore(immobile) {
        const fattori = {};

        fattori.etaProprietario = this.scoreEta(immobile.etaProprietario);
        fattori.statoImmobile = this.scoreStato(immobile.statoImmobile);
        fattori.anniUltimaRistrutturazione = this.scoreRistrutturazione(immobile.anniUltimaRistrutturazione);
        fattori.successioneRecente = this.scoreSuccessione(immobile.successioneRecente, immobile.anniDaSuccessione);
        fattori.fallimentoAsta = this.scoreFallimento(immobile.fallimento, immobile.asta);
        fattori.immobileFermo = this.scoreImmobileFermo(immobile.anniFermo);
        fattori.assenzaEredi = this.scoreEredi(immobile.erediNoti);

        let scoreFinale = 0;
        for (const [fattore, score] of Object.entries(fattori)) {
            scoreFinale += (score / 100) * this.WEIGHTS[fattore];
        }

        // Bonus: combinazioni che aumentano la probabilità
        scoreFinale += this.calcolaBonus(immobile, fattori);

        // Clamp a 0-100
        scoreFinale = Math.max(0, Math.min(100, Math.round(scoreFinale)));

        return {
            score: scoreFinale,
            livello: this.getLivello(scoreFinale),
            fattori,
            dettaglio: this.getDettaglio(fattori)
        };
    },

    /**
     * Score basato sull'età del proprietario
     * 70+ anni = alta probabilità di vendita/successione
     */
    scoreEta(eta) {
        if (!eta) return 0;
        if (eta >= 90) return 100;
        if (eta >= 85) return 90;
        if (eta >= 80) return 75;
        if (eta >= 75) return 60;
        if (eta >= 70) return 40;
        if (eta >= 65) return 20;
        return 0;
    },

    /**
     * Score basato sullo stato dell'immobile
     */
    scoreStato(stato) {
        const stati = {
            'abbandonato': 100,
            'semiabbandonato': 85,
            'pessimo': 75,
            'da_ristrutturare': 60,
            'mediocre': 40,
            'discreto': 15,
            'buono': 5,
            'ottimo': 0
        };
        return stati[stato] || 0;
    },

    /**
     * Score basato sugli anni dall'ultima ristrutturazione
     */
    scoreRistrutturazione(anni) {
        if (!anni) return 30; // Nessun dato = probabile vecchio
        if (anni >= 40) return 100;
        if (anni >= 30) return 80;
        if (anni >= 20) return 55;
        if (anni >= 15) return 35;
        if (anni >= 10) return 15;
        return 0;
    },

    /**
     * Score basato sulla successione
     * Una successione recente (0-3 anni) è il segnale più forte
     */
    scoreSuccessione(successione, anniDaSuccessione) {
        if (!successione) return 0;
        if (anniDaSuccessione <= 1) return 100;
        if (anniDaSuccessione <= 2) return 85;
        if (anniDaSuccessione <= 3) return 65;
        if (anniDaSuccessione <= 5) return 40;
        return 15;
    },

    /**
     * Score basato su fallimenti/aste
     */
    scoreFallimento(fallimento, asta) {
        if (asta) return 95;
        if (fallimento) return 80;
        return 0;
    },

    /**
     * Score basato su quanto tempo l'immobile è "fermo"
     */
    scoreImmobileFermo(anniFermo) {
        if (!anniFermo) return 0;
        if (anniFermo >= 10) return 100;
        if (anniFermo >= 7) return 75;
        if (anniFermo >= 5) return 55;
        if (anniFermo >= 3) return 30;
        return 10;
    },

    /**
     * Score basato sull'assenza di eredi
     */
    scoreEredi(erediNoti) {
        if (erediNoti === false) return 100;
        if (erediNoti === null || erediNoti === undefined) return 50;
        return 0;
    },

    /**
     * Bonus per combinazioni particolarmente indicative
     */
    calcolaBonus(immobile, fattori) {
        let bonus = 0;

        // Proprietario anziano + immobile in cattivo stato
        if (fattori.etaProprietario >= 60 && fattori.statoImmobile >= 60) {
            bonus += 5;
        }

        // Successione + immobile fermo
        if (fattori.successioneRecente >= 60 && fattori.immobileFermo >= 30) {
            bonus += 5;
        }

        // Proprietario anziano + nessun erede
        if (fattori.etaProprietario >= 60 && fattori.assenzaEredi >= 80) {
            bonus += 4;
        }

        // Immobile completamente abbandonato + fermo da molto
        if (fattori.statoImmobile >= 85 && fattori.immobileFermo >= 75) {
            bonus += 3;
        }

        return bonus;
    },

    getLivello(score) {
        if (score >= 70) return 'hot';
        if (score >= 40) return 'warm';
        return 'cold';
    },

    getDettaglio(fattori) {
        const nomi = {
            etaProprietario: 'Età Proprietario',
            statoImmobile: 'Stato Immobile',
            anniUltimaRistrutturazione: 'Vetustà Ristrutturazione',
            successioneRecente: 'Successione Recente',
            fallimentoAsta: 'Fallimento/Asta',
            immobileFermo: 'Immobile Fermo',
            assenzaEredi: 'Assenza Eredi'
        };

        return Object.entries(fattori).map(([key, value]) => ({
            nome: nomi[key],
            score: value,
            peso: this.WEIGHTS[key],
            contributo: Math.round((value / 100) * this.WEIGHTS[key])
        }));
    },

    /**
     * Determina i tags/segnali per un immobile
     */
    getSegnali(immobile) {
        const segnali = [];

        if (['abbandonato', 'semiabbandonato'].includes(immobile.statoImmobile)) {
            segnali.push({ label: 'Semiabbandono', class: 'tag-abbandono', icon: 'fa-house-crack' });
        }
        if (['da_ristrutturare', 'pessimo'].includes(immobile.statoImmobile)) {
            segnali.push({ label: 'Da Ristrutturare', class: 'tag-ristrutturare', icon: 'fa-hammer' });
        }
        if (immobile.successioneRecente) {
            segnali.push({ label: 'Successione', class: 'tag-successione', icon: 'fa-file-signature' });
        }
        if (immobile.fallimento || immobile.asta) {
            segnali.push({ label: immobile.asta ? 'Asta' : 'Fallimento', class: 'tag-fallimento', icon: 'fa-gavel' });
        }
        if (immobile.anniFermo >= 5) {
            segnali.push({ label: 'Fermo', class: 'tag-fermo', icon: 'fa-clock' });
        }

        return segnali;
    }
};
