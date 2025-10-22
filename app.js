/*
╔══════════════════════════════════════════════════════════════════════════════╗
║ IMMOSMART DAKAR - APP.JS                                                     ║
║──────────────────────────────────────────────────────────────────────────────║
║ Description : Application immobilière interactive (recherche, carte, dash)   ║
║               • Vue client : recherche avancée, carte Leaflet + clusters     ║
║               • Vue agent : dashboard KPIs, graphique Chart.js, top biens    ║
║               • Modals : détail bien, comparateur (max 3), contact, galerie  ║
║               • Sécurité : validation inputs, échappement HTML, sanitize     ║
║──────────────────────────────────────────────────────────────────────────────║
║ Auteur      : Patrick Junior Samba Ntadi (Intello)                           ║
║ Date        : Janvier 2025                                                   ║
║ Stack       : Vanilla JavaScript ES6+ (IIFE, strict mode)                    ║
║ Dépendances : Leaflet 1.9.4, Leaflet.markercluster 1.5.3, Chart.js 4.4.0    ║
║──────────────────────────────────────────────────────────────────────────────║
║ Structure :                                                                  ║
║  1. Utilitaires & Helpers (DOM, formatage, validation, sécurité)            ║
║  2. État global (biens, filtres, carte, comparateur, galerie)               ║
║  3. Données fictives (quartiers Dakar, génération biens)                    ║
║  4. Carte Leaflet (init, marqueurs, clustering, bounds)                     ║
║  5. Rendu résultats (grille, cartes biens)                                  ║
║  6. Filtres & Recherche & Tri                                               ║
║  7. Modals (détail bien, comparateur, contact, galerie lightbox)            ║
║  8. Dashboard Agent (KPIs, Chart.js ventes, top 5 biens)                    ║
║  9. Événements globaux & Init                                               ║
║──────────────────────────────────────────────────────────────────────────────║
║ Sécurité : Toutes les données utilisateur sont validées avant traitement.   ║
║            innerHTML utilise escapeHTML() pour prévenir XSS.                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
*/

