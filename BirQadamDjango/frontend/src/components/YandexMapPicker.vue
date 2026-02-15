<template>
    <div class="yandex-map-picker">
      <!-- Контейнер карты всегда в DOM для инициализации, но скрыт до готовности -->
      <div class="map-wrapper">
        <div ref="mapContainer" class="map-container" :style="{ display: mapLoaded ? 'block' : 'none' }" />
        
        <!-- Поиск сверху карты -->
        <div v-if="mapLoaded && !mapError" class="map-search-overlay">
          <v-autocomplete
            v-model="searchQuery"
            :items="suggestions"
            :loading="suggestionsLoading || searchLoading"
            label="Поиск адреса"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-magnify"
            :append-inner-icon="searchLoading ? undefined : 'mdi-close'"
            @click:append-inner="clearSearch"
            @keyup.enter="performSearch"
            @update:search="(value) => { if (value && typeof value === 'string') onSearchInput(value); }"
            @update:model-value="onSuggestionSelect"
            :disabled="searchLoading"
            hide-details
            class="search-field"
            item-title="text"
            return-object
            clearable
            no-data-text="Адрес не найден. Попробуйте уточнить запрос."
            auto-select-first
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props" :title="item.raw.text" :subtitle="item.raw.description">
                <template #prepend>
                  <v-icon icon="mdi-map-marker-outline" />
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
        </div>
      </div>
      
      <div v-if="!mapLoaded && !mapError" class="map-loading">
        <v-progress-circular indeterminate color="primary" />
        <p class="text-body-2 text-medium-emphasis mt-2">Загрузка карты...</p>
      </div>
      <div v-else-if="mapError" class="map-error">
        <v-alert type="error" variant="tonal" class="mb-2">
          <v-icon icon="mdi-alert-circle" start />
          {{ mapError }}
        </v-alert>
        <v-btn
          color="primary"
          variant="outlined"
          size="small"
          @click="retryLoadMap"
        >
          <v-icon icon="mdi-refresh" start />
          Попробовать снова
        </v-btn>
      </div>
      <div v-if="mapLoaded && searchError" class="search-error mt-2">
        <v-alert type="warning" variant="tonal" density="compact" class="mb-0">
          <v-icon icon="mdi-alert" start size="16" />
          {{ searchError }}
        </v-alert>
      </div>
      <div v-if="mapLoaded && selectedAddress" class="selected-address mt-2">
        <v-chip color="primary" variant="tonal" size="small">
          <v-icon icon="mdi-map-marker" start size="16" />
          {{ selectedAddress }}
        </v-chip>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
  
  interface Props {
    latitude?: number | string | null;
    longitude?: number | string | null;
    city?: string;
    height?: string;
  }
  
  const props = withDefaults(defineProps<Props>(), {
    latitude: null,
    longitude: null,
    city: '',
    height: '300px',
  });
  
  const emit = defineEmits<{
    'update:latitude': [value: string | null];
    'update:longitude': [value: string | null];
    'update:address': [value: string];
  }>();
  
  const mapContainer = ref<HTMLElement | null>(null);
  const mapLoaded = ref(false);
  const mapError = ref<string | null>(null);
    const searchQuery = ref<string | any>('');
  const selectedAddress = ref('');
  const searchLoading = ref(false);
  const searchError = ref<string | null>(null);
  const suggestions = ref<Array<{ text: string; description: string; coords?: [number, number] }>>([]);
  const suggestionsLoading = ref(false);
  let suggestionsTimeout: number | null = null;
  let map: any = null;
  let marker: any = null;
  
  // Загрузка Leaflet (OpenStreetMap)
  const loadLeaflet = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).L) {
        console.log('Leaflet уже загружен');
        resolve();
        return;
      }

      // Загружаем CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);

      // Загружаем JS
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.async = true;
      
      console.log('Загрузка Leaflet...');
      
      const timeout = setTimeout(() => {
        console.error('Таймаут загрузки Leaflet');
        reject(new Error('Превышено время ожидания загрузки карты. Проверьте подключение к интернету.'));
      }, 30000);
  
      script.onload = () => {
        console.log('Leaflet загружен');
        clearTimeout(timeout);
        resolve();
      };
      
      script.onerror = (error) => {
        console.error('Ошибка загрузки Leaflet:', error);
        clearTimeout(timeout);
        reject(new Error('Не удалось загрузить Leaflet'));
      };
      
      document.head.appendChild(script);
    });
  };
  
  // Инициализация карты (Leaflet)
  const initMap = async () => {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!mapContainer.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!mapContainer.value) {
      console.error('mapContainer не найден после ожидания');
      mapError.value = 'Не удалось найти контейнер для карты';
      mapLoaded.value = false;
      return;
    }
  
    console.log('Начало инициализации карты, mapContainer найден');
    try {
      const L = (window as any).L;
      if (!L) {
        throw new Error('Leaflet не доступен');
      }
      console.log('Leaflet доступен, создаем карту...');
  
      let initialLat = 43.2389;
      let initialLon = 76.8897;
      let initialZoom = 11;
  
      if (props.latitude && props.longitude) {
        initialLat = parseFloat(String(props.latitude));
        initialLon = parseFloat(String(props.longitude));
        initialZoom = 15;
      }
  
      // Создаем карту Leaflet
      map = L.map(mapContainer.value, {
        center: [initialLat, initialLon],
        zoom: initialZoom,
        zoomControl: true,
      });
  
      // Добавляем тайлы OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
  
      // Обработчик клика на карте
      map.on('click', async (e: any) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        await updateLocation(lat, lon);
      });
  
      if (props.latitude && props.longitude) {
        const lat = parseFloat(String(props.latitude));
        const lon = parseFloat(String(props.longitude));
        if (!isNaN(lat) && !isNaN(lon)) {
          await updateLocation(lat, lon, false);
          await reverseGeocode(lat, lon);
        }
      }
  
      console.log('Карта успешно инициализирована');
      mapLoaded.value = true;
      mapError.value = null;
    } catch (error: any) {
      console.error('Ошибка инициализации карты:', error);
      mapError.value = error?.message || 'Не удалось загрузить карту. Проверьте подключение к интернету.';
      mapLoaded.value = false;
    }
  };
  
  // Обновление местоположения
  const updateLocation = async (lat: number, lon: number, geocode: boolean = true) => {
    if (!map) return;
  
    const L = (window as any).L;
    if (!L) return;
  
    // Удаляем старый маркер
    if (marker) {
      map.removeLayer(marker);
    }
  
    // Создаем новый маркер с возможностью перетаскивания
    // Используем стандартные иконки Leaflet
    marker = L.marker([lat, lon], {
      draggable: true
    }).addTo(map);
  
    // Добавляем всплывающую подсказку
    marker.bindPopup('Выбранное местоположение').openPopup();
  
    // Перемещаем карту к маркеру
    map.setView([lat, lon], map.getZoom(), { animate: true, duration: 0.3 });
  
    emit('update:latitude', lat.toFixed(6));
    emit('update:longitude', lon.toFixed(6));
  
    if (geocode) {
      await reverseGeocode(lat, lon);
    }
  
    // Обработчик перетаскивания маркера
    marker.on('dragend', async () => {
      const position = marker.getLatLng();
      emit('update:latitude', position.lat.toFixed(6));
      emit('update:longitude', position.lng.toFixed(6));
      await reverseGeocode(position.lat, position.lng);
    });
  };
  
  // Обратное геокодирование через Photon API
  // Примечание: параметр lang не поддерживается для /reverse endpoint
  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const featureProps = feature.properties;
        
        // Формируем адрес из свойств с приоритетом русских названий
        const street = featureProps['street:ru'] || featureProps.street || '';
        const city = featureProps['city:ru'] || featureProps['locality:ru'] || featureProps.city || featureProps.locality || '';
        const name = featureProps['name:ru'] || featureProps.name || '';
        const housenumber = featureProps.housenumber || '';
        
        const addressParts = [street, housenumber, city].filter(Boolean);
        const address = addressParts.join(', ') || name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        
        selectedAddress.value = address;
        emit('update:address', address);
      } else {
        selectedAddress.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        emit('update:address', '');
      }
    } catch (error) {
      console.error('Ошибка геокодирования:', error);
      selectedAddress.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      emit('update:address', '');
    }
  };
  
  // Поиск адреса через геокодер API для более точных результатов
  const performSearch = async () => {
    let queryValue: string = '';
    
    // Безопасное извлечение строки из searchQuery
    if (typeof searchQuery.value === 'string') {
      queryValue = searchQuery.value;
    } else if (searchQuery.value && typeof searchQuery.value === 'object') {
      // Проверяем различные возможные свойства объекта
      const obj = searchQuery.value as any;
      if (obj.text && typeof obj.text === 'string') {
        queryValue = obj.text;
      } else if (obj.value && typeof obj.value === 'string') {
        queryValue = obj.value;
      } else if (obj.title && typeof obj.title === 'string') {
        queryValue = obj.title;
      } else {
        // Если это не простой объект с текстом, игнорируем его
        console.warn('Некорректный тип значения searchQuery:', typeof searchQuery.value, searchQuery.value);
        queryValue = '';
      }
    } else if (searchQuery.value === null || searchQuery.value === undefined) {
      queryValue = '';
    } else {
      // Для других типов пытаемся безопасно преобразовать
      const str = String(searchQuery.value);
      // Проверяем, что это не HTML-шаблон
      if (str.includes('<') || str.includes('>') || str.length > 500) {
        console.warn('Попытка использовать некорректное значение как запрос');
        queryValue = '';
      } else {
        queryValue = str;
      }
    }
    
    if (!queryValue.trim() || !map || searchLoading.value) return;
  
    let queryText = queryValue.trim();
    
    // Проверка на HTML-теги - если запрос содержит HTML, это ошибка
    if (queryText.includes('<') || queryText.includes('>') || queryText.length > 500) {
      console.error('Некорректный запрос (содержит HTML или слишком длинный):', queryText.substring(0, 100));
      searchError.value = 'Некорректный запрос. Пожалуйста, введите адрес текстом.';
      searchLoading.value = false;
      return;
    }
    
    console.log('=== НАЧАЛО ПОИСКА АДРЕСА ===');
    console.log('Исходный запрос (queryText):', queryText);
    console.log('Город из props:', props.city);

    searchLoading.value = true;
    searchError.value = null;

    try {
      let query = queryText;
      if (props.city && !queryText.toLowerCase().includes(props.city.toLowerCase())) {
        query = `${props.city}, ${queryText}`;
      }

      console.log('Формируем запрос для API:', query);

      // Используем Photon API (OpenStreetMap)
      // Примечание: параметр lang не поддерживается Photon API и вызывает ошибки 400
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=20`;
      
      console.log('Запрос к Photon API:', url);
      
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();
      
      console.log('Ответ от Photon API получен. Статус:', response.status);
      console.log('Количество результатов:', data.features?.length || 0);
      console.log('Полные данные ответа:', data);
      
      if (!response.ok) {
        console.error('Ошибка запроса к Photon API:', response.status, response.statusText);
        searchError.value = `Ошибка поиска адреса. Статус: ${response.status}`;
        searchLoading.value = false;
        return;
      }
  
      if (data.features && data.features.length > 0) {
        // Улучшенное регулярное выражение для извлечения номера дома
        // Ищет "дом 46", "д. 46", "46", "улица ... 46", "толе би 75" и т.д.
        // Ищем число в конце строки или после пробела
        const houseNumberMatch = queryText.match(/(?:дом|д\.?|дом\s*№?)\s*(\d+[А-Яа-яA-Za-z]?)|(\d+[А-Яа-яA-Za-z]?)(?:\s*$|\s*[^\d])/i);
        const houseNumber = houseNumberMatch ? (houseNumberMatch[1] || houseNumberMatch[2]) : null;
        
        console.log('=== ИЗВЛЕЧЕНИЕ НОМЕРА ДОМА ===');
        console.log('Исходный запрос:', queryText);
        console.log('Регулярное выражение совпадение:', houseNumberMatch);
        console.log('Извлечен номер дома:', houseNumber);
        
        let bestResult = null;
        let bestScore = -1;
        let foundStreet = null;
        
        // Приоритеты типов объектов для Photon (osm_key)
        const kindPriority: Record<string, number> = {
          'building': 10,
          'place': 5,
          'highway': 3,
          'amenity': 2
        };
        
        console.log('=== ПРОВЕРКА РЕЗУЛЬТАТОВ PHOTON API ===');
        console.log('Всего результатов для проверки:', data.features.length);
        
        if (houseNumber) {
          // Сначала ищем точное совпадение дома с номером
          for (let i = 0; i < data.features.length; i++) {
            const feature = data.features[i];
            const featureProps = feature.properties;
            const osmKey = featureProps.osm_key;
            const osmType = featureProps.osm_type;
            // Используем русские названия, если они есть
            const name = featureProps['name:ru'] || featureProps.name || '';
            const housenumber = featureProps.housenumber || '';
            const street = featureProps['street:ru'] || featureProps.street || '';
            const city = featureProps['city:ru'] || featureProps['locality:ru'] || featureProps.city || featureProps.locality || '';
            
            // Формируем полный адрес
            const addressParts = [street, housenumber, city].filter(Boolean);
            const address = addressParts.join(', ') || name;
            
            console.log(`\n[Результат ${i + 1}]`);
            console.log('  OSM key:', osmKey);
            console.log('  OSM type:', osmType);
            console.log('  Название:', name);
            console.log('  Улица:', street);
            console.log('  Номер дома:', housenumber);
            console.log('  Город:', city);
            console.log('  Полный адрес:', address);
            
            // Сохраняем улицу на случай, если дом не найдем
            if (osmKey === 'highway' && !foundStreet) {
              foundStreet = feature;
              console.log('  ✓ Сохранена улица для второго запроса');
            }
            
            let score = kindPriority[osmKey] || 0;
            
            // Проверяем номер дома
            if (housenumber) {
              console.log('  Найден номер дома в properties:', housenumber);
              console.log('  Сравнение:', housenumber, '===', houseNumber, '?', housenumber === houseNumber);
            }
            
            // Если это здание и номер дома совпадает
            if (osmKey === 'building' && housenumber === houseNumber) {
              score += 50; // Максимальный приоритет
              bestResult = feature;
              bestScore = score;
              console.log('  ✓✓✓ НАЙДЕНО ТОЧНОЕ СОВПАДЕНИЕ ДОМА!');
              break;
            }
            
            // Также проверяем, если номер дома в названии
            if (housenumber === houseNumber && osmKey === 'building') {
              score += 40;
              if (score > bestScore) {
                bestResult = feature;
                bestScore = score;
                console.log('  ✓✓ НАЙДЕНО СОВПАДЕНИЕ ДОМА!');
              }
            }
          }
          
          console.log('\n=== ИТОГИ ПЕРВОГО ЗАПРОСА ===');
          console.log('Найден дом?', bestResult ? 'ДА' : 'НЕТ');
          if (bestResult) {
            const bestProps = bestResult.properties;
            const street = bestProps['street:ru'] || bestProps.street || '';
            const city = bestProps['city:ru'] || bestProps['locality:ru'] || bestProps.city || bestProps.locality || '';
            console.log('Найденный адрес:', street, bestProps.housenumber, city);
          }
          if (foundStreet) {
            const streetProps = foundStreet.properties;
            const streetName = streetProps['name:ru'] || streetProps['street:ru'] || streetProps.name || streetProps.street;
            console.log('Найдена улица:', streetName);
          }
          
          // Если не нашли дом, но есть улица - делаем второй запрос
          if (!bestResult && foundStreet) {
            const streetProps = foundStreet.properties;
            const streetName = streetProps['name:ru'] || streetProps['street:ru'] || streetProps.name || streetProps.street;
            const preciseQuery = props.city 
              ? `${props.city}, ${streetName}, ${houseNumber}`
              : `${streetName}, ${houseNumber}`;
            
            console.log('Дом не найден в первом запросе, делаем второй запрос:', preciseQuery);
            
            try {
              const preciseUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(preciseQuery)}&limit=10`;
              
              const preciseResponse = await fetch(preciseUrl, {
                cache: 'no-cache',
                headers: { 'Cache-Control': 'no-cache' }
              });
              
              const preciseData = await preciseResponse.json();
              
              if (preciseData.features && preciseData.features.length > 0) {
                // Ищем дом с нужным номером
                for (const feature of preciseData.features) {
                  const featureProps = feature.properties;
                  if (featureProps.osm_key === 'building' && featureProps.housenumber === houseNumber) {
                    bestResult = feature;
                    const street = featureProps['street:ru'] || featureProps.street || '';
                    console.log('Найден дом во втором запросе:', street, featureProps.housenumber);
                    break;
                  }
                }
              }
            } catch (preciseError) {
              console.warn('Ошибка второго запроса для поиска дома:', preciseError);
            }
          }
          
          // Если не нашли дом, но есть улица - используем её как результат
          if (!bestResult && foundStreet) {
            console.log('Дом не найден, используем улицу как результат');
            bestResult = foundStreet;
            searchError.value = `Дом "${houseNumber}" на этой улице не найден. Показана улица.`;
          }
        }
        
        // Если не нашли точное совпадение, ищем по частичному совпадению названия улицы
        if (!bestResult) {
          console.log('Ищем результат по частичному совпадению названия улицы');
          
          // Извлекаем название улицы из запроса (убираем номер дома и город)
          let streetQuery = queryText.toLowerCase();
          if (houseNumber) {
            streetQuery = streetQuery.replace(new RegExp(`\\s*${houseNumber}\\s*`, 'i'), '').trim();
          }
          if (props.city) {
            streetQuery = streetQuery.replace(new RegExp(`\\s*${props.city.toLowerCase()}\\s*`, 'g'), '').trim();
          }
          streetQuery = streetQuery.replace(/^улица\s+|^ул\.?\s+|^проспект\s+|^пр\.?\s+/i, '').trim();
          
          console.log('Поиск улицы по запросу:', streetQuery);
          
          for (const feature of data.features) {
            const featureProps = feature.properties;
            const osmKey = featureProps.osm_key;
            
            // Используем русские названия, если они есть
            const name = (featureProps['name:ru'] || featureProps.name || '').toLowerCase();
            const street = (featureProps['street:ru'] || featureProps.street || '').toLowerCase();
            const housenumber = featureProps.housenumber || '';
            
            // Проверяем совпадение названия улицы
            const nameMatch = name.includes(streetQuery) || streetQuery.includes(name);
            const streetMatch = street.includes(streetQuery) || streetQuery.includes(street);
            
            let score = kindPriority[osmKey] || 0;
            
            // Бонус за совпадение названия
            if (nameMatch || streetMatch) {
              score += 20;
              // Дополнительный бонус, если есть номер дома и он совпадает
              if (houseNumber && housenumber === houseNumber) {
                score += 30;
              }
            }
            
            console.log(`  Результат: ${name || street}, тип: ${osmKey}, совпадение: ${nameMatch || streetMatch}, приоритет: ${score}`);
            
            if (score > bestScore) {
              bestResult = feature;
              bestScore = score;
              console.log(`  ✓ Выбран как лучший результат`);
            }
          }
        }
        
        // Если все еще не нашли, берем лучший результат по приоритету типа
        if (!bestResult) {
          console.log('Ищем лучший результат по приоритету типа среди всех результатов');
          for (const feature of data.features) {
            const featureProps = feature.properties;
            const osmKey = featureProps.osm_key;
            const score = kindPriority[osmKey] || 0;
            
            // Используем русские названия для логирования
            const name = featureProps['name:ru'] || featureProps.name || '';
            const street = featureProps['street:ru'] || featureProps.street || '';
            
            console.log(`  Результат: ${name || street}, тип: ${osmKey}, приоритет: ${score}`);
            
            if (score > bestScore) {
              bestResult = feature;
              bestScore = score;
              console.log(`  ✓ Выбран как лучший результат`);
            }
          }
        }
        
        // Если все еще нет результата, берем первый
        if (!bestResult) {
          console.log('Точное совпадение не найдено, берем первый результат');
          bestResult = data.features[0];
        }
  
        if (!bestResult) {
          console.error('КРИТИЧЕСКАЯ ОШИБКА: bestResult все еще null после обработки результатов!');
          searchError.value = `Адрес "${queryText}" не найден. Попробуйте уточнить адрес.`;
          searchLoading.value = false;
          return;
        }
  
        // Photon возвращает координаты в формате [lon, lat]
        const coords = bestResult.geometry.coordinates;
        const lon = coords[0];
        const lat = coords[1];
        
        // Формируем адрес из свойств с приоритетом русских названий
        const bestProps = bestResult.properties;
        console.log('Свойства найденного результата:', bestProps);
        
        // Используем русские названия, если они есть, иначе используем стандартные
        const street = bestProps['street:ru'] || bestProps.street || '';
        const city = bestProps['city:ru'] || bestProps['locality:ru'] || bestProps.city || bestProps.locality || '';
        const name = bestProps['name:ru'] || bestProps.name || '';
        const housenumber = bestProps.housenumber || '';
        
        const addressParts = [street, housenumber, city].filter(Boolean);
        const address = addressParts.join(', ') || name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  
        console.log('Итоговый результат - Адрес:', address, 'Координаты:', [lat, lon]);
        console.log('Тип объекта:', bestProps.osm_key, bestProps.osm_value);
  
        await updateLocation(lat, lon);
        selectedAddress.value = address;
        emit('update:address', address);
        searchError.value = null;
      } else {
        console.warn('Адрес не найден:', query);
        searchError.value = `Адрес "${queryText}" не найден. Попробуйте уточнить адрес или проверить написание.`;
        
        if (!props.city && !queryText.includes(',')) {
          // Поиск города через Photon
          const cityUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryText)}&limit=1`;
          const cityResponse = await fetch(cityUrl, {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
          const cityData = await cityResponse.json();
          
          if (cityData.features && cityData.features.length > 0) {
            const cityFeature = cityData.features[0];
            const cityFeatureProps = cityFeature.properties;
            
            // Проверяем, что это город (place=city или place=town)
            if (cityFeatureProps.osm_key === 'place' && (cityFeatureProps.osm_value === 'city' || cityFeatureProps.osm_value === 'town')) {
              const coords = cityFeature.geometry.coordinates; // [lon, lat]
              const cityLat = coords[1];
              const cityLon = coords[0];
              
              map.setView([cityLat, cityLon], 12, { animate: true, duration: 0.5 });
              console.log('Карта перемещена к городу:', cityFeatureProps.name);
              searchError.value = null;
            }
          }
        }
        
        if (searchError.value) {
          const queryWithoutNumber = queryText.replace(/\d+\/?\d*/g, '').trim();
          if (queryWithoutNumber && queryWithoutNumber !== queryText) {
            console.log('Пробуем поиск без номера:', queryWithoutNumber);
            const altQuery = props.city ? `${props.city}, ${queryWithoutNumber}` : queryWithoutNumber;
            const altUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(altQuery)}&limit=5`;
            
            try {
              const altResponse = await fetch(altUrl, { cache: 'no-cache' });
              const altData = await altResponse.json();
              
              if (altData.features && altData.features.length > 0) {
                const altFeature = altData.features[0];
                const coords = altFeature.geometry.coordinates; // [lon, lat]
                const altLat = coords[1];
                const altLon = coords[0];
                
                await updateLocation(altLat, altLon);
                searchError.value = null;
                return;
              }
            } catch (altError) {
              console.warn('Альтернативный поиск не удался:', altError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Ошибка поиска адреса:', error);
    } finally {
      searchLoading.value = false;
    }
  };
  
  const clearSearch = () => {
    searchQuery.value = '';
    suggestions.value = [];
    searchError.value = null;
  };
  
  // Получение подсказок через Photon API
  const fetchSuggestions = async (query: string) => {
    if (!query || typeof query !== 'string' || !query.trim() || query.length < 3) {
      suggestions.value = [];
      return;
    }
    
    // Проверка на HTML-теги и слишком длинные запросы
    const cleanQuery = query.trim();
    if (cleanQuery.includes('<') || cleanQuery.includes('>') || cleanQuery.length > 500) {
      suggestions.value = [];
      return;
    }
    
    // Проверка на слишком короткие запросы после очистки
    if (cleanQuery.length < 3) {
      suggestions.value = [];
      return;
    }
  
    if (suggestionsTimeout !== null) {
      clearTimeout(suggestionsTimeout);
    }
  
    suggestionsTimeout = window.setTimeout(async () => {
      try {
        suggestionsLoading.value = true;
        
        // Формируем запрос - если город указан, добавляем его только если его нет в запросе
        let geocodeQuery = cleanQuery;
        if (props.city && !cleanQuery.toLowerCase().includes(props.city.toLowerCase())) {
          geocodeQuery = `${props.city}, ${cleanQuery}`;
        }
        
        // Убеждаемся, что запрос не слишком короткий
        if (geocodeQuery.length < 3) {
          suggestions.value = [];
          suggestionsLoading.value = false;
          return;
        }
        
        // Проверяем, что запрос содержит хотя бы одну букву (не только цифры/спецсимволы)
        if (!/[а-яА-Яa-zA-Z]/.test(geocodeQuery)) {
          suggestions.value = [];
          suggestionsLoading.value = false;
          return;
        }
        
        // Используем Photon API
        // Примечание: параметр lang не поддерживается Photon API и вызывает ошибки 400
        // Увеличиваем лимит до 15, чтобы получить больше результатов с домами
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(geocodeQuery)}&limit=15`;
        console.log('Запрос подсказок к Photon:', url);
        
        const geocodeResponse = await fetch(url, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!geocodeResponse.ok) {
          // Если 400, это может быть из-за некорректного запроса - просто игнорируем без ошибки
          if (geocodeResponse.status === 400) {
            console.warn('Photon API вернул 400 для запроса:', geocodeQuery, '- игнорируем');
            suggestions.value = [];
            suggestionsLoading.value = false;
            return;
          }
          // Для других ошибок тоже просто игнорируем, чтобы не засорять консоль
          console.warn('Photon API вернул ошибку:', geocodeResponse.status, 'для запроса:', geocodeQuery);
          suggestions.value = [];
          suggestionsLoading.value = false;
          return;
        }
        
        const geocodeData = await geocodeResponse.json();
        
        console.log('Ответ от Photon API:', geocodeData);
        console.log('Количество результатов:', geocodeData.features?.length || 0);
        
        if (geocodeData.features && geocodeData.features.length > 0) {
          // Приоритеты типов объектов для сортировки (дома выше улиц)
          const typePriority: Record<string, number> = {
            'building': 100,
            'place': 50,
            'highway': 10,
            'amenity': 5
          };
          
          // Сортируем результаты: сначала дома (buildings), потом улицы (highways)
          const sortedFeatures = [...geocodeData.features].sort((a: any, b: any) => {
            const aKey = a.properties.osm_key || '';
            const bKey = b.properties.osm_key || '';
            const aPriority = typePriority[aKey] || 0;
            const bPriority = typePriority[bKey] || 0;
            
            // Если оба имеют housenumber, приоритет выше
            const aHasHouse = !!a.properties.housenumber;
            const bHasHouse = !!b.properties.housenumber;
            
            if (aHasHouse && !bHasHouse) return -1;
            if (!aHasHouse && bHasHouse) return 1;
            
            return bPriority - aPriority;
          });
          
          // Убираем дубликаты по координатам и тексту
          const uniqueFeatures = new Map<string, any>();
          
          sortedFeatures
            .forEach((feature: any, index: number) => {
              const featureProps = feature.properties;
              const coords = feature.geometry.coordinates; // [lon, lat]
              
              console.log(`[Подсказка ${index + 1}] Свойства:`, featureProps);
              
              // Формируем адрес с приоритетом русских названий
              // Используем русские названия, если они есть, иначе используем стандартные
              const street = featureProps['street:ru'] || featureProps.street || '';
              const city = featureProps['city:ru'] || featureProps['locality:ru'] || featureProps.city || featureProps.locality || '';
              const name = featureProps['name:ru'] || featureProps.name || '';
              const housenumber = featureProps.housenumber || '';
              
              let text = '';
              if (street && housenumber) {
                text = `${street}, ${housenumber}`;
                if (city) {
                  text += `, ${city}`;
                }
              } else if (street) {
                text = street;
                if (city) {
                  text += `, ${city}`;
                }
              } else if (name) {
                text = name;
                if (city) {
                  text += `, ${city}`;
                }
              } else {
                // Если ничего нет, формируем из доступных частей
                const addressParts = [street, housenumber, city, name].filter(Boolean);
                text = addressParts.join(', ') || `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
              }
              
              const description = featureProps.city || featureProps.locality || featureProps.district || '';
              
              console.log(`[Подсказка ${index + 1}] Сформированный текст:`, text);
              
              // Убеждаемся, что text не пустой
              if (!text || text.trim() === '') {
                console.warn(`[Подсказка ${index + 1}] Пустой текст, пропускаем`);
                return null;
              }
              
              // Создаем уникальный ключ для дедупликации
              const uniqueKey = `${text}_${coords[0]}_${coords[1]}`;
              
              if (!uniqueFeatures.has(uniqueKey)) {
                const suggestionItem = {
                  id: `photon-${index}-${Date.now()}-${Math.random()}`, // Уникальный ID
                  text: text.trim(), // Убираем пробелы
                  description: description || '',
                  coords: [coords[1], coords[0]] as [number, number], // Конвертируем в [lat, lon]
                  featureProps: featureProps // Сохраняем свойства для дополнительного поиска
                };
                
                uniqueFeatures.set(uniqueKey, suggestionItem);
                console.log(`[Подсказка ${index + 1}] Добавлена:`, suggestionItem);
              }
            });
          
          // Убираем дубликаты из массива и ограничиваем до 10 результатов
          suggestions.value = Array.from(uniqueFeatures.values())
            .filter((item: any) => item && item.text && item.text.trim() !== '')
            .slice(0, 10); // Показываем максимум 10 подсказок
          
          console.log('Обработанные подсказки:', suggestions.value.length);
          console.log('Содержимое подсказок:', suggestions.value.map((s: any) => ({ 
            id: s.id, 
            text: s.text, 
            description: s.description,
            hasText: !!s.text,
            textLength: s.text?.length || 0,
            hasHouseNumber: !!s.featureProps?.housenumber,
            osmKey: s.featureProps?.osm_key
          })));
        } else {
          console.log('Нет результатов от Photon API');
          suggestions.value = [];
        }
      } catch (error) {
        console.error('Ошибка получения подсказок через Photon:', error);
        suggestions.value = [];
      } finally {
        suggestionsLoading.value = false;
      }
    }, 300);
  };
  
  // Обработчик ввода в поле поиска
  const onSearchInput = (value: string | Event | null) => {
    let queryString: string = '';
    
    if (typeof value === 'string') {
      queryString = value;
    } else if (value && typeof value === 'object' && 'target' in value) {
      const target = (value as Event).target as HTMLInputElement;
      queryString = target?.value || '';
    } else if (value && typeof value === 'object' && 'text' in value) {
      queryString = (value as any).text || '';
    }
    
    // Проверка на HTML-теги и слишком длинные запросы
    if (queryString && (queryString.includes('<') || queryString.includes('>') || queryString.length > 500)) {
      console.warn('Некорректный запрос (содержит HTML или слишком длинный)');
      suggestions.value = [];
      return;
    }
    
    if (queryString && queryString.trim() && queryString.length >= 3) {
      fetchSuggestions(queryString.trim());
    } else {
      suggestions.value = [];
      searchError.value = null;
    }
  };
  
  watch(searchQuery, (newValue) => {
    // Если это объект, проверяем, что это наш объект с нужными свойствами
    if (typeof newValue === 'object' && newValue !== null) {
      // Если это объект с текстом (из подсказок), это нормально
      if ((newValue as any).text && typeof (newValue as any).text === 'string') {
        // Это объект из подсказок, обрабатывается в onSuggestionSelect
        return;
      } else {
        // Это не наш объект, возможно Vue-компонент или что-то еще
        // Очищаем значение
        console.warn('Обнаружен некорректный объект в searchQuery, очищаем:', newValue);
        searchQuery.value = '';
        return;
      }
    }
    
    if (typeof newValue === 'string') {
      // Проверка на HTML-теги и слишком длинные запросы
      if (newValue.includes('<') || newValue.includes('>') || newValue.length > 500) {
        console.warn('Некорректный запрос (содержит HTML или слишком длинный)');
        suggestions.value = [];
        // Очищаем некорректное значение
        searchQuery.value = '';
        return;
      }
      
      if (newValue.trim() && newValue.length >= 3) {
        fetchSuggestions(newValue.trim());
      } else if (!newValue || newValue === '') {
        suggestions.value = [];
        searchError.value = null;
      }
    } else if (!newValue || newValue === '') {
      suggestions.value = [];
      searchError.value = null;
    }
  }, { immediate: false });
  
  // Обработчик выбора подсказки
  const onSuggestionSelect = async (item: any) => {
    console.log('=== ВЫБОР ПОДСКАЗКИ ===');
    console.log('Выбранный элемент:', item);
    console.log('Тип элемента:', typeof item);
    
    if (!item) {
      // Если item пустой, очищаем поиск
      console.log('Элемент пустой, очищаем поиск');
      searchQuery.value = '';
      return;
    }
    
    // Если это строка (простой ввод текста), выполняем поиск
    if (typeof item === 'string') {
      console.log('Выбрана строка, выполняем поиск:', item);
      searchQuery.value = item;
      await performSearch();
      return;
    }
    
    // Если это объект, значит это выбор из списка подсказок
    if (typeof item === 'object' && item !== null) {
      // Безопасное извлечение данных из объекта
      let selectedText: string = '';
      let selectedCoords: [number, number] | undefined = undefined;
      
      console.log('Структура объекта:', {
        text: item.text,
        value: item.value,
        title: item.title,
        coords: item.coords,
        raw: item.raw
      });
      
      // Проверяем, есть ли вложенный объект raw (из v-autocomplete)
      const actualItem = item.raw || item;
      
      // Извлекаем текст из объекта
      if (actualItem.text && typeof actualItem.text === 'string') {
        selectedText = actualItem.text;
      } else if (actualItem.value && typeof actualItem.value === 'string') {
        selectedText = actualItem.value;
      } else if (actualItem.title && typeof actualItem.title === 'string') {
        selectedText = actualItem.title;
      } else if (item.text && typeof item.text === 'string') {
        selectedText = item.text;
      }
      
      // Извлекаем координаты
      if (actualItem.coords && Array.isArray(actualItem.coords) && actualItem.coords.length === 2) {
        const [lat, lon] = actualItem.coords;
        if (typeof lat === 'number' && typeof lon === 'number') {
          selectedCoords = [lat, lon];
        }
      } else if (item.coords && Array.isArray(item.coords) && item.coords.length === 2) {
        const [lat, lon] = item.coords;
        if (typeof lat === 'number' && typeof lon === 'number') {
          selectedCoords = [lat, lon];
        }
      }
      
      console.log('Извлеченные данные:', { selectedText, selectedCoords });
      
      // Если есть координаты, используем их напрямую
      if (selectedCoords) {
        const [lat, lon] = selectedCoords;
        console.log('Используем координаты напрямую:', [lat, lon]);
        await updateLocation(lat, lon);
        // Устанавливаем текст как строку
        searchQuery.value = selectedText;
        selectedAddress.value = selectedText;
        emit('update:address', selectedText);
        suggestions.value = [];
        searchError.value = null;
      } else if (selectedText) {
        // Если есть только текст, выполняем поиск
        console.log('Используем текст для поиска:', selectedText);
        searchQuery.value = selectedText;
        await performSearch();
      } else {
        // Если ничего не найдено, очищаем
        console.warn('Не удалось извлечь данные из выбранного элемента:', item);
        searchQuery.value = '';
      }
    }
  };
  
  watch(
    () => [props.latitude, props.longitude],
    async ([newLat, newLon], [oldLat, oldLon]) => {
      if (map && newLat !== null && newLat !== '' && newLon !== null && newLon !== '') {
        const lat = parseFloat(String(newLat));
        const lon = parseFloat(String(newLon));
        
        if (isNaN(lat) || isNaN(lon)) return;
        
        const oldLatNum = oldLat !== null && oldLat !== '' ? parseFloat(String(oldLat)) : null;
        const oldLonNum = oldLon !== null && oldLon !== '' ? parseFloat(String(oldLon)) : null;
  
        if (lat !== oldLatNum || lon !== oldLonNum) {
          await updateLocation(lat, lon, false);
          await reverseGeocode(lat, lon);
        }
      }
    },
    { immediate: false }
  );
  
  const retryLoadMap = async () => {
    mapError.value = null;
    mapLoaded.value = false;
    await loadLeaflet();
    await nextTick();
    await initMap();
  };
  
  onMounted(async () => {
    try {
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Компонент смонтирован, mapContainer:', mapContainer.value);
      
      await loadLeaflet();
      await nextTick();
      await initMap();
    } catch (error: any) {
      console.error('Ошибка при монтировании компонента:', error);
      mapError.value = error?.message || 'Не удалось загрузить карту. Проверьте подключение к интернету.';
      mapLoaded.value = false;
    }
  });
  
  onUnmounted(() => {
    if (map) {
      map.remove();
    }
  });
  </script>
  
  <style scoped>
  .yandex-map-picker {
    width: 100%;
  }
  
  .map-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: v-bind(height);
    background: #f5f5f5;
    border-radius: 8px;
  }
  
  .map-error {
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
    text-align: center;
  }
  
  .map-wrapper {
    position: relative;
    width: 100%;
    height: v-bind(height);
  }
  
  .map-container {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.12);
    position: relative;
  }
  
  .map-search-overlay {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    z-index: 1000;
    pointer-events: none;
  }
  
  .map-search-overlay .search-field {
    pointer-events: all;
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  .map-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
  }
  
  .map-search-container {
    width: 100%;
  }
  
  .selected-address {
    min-height: 32px;
  }
  
  .search-error {
    min-height: 40px;
  }
  </style>