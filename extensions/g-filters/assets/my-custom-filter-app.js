document.addEventListener("DOMContentLoaded", function () {
  console.log("🔹 Custom Filter App Loaded");

  // 🔍 Obținem ID-ul colecției și shop-ul din atributele HTML generate de Liquid
  const filterAppElement = document.getElementById("custom-filter-app");
  const collectionId = filterAppElement?.getAttribute("data-collection-id") || null;
  const shop = window.Shopify?.shop || window.location.hostname;



  async function fetchProducts(vendor = "", minPrice = "", maxPrice = "", selectedTags = [], metafields = []) {
    let apiUrl = `/apps/filtered-products/api/filtered-products`;

    const queryParams = new URLSearchParams();
    if (collectionId) queryParams.append("collection", collectionId);
    if (shop) queryParams.append("shop", shop);
    if (vendor) queryParams.append("vendor", vendor);
    if (minPrice) queryParams.append("minPrice", minPrice);
    if (maxPrice) queryParams.append("maxPrice", maxPrice);
    selectedTags.forEach(tag => queryParams.append("tags", tag));
    
    // Adăugăm logging pentru debug
    console.log("🔍 Metafields to be sent:", metafields);
    
    // Trimitem fiecare metafield ca parametru separat
    metafields.forEach(metafield => {
      queryParams.append("metafields", JSON.stringify(metafield));
    });

    if (queryParams.toString()) {
      apiUrl += `?${queryParams.toString()}`;
    }

    console.log("🔍 URL-ul final pentru API:", apiUrl);

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      

      if (data.success) {
        renderProducts(data.products);
        if (!vendor && !minPrice && !maxPrice && selectedTags.length === 0 && metafields.length === 0) {
          // Doar pentru încărcarea inițială, procesăm metafieldurile
          processMetafields(data.products);
        }
      } else {
        console.error("❌ Eroare la obținerea produselor:", data.error);
      }
    } catch (error) {
      console.error("❌ Eroare de rețea:", error);
    }
  }

  function processMetafields(products) {
    console.log("🔍 Processing metafields from API response");
    const metafieldsMap = new Map();

    products.forEach(product => {
      console.log("🔍 Processing product:", product.title);
      console.log("🔍 Product metafields:", product.customMetafields);
      
      if (Array.isArray(product.customMetafields)) {
        product.customMetafields.forEach(metafield => {
          if (metafield && typeof metafield === 'object' && metafield.key) {
            if (!metafieldsMap.has(metafield.key)) {
              metafieldsMap.set(metafield.key, new Set());
            }
            if (metafield.value) {
              metafieldsMap.get(metafield.key).add(metafield.value);
            }
          }
        });
      }
    });

    console.log("🔍 Unique metafields available in database:", metafieldsMap);
    createMetafieldFilters(metafieldsMap);
  }

  async function getVisibleMetafields() {
    try {
      const response = await fetch(`/apps/filtered-products/api/visible-metafields?shop=${encodeURIComponent(shop)}`);
      const data = await response.json();
      return data.visibleMetafields || [];
    } catch (error) {
      console.error("❌ Eroare la obținerea metafieldurilor vizibile:", error);
      return [];
    }
  }

  async function createMetafieldFilters(metafieldsMap) {
    const metafieldsContainer = document.getElementById("metafields-container");
    if (!metafieldsContainer) return;

    try {
      // Obținem configurația completă pentru filtre
      const response = await fetch(`/apps/filtered-products/api/filter-config?shop=${encodeURIComponent(shop)}`);
      const config = await response.json();
      
      console.log("%c🔍 Configurație completă primită:", "background: #f0f0f0; color: #2196F3; font-size: 12px; padding: 5px;", config);

      const visibleMetafields = config.visibleMetafields || [];
      const includeInCollections = config.includeInCollections || [];
      const excludeFromCollections = config.excludeFromCollections || [];
      const filterSettings = config.filterSettings || {};

      metafieldsContainer.innerHTML = '';

      // Creăm un array de filtre pentru a le putea sorta
      const filtersToRender = Array.from(metafieldsMap.entries())
        .map(([key, values]) => ({
          key,
          values,
          settings: filterSettings[key] || {}
        }))
        .filter(filter => filter.settings.isEnabled)
        .sort((a, b) => {
          console.log(`Sorting filters: ${a.key}(${a.settings.position || 0}) vs ${b.key}(${b.settings.position || 0})`);
          return (a.settings.position || 0) - (b.settings.position || 0);
        });

      console.log('Sorted filters:', filtersToRender.map(f => `${f.key}(${f.settings.position})`));

      // Golim containerul înainte de a adăuga filtrele sortate
      metafieldsContainer.innerHTML = '';

      // Iterăm prin filtrele sortate
      filtersToRender.forEach(({key, values, settings}) => {
        const displayName = settings.filterLabel || key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Verificăm dacă filtrul ar trebui afișat
        if (!settings.isEnabled) {
          console.log(`%c🚫 Filtrul ${key} este dezactivat`, "background: #f0f0f0; color: #F44336; font-size: 12px; padding: 5px;");
          return;
        }

        console.log(`%c✨ Creez filtru pentru ${key}`, "background: #f0f0f0; color: #2196F3; font-size: 12px; padding: 5px;", {
          displayName,
          displayType: settings.displayType,
          values: Array.from(values)
        });
        
        // Debug pentru tipul de afișare
        console.log(`%c🎯 Decizie tip afișare pentru ${key}:`, "background: #f0f0f0; color: #FF9800; font-size: 12px; padding: 5px;", {
          displayType: settings.displayType,
          isCheckbox: settings.displayType === 'checkbox',
          settingsObject: settings
        });
        
        // Creăm elementul container pentru filtru
          const filterSection = document.createElement("div");
          filterSection.className = "metafield-filter";

        if (settings.displayType === 'checkbox') {
          console.log(`%c📋 Creez interfață checkbox pentru ${key}`, "background: #f0f0f0; color: #4CAF50; font-size: 12px; padding: 5px;");
          
          // Verificăm setările pentru displayMode și searchbox
          console.log('Display mode pentru', key, ':', settings.displayMode);
          console.log('Searchbox activat pentru', key, ':', settings.hasSearchbox);
          
          const sortedValues = Array.from(values).sort();
          const initialVisibleCount = 5; // Numărul inițial de opțiuni vizibile
          
          let html = `<div class="filter-label">${displayName}:</div>`;
          
          // Adăugăm searchbox-ul dacă este activat
          if (settings.hasSearchbox) {
            html += `
              <div class="filter-searchbox-container">
                <input type="text" 
                       class="filter-searchbox" 
                       placeholder="Caută în filtru..." 
                       data-key="${key}"
                       aria-label="Caută în filtru">
              </div>
            `;
          }

          html += `
            <div class="checkbox-group" data-key="${key}">
              ${sortedValues
                .map((value, index) => `
                  <label class="checkbox-label ${index >= initialVisibleCount && settings.displayMode === 'show_more' ? 'hidden' : ''}" data-index="${index}">
                    <input type="checkbox" value="${value}" data-key="${key}">
                    <span>${getTransformedText(value, settings.textTransform)}</span>
                  </label>
                `).join("")}
            </div>
          `;

          // Adăugăm butonul "Show More" dacă este necesar
          if (settings.displayMode === 'show_more' && sortedValues.length > initialVisibleCount) {
            html += `
              <button class="show-more-button" data-key="${key}">
                <span class="show-more-text">Arată mai mult</span>
                <span class="show-less-text" style="display: none;">Arată mai puțin</span>
              </button>
            `;
          }

          filterSection.innerHTML = html;

          // Adăugăm funcționalitatea pentru searchbox dacă există
          if (settings.hasSearchbox) {
            const searchbox = filterSection.querySelector('.filter-searchbox');
            const labels = filterSection.querySelectorAll('.checkbox-label');
            
            // Funcție de filtrare în timp real
            searchbox.addEventListener('input', function() {
              const searchValue = searchbox.value.toLowerCase();
              
              labels.forEach(label => {
                const text = label.querySelector('span').textContent.toLowerCase();
                if (text.includes(searchValue)) {
                  label.classList.remove('hidden');
                } else {
                  label.classList.add('hidden');
                }
              });

              // Actualizăm vizibilitatea butonului Show More
              const showMoreButton = filterSection.querySelector('.show-more-button');
              if (showMoreButton) {
                showMoreButton.style.display = searchValue ? 'none' : '';
              }
            });
          }

          // Adăugăm funcționalitatea pentru butonul Show More
          if (settings.displayMode === 'show_more') {
            const showMoreButton = filterSection.querySelector('.show-more-button');
            const showMoreText = showMoreButton?.querySelector('.show-more-text');
            const showLessText = showMoreButton?.querySelector('.show-less-text');
            const labels = filterSection.querySelectorAll('.checkbox-label');
            let isExpanded = false;

            showMoreButton?.addEventListener('click', () => {
              isExpanded = !isExpanded;
              
              labels.forEach(label => {
                const index = parseInt(label.dataset.index);
                if (index >= initialVisibleCount) {
                  label.classList.toggle('hidden', !isExpanded);
                }
              });

              if (showMoreText && showLessText) {
                showMoreText.style.display = isExpanded ? 'none' : '';
                showLessText.style.display = isExpanded ? '' : 'none';
              }
            });
          }

          const checkboxes = filterSection.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
              const selectedValues = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => ({
                  key: cb.dataset.key,
                  value: cb.value,
                  type: "single_line_text_field"
                }));
              
              fetchProducts(
                document.getElementById('vendor-filter')?.value || '',
                document.getElementById('min-price')?.value || '',
                document.getElementById('max-price')?.value || '',
                Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(tag => tag.value),
                selectedValues
              );
            });
          });
        } else if (settings.displayType === 'range') {
          console.log(`%c📊 Creez interfață range pentru ${key}`, "background: #f0f0f0; color: #4CAF50; font-size: 12px; padding: 5px;");
          
          // Convertim valorile în numere și le filtrăm
          const numericValues = Array.from(values)
            .map(value => value.replace(/[^\d.-]/g, '')) // Eliminăm orice caracter non-numeric (except punct și minus)
            .map(Number)
            .filter(v => !isNaN(v));

          console.log(`%c📊 Valori numerice pentru ${key}:`, "background: #f0f0f0; color: #4CAF50; font-size: 12px; padding: 5px;", numericValues);

          // Verificăm dacă avem valori valide
          if (numericValues.length === 0) {
            console.error(`❌ Nu s-au găsit valori numerice valide pentru ${key}`);
            return;
          }

          const min = Math.min(...numericValues);
          const max = Math.max(...numericValues);
          
          console.log(`%c📊 Range pentru ${key}: min=${min}, max=${max}`, "background: #f0f0f0; color: #4CAF50; font-size: 12px; padding: 5px;");
          
          filterSection.innerHTML = `
            <div class="filter-label">${displayName}:</div>
            <div class="range-group" data-key="${key}">
              <div class="range-inputs">
                <input type="number" class="range-min" value="${min}" min="${min}" max="${max}" step="1" data-key="${key}">
                <span>-</span>
                <input type="number" class="range-max" value="${max}" min="${min}" max="${max}" step="1" data-key="${key}">
              </div>
              <div class="range-sliders">
                <input type="range" class="range-slider min-slider" min="${min}" max="${max}" value="${min}" step="1" data-key="${key}">
                <input type="range" class="range-slider max-slider" min="${min}" max="${max}" value="${max}" step="1" data-key="${key}">
              </div>
            </div>
          `;

          const minInput = filterSection.querySelector('.range-min');
          const maxInput = filterSection.querySelector('.range-max');
          const minSlider = filterSection.querySelector('.min-slider');
          const maxSlider = filterSection.querySelector('.max-slider');

          // Funcție pentru actualizarea UI fără a face query
          const updateUI = () => {
            const minVal = Number(minInput.value);
            const maxVal = Number(maxInput.value);
            
            if (minVal > maxVal) {
              // Ajustăm valorile pentru a menține min <= max
              if (minVal > max) minInput.value = max;
              if (maxVal < min) maxInput.value = min;
              return;
            }

            minSlider.value = minVal;
            maxSlider.value = maxVal;
          };

          // Event listeners pentru inputuri numerice
          minInput.addEventListener('change', updateUI);
          maxInput.addEventListener('change', updateUI);

          // Event listeners pentru slidere
          minSlider.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            const maxVal = Number(maxInput.value);
            if (value <= maxVal) {
              minInput.value = value;
            } else {
              e.target.value = maxVal;
              minInput.value = maxVal;
            }
          });

          maxSlider.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            const minVal = Number(minInput.value);
            if (value >= minVal) {
              maxInput.value = value;
            } else {
              e.target.value = minVal;
              maxInput.value = minVal;
            }
          });

          // Adăugăm funcția de actualizare la lista de filtre active
          filterSection.setAttribute('data-filter-type', 'range');
        } else if (settings.displayType === 'color') {
          console.log(`%c🎨 Creez interfață color pentru ${key}`, "background: #f0f0f0; color: #4CAF50; font-size: 12px; padding: 5px;");
          
          // Funcție pentru procesarea valorilor de culoare
          function processColorValue(value) {
            // Eliminăm caracterele nedorite și spațiile extra
            return value.replace(/[\[\]"]/g, '').split(',').map(c => c.trim());
          }

          // Obținem valorile unice de culori
          const uniqueColors = Array.from(values).sort();
          
          filterSection.innerHTML = `
            <div class="filter-label">${displayName}:</div>
            <div class="color-group" data-key="${key}">
              ${uniqueColors
                .map(value => {
                  const colors = processColorValue(value);
                  const isMultiColor = colors.length > 1;
                  const colorClass = colors.length === 2 ? 'dual-color-button' : 
                                   colors.length === 3 ? 'triple-color-button' : 
                                   'color-swatch';
                  
                  return `
                    <label class="color-label" title="${colors.join(', ')}">
                      <input type="checkbox" value='${value}' data-key="${key}">
                      ${isMultiColor ? 
                        `<span class="${colorClass}" style="${
                          colors.length === 1 ? `background-color: ${colors[0]}` :
                          colors.length === 2 ? `background: linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` :
                          `background: linear-gradient(135deg, ${colors[0]} 33%, ${colors[1]} 33% 66%, ${colors[2]} 66%)`
                        }"></span>` :
                        `<span class="color-swatch" style="background-color: ${value};"></span>`
                      }
                    </label>
                  `;
                }).join("")}
            </div>
          `;

          // Adăugăm stiluri pentru color swatches
          const style = document.createElement('style');
          style.textContent = `
            .color-group {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              padding: 10px;
              background: #fff;
              border-radius: 8px;
              border: 1px solid #e5e5e5;
            }

            .color-label {
              position: relative;
              cursor: pointer;
            }

            .color-label input[type="checkbox"] {
              position: absolute;
              opacity: 0;
              cursor: pointer;
            }

            .color-swatch,
            .dual-color-button,
            .triple-color-button {
              display: block;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 2px solid #fff;
              box-shadow: 0 0 0 1px #e5e5e5;
              transition: all 0.2s ease;
              overflow: hidden;
            }

            .color-label input:checked + .color-swatch,
            .color-label input:checked + .dual-color-button,
            .color-label input:checked + .triple-color-button {
              box-shadow: 0 0 0 2px #000;
              transform: scale(1.1);
            }

            .color-label:hover .color-swatch,
            .color-label:hover .dual-color-button,
            .color-label:hover .triple-color-button {
              transform: scale(1.1);
            }
          `;
          document.head.appendChild(style);

          const checkboxes = filterSection.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
              const selectedValues = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => ({
                  key: cb.dataset.key,
                  value: cb.value,
                  type: "list.color",
                  query_type: "array_contains"
                }));
              
              fetchProducts(
                document.getElementById('vendor-filter')?.value || '',
                document.getElementById('min-price')?.value || '',
                document.getElementById('max-price')?.value || '',
                Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(tag => tag.value),
                selectedValues
              );
            });
          });
        } else if (settings.displayType === 'radio') {
          console.log(`%c📻 Creez interfață radio pentru ${key}`, "background: #f0f0f0; color: #4CAF50; font-size: 12px; padding: 5px;");
          
          // Verificăm setările pentru displayMode și searchbox
          console.log('Display mode pentru', key, ':', settings.displayMode);
          console.log('Searchbox activat pentru', key, ':', settings.hasSearchbox);
          
          const sortedValues = Array.from(values).sort();
          const initialVisibleCount = 5;

          let html = `<div class="filter-label">${displayName}:</div>`;
          
          // Adăugăm searchbox-ul dacă este activat
          if (settings.hasSearchbox) {
            html += `
              <div class="filter-searchbox-container">
                <input type="text" 
                       class="filter-searchbox" 
                       placeholder="Caută în filtru..." 
                       data-key="${key}"
                       aria-label="Caută în filtru">
              </div>
            `;
          }

          html += `
            <div class="radio-group" data-key="${key}">
              <label class="radio-label">
                <input type="radio" name="${key}-radio" value="" data-key="${key}" checked>
                <span>Toate valorile</span>
              </label>
              ${sortedValues
                .map((value, index) => `
                  <label class="radio-label ${index >= initialVisibleCount && settings.displayMode === 'show_more' ? 'hidden' : ''}" data-index="${index}">
                    <input type="radio" name="${key}-radio" value="${value}" data-key="${key}">
                    <span>${getTransformedText(value, settings.textTransform)}</span>
                  </label>
                `).join("")}
            </div>
          `;

          // Adăugăm butonul "Show More" dacă este necesar
          if (settings.displayMode === 'show_more' && sortedValues.length > initialVisibleCount) {
            html += `
              <button class="show-more-button" data-key="${key}">
                <span class="show-more-text">Arată mai mult</span>
                <span class="show-less-text" style="display: none;">Arată mai puțin</span>
              </button>
            `;
          }

          filterSection.innerHTML = html;

          // Adăugăm funcționalitatea pentru searchbox dacă există
          if (settings.hasSearchbox) {
            const searchbox = filterSection.querySelector('.filter-searchbox');
            const labels = filterSection.querySelectorAll('.radio-label:not(:first-child)');
            
            // Funcție de filtrare în timp real
            searchbox.addEventListener('input', function() {
              const searchValue = searchbox.value.toLowerCase();
              
              labels.forEach(label => {
                const text = label.querySelector('span').textContent.toLowerCase();
                if (text.includes(searchValue)) {
                  label.classList.remove('hidden');
                } else {
                  label.classList.add('hidden');
                }
              });

              // Actualizăm vizibilitatea butonului Show More
              const showMoreButton = filterSection.querySelector('.show-more-button');
              if (showMoreButton) {
                showMoreButton.style.display = searchValue ? 'none' : '';
              }
            });
          }

          // Adăugăm funcționalitatea pentru butonul Show More
          if (settings.displayMode === 'show_more') {
            const showMoreButton = filterSection.querySelector('.show-more-button');
            const showMoreText = showMoreButton?.querySelector('.show-more-text');
            const showLessText = showMoreButton?.querySelector('.show-less-text');
            const labels = filterSection.querySelectorAll('.radio-label:not(:first-child)');
            let isExpanded = false;

            showMoreButton?.addEventListener('click', () => {
              isExpanded = !isExpanded;
              
              labels.forEach(label => {
                const index = parseInt(label.dataset.index);
                if (index >= initialVisibleCount) {
                  label.classList.toggle('hidden', !isExpanded);
                }
              });

              if (showMoreText && showLessText) {
                showMoreText.style.display = isExpanded ? 'none' : '';
                showLessText.style.display = isExpanded ? '' : 'none';
              }
            });
          }

          const radioButtons = filterSection.querySelectorAll('input[type="radio"]');
          radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
              const selectedValues = [];
              if (radio.checked && radio.value) {
                selectedValues.push({
                  key: radio.dataset.key,
                  value: radio.value,
                  type: "single_line_text_field"
                });
              }
              
              fetchProducts(
                document.getElementById('vendor-filter')?.value || '',
                document.getElementById('min-price')?.value || '',
                document.getElementById('max-price')?.value || '',
                Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(tag => tag.value),
                selectedValues
              );
            });
          });
        } else if (settings.displayType === 'dropdown') {
          console.log(`%c📋 Creez interfață dropdown pentru ${key}`, "background: #f0f0f0; color: #4CAF50; font-size: 12px; padding: 5px;");

          filterSection.innerHTML = `
            <div class="filter-label">${displayName}:</div>
            <div class="dropdown-group" data-key="${key}">
              <select class="dropdown-select" data-key="${key}">
                <option value="">Toate</option>
                ${Array.from(values)
                  .sort()
                  .map(value => `
                    <option value="${value}">${getTransformedText(value, settings.textTransform)}</option>
                  `).join("")}
              </select>
            </div>
          `;

          const dropdown = filterSection.querySelector('select');
          dropdown.addEventListener('change', () => {
            const selectedValue = dropdown.value;
            const metafieldFilter = selectedValue ? [{
              key: dropdown.dataset.key,
              value: selectedValue,
              type: "single_line_text_field"
            }] : [];
            
            fetchProducts(
              document.getElementById('vendor-filter')?.value || '',
              document.getElementById('min-price')?.value || '',
              document.getElementById('max-price')?.value || '',
              Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(tag => tag.value),
              metafieldFilter
            );
          });

          // Adăugăm stiluri pentru dropdown
          const style = document.createElement('style');
          style.textContent = `
            .dropdown-group {
              margin: 10px 0;
            }
            
            .dropdown-select {
              width: 100%;
              padding: 8px;
              border: 1px solid #e5e5e5;
              border-radius: 4px;
              background-color: white;
              cursor: pointer;
            }
            
            .dropdown-select:hover {
              border-color: #999;
            }
            
            .dropdown-select:focus {
              outline: none;
              border-color: #000;
              box-shadow: 0 0 0 1px #000;
            }
          `;
          document.head.appendChild(style);
        } else {
          console.log(`%c⚠️ Tip de afișare necunoscut pentru ${key}, folosim dropdown implicit`, "background: #f0f0f0; color: #FF9800; font-size: 12px; padding: 5px;");
          
          // Redirecționăm către logica de dropdown
          settings.displayType = 'dropdown';
          createMetafieldFilters(new Map([[key, values]]));
        }

        metafieldsContainer.appendChild(filterSection);
      });
    } catch (error) {
      console.error("❌ Eroare la obținerea configurației filtrelor:", error);
    }
  }

  function renderProducts(products) {
    const productsContainer = document.getElementById("custom-product-grid");
    if (!productsContainer) {
      console.error("❌ Containerul pentru produse nu există!");
      return;
    }

    if (products.length === 0) {
      productsContainer.innerHTML = "<p>❌ Nu s-au găsit produse.</p>";
    } else {
      productsContainer.innerHTML = products
        .map(
          (product) => `
          <div class="product-card">
            <h3>${product.title}</h3>
            <p>Vendor: ${product.vendor}</p>
            <p>Preț: ${product.price || "N/A"} RON</p>
          </div>
        `
        )
        .join("");
    }
  }

  // Inițializare UI pentru filtrare
  const filterContainer = document.getElementById("custom-filter-ui");
  if (filterContainer) {
    filterContainer.innerHTML = `
      <h2>Filtrează Produsele</h2>
      <div class="filter-section">
        <h3>Vendor</h3>
        <label>
          <input type="text" id="vendor-filter" placeholder="Ex: YATO" />
        </label>
      </div>
      <div class="filter-section">
        <h3>Preț</h3>
        <div class="price-range">
          <input type="number" id="min-price" placeholder="Min" />
          <span>-</span>
          <input type="number" id="max-price" placeholder="Max" />
        </div>
      </div>
      <div class="filter-section">
        <h3>Tag-uri</h3>
        <div class="tags-container">
          <label><input type="checkbox" name="tags" value="nou"> Nou</label>
          <label><input type="checkbox" name="tags" value="promo"> Promo</label>
          <label><input type="checkbox" name="tags" value="popular"> Popular</label>
        </div>
      </div>
      <div class="filter-section">
        <h3>Specificații Produs</h3>
        <div id="metafields-container">
          <!-- Aici vor fi adăugate dinamic filtrele de metafielduri -->
        </div>
      </div>
      <button id="apply-filter">Aplică filtre</button>
    `;

    // Event listener pentru butonul de aplicare filtre
    document.getElementById("apply-filter").addEventListener("click", async (event) => {
      event.preventDefault();

      const vendorInput = document.getElementById("vendor-filter").value.trim();
      const minPriceInput = document.getElementById("min-price").value.trim();
      const maxPriceInput = document.getElementById("max-price").value.trim();
      const selectedTags = [...document.querySelectorAll('input[name="tags"]:checked')].map(tag => tag.value);
      
      // Colectăm toate valorile selectate
      const selectedMetafields = [];
      
      // Colectăm valorile din dropdown-uri
      document.querySelectorAll('.dropdown-select').forEach(select => {
        if (select.value && select.value.trim() !== "") {
          selectedMetafields.push({
            key: select.dataset.key,
            value: select.value.trim(),
            type: "single_line_text_field"
          });
        }
      });
      
      // Colectăm valorile din checkbox-uri
      document.querySelectorAll('.checkbox-group').forEach(group => {
        const key = group.dataset.key;
        const checkedBoxes = group.querySelectorAll('input[type="checkbox"]:checked');
        
        checkedBoxes.forEach(checkbox => {
          selectedMetafields.push({
            key: key,
            value: checkbox.value,
            type: "single_line_text_field"
          });
        });
      });

      // Colectăm valorile din range filters
      document.querySelectorAll('.range-group').forEach(group => {
        const key = group.dataset.key;
        const minInput = group.querySelector('.range-min');
        const maxInput = group.querySelector('.range-max');
        
        if (minInput && maxInput) {
          const minVal = Number(minInput.value);
          const maxVal = Number(maxInput.value);
          
          if (!isNaN(minVal) && !isNaN(maxVal) && minVal <= maxVal) {
            selectedMetafields.push({
              key: key,
              type: "range",
              value: `${minVal}-${maxVal}`,
              range: {
                min: minVal,
                max: maxVal
              },
              query_type: "array_contains_range"
            });
          }
        }
      });
      
      console.log("🔍 Metafields selectate pentru filtrare:", selectedMetafields);

      fetchProducts(vendorInput, minPriceInput, maxPriceInput, selectedTags, selectedMetafields);
    });
  }

  // La încărcare, afișează automat produsele din colecția curentă
  fetchProducts();

  // Adăugăm stilurile pentru selectorul de culori
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    .color-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e5e5e5;
    }

    .color-label {
      position: relative;
      cursor: pointer;
    }

    .color-label input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      cursor: pointer;
    }

    .color-swatch {
      display: block;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px #e5e5e5;
      transition: all 0.2s ease;
    }

    .color-label input[type="checkbox"]:checked + .color-swatch {
      box-shadow: 0 0 0 2px #000;
      transform: scale(1.1);
    }

    .color-label:hover .color-swatch {
      transform: scale(1.1);
    }
  `;
  document.head.appendChild(styleSheet);

  // Adăugăm stilurile pentru searchbox
  const searchboxStyles = document.createElement('style');
  searchboxStyles.textContent = `
    .filter-searchbox-container {
      margin-bottom: 10px;
    }

    .filter-searchbox {
      width: 100%;
      padding: 8px;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      font-size: 14px;
    }

    .filter-searchbox:focus {
      outline: none;
      border-color: #000;
      box-shadow: 0 0 0 1px #000;
    }

    .search-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(searchboxStyles);

  // Adăugăm stilurile CSS pentru elementele ascunse
  const hideStyle = document.createElement('style');
  hideStyle.textContent = `
    .hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(hideStyle);
});

function getTransformedText(text, transform) {
  switch (transform) {
    case 'capitalize':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    default:
      return text;
  }
}

// Funcție pentru a aplica stilurile de scrollbar
function applyScrollbarStyles(element, settings) {
  console.log('Applying scrollbar styles to element:', element);
  if (settings && settings.displayMode === 'scrollbar') {
    element.classList.add('scrollable');
    element.style.maxHeight = '320px';
    element.style.overflowY = 'auto';
    element.style.overflowX = 'hidden';
    element.style.border = '1px solid #ddd';
    element.style.borderRadius = '4px';
    element.style.backgroundColor = 'white';
    element.style.padding = '8px';
    console.log('Scrollbar styles applied');
  }
}

console.log ( "testTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT" ) 
// Funcție pentru a găsi și actualiza filtrele existente
function initializeFilters() {
  console.log('Initializing filters...');
  
  // Funcție pentru a procesa un filtru
  function processFilter(filterElement) {
    console.log('Processing filter:', filterElement);
    
    // Găsim cheia filtrului
    const radioGroup = filterElement.querySelector('.radio-group');
    if (!radioGroup) {
      console.log('No radio group found');
      return;
    }
    
    const key = radioGroup.getAttribute('data-key');
    console.log('Filter key:', key);
    
    // Verificăm dacă avem setări pentru acest filtru
    const settings = {
      displayMode: 'scrollbar',  // Forțăm scrollbar pentru test
      displayType: 'radio'
    };
    
    // Aplicăm stilurile
    applyScrollbarStyles(radioGroup, settings);
  }
  
  // Găsim toate filtrele și le procesăm
  const filters = document.querySelectorAll('.metafield-filter');
  console.log('Found filters:', filters.length);
  filters.forEach(processFilter);
}

// Funcție pentru a verifica periodic dacă filtrele există
function checkAndInitializeFilters() {
  console.log('Checking for filters...');
  const filters = document.querySelectorAll('.metafield-filter');
  if (filters.length > 0) {
    console.log('Filters found, initializing...');
    initializeFilters();
  } else {
    console.log('No filters found, will check again...');
    setTimeout(checkAndInitializeFilters, 500);
  }
}

// Inițializăm când DOM-ul este încărcat
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded');
  checkAndInitializeFilters();
});

// Inițializăm și când fereastra este încărcată complet
window.addEventListener('load', function() {
  console.log('Window loaded');
  checkAndInitializeFilters();
});

// Exportăm funcțiile pentru a putea fi folosite manual dacă e nevoie
window.CustomFilter = {
  initializeFilters,
  applyScrollbarStyles
};
