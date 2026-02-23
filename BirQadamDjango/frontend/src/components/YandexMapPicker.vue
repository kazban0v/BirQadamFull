<template>
  <div class="mp">

    <!-- ════════════════════════
         MAP BLOCK
    ════════════════════════ -->
    <div class="mp__map" :style="{ height }">

      <!-- Leaflet canvas -->
      <div
        ref="mapContainer"
        class="mp__canvas"
        :style="{ display: mapLoaded && !mapError ? 'block' : 'none' }"
      />

      <!-- Loading -->
      <div v-if="!mapLoaded && !mapError" class="mp__state">
        <svg class="mp__state-spin" width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="12" stroke="rgba(139,195,74,0.18)" stroke-width="3"/>
          <path d="M16 4a12 12 0 0 1 12 12" stroke="#8bc34a" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <span>Загрузка карты…</span>
        </div>

      <!-- Error -->
      <div v-else-if="mapError" class="mp__state mp__state--err">
        <span class="mp__state-emoji">🗺️</span>
        <span>{{ mapError }}</span>
        <button class="mp__retry" type="button" @click="retryLoadMap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>   
      
      <!-- ── Search overlay (поверх карты) ── -->
      <div v-if="mapLoaded && !mapError" class="mp__overlay">
        <div class="sb" :class="{ 'sb--focused': focused }">
          <svg class="sb__ico" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
            <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input
            ref="inputRef"
            v-model="searchText"
            class="sb__input"
            placeholder="Улица, дом, место…"
            autocomplete="off"
            @focus="focused = true; openDrop()"
            @blur="onBlur"
            @input="onInput"
            @keydown.enter.prevent="performSearch"
            @keydown.escape="showDrop = false"
            @keydown.arrow-down.prevent="focusItem(0)"
          />
          <!-- Spinner -->
          <svg v-if="suggestionsLoading || searchLoading" class="sb__spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(0,0,0,0.12)" stroke-width="3"/>
            <path d="M12 3a9 9 0 0 1 9 9" stroke="#8bc34a" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <!-- Clear -->
          <button
            v-else-if="searchText || selectedAddress"
            class="sb__clear"
            type="button"
            tabindex="-1"
            @mousedown.prevent="clearSearch"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
          </button>
      </div>

        <!-- Suggestions dropdown -->
        <transition name="drop">
          <div v-if="showDrop && suggestions.length" class="drop">
            <button
              v-for="(s, i) in suggestions"
              :key="s.id"
              :ref="el => { if (el) itemRefs[i] = el as HTMLElement }"
              class="drop__item"
              type="button"
              @mousedown.prevent="selectSuggestion(s)"
              @keydown.enter.prevent="selectSuggestion(s)"
              @keydown.arrow-down.prevent="focusItem(i + 1)"
              @keydown.arrow-up.prevent="i === 0 ? inputRef?.focus() : focusItem(i - 1)"
            >
              <svg class="drop__pin" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
              <div class="drop__info">
                <span class="drop__text">{{ s.text }}</span>
                <span v-if="s.description" class="drop__sub">{{ s.description }}</span>
      </div>
            </button>
      </div>
        </transition>
      </div>

      <!-- Coord pill -->
      <transition name="fade">
        <div v-if="mapLoaded && !mapError && props.latitude && props.longitude" class="mp__pill">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" fill="#c6ea5a"/>
            <circle cx="12" cy="12" r="9" stroke="#c6ea5a" stroke-width="2" opacity="0.4"/>
          </svg>
          {{ props.latitude }}, {{ props.longitude }}
    </div>
      </transition>
    </div>

    <!-- ── Status bar ── -->
    <transition name="fade">
      <div
        v-if="mapLoaded && !mapError"
        class="mp__status"
        :class="{ 'mp__status--ok': selectedAddress && !searchError, 'mp__status--err': !!searchError }"
      >
        <template v-if="searchError">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ searchError }}
        </template>
        <template v-else-if="selectedAddress">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="mp__status-addr">{{ selectedAddress }}</span>
        </template>
        <template v-else>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="2"/></svg>
          Введите адрес или кликните на карте
        </template>
      </div>
    </transition>

  </div>
  </template>
  
  <script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
  
// ── Props ──────────────────────────────────────────────────────────
  interface Props {
  latitude?:  number | string | null;
    longitude?: number | string | null;
  city?:      string;
  height?:    string;
  }
  const props = withDefaults(defineProps<Props>(), {
  latitude: null, longitude: null, city: '', height: '300px',
  });
  
  const emit = defineEmits<{
  'update:latitude':  [value: string | null];
    'update:longitude': [value: string | null];
  'update:address':   [value: string];
  }>();
  
// ── Refs ───────────────────────────────────────────────────────────
  const mapContainer = ref<HTMLElement | null>(null);
const inputRef     = ref<HTMLInputElement | null>(null);
const itemRefs     = ref<HTMLElement[]>([]);

const mapLoaded  = ref(false);
const mapError   = ref<string | null>(null);

const searchText      = ref('');
const focused         = ref(false);
const showDrop        = ref(false);
const searchLoading   = ref(false);
const searchError     = ref<string | null>(null);
  const selectedAddress = ref('');

type Sug = { id: string; text: string; description: string; coords?: [number, number] };
const suggestions        = ref<Sug[]>([]);
  const suggestionsLoading = ref(false);

let dropTimer: ReturnType<typeof setTimeout> | null = null;
let map:    any = null;
  let marker: any = null;
  
// ── Geoapify API Key (можно задать через переменную окружения) ─────
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY || '';
const USE_GEOAPIFY = !!GEOAPIFY_API_KEY;

// ── Yandex Geocoder API Key (обязателен для использования) ─────
const YANDEX_GEOCODER_KEY = import.meta.env.VITE_YANDEX_GEOCODER_KEY || '';
const USE_YANDEX = !!YANDEX_GEOCODER_KEY; // Yandex требует API ключ

// ── Utils ──────────────────────────────────────────────────────────
function openDrop() { if (suggestions.value.length) showDrop.value = true; }
function onBlur()   { focused.value = false; setTimeout(() => { showDrop.value = false; }, 160); }
function focusItem(i: number) { itemRefs.value[i]?.focus(); }

// Helper для создания timeout для fetch
function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// Нормализация адреса для лучшего поиска
function normalizeAddress(address: string): string {
  if (!address) return '';
  // Убираем лишние пробелы
  let normalized = address.trim().replace(/\s+/g, ' ');
  // Если нет запятой между улицей и номером, добавляем
  normalized = normalized.replace(/([а-яёА-ЯЁ]+)\s+(\d+)/i, '$1, $2');
  return normalized;
}

function buildAddr(p: any): string {
  const st = p['street:ru'] || p.street || '';
  const ct = p['city:ru']   || p['locality:ru'] || p.city || p.locality || '';
  const nm = p['name:ru']   || p.name || '';
  const hn = p.housenumber  || '';
  return [st, hn, ct].filter(Boolean).join(', ') || nm;
}

function pickBest(features: any[], query: string) {
  const hm = query.match(/(\d+[А-Яа-яA-Za-z]?)(?:\s|$)/);
  const hn = hm?.[1] ?? null;
  const pri: Record<string, number> = { building: 10, place: 5, highway: 3, amenity: 2 };
  if (hn) {
    const exact = features.find(f => f.properties.osm_key === 'building' && f.properties.housenumber === hn);
    if (exact) return exact;
  }
  return [...features].sort((a, b) => (pri[b.properties.osm_key] || 0) - (pri[a.properties.osm_key] || 0))[0];
}

// ── Leaflet load ───────────────────────────────────────────────────
function loadLeaflet(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).L) {
      // Проверяем что Leaflet полностью загружен
      setTimeout(() => resolve(), 50);
        return;
      }

      // Загружаем CSS
    const existingCSS = document.querySelector('link[href*="leaflet.css"]');
    if (!existingCSS) {
      const link = Object.assign(document.createElement('link'), {
        rel: 'stylesheet',
        href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        crossOrigin: 'anonymous',
      });
      document.head.appendChild(link);
    }

      // Загружаем JS
    const existingScript = document.querySelector('script[src*="leaflet.js"]');
    if (existingScript) {
      // Если скрипт уже загружается, ждем его
      const checkInterval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!(window as any).L) {
          reject(new Error('Leaflet не загрузился'));
        }
      }, 10000);
      return;
    }
    
    const script = Object.assign(document.createElement('script'), {
      src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      crossOrigin: 'anonymous',
      async: true,
    });
    
    const t = setTimeout(() => {
      reject(new Error('Таймаут загрузки карты. Проверьте подключение к интернету.'));
      }, 30000);
  
      script.onload = () => {
      clearTimeout(t);
      // Даем время Leaflet инициализироваться
      setTimeout(() => {
        if ((window as any).L) {
        resolve();
        } else {
          reject(new Error('Leaflet загружен, но не инициализирован'));
        }
      }, 100);
    };
    
    script.onerror = () => {
      clearTimeout(t);
      reject(new Error('Не удалось загрузить библиотеку карты. Проверьте подключение к интернету.'));
      };
      
      document.head.appendChild(script);
    });
}

// ── Map init ───────────────────────────────────────────────────────
async function initMap() {
  // Ждем появления контейнера (увеличено для модальных окон)
  for (let i = 0; i < 100 && !mapContainer.value; i++) await new Promise(r => setTimeout(r, 50));
    if (!mapContainer.value) {
    mapError.value = 'Контейнер карты не найден.'; 
      mapLoaded.value = false;
      return;
    }
  
    try {
      const L = (window as any).L;
      if (!L) {
      throw new Error('Leaflet недоступен. Попробуйте обновить страницу.');
    }

    // Убеждаемся что контейнер видим и имеет размеры (увеличено время для модальных окон)
    await nextTick();
    await new Promise(r => setTimeout(r, 200));
    
    // Ждем пока контейнер получит размеры (важно для модальных окон)
    let attempts = 0;
    while (attempts < 20) {
      const rect = mapContainer.value.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) break;
      await new Promise(r => setTimeout(r, 50));
      attempts++;
    }
    
    // Проверяем размеры контейнера
    const rect = mapContainer.value.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Контейнер карты имеет нулевые размеры, пробуем инициализировать...');
    }

    const lat0 = props.latitude  ? parseFloat(String(props.latitude))  : 43.2389;
    const lon0 = props.longitude ? parseFloat(String(props.longitude)) : 76.8897;

    // Удаляем старую карту если есть
    if (map) {
      try {
        map.remove();
      } catch (e) {
        console.warn('Ошибка при удалении старой карты:', e);
      }
      map = null;
    }

      map = L.map(mapContainer.value, {
      center: [lat0, lon0],
      zoom:   (props.latitude && props.longitude) ? 15 : 11,
        zoomControl: true,
      preferCanvas: false,
    });

    // Ждем инициализации карты
    await new Promise(r => setTimeout(r, 50));

    // CartoDB Voyager — чистые, современные тайлы
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      subdomains: 'abcd',
    });
    
    tileLayer.addTo(map);
    
    // Принудительно обновляем размер карты после загрузки тайлов
    map.whenReady(() => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    });

      map.on('click', async (e: any) => {
      await updateLocation(e.latlng.lat, e.latlng.lng); 
      });
  
      if (props.latitude && props.longitude) {
      const la = parseFloat(String(props.latitude)), lo = parseFloat(String(props.longitude));
      if (!isNaN(la) && !isNaN(lo)) { 
        await updateLocation(la, lo, false); 
        await reverseGeocode(la, lo); 
      }
    }

      mapLoaded.value = true;
    mapError.value  = null;
  } catch (e: any) {
    console.error('Ошибка инициализации карты:', e);
    mapError.value  = e?.message || 'Не удалось инициализировать карту.';
      mapLoaded.value = false;
    }
}

// ── Custom marker ──────────────────────────────────────────────────
function makeIcon() {
    const L = (window as any).L;
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:38px;background:linear-gradient(135deg,#8bc34a,#3d7a1a);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.28)"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);width:9px;height:9px;background:#fff;border-radius:50%"></div></div>`,
    iconSize:   [30, 38],
    iconAnchor: [15, 38],
  });
}