(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // 1. UTILITAIRES & HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Sélecteur DOM raccourci (retourne le premier élément trouvé)
   * @param {string} selector - Sélecteur CSS
   * @returns {Element|null}
   */
  const $ = (selector) => document.querySelector(selector);

  /**
   * Sélecteur DOM raccourci (retourne un tableau de tous les éléments)
   * @param {string} selector - Sélecteur CSS
   * @returns {Array<Element>}
   */
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  /**
   * Échappe HTML pour prévenir XSS lors de l'injection dans innerHTML
   * @param {string} unsafe - Chaîne non sécurisée
   * @returns {string} Chaîne échappée
   */
  const escapeHTML = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
  };

  /**
   * Formate un nombre en francs CFA (FCFA) avec séparateurs de milliers
   * @param {number} montant - Montant en FCFA
   * @returns {string} Ex: "125 000 000 FCFA"
   */
  const formatFCFA = (montant) => {
    return `${Math.round(montant).toLocaleString('fr-FR')} FCFA`;
  };

  /**
   * Retourne un élément aléatoire d'un tableau
   * @param {Array} array - Tableau source
   * @returns {*} Élément aléatoire
   */
  const randomPick = (array) => array[Math.floor(Math.random() * array.length)];

  /**
   * Génère un entier aléatoire entre min et max (inclus)
   * @param {number} min - Valeur minimale
   * @param {number} max - Valeur maximale
   * @returns {number}
   */
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  /**
   * Retourne une date passée de N jours
   * @param {number} days - Nombre de jours dans le passé
   * @returns {Date}
   */
  const pastDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  };

  /**
   * Valide un email selon RFC 5322 (simplifié)
   * @param {string} email - Email à valider
   * @returns {boolean}
   */
  const isValidEmail = (email) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  };

  /**
   * Valide un numéro de téléphone sénégalais (+221 77 123 45 67)
   * @param {string} tel - Numéro à valider
   * @returns {boolean}
   */
  const isValidPhone = (tel) => {
    const pattern = /^(\+221|00221)?\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/;
    return pattern.test(tel.trim());
  };

  /**
   * Affiche une notification toast temporaire
   * @param {string} message - Message à afficher
   * @param {string} type - Type de toast : 'success', 'error', 'info'
   * @param {number} duration - Durée d'affichage en ms (défaut: 3500)
   */
  const showToast = (message, type = 'success', duration = 3500) => {
    const container = $('#toastContainer');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;
    toastEl.textContent = escapeHTML(message);

    container.appendChild(toastEl);

    // Auto-suppression après durée écoulée
    setTimeout(() => {
      toastEl.remove();
    }, duration);
  };

  /**
   * Debounce : retarde l'exécution d'une fonction jusqu'à ce que X ms se soient écoulées
   * @param {Function} func - Fonction à débouncer
   * @param {number} wait - Délai en ms
   * @returns {Function}
   */
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 2. ÉTAT GLOBAL
  // Centralisation des données de l'application
  // ═══════════════════════════════════════════════════════════════════════

  const state = {
    activeView: 'client',        // 'client' | 'dashboard'
    properties: [],              // Tous les biens immobiliers
    filteredProperties: [],      // Biens après filtres
    compareList: [],             // IDs des biens dans le comparateur (max 3)
    map: null,                   // Instance Leaflet
    markerCluster: null,         // Groupe de clusters Leaflet
    mapFullscreen: false,        // État plein écran de la carte
    salesChart: null,            // Instance Chart.js (ventes)
    galleryIndex: 0,             // Index actuel dans la galerie lightbox
    galleryPhotos: []            // Photos de la galerie actuelle
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 3. DONNÉES FICTIVES
  // Quartiers de Dakar + génération de biens immobiliers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Dictionnaire des quartiers de Dakar avec coordonnées GPS
   * Source : OpenStreetMap, centroids approximatifs
   */
  const NEIGHBORHOODS = {
    'almadies': { name: 'Almadies', lat: 14.723, lng: -17.503 },
    'mermoz': { name: 'Mermoz', lat: 14.709, lng: -17.472 },
    'vdn': { name: 'VDN', lat: 14.720, lng: -17.459 },
    'plateau': { name: 'Plateau', lat: 14.673, lng: -17.438 },
    'sacre-coeur': { name: 'Sacré-Cœur', lat: 14.712, lng: -17.462 },
    'ouakam': { name: 'Ouakam', lat: 14.724, lng: -17.490 },
    'fann': { name: 'Fann', lat: 14.692, lng: -17.466 },
    'ngor': { name: 'Ngor', lat: 14.745, lng: -17.513 },
    'point-e': { name: 'Point E', lat: 14.691, lng: -17.466 },
    'hann': { name: 'Hann Maristes', lat: 14.721, lng: -17.424 }
  };

  const PROPERTY_TYPES = ['villa', 'appartement', 'terrain', 'bureau'];
  const TRANSACTION_TYPES = ['vente', 'location'];
  const AMENITIES = ['piscine', 'jardin', 'parking', 'securite', 'climatisation'];

  /**
   * Constantes de configuration pour la génération de biens
   */
  const CONFIG = {
    SALE_PRICE_MIN: 30_000_000,      // 30M FCFA
    SALE_PRICE_MAX: 450_000_000,     // 450M FCFA
    RENT_PRICE_MIN: 250_000,         // 250k FCFA/mois
    RENT_PRICE_MAX: 3_500_000,       // 3.5M FCFA/mois
    AREA_MIN: 45,                    // m²
    AREA_MAX: 380,                   // m²
    ROOMS_MIN: 1,
    ROOMS_MAX: 6,
    VIEWS_MIN: 50,
    VIEWS_MAX: 1500,
    PHOTOS_MIN: 3,
    PHOTOS_MAX: 6
  };

  /**
   * Photos fictives (Unsplash, immobilier)
   */
  const SAMPLE_PHOTOS = [
    'https://images.unsplash.com/photo-1560448075-bb4caa6c0f11?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1523217582562-09d0def993a6?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1597047084897-51e81819a499?q=80&w=1600&auto=format&fit=crop'
  ];

  /**
   * Génère un titre descriptif pour un bien immobilier
   * @param {string} type - Type de bien (villa, appartement...)
   * @param {number} rooms - Nombre de chambres
   * @param {number} area - Superficie en m²
   * @param {string} transaction - Type de transaction (vente, location)
   * @param {string} neighborhood - Nom du quartier
   * @returns {string} Titre formaté
   */
  const buildPropertyTitle = (type, rooms, area, transaction, neighborhood) => {
    const typeLabels = {
      'villa': 'Villa',
      'appartement': 'Appartement',
      'terrain': 'Terrain',
      'bureau': 'Bureau'
    };
    const typeLabel = typeLabels[type] || type;
    const transactionLabel = transaction === 'vente' ? 'à vendre' : 'à louer';
    const roomsLabel = rooms > 0 ? `${rooms} ch` : `${area} m²`;

    return `${typeLabel} ${transactionLabel} — ${roomsLabel} — ${neighborhood}`;
  };

  /**
   * Génère N biens immobiliers fictifs avec données réalistes pour Dakar
   * @param {number} count - Nombre de biens à générer (défaut: 36)
   * @returns {Array<Object>} Tableau de biens
   */
  const generateProperties = (count = 36) => {
    const neighborhoodKeys = Object.keys(NEIGHBORHOODS);
    const properties = [];

    for (let i = 0; i < count; i++) {
      // Sélection quartier et dispersion GPS aléatoire autour du centre
      const neighborhoodKey = randomPick(neighborhoodKeys);
      const neighborhood = NEIGHBORHOODS[neighborhoodKey];
      const lat = neighborhood.lat + (Math.random() - 0.5) * 0.02; // ±1km environ
      const lng = neighborhood.lng + (Math.random() - 0.5) * 0.02;

      const propertyType = randomPick(PROPERTY_TYPES);
      const transaction = randomPick(TRANSACTION_TYPES);

      // Prix selon type de transaction (vente ou location)
      let price;
      if (transaction === 'vente') {
        price = randomInt(CONFIG.SALE_PRICE_MIN, CONFIG.SALE_PRICE_MAX);
        if (propertyType === 'terrain') price = randomInt(20_000_000, 300_000_000);
        if (propertyType === 'bureau') price = randomInt(50_000_000, 600_000_000);
      } else {
        price = randomInt(CONFIG.RENT_PRICE_MIN, CONFIG.RENT_PRICE_MAX);
        if (propertyType === 'bureau') price = randomInt(500_000, 5_000_000);
      }

      // Superficie et chambres
      const area = propertyType === 'terrain'
        ? randomInt(150, 1200)
        : randomInt(CONFIG.AREA_MIN, CONFIG.AREA_MAX);
      const rooms = propertyType === 'terrain' ? 0 : randomInt(CONFIG.ROOMS_MIN, CONFIG.ROOMS_MAX);

      // Commodités aléatoires (50% chance par commodité)
      const amenities = AMENITIES.filter(() => Math.random() > 0.5);

      // Photos (3-6 photos aléatoires avec signatures uniques)
      const photos = Array.from(
        { length: randomInt(CONFIG.PHOTOS_MIN, CONFIG.PHOTOS_MAX) },
        () => `${randomPick(SAMPLE_PHOTOS)}&sig=${Math.random()}`
      );

      properties.push({
        id: `prop-${i + 1}`,
        title: buildPropertyTitle(propertyType, rooms, area, transaction, neighborhood.name),
        type: propertyType,
        transaction,
        price,
        area,
        rooms,
        neighborhood: neighborhoodKey,
        coordinates: [lat, lng],
        amenities,
        views: randomInt(CONFIG.VIEWS_MIN, CONFIG.VIEWS_MAX),
        createdAt: pastDate(randomInt(0, 45)), // Créé dans les 45 derniers jours
        photos,
        description: `Superbe ${propertyType} situé à ${neighborhood.name}. ${
          rooms > 0 ? `${rooms} chambres spacieuses` : 'Surface généreuse'
        } • ${area} m² • Commodités: ${amenities.join(', ') || 'à définir'}.`
      });
    }

    return properties;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 4. CARTE LEAFLET (Init, marqueurs, clustering)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialise la carte Leaflet avec tuiles OpenStreetMap et clustering
   */
  const initMap = () => {
    const dakarCenter = [14.6928, -17.4467]; // Centre de Dakar

    // Créer instance carte
    state.map = L.map('map', {
      center: dakarCenter,
      zoom: 12,
      preferCanvas: true // Meilleure performance pour beaucoup de marqueurs
    });

    // Ajouter tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    // Initialiser cluster
    state.markerCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16
    });
    state.map.addLayer(state.markerCluster);

    // Bouton recentrer
    const centerBtn = $('#centerMapBtn');
    if (centerBtn) {
      centerBtn.addEventListener('click', () => {
        const list = state.filteredProperties.length ? state.filteredProperties : state.properties;
        fitMapToBounds(list);
      });
    }

    // Bouton plein écran (ajuste hauteur carte)
    const toggleBtn = $('#toggleMapBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        state.mapFullscreen = !state.mapFullscreen;
        const mapContainer = $('#map');
        if (mapContainer) {
          mapContainer.style.height = state.mapFullscreen ? '70vh' : '420px';
          setTimeout(() => state.map.invalidateSize(), 200);
        }
      });
    }
  };

  /**
   * Met à jour les marqueurs sur la carte selon la liste de biens
   * @param {Array<Object>} properties - Liste de biens à afficher
   */
  const updateMapMarkers = (properties) => {
    if (!state.markerCluster) return;

    // Vider les marqueurs existants
    state.markerCluster.clearLayers();

    properties.forEach((property) => {
      const marker = L.marker(property.coordinates);

      // Formatage prix
      const priceDisplay = property.transaction === 'vente'
        ? formatFCFA(property.price)
        : `${formatFCFA(property.price)} / mois`;

      // Popup avec boutons d'action (sécurisé avec escapeHTML)
      const popupContent = `
        <div style="min-width:220px">
          <strong>${escapeHTML(property.title)}</strong>
          <div style="margin-top:6px;font-size:13px;color:#9aa3b2">
            ${priceDisplay} — ${property.area} m²
          </div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button data-id="${property.id}" class="btn-popup btn-detail" style="padding:6px 12px;border-radius:8px;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#001219;border:none;cursor:pointer;font-weight:700;font-size:12px;">Détails</button>
            <button data-id="${property.id}" class="btn-popup btn-compare" style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.1);color:#e6eef5;border:1px solid rgba(255,255,255,0.2);cursor:pointer;font-weight:700;font-size:12px;">Comparer</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Délégation événements dans popup
      marker.on('popupopen', (event) => {
        const popupElement = event.popup.getElement();
        const detailBtn = popupElement.querySelector('.btn-detail');
        const compareBtn = popupElement.querySelector('.btn-compare');

        if (detailBtn) {
          detailBtn.addEventListener('click', () => openPropertyModal(property.id));
        }
        if (compareBtn) {
          compareBtn.addEventListener('click', () => toggleCompare(property.id));
        }
      });

      state.markerCluster.addLayer(marker);
    });

    // Ajuster vue carte
    fitMapToBounds(properties);
  };

  /**
   * Ajuste la vue de la carte pour englober tous les biens affichés
   * @param {Array<Object>} properties - Liste de biens
   */
  const fitMapToBounds = (properties) => {
    if (!properties.length) {
      state.map.setView([14.6928, -17.4467], 12); // Centrer Dakar par défaut
      return;
    }

    const bounds = L.latLngBounds(properties.map((p) => p.coordinates));
    state.map.fitBounds(bounds.pad(0.2), { animate: true, duration: 0.5 });
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 5. RENDU RÉSULTATS (Grille de biens)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Affiche les résultats de recherche dans la grille HTML
   * @param {Array<Object>} properties - Liste de biens filtrés
   */
  const renderResults = (properties) => {
    const grid = $('#resultsGrid');
    const countEl = $('#resultsCount');

    if (!grid || !countEl) return;

    // Mettre à jour compteur
    countEl.textContent = properties.length;

    // Cas aucun résultat
    if (!properties.length) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--muted);">
          <div style="font-size:48px; margin-bottom:12px;" aria-hidden="true">🔎</div>
          <p>Aucun bien ne correspond à vos critères.</p>
        </div>
      `;
      return;
    }

    // Rendu cartes biens
    grid.innerHTML = properties
      .map((property) => {
        const priceDisplay = property.transaction === 'vente'
          ? formatFCFA(property.price)
          : `${formatFCFA(property.price)} / mois`;

        const transactionLabel = property.transaction === 'vente' ? 'À vendre' : 'À louer';
        const neighborhoodName = NEIGHBORHOODS[property.neighborhood]?.name || property.neighborhood;

        // Échapper données pour sécurité XSS
        const safeTitle = escapeHTML(property.title);
        const safeNeighborhood = escapeHTML(neighborhoodName);

        return `
          <article class="result-card" data-id="${property.id}">
            <img 
              src="${property.photos[0]}" 
              alt="${safeTitle}" 
              class="bien-thumb" 
              loading="lazy"
            />
            <div class="bien-body">
              <div class="bien-row">
                <div class="bien-price">${priceDisplay}</div>
                <div class="bien-type">${transactionLabel}</div>
              </div>
              <div class="bien-meta">
                <span>${property.rooms} ch • ${property.area} m²</span>
                <span>${safeNeighborhood}</span>
              </div>
              <div class="bien-tags">
                ${property.amenities
                  .slice(0, 4)
                  .map((amenity) => `<span class="tag">${escapeHTML(amenity)}</span>`)
                  .join('')}
              </div>
              <div class="bien-actions">
                <button class="btn-pill primary" data-action="details" data-id="${property.id}">
                  <span aria-hidden="true">👁️</span> Détails
                </button>
                <button class="btn-pill" data-action="viewMap" data-id="${property.id}">
                  <span aria-hidden="true">🗺️</span> Voir carte
                </button>
                <button class="btn-pill" data-action="gallery" data-id="${property.id}">
                  <span aria-hidden="true">🖼️</span> Galerie
                </button>
                <button class="btn-pill" data-action="compare" data-id="${property.id}">
                  <span aria-hidden="true">⚖️</span> Comparer
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  };

  /**
   * Délégation d'événements pour les cartes de résultats
   * Évite d'attacher un listener par carte (performance)
   */
  const bindResultsEvents = () => {
    const grid = $('#resultsGrid');
    if (!grid) return;

    grid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const propertyId = button.dataset.id;
      const action = button.dataset.action;
      const property = state.properties.find((p) => p.id === propertyId);

      if (!property) return;

      switch (action) {
        case 'details':
          openPropertyModal(propertyId);
          break;

        case 'viewMap':
          // Centrer carte sur le bien + ouvrir popup
          state.map.setView(property.coordinates, 15, { animate: true });
          setTimeout(() => {
            // Trouver le marqueur correspondant et ouvrir popup
            state.markerCluster.eachLayer((marker) => {
              const pos = marker.getLatLng();
              if (
                Math.abs(pos.lat - property.coordinates[0]) < 0.0005 &&
                Math.abs(pos.lng - property.coordinates[1]) < 0.0005
              ) {
                marker.openPopup();
              }
            });
          }, 300);
          break;

        case 'gallery':
          openGallery(property.photos, 0, property.title);
          break;

        case 'compare':
          toggleCompare(propertyId);
          break;
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 6. FILTRES & RECHERCHE & TRI
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Applique tous les filtres actifs + recherche + tri
   * Met à jour résultats et carte
   */
  const applyFilters = () => {
    // Récupérer valeurs filtres
    const searchQuery = $('#searchQuery').value.trim().toLowerCase();
    const propertyType = $('#typeBien').value;
    const transaction = $('#transaction').value;
    const neighborhood = $('#quartierFilter').value;

    const minPrice = Number($('#prixMin').value) || 0;
    const maxPrice = Number($('#prixMax').value) || Infinity;
    const minArea = Number($('#superficieMin').value) || 0;
    const maxArea = Number($('#superficieMax').value) || Infinity;
    const minRooms = Number($('#chambresFilter').value) || 0;

    // Commodités cochées
    const selectedAmenities = $$('.commodity-checkbox:checked').map((checkbox) => checkbox.value);

    // Filtrage
    let filtered = state.properties.filter((property) => {
      // Type de bien
      if (propertyType && property.type !== propertyType) return false;

      // Transaction
      if (transaction && property.transaction !== transaction) return false;

      // Quartier
      if (neighborhood && property.neighborhood !== neighborhood) return false;

      // Prix
      if (property.price < minPrice || property.price > maxPrice) return false;

      // Superficie
      if (property.area < minArea || property.area > maxArea) return false;

      // Chambres minimum
      if (property.rooms < minRooms) return false;

      // Commodités (ET logique : doit avoir toutes les commodités cochées)
      if (selectedAmenities.length > 0) {
        for (const amenity of selectedAmenities) {
          if (!property.amenities.includes(amenity)) return false;
        }
      }

      // Recherche textuelle (dans titre + description + quartier)
      if (searchQuery) {
        const haystack = `${property.title} ${property.description} ${
          NEIGHBORHOODS[property.neighborhood]?.name || ''
        }`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }

      return true;
    });

    // Tri
    const sortBy = $('#sortSelect').value;
    switch (sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'superficie-desc':
        filtered.sort((a, b) => b.area - a.area);
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    // Mettre à jour état et rendu
    state.filteredProperties = filtered;
    renderResults(filtered);
    updateMapMarkers(filtered);
  };

  /**
   * Réinitialise tous les filtres à leurs valeurs par défaut
   */
  const resetFilters = () => {
    $('#searchQuery').value = '';
    $('#typeBien').value = '';
    $('#transaction').value = '';
    $('#quartierFilter').value = '';
    $('#prixMin').value = '';
    $('#prixMax').value = '';
    $('#superficieMin').value = '';
    $('#superficieMax').value = '';
    $('#chambresFilter').value = '';
    $$('.commodity-checkbox').forEach((checkbox) => (checkbox.checked = false));
    $('#sortSelect').value = 'recent';

    applyFilters();
    showToast('Filtres réinitialisés', 'info');
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 7. MODALS (Détail bien, Comparateur, Contact, Galerie)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Ouvre une modal générique
   * @param {string} selector - Sélecteur CSS de la modal
   */
  const openModal = (selector) => {
    const modal = $(selector);
    if (!modal) return;
    modal.classList.add('active');
    modal.removeAttribute('hidden');

    // Focus trap : focus premier élément focusable
    setTimeout(() => {
      const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
    }, 100);
  };

  /**
   * Ferme une modal générique
   * @param {string} selector - Sélecteur CSS de la modal
   */
  const closeModal = (selector) => {
    const modal = $(selector);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('hidden', '');
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal Détail Bien
  // ─────────────────────────────────────────────────────────────────

  /**
   * Ouvre la modal de détail d'un bien immobilier
   * @param {string} propertyId - ID du bien
   */
  const openPropertyModal = (propertyId) => {
    const property = state.properties.find((p) => p.id === propertyId);
    if (!property) return;

    const modal = $('#bienModal');
    const body = $('#bienModalBody');
    if (!modal || !body) return;

    const priceDisplay = property.transaction === 'vente'
      ? formatFCFA(property.price)
      : `${formatFCFA(property.price)} / mois`;
    const neighborhoodName = NEIGHBORHOODS[property.neighborhood]?.name || property.neighborhood;

    // Sécuriser données
    const safeTitle = escapeHTML(property.title);
    const safeDescription = escapeHTML(property.description);
    const safeNeighborhood = escapeHTML(neighborhoodName);

    body.innerHTML = `
      <div style="display:grid; gap:16px;">
        <!-- Galerie photos (4 premières) -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          ${property.photos
            .slice(0, 4)
            .map(
              (photo, index) => `
            <img 
              src="${photo}" 
              alt="Photo ${index + 1} ${safeTitle}" 
              style="width:100%; height:160px; object-fit:cover; border-radius:12px; cursor:pointer;" 
              data-gallery-index="${index}"
              loading="lazy"
            />
          `
            )
            .join('')}
        </div>

        <!-- Titre + Prix -->
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
          <h2 style="margin:0; font-size:22px; font-weight:900;">${safeTitle}</h2>
          <div style="font-weight:900; font-size:20px; color: var(--accent);">${priceDisplay}</div>
        </div>

        <!-- Infos clés -->
        <div style="display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px; color: var(--muted);">
          <div><span aria-hidden="true">📍</span> ${safeNeighborhood}</div>
          <div><span aria-hidden="true">📐</span> ${property.area} m²</div>
          <div><span aria-hidden="true">🛏️</span> ${property.rooms} chambres</div>
        </div>

        <!-- Description -->
        <p style="color: var(--muted); line-height:1.6;">${safeDescription}</p>

        <!-- Commodités -->
        <div class="bien-tags">
          ${property.amenities.map((amenity) => `<span class="tag">${escapeHTML(amenity)}</span>`).join('')}
        </div>

        <!-- Actions -->
        <div style="display:flex; gap:10px; margin-top:6px; flex-wrap:wrap;">
          <button class="btn-primary" id="requestVisitBtn">
            <span aria-hidden="true">📅</span> Demander une visite
          </button>
          <button class="btn-outline" id="openFullGalleryBtn">
            <span aria-hidden="true">🖼️</span> Ouvrir la galerie
          </button>
          <button class="btn-outline" id="addToCompareBtn">
            <span aria-hidden="true">⚖️</span> Ajouter au comparateur
          </button>
        </div>
      </div>
    `;

    // Événements : clic sur photo → ouvrir galerie
    body.querySelectorAll('[data-gallery-index]').forEach((img) => {
      img.addEventListener('click', () => {
        const index = Number(img.dataset.galleryIndex);
        openGallery(property.photos, index, property.title);
      });
    });

    // Bouton demander visite
    const visitBtn = $('#requestVisitBtn');
    if (visitBtn) {
      visitBtn.addEventListener('click', () => {
        closeModal('#bienModal');
        openContactModal(property.id);
      });
    }

    // Bouton galerie complète
    const galleryBtn = $('#openFullGalleryBtn');
    if (galleryBtn) {
      galleryBtn.addEventListener('click', () => {
        openGallery(property.photos, 0, property.title);
      });
    }

    // Bouton comparateur
    const compareBtn = $('#addToCompareBtn');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => {
        toggleCompare(property.id);
      });
    }

    openModal('#bienModal');
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal Comparateur
  // ─────────────────────────────────────────────────────────────────

  /**
   * Bascule l'ajout/retrait d'un bien dans le comparateur
   * @param {string} propertyId - ID du bien
   */
  const toggleCompare = (propertyId) => {
    if (state.compareList.includes(propertyId)) {
      // Retirer du comparateur
      state.compareList = state.compareList.filter((id) => id !== propertyId);
      showToast('Bien retiré du comparateur', 'info');
    } else {
      // Ajouter (max 3)
      if (state.compareList.length >= 3) {
        showToast('Comparateur: maximum 3 biens', 'error');
        return;
      }
      state.compareList.push(propertyId);
      showToast('Bien ajouté au comparateur', 'success');
    }

    updateCompareBadge();
  };

  /**
   * Met à jour le badge compteur du comparateur dans le header
   */
  const updateCompareBadge = () => {
    const badge = $('#compareCount');
    if (badge) {
      badge.textContent = state.compareList.length;
    }
  };

  /**
   * Ouvre la modal comparateur avec tableau comparatif
   */
  const openCompareModal = () => {
    const modal = $('#compareModal');
    const body = $('#compareModalBody');
    if (!modal || !body) return;

    // Cas aucun bien sélectionné
    if (!state.compareList.length) {
      body.innerHTML = `
        <div style="text-align:center; padding: 30px; color: var(--muted);">
          <div style="font-size:48px; margin-bottom:12px;" aria-hidden="true">⚖️</div>
          <p>Aucun bien sélectionné pour comparaison.</p>
        </div>
      `;
      openModal('#compareModal');
      return;
    }

    // Récupérer biens
    const properties = state.compareList
      .map((id) => state.properties.find((p) => p.id === id))
      .filter(Boolean);

    // Tableau comparatif
    body.innerHTML = `
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:600px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border);">
              <th style="padding:12px; text-align:left; color:var(--muted); font-weight:700;">Caractéristiques</th>
              ${properties
                .map(
                  (p) => `<th style="padding:12px; text-align:left; font-weight:700;">${escapeHTML(p.title)}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            <!-- Photos -->
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding:12px; color:var(--muted);">Photo</td>
              ${properties
                .map(
                  (p) => `
                <td style="padding:12px;">
                  <img src="${p.photos[0]}" alt="${escapeHTML(p.title)}" style="width:160px; height:100px; object-fit:cover; border-radius:8px;" />
                </td>
              `
                )
                .join('')}
            </tr>

            <!-- Prix -->
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding:12px; color:var(--muted);">Prix</td>
              ${properties
                .map((p) => {
                  const priceDisplay = p.transaction === 'vente' ? formatFCFA(p.price) : `${formatFCFA(p.price)} / mois`;
                  return `<td style="padding:12px; font-weight:900; color: var(--accent);">${priceDisplay}</td>`;
                })
                .join('')}
            </tr>

            <!-- Superficie -->
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding:12px; color:var(--muted);">Superficie</td>
              ${properties.map((p) => `<td style="padding:12px;">${p.area} m²</td>`).join('')}
            </tr>

            <!-- Chambres -->
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding:12px; color:var(--muted);">Chambres</td>
              ${properties.map((p) => `<td style="padding:12px;">${p.rooms}</td>`).join('')}
            </tr>

            <!-- Quartier -->
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding:12px; color:var(--muted);">Quartier</td>
              ${properties
                .map((p) => {
                  const neighborhoodName = NEIGHBORHOODS[p.neighborhood]?.name || p.neighborhood;
                  return `<td style="padding:12px;">${escapeHTML(neighborhoodName)}</td>`;
                })
                .join('')}
            </tr>

            <!-- Commodités -->
            <tr>
              <td style="padding:12px; color:var(--muted);">Commodités</td>
              ${properties
                .map((p) => {
                  const amenitiesList = p.amenities.join(', ') || '—';
                  return `<td style="padding:12px;">${escapeHTML(amenitiesList)}</td>`;
                })
                .join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;

    openModal('#compareModal');
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal Contact
  // ─────────────────────────────────────────────────────────────────

  /**
   * Ouvre la modal de contact avec formulaire de demande de visite
   * @param {string|null} propertyId - ID du bien (optionnel)
   */
  const openContactModal = (propertyId = null) => {
    const input = $('#bienIdContact');
    if (input) {
      input.value = propertyId || '';
    }

    // Définir date min (aujourd'hui) pour input date
    const dateInput = $('#dateVisite');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
    }

    openModal('#contactModal');
  };

  /**
   * Gère la soumission du formulaire de contact
   * Validation stricte des champs
   * @param {Event} event - Événement submit
   */
  const handleContactSubmit = (event) => {
    event.preventDefault();

    // Récupérer et nettoyer valeurs
    const name = $('#nomContact').value.trim();
    const email = $('#emailContact').value.trim();
    const phone = $('#telContact').value.trim();
    const date = $('#dateVisite').value;
    const message = $('#messageContact').value.trim();

    // Validation champs obligatoires
    if (!name || !email || !phone) {
      showToast('Veuillez remplir tous les champs obligatoires (nom, email, téléphone)', 'error', 4000);
      return;
    }

    // Validation nom (min 2 caractères, max 100)
    if (name.length < 2 || name.length > 100) {
      showToast('Nom invalide (2-100 caractères)', 'error');
      return;
    }

    // Validation email
    if (!isValidEmail(email)) {
      showToast('Email invalide (exemple: nom@domaine.com)', 'error');
      return;
    }

    // Validation téléphone
    if (!isValidPhone(phone)) {
      showToast('Numéro de téléphone invalide (format: +221 77 123 45 67)', 'error', 4000);
      return;
    }

    // Validation date (si fournie, doit être future)
    if (date) {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        showToast('La date de visite doit être dans le futur', 'error');
        return;
      }
    }

    // Validation message (max 500 caractères)
    if (message.length > 500) {
      showToast('Message trop long (max 500 caractères)', 'error');
      return;
    }

    // Simulation envoi (dans un vrai projet : appel API)
    console.log('Demande de contact envoyée:', { name, email, phone, date, message });

    // Réinitialiser formulaire
    $('#contactForm').reset();

    // Fermer modal + feedback
    closeModal('#contactModal');
    showToast('✓ Demande envoyée avec succès ! Nous vous rappelons rapidement.', 'success', 4000);
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal Galerie Lightbox
  // ─────────────────────────────────────────────────────────────────

  /**
   * Ouvre la galerie lightbox
   * @param {Array<string>} photos - URLs des photos
   * @param {number} startIndex - Index de départ (défaut: 0)
   * @param {string} title - Titre pour alt text (défaut: '')
   */
  const openGallery = (photos, startIndex = 0, title = '') => {
    state.galleryPhotos = photos;
    state.galleryIndex = startIndex;

    const img = $('#galleryImage');
    const counter = $('#galleryCounter');

    if (img) {
      img.src = photos[startIndex];
      img.alt = `Galerie — ${escapeHTML(title)} — Photo ${startIndex + 1}`;
    }

    if (counter) {
      counter.textContent = `${startIndex + 1} / ${photos.length}`;
    }

    openModal('#galleryModal');
  };

  /**
   * Navigue dans la galerie (précédent/suivant)
   * @param {number} delta - Direction : -1 (précédent) ou +1 (suivant)
   */
  const navigateGallery = (delta) => {
    if (!state.galleryPhotos.length) return;

    // Navigation circulaire
    state.galleryIndex = (state.galleryIndex + delta + state.galleryPhotos.length) % state.galleryPhotos.length;

    const img = $('#galleryImage');
    const counter = $('#galleryCounter');

    if (img) {
      img.src = state.galleryPhotos[state.galleryIndex];
    }

    if (counter) {
      counter.textContent = `${state.galleryIndex + 1} / ${state.galleryPhotos.length}`;
    }
  };

  /**
   * Gère la navigation au clavier dans la galerie
   * @param {KeyboardEvent} event
   */
  const handleGalleryKeyboard = (event) => {
    const modal = $('#galleryModal');
    if (!modal || !modal.classList.contains('active')) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        navigateGallery(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        navigateGallery(1);
        break;
      case 'Escape':
        closeModal('#galleryModal');
        break;
    }
  };

  /**
   * Lie les événements génériques des modals (fermeture, overlay...)
   */
  const bindModalEvents = () => {
    // Boutons fermeture (croix)
    $('#closeBienModal')?.addEventListener('click', () => closeModal('#bienModal'));
    $('#closeCompareModal')?.addEventListener('click', () => closeModal('#compareModal'));
    $('#closeContactModal')?.addEventListener('click', () => closeModal('#contactModal'));
    $('#closeGalleryModal')?.addEventListener('click', () => closeModal('#galleryModal'));

    // Fermeture au clic sur overlay
    $$('.modal').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal-overlay')) {
          modal.classList.remove('active');
          modal.setAttribute('hidden', '');
        }
      });
    });

    // Navigation galerie (boutons)
    $('#galleryPrev')?.addEventListener('click', () => navigateGallery(-1));
    $('#galleryNext')?.addEventListener('click', () => navigateGallery(1));

    // Navigation galerie (clavier)
    document.addEventListener('keydown', handleGalleryKeyboard);

    // Fermeture générale avec Escape
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal('#bienModal');
        closeModal('#compareModal');
        closeModal('#contactModal');
        closeModal('#galleryModal');
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 8. DASHBOARD AGENT
  // KPIs + Graphique Chart.js + Top 5 biens
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Bascule entre vue client et vue dashboard agent
   */
  const toggleView = () => {
    state.activeView = state.activeView === 'client' ? 'dashboard' : 'client';

    const clientView = $('#clientView');
    const dashboardView = $('#dashboardView');

    if (clientView) {
      clientView.classList.toggle('hidden', state.activeView === 'dashboard');
    }
    if (dashboardView) {
      dashboardView.classList.toggle('hidden', state.activeView === 'client');
    }

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Charger dashboard si activé
    if (state.activeView === 'dashboard') {
      updateDashboard();
    }
  };

  /**
   * Met à jour le dashboard agent avec KPIs + graphique + top biens
   */
  const updateDashboard = () => {
    // ─────────────────────────────────────────────────────────────────
    // KPIs (données fictives simulées)
    // ─────────────────────────────────────────────────────────────────
    const totalProperties = state.properties.length;
    const monthlySales = randomInt(4, 22);
    const revenue = randomInt(80, 480); // Millions FCFA
    const weeklyVisits = randomInt(12, 45);

    const biensActifsEl = $('#biensActifs');
    const ventesMoisEl = $('#ventesMois');
    const chiffreAffairesEl = $('#chiffreAffaires');
    const visitesCountEl = $('#visitesCount');

    if (biensActifsEl) biensActifsEl.textContent = totalProperties;
    if (ventesMoisEl) ventesMoisEl.textContent = monthlySales;
    if (chiffreAffairesEl) chiffreAffairesEl.textContent = `${revenue} M`;
    if (visitesCountEl) visitesCountEl.textContent = weeklyVisits;

    // ─────────────────────────────────────────────────────────────────
    // Graphique Chart.js : Évolution ventes (30 jours)
    // ─────────────────────────────────────────────────────────────────
    const labels = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    });

    // Données fictives (0-3 ventes/jour)
    const data = labels.map(() => randomInt(0, 3));

    // Détruire instance précédente pour éviter memory leak
    if (state.salesChart) {
      state.salesChart.destroy();
      state.salesChart = null;
    }

    const canvas = $('#ventesChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Créer gradient pour background
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(6,182,212,0.35)');
    gradient.addColorStop(1, 'rgba(6,182,212,0.02)');

    state.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ventes',
            data,
            borderColor: '#06b6d4',
            backgroundColor: gradient,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#06b6d4',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,15,26,0.9)',
            titleColor: '#e6eef5',
            bodyColor: '#e6eef5',
            borderColor: 'rgba(6,182,212,0.5)',
            borderWidth: 1,
            padding: 10,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: '#9aa3b2', maxTicksLimit: 8, font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: '#9aa3b2', stepSize: 1, beginAtZero: true, font: { size: 11 } }
          }
        },
        animation: {
          duration: 700,
          easing: 'easeInOutQuart'
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────
    // Top 5 biens par nombre de vues
    // ─────────────────────────────────────────────────────────────────
    const topProperties = [...state.properties].sort((a, b) => b.views - a.views).slice(0, 5);

    const topListEl = $('#topBiensList');
    if (!topListEl) return;

    topListEl.innerHTML = topProperties
      .map((property) => {
        const neighborhoodName = NEIGHBORHOODS[property.neighborhood]?.name || property.neighborhood;
        const safeTitle = escapeHTML(property.title);
        const safeNeighborhood = escapeHTML(neighborhoodName);

        return `
          <div class="top-bien-item">
            <img 
              src="${property.photos[0]}" 
              alt="${safeTitle}" 
              class="top-thumb" 
              loading="lazy"
            />
            <div class="top-info">
              <div class="top-title">${safeTitle}</div>
              <div class="top-meta">${property.area} m² • ${property.rooms} ch • ${safeNeighborhood}</div>
            </div>
            <div class="top-views">${property.views} vues</div>
          </div>
        `;
      })
      .join('');
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 9. ÉVÉNEMENTS GLOBAUX & INITIALISATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Lie tous les événements globaux de l'application
   */
  const bindGlobalEvents = () => {
    // ─────────────────────────────────────────────────────────────────
    // Recherche
    // ─────────────────────────────────────────────────────────────────
    const searchForm = $('#searchForm');
    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        applyFilters();
      });
    }

    // Recherche live avec debounce (performance)
    const searchInput = $('#searchQuery');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(applyFilters, 500));
    }

    // ─────────────────────────────────────────────────────────────────
    // Filtres
    // ─────────────────────────────────────────────────────────────────
    $('#applyFilters')?.addEventListener('click', applyFilters);
    $('#resetFilters')?.addEventListener('click', resetFilters);
    $('#sortSelect')?.addEventListener('change', applyFilters);

    // ─────────────────────────────────────────────────────────────────
    // Basculement vue client / dashboard
    // ─────────────────────────────────────────────────────────────────
    $('#toggleDashboardBtn')?.addEventListener('click', toggleView);
    $('#retourClientBtn')?.addEventListener('click', toggleView);

    // ─────────────────────────────────────────────────────────────────
    // Comparateur
    // ─────────────────────────────────────────────────────────────────
    $('#compareBtn')?.addEventListener('click', openCompareModal);

    // ─────────────────────────────────────────────────────────────────
    // Contact
    // ─────────────────────────────────────────────────────────────────
    $('#contactBtn')?.addEventListener('click', () => openContactModal());

    const contactForm = $('#contactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', handleContactSubmit);
    }

    // ─────────────────────────────────────────────────────────────────
    // Délégation événements résultats
    // ─────────────────────────────────────────────────────────────────
    bindResultsEvents();

    // ─────────────────────────────────────────────────────────────────
    // Effet scroll header (classe sticky)
    // ─────────────────────────────────────────────────────────────────
    window.addEventListener('scroll', () => {
      const header = $('#mainHeader');
      if (!header) return;

      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  };

  /**
   * Initialisation principale de l'application
   * Appelée au chargement DOM
   */
  const init = () => {
    // Générer biens fictifs
    state.properties = generateProperties(36);

    // Initialiser carte Leaflet
    initMap();

    // Lier événements modals
    bindModalEvents();

    // Lier événements globaux
    bindGlobalEvents();

    // Initialiser badge comparateur
    updateCompareBadge();

    // Afficher résultats initiaux (tous les biens, tri récents)
    applyFilters();

    // Log console (branding)
    console.log(
      '%c🏠 ImmoSmart Dakar — Prototype Intello',
      'color:#06b6d4; font-size:16px; font-weight:700; padding:8px; background:rgba(6,182,212,0.1); border-radius:4px;'
    );
    console.log(
      '%cDonnées fictives • Stack : Vanilla JS + Leaflet + Chart.js',
      'color:#9aa3b2; font-size:12px; padding:4px;'
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DÉMARRAGE APPLICATION
  // ═══════════════════════════════════════════════════════════════════════

  // Attendre chargement DOM complet
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM déjà chargé (cas script defer)
    init();
  }
})();