async function updateLocation(lat: number, lon: number, geocode = true) {
  if (!map) return;
  const L = (window as any).L;
  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lon], { icon: makeIcon(), draggable: true }).addTo(map);
  map.setView([lat, lon], Math.max(map.getZoom(), 15), { animate: true, duration: 0.3 });
  emit('update:latitude',  lat.toFixed(6));
    emit('update:longitude', lon.toFixed(6));
  if (geocode) await reverseGeocode(lat, lon);
    marker.on('dragend', async () => {
    const p = marker.getLatLng();
    emit('update:latitude',  p.lat.toFixed(6));
    emit('update:longitude', p.lng.toFixed(6));
    await reverseGeocode(p.lat, p.lng);
  });
}

// ── Reverse Geocoding (координаты → адрес) с Fallback Chain ────────
async function reverseGeocode(lat: number, lon: number) {
  const sources = [
    // 1. Yandex Geocoder - бесплатный, отлично для Казахстана (25,000 запросов/день, требует API ключ)
    async () => {
      if (!USE_YANDEX) return null;
      try {
        const r = await fetch(
          `https://geocode-maps.yandex.ru/1.x/?geocode=${lon},${lat}&format=json&kind=house&results=1&apikey=${YANDEX_GEOCODER_KEY}`,
          { signal: createTimeoutSignal(5000) }
        );
        if (!r.ok || r.status === 400) return null;
        const d = await r.json();
        if (d.response?.GeoObjectCollection?.featureMember?.length) {
          const geoObject = d.response.GeoObjectCollection.featureMember[0].GeoObject;
          const addr = geoObject.metaDataProperty?.GeocoderMetaData?.text || 
            geoObject.name || null;
          return addr;
        }
      } catch (e) {
        console.warn('Yandex reverse failed:', e);
      }
      return null;
    },
    
    // 2. Geoapify (если доступен) - 3,000 запросов/месяц
    async () => {
      if (!USE_GEOAPIFY) return null;
      try {
        const r = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}&lang=ru&format=json`,
          { signal: createTimeoutSignal(5000) }
        );
        if (!r.ok) return null;
        const d = await r.json();
        if (d.results?.length) {
          const result = d.results[0];
          return result.formatted || 
            [result.street, result.housenumber, result.city, result.country]
              .filter(Boolean)
              .join(', ') || null;
        }
      } catch (e) {
        console.warn('Geoapify reverse failed:', e);
      }
      return null;
    },
    
    // 3. Photon (Komoot) - полностью бесплатный
    async () => {
      try {
        const r = await fetch(
          `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`,
          { signal: createTimeoutSignal(5000) }
        );
        if (!r.ok) return null;
        const d = await r.json();
        if (d.features?.length) {
          return buildAddr(d.features[0].properties) || null;
        }
      } catch (e: any) {
        // AbortError - это нормально при таймауте, не логируем
        if (e?.name !== 'AbortError') {
          console.warn('Photon reverse failed:', e);
        }
      }
      return null;
    },
    
    // 4. Nominatim (OpenStreetMap) - бесплатный, но медленнее
    async () => {
      try {
        // Nominatim требует задержку между запросами (rate limit)
        await new Promise(r => setTimeout(r, 1000));
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ru`,
          { 
            headers: { 'User-Agent': 'BirQadam/1.0' },
            signal: createTimeoutSignal(5000)
          }
        );
        if (!r.ok) return null;
        const d = await r.json();
        if (d.address) {
          const parts = [
            d.address.road,
            d.address.house_number,
            d.address.suburb || d.address.neighbourhood,
            d.address.city || d.address.town || d.address.village,
            d.address.country
          ].filter(Boolean);
          return parts.length > 0 ? parts.join(', ') : d.display_name || null;
        }
      } catch (e) {
        console.warn('Nominatim reverse failed:', e);
      }
      return null;
    }
  ];
  
  // Пробуем все источники по очереди
  for (const source of sources) {
    const addr = await source();
    if (addr) {
      selectedAddress.value = addr;
      emit('update:address', addr);
      return;
    }
  }
  
  // Если ничего не найдено
  const coords = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  selectedAddress.value = coords;
  emit('update:address', '');
}

// ── Search ─────────────────────────────────────────────────────────
function onInput() {
  searchError.value = null;
  showDrop.value    = false;
  if (!searchText.value) { suggestions.value = []; return; }
  if (dropTimer) clearTimeout(dropTimer);
  if (searchText.value.length >= 3) {
    dropTimer = setTimeout(() => fetchSuggestions(searchText.value), 320);
  }
}

async function performSearch() {
  const q = searchText.value.trim();
  if (!q || !map || searchLoading.value) return;
  showDrop.value      = false;
  searchLoading.value = true;
  searchError.value   = null;
  
  const full = (props.city && !q.toLowerCase().includes(props.city.toLowerCase())) 
    ? `${props.city}, ${q}` 
    : q;
  
  // Fallback Chain для поиска адресов
  const searchSources = [
    // 1. Yandex Geocoder - бесплатный, отлично для Казахстана (25,000 запросов/день, требует API ключ)
    async () => {
      if (!USE_YANDEX) return null;
      try {
        const normalized = normalizeAddress(full);
        const res = await fetch(
          `https://geocode-maps.yandex.ru/1.x/?geocode=${encodeURIComponent(normalized)}&format=json&results=1&apikey=${YANDEX_GEOCODER_KEY}`,
          { signal: createTimeoutSignal(5000) }
        );
        if (!res.ok || res.status === 400) return null;
        const data = await res.json();
        if (data.response?.GeoObjectCollection?.featureMember?.length) {
          const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
          const pos = geoObject.Point.pos.split(' ');
          const lon = parseFloat(pos[0]);
          const lat = parseFloat(pos[1]);
          const addr = geoObject.metaDataProperty?.GeocoderMetaData?.text || 
            geoObject.name || full;
          return { lat, lon, addr };
        }
      } catch (e) {
        console.warn('Yandex search failed:', e);
      }
      return null;
    },
    
    // 2. Geoapify (если доступен) - 3,000 запросов/месяц
    async () => {
      if (!USE_GEOAPIFY) return null;
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(full)}&apiKey=${GEOAPIFY_API_KEY}&lang=ru&limit=20&filter=countrycode:kz`,
          { signal: createTimeoutSignal(5000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.features?.length) {
          const best = data.features[0];
          const [lon, lat] = best.geometry.coordinates;
          return {
            lat,
            lon,
            addr: best.properties.formatted || 
              [best.properties.street, best.properties.housenumber, best.properties.city]
                .filter(Boolean)
                .join(', ') || 
              `${lat.toFixed(6)}, ${lon.toFixed(6)}`
          };
        }
      } catch (e) {
        console.warn('Geoapify search failed:', e);
      }
      return null;
    },
    
    // 3. Photon (Komoot) - полностью бесплатный
    async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(full)}&limit=20`,
          { cache: 'no-cache', signal: createTimeoutSignal(5000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.features?.length) {
          const best = pickBest(data.features, q);
          if (best) {
            const [lo, la] = best.geometry.coordinates;
            return {
              lat: la,
              lon: lo,
              addr: buildAddr(best.properties) || `${la.toFixed(6)}, ${lo.toFixed(6)}`
            };
          }
        }
      } catch (e: any) {
        // AbortError - это нормально при таймауте, не логируем
        if (e?.name !== 'AbortError') {
          console.warn('Photon search failed:', e);
        }
      }
      return null;
    },
    
    // 4. Nominatim (OpenStreetMap) - бесплатный, но медленнее
    async () => {
      try {
        // Nominatim требует задержку между запросами
        await new Promise(r => setTimeout(r, 1000));
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(full)}&format=json&limit=1&accept-language=ru`,
          { 
            headers: { 'User-Agent': 'BirQadam/1.0' },
            signal: createTimeoutSignal(5000)
          }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.length > 0) {
          const result = data[0];
          return {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            addr: result.display_name || full
          };
        }
      } catch (e) {
        console.warn('Nominatim search failed:', e);
      }
      return null;
    }
  ];
  
  // Пробуем все источники по очереди
  for (const source of searchSources) {
    const result = await source();
    if (result) {
      await updateLocation(result.lat, result.lon);
      selectedAddress.value = result.addr;
      searchText.value = result.addr;
      emit('update:address', result.addr);
      searchError.value = null;
      searchLoading.value = false;
      return;
    }
  }
  
  // Если ничего не найдено
  searchError.value = `Адрес «${q}» не найден. Попробуйте уточнить запрос или выберите место на карте.`;
          searchLoading.value = false;
}

async function fetchSuggestions(q: string) {
  if (!q || q.length < 3) { suggestions.value = []; return; }
  suggestionsLoading.value = true;
  
  const full = (props.city && !q.toLowerCase().includes(props.city.toLowerCase())) 
    ? `${props.city}, ${q}` 
    : q;
  
  // Fallback Chain для автодополнения
  const autocompleteSources = [
    // 1. Yandex Geocoder - бесплатный, отлично для Казахстана (25,000 запросов/день, требует API ключ)
    async () => {
      if (!USE_YANDEX) return [];
      try {
        const normalized = normalizeAddress(full);
        const res = await fetch(
          `https://geocode-maps.yandex.ru/1.x/?geocode=${encodeURIComponent(normalized)}&format=json&results=8&apikey=${YANDEX_GEOCODER_KEY}`,
          { signal: createTimeoutSignal(3000) }
        );
        if (!res.ok || res.status === 400) return [];
        const data = await res.json();
        const seen = new Set<string>();
        const list: Sug[] = [];
        
        if (data.response?.GeoObjectCollection?.featureMember) {
          for (const member of data.response.GeoObjectCollection.featureMember.slice(0, 8)) {
            const geoObject = member.GeoObject;
            const text = geoObject.metaDataProperty?.GeocoderMetaData?.text || 
              geoObject.name || '';
            
            if (!text || seen.has(text)) continue;
            seen.add(text);
            
            const pos = geoObject.Point.pos.split(' ');
            const lon = parseFloat(pos[0]);
            const lat = parseFloat(pos[1]);
            
            const description = geoObject.metaDataProperty?.GeocoderMetaData?.Address?.formatted || 
              geoObject.description || '';
            
            list.push({
              id: `yandex-${geoObject.metaDataProperty?.GeocoderMetaData?.precision || Date.now()}`,
              text,
              description: description.split(',').slice(-2).join(',').trim() || '',
              coords: [lat, lon],
            });
          }
        }
        return list;
      } catch (e) {
        console.warn('Yandex autocomplete failed:', e);
        return [];
      }
    },
    
    // 2. Geoapify (если доступен) - 3,000 запросов/месяц
    async () => {
      if (!USE_GEOAPIFY) return [];
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(full)}&apiKey=${GEOAPIFY_API_KEY}&lang=ru&limit=8&filter=countrycode:kz`,
          { signal: createTimeoutSignal(3000) }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const seen = new Set<string>();
        const list: Sug[] = [];
        
        for (const feature of (data.features || []).slice(0, 8)) {
          const props = feature.properties;
          const text = props.formatted || 
            [props.street, props.housenumber, props.city]
              .filter(Boolean)
              .join(', ') || 
            props.name || '';
          
          if (!text || seen.has(text)) continue;
          seen.add(text);
          
          const [lon, lat] = feature.geometry.coordinates;
          list.push({
            id: `geoapify-${feature.properties.place_id || Date.now()}`,
            text,
            description: props.city || props.state || props.country || '',
            coords: [lat, lon],
          });
        }
        return list;
      } catch (e) {
        console.warn('Yandex autocomplete failed:', e);
        return [];
      }
    },
    
    // 3. Photon (Komoot) - полностью бесплатный
    async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(full)}&limit=15`,
          { cache: 'no-cache', signal: createTimeoutSignal(5000) }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const seen = new Set<string>();
        const list: Sug[] = [];
        
        for (let i = 0; i < (data.features?.length ?? 0) && list.length < 8; i++) {
          const f = data.features[i], p = f.properties;
          const text = buildAddr(p) || p['name:ru'] || p.name || '';
          if (!text || seen.has(text)) continue;
          seen.add(text);
          list.push({
            id: `photon-${i}-${Date.now()}`,
            text,
            description: p.district || p.state || '',
            coords: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
          });
        }
        return list;
      } catch (e: any) {
        // AbortError - это нормально при таймауте, не логируем
        if (e?.name !== 'AbortError') {
          console.warn('Photon autocomplete failed:', e);
        }
        return [];
      }
    }
  ];
  
  // Пробуем все источники по очереди
  for (const source of autocompleteSources) {
    const list = await source();
    if (list.length > 0) {
      suggestions.value = list;
      showDrop.value = true;
          suggestionsLoading.value = false;
          return;
    }
        }
        
  // Если ничего не найдено
          suggestions.value = [];
  showDrop.value = false;
          suggestionsLoading.value = false;
}

async function selectSuggestion(s: Sug) {
  showDrop.value   = false;
  searchText.value = s.text;
  if (s.coords) {
    const [la, lo] = s.coords;
    await updateLocation(la, lo);
    selectedAddress.value = s.text;
    emit('update:address', s.text);
    searchError.value = null;
  } else await performSearch();
}

function clearSearch() {
  searchText.value = selectedAddress.value = searchError.value = '';
            suggestions.value = [];
  showDrop.value    = false;
  emit('update:latitude',  null);
  emit('update:longitude', null);
  emit('update:address',   '');
  if (marker && map) { map.removeLayer(marker); marker = null; }
}

async function retryLoadMap() {
  mapError.value = null; mapLoaded.value = false;
  await loadLeaflet(); await nextTick(); await initMap();
}

// ── Watch prop changes ─────────────────────────────────────────────
watch(() => [props.latitude, props.longitude] as const, async ([la, lo], [ola, olo]) => {
  if (!map || !la || !lo) return;
  const lat = parseFloat(String(la)), lon = parseFloat(String(lo));
  if (isNaN(lat) || isNaN(lon)) return;
  if (lat === parseFloat(String(ola)) && lon === parseFloat(String(olo))) return;
  await updateLocation(lat, lon, false);
  await reverseGeocode(lat, lon);
}, { immediate: false });

// ── Resize handler для карты ──────────────────────────────────────
let resizeHandler: (() => void) | null = null;

// ── Lifecycle ──────────────────────────────────────────────────────
onMounted(async () => {
  try {
    await nextTick();
    // Даем время для рендера контейнера, особенно в модальных окнах
    await new Promise(r => setTimeout(r, 150));
    await loadLeaflet();
    await nextTick();
    await initMap();
    
    // Обновляем размер карты после полной загрузки (важно для модальных окон)
    if (map) {
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 300);
      
      // Также обновляем при изменении размера окна
      resizeHandler = () => {
        if (map) {
          setTimeout(() => map.invalidateSize(), 100);
        }
      };
      window.addEventListener('resize', resizeHandler);
    }
  } catch (e: any) {
    console.error('Ошибка загрузки карты:', e);
    mapError.value  = e?.message || 'Не удалось загрузить карту.';
    mapLoaded.value = false;
  }
});

onUnmounted(() => { 
  // Удаляем обработчик resize
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  
  // Удаляем карту
  if (map) { 
    try {
      map.remove(); 
    } catch (e) {
      console.warn('Ошибка при удалении карты:', e);
    }
    map = null; 
  } 
});
</script>

<style scoped>
/* ══════════════════════════════════
   ROOT
══════════════════════════════════ */
.mp {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
}

/* ══════════════════════════════════
   MAP BLOCK
══════════════════════════════════ */
.mp__map {
  position: relative;
  border-radius: 14px 14px 0 0;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #ecefe8;
}

.mp__canvas { 
  width: 100%; 
  height: 100%; 
  display: block; 
  position: relative;
  z-index: 0;
}

/* Исправление для Leaflet */
.mp__canvas :deep(.leaflet-container) {
  width: 100% !important;
  height: 100% !important;
  font-family: inherit;
}

/* ── States ── */
.mp__state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #f2f4ef;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.4);
}

.mp__state-spin { animation: spin 0.9s linear infinite; display: block; }
.mp__state-emoji { font-size: 2rem; }
.mp__state--err { background: #fef4f4; }

.mp__retry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 15px;
  border-radius: 100px;
  background: rgba(139, 195, 74, 0.1);
  border: 1.5px solid rgba(139, 195, 74, 0.25);
  color: #3a7422;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.mp__retry:hover { background: rgba(139, 195, 74, 0.2); }

/* ── Coord pill ── */
.mp__pill {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 100px;
  background: rgba(8, 18, 6, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #c6ea5a;
  font-size: 0.68rem;
  font-family: 'Fira Code', monospace;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  z-index: 600;
}

/* ══════════════════════════════════
   SEARCH OVERLAY
══════════════════════════════════ */
.mp__overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 1000;
}

/* ── Search box ── */
.sb {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 11px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.11);
  overflow: hidden;
  transition: border-color 0.17s, box-shadow 0.17s;
}
.sb--focused {
  border-color: #8bc34a;
  box-shadow: 0 2px 18px rgba(139, 195, 74, 0.22);
}

.sb__ico {
  flex-shrink: 0;
  padding: 0 8px 0 13px;
  color: rgba(0, 0, 0, 0.33);
}

.sb__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: #111;
  padding: 10px 0;
  min-width: 0;
}
.sb__input::placeholder { color: rgba(0,0,0,0.30); }

.sb__spin {
  flex-shrink: 0;
  margin-right: 10px;
  animation: spin 0.9s linear infinite;
}

.sb__clear {
  flex-shrink: 0;
  margin-right: 9px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,0.07);
  border: none;
  color: rgba(0,0,0,0.38);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.13s, color 0.13s;
}
.sb__clear:hover { background: rgba(0,0,0,0.13); color: rgba(0,0,0,0.65); }

/* ── Dropdown ── */
.drop {
  margin-top: 4px;
  background: #fff;
  border-radius: 11px;
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 8px 28px rgba(0,0,0,0.13);
  overflow: hidden;
}

.drop__item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
    width: 100%;
  padding: 9px 13px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.11s;
}
.drop__item:hover, .drop__item:focus { background: rgba(139,195,74,0.08); outline: none; }
.drop__item + .drop__item { border-top: 1px solid rgba(0,0,0,0.05); }

.drop__pin { flex-shrink: 0; color: #8bc34a; margin-top: 2px; }
.drop__info { flex: 1; min-width: 0; }

.drop__text {
  display: block;
  font-size: 0.84rem;
  font-weight: 600;
  color: #111;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.drop__sub {
  display: block;
  font-size: 0.73rem;
  color: rgba(0,0,0,0.40);
  margin-top: 1px;
}

/* ══════════════════════════════════
   STATUS BAR
══════════════════════════════════ */
.mp__status {
    display: flex;
    align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 0 0 12px 12px;
  font-size: 0.775rem;
  font-weight: 600;
  color: rgba(0,0,0,0.42);
  background: rgba(0,0,0,0.025);
  border: 1px solid rgba(0,0,0,0.07);
  border-top: none;
  min-height: 33px;
}

.mp__status--ok  { color: #3a7422; background: rgba(139,195,74,0.07); border-color: rgba(139,195,74,0.17); }
.mp__status--err { color: #c62828; background: rgba(198,40,40,0.05);  border-color: rgba(198,40,40,0.14); }

.mp__status-addr { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* ══════════════════════════════════
   TRANSITIONS
══════════════════════════════════ */
.drop-enter-active, .drop-leave-active { transition: opacity 0.14s, transform 0.14s; }
.drop-enter-from  { opacity: 0; transform: translateY(-5px); }
.drop-leave-to    { opacity: 0; transform: translateY(-4px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }

@keyframes spin { to { transform: rotate(360deg); } }

/* ══════════════════════════════════
   LEAFLET OVERRIDES
══════════════════════════════════ */
:deep(.leaflet-control-attribution) {
  font-size: 0.58rem !important;
  background: rgba(255,255,255,0.65) !important;
  backdrop-filter: blur(4px);
  border-radius: 6px 0 0 0 !important;
}

:deep(.leaflet-control-zoom) {
  border: none !important;
  border-radius: 10px !important;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.13) !important;
}

:deep(.leaflet-control-zoom a) {
  border-radius: 0 !important;
  color: #3a7422 !important;
  border-color: rgba(139,195,74,0.2) !important;
  font-size: 1rem !important;
  }
  </style>