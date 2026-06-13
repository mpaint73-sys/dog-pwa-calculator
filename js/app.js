const COMPONENTS = [
  { id: 'meat', name: 'Мясо / мясная обрезь', desc: 'Мякоть кусковая, птица, диафрагма, обрезь', color: '#e57373', icon: '🥩', defaultPct: 40 },
  { id: 'muscle', name: 'Мышечные органы', desc: 'Сердце, желудки, лёгкое, рубец', color: '#f06292', icon: '🫀', defaultPct: 30 },
  { id: 'bone', name: 'Мясокостное', desc: 'Шеи, головы, каркасы птицы, хвосты', color: '#ba68c8', icon: '🦴', defaultPct: 20 },
  { id: 'secreting', name: 'Кроветворные органы', desc: 'Печень, почки, селезёнка', color: '#9575cd', icon: '🫁', defaultPct: 10 },
];

const PRESETS = {
  classic: [40, 30, 20, 10],
  moreOrgans: [30, 40, 15, 15],
  moreMeat: [50, 20, 20, 10],
  custom: null,
};

const AGE_RANGES = {
  '1-3': { min: 5, max: 8, defaultPct: 6.5, defaultMeals: 5 },
  '3-6': { min: 4, max: 6, defaultPct: 5, defaultMeals: 3 },
  '6-12': { min: 3, max: 5, defaultPct: 4, defaultMeals: 2 },
  '12-18': { min: 2, max: 3, defaultPct: 2.5, defaultMeals: 2 },
  '18+': { min: 2, max: 3, defaultPct: 3, defaultMeals: 2 },
};

let appData = loadData();
let activeTab = appData.activeDogId ? 'dog' : 'quick';
let activeDogId = appData.activeDogId;
let saveTimer = null;
let costRowsRendered = false;

let state = {
  params: { weight: 10, ageGroup: '18+', meals: 2, pctBody: 3 },
  components: COMPONENTS.map(c => c.defaultPct),
  preset: 'classic',
  costPrices: {},
  daysCount: 30,
};

function defaultState() {
  return {
    params: { weight: 10, ageGroup: '18+', meals: 2, pctBody: 3 },
    components: [...PRESETS.classic],
    preset: 'classic',
    costPrices: {},
    daysCount: 30,
  };
}

function readFormToState() {
  state.params = {
    weight: parseFloat(document.getElementById('weight').value) || 0,
    ageGroup: document.getElementById('ageGroup').value,
    meals: parseInt(document.getElementById('meals').value, 10) || 1,
    pctBody: parseFloat(document.getElementById('pctBody').value) || 0,
  };
  state.daysCount = parseInt(document.getElementById('daysCount').value, 10) || 30;
  COMPONENTS.forEach(c => {
    const input = document.querySelector(`.price-input[data-id="${c.id}"]`);
    if (input) state.costPrices[c.id] = parseFloat(input.value) || 0;
  });
}

function applyStateToForm() {
  document.getElementById('weight').value = state.params.weight;
  document.getElementById('ageGroup').value = state.params.ageGroup;
  document.getElementById('meals').value = state.params.meals;
  document.getElementById('pctBody').value = state.params.pctBody;
  document.getElementById('daysCount').value = state.daysCount;

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === state.preset);
  });

  renderComponents();
  costRowsRendered = false;
  renderCostRows();
  renderPurchaseSection();
  updateDogActions();
}

function init() {
  if (activeDogId) {
    const dog = getDog(appData, activeDogId);
    if (dog) {
      state = applyDogToState(dog);
      activeTab = 'dog';
    } else {
      activeDogId = null;
      activeTab = 'quick';
    }
  }

  renderTabs();
  applyStateToForm();
  bindEvents();
  calculate();
  setupOfflineBanner();
  setupServiceWorkerUpdate();
  applyCollapsedState();
}

function bindEvents() {
  document.getElementById('weight').addEventListener('input', onFormChange);
  document.getElementById('ageGroup').addEventListener('change', onAgeChange);
  document.getElementById('meals').addEventListener('change', onFormChange);
  document.getElementById('pctBody').addEventListener('input', onFormChange);
  document.getElementById('daysCount').addEventListener('input', onFormChange);

  document.getElementById('btn-save-dog').addEventListener('click', openSaveDogModal);
  document.getElementById('btn-save-changes').addEventListener('click', saveCurrentDog);
  document.getElementById('btn-add-purchase').addEventListener('click', addPurchaseFromForm);

  document.getElementById('save-dog-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.dataset.close !== undefined) closeModal('save-dog-modal');
  });
  document.getElementById('rename-dog-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.dataset.close !== undefined) closeModal('rename-dog-modal');
  });
  document.getElementById('confirm-save-dog').addEventListener('click', confirmSaveDog);
  document.getElementById('confirm-rename-dog').addEventListener('click', confirmRenameDog);
  document.getElementById('btn-rename-dog').addEventListener('click', openRenameModal);
  document.getElementById('btn-delete-dog').addEventListener('click', deleteCurrentDog);
}

function onFormChange() {
  readFormToState();
  calculate();
  scheduleAutoSave();
}

function onAgeChange() {
  const age = document.getElementById('ageGroup').value;
  const r = AGE_RANGES[age];
  document.getElementById('pctBody').value = r.defaultPct;
  document.getElementById('meals').value = r.defaultMeals;
  onFormChange();
}

function scheduleAutoSave() {
  if (activeTab !== 'dog' || !activeDogId) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentDog, 500);
}

function saveCurrentDog() {
  if (!activeDogId) return;
  readFormToState();
  updateDog(appData, activeDogId, dogSnapshotFromUI(state));
  showToast('Сохранено');
}

function renderTabs() {
  const bar = document.getElementById('dog-tabs');
  let html = `<button class="tab-btn ${activeTab === 'quick' ? 'active' : ''}" data-tab="quick">⚡ Быстрый</button>`;

  appData.dogs.forEach(dog => {
    const active = activeTab === 'dog' && activeDogId === dog.id;
    html += `<button class="tab-btn ${active ? 'active' : ''}" data-tab="dog" data-dog-id="${dog.id}">🐕 ${escapeHtml(dog.name)}</button>`;
  });

  html += `<button class="tab-btn tab-add" data-action="add-dog" title="Добавить собаку">+</button>`;
  bar.innerHTML = html;

  bar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'add-dog') {
        openSaveDogModal();
        return;
      }
      switchTab(btn.dataset.tab, btn.dataset.dogId || null);
    });
  });
}

function switchTab(tab, dogId) {
  if (activeTab === 'dog' && activeDogId) {
    clearTimeout(saveTimer);
    readFormToState();
    updateDog(appData, activeDogId, dogSnapshotFromUI(state));
  }

  activeTab = tab;
  activeDogId = dogId;
  appData.activeDogId = dogId;
  saveData(appData);

  if (tab === 'quick') {
    state = defaultState();
  } else if (dogId) {
    const dog = getDog(appData, dogId);
    if (dog) state = applyDogToState(dog);
  }

  renderTabs();
  applyStateToForm();
  calculate();
}

function updateDogActions() {
  const quickActions = document.getElementById('quick-actions');
  const dogActions = document.getElementById('dog-actions');
  const purchaseCard = document.getElementById('purchase-card');
  const purchaseHint = document.getElementById('purchase-hint');

  if (activeTab === 'quick') {
    quickActions.style.display = 'flex';
    dogActions.style.display = 'none';
    purchaseCard.style.display = 'none';
    purchaseHint.style.display = 'block';
  } else {
    quickActions.style.display = 'none';
    dogActions.style.display = 'flex';
    purchaseCard.style.display = 'block';
    purchaseHint.style.display = 'none';
  }
}

function openSaveDogModal() {
  readFormToState();
  document.getElementById('new-dog-name').value = '';
  openModal('save-dog-modal');
  document.getElementById('new-dog-name').focus();
}

function confirmSaveDog() {
  const name = document.getElementById('new-dog-name').value;
  readFormToState();
  createDog(appData, name, dogSnapshotFromUI(state));
  activeTab = 'dog';
  activeDogId = appData.activeDogId;
  closeModal('save-dog-modal');
  renderTabs();
  applyStateToForm();
  calculate();
  showToast('Собака сохранена');
}

function openRenameModal() {
  const dog = getDog(appData, activeDogId);
  if (!dog) return;
  document.getElementById('rename-dog-name').value = dog.name;
  openModal('rename-dog-modal');
}

function confirmRenameDog() {
  const name = document.getElementById('rename-dog-name').value;
  renameDog(appData, activeDogId, name);
  closeModal('rename-dog-modal');
  renderTabs();
  showToast('Имя обновлено');
}

function deleteCurrentDog() {
  const dog = getDog(appData, activeDogId);
  if (!dog) return;
  if (!confirm(`Удалить профиль «${dog.name}» и всю историю покупок?`)) return;
  deleteDog(appData, activeDogId);
  activeTab = 'quick';
  activeDogId = null;
  state = defaultState();
  renderTabs();
  applyStateToForm();
  calculate();
  showToast('Профиль удалён');
}

function toggleParameters() {
  const content = document.getElementById('params-content');
  const summary = document.getElementById('params-summary');
  const header = document.querySelector('.collapsible-header');
  const collapsed = content.style.display !== 'none';

  if (collapsed) {
    content.style.display = 'none';
    summary.style.display = 'flex';
    header.classList.add('collapsed');
    updateSummaryBar();
    appData.settings.paramsCollapsed = true;
  } else {
    content.style.display = 'block';
    summary.style.display = 'none';
    header.classList.remove('collapsed');
    appData.settings.paramsCollapsed = false;
  }
  saveData(appData);
}

function applyCollapsedState() {
  if (!appData.settings.paramsCollapsed) return;
  const content = document.getElementById('params-content');
  const summary = document.getElementById('params-summary');
  const header = document.querySelector('.collapsible-header');
  content.style.display = 'none';
  summary.style.display = 'flex';
  header.classList.add('collapsed');
  updateSummaryBar();
}

function updateSummaryBar() {
  const weight = parseFloat(document.getElementById('weight').value) || 0;
  const pctBody = parseFloat(document.getElementById('pctBody').value) || 0;
  const meals = parseInt(document.getElementById('meals').value, 10) || 1;
  const totalGrams = Math.round(weight * pctBody * 10);
  document.getElementById('summary-weight').textContent = `${weight} кг`;
  document.getElementById('summary-daily').textContent = `${totalGrams} г`;
  document.getElementById('summary-meals').textContent = meals;
}

function renderComponents() {
  const wrap = document.getElementById('components');
  wrap.innerHTML = COMPONENTS.map((c, i) => `
    <div class="component">
      <div class="icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div>
      <div class="info">
        <div class="name">${c.name}</div>
        <div class="desc">${c.desc}</div>
        <div class="slider-row">
          <input type="range" class="pct-slider" min="0" max="100" step="1" value="${state.components[i]}"
                 data-idx="${i}" style="accent-color:${c.color}">
        </div>
      </div>
      <div class="pct-wrap">
        <input class="pct-input" type="number" min="0" max="100" value="${state.components[i]}" data-idx="${i}">
        <span class="pct-sign">%</span>
      </div>
      <div class="grams" id="grams-${c.id}">0 г</div>
    </div>
  `).join('');

  wrap.querySelectorAll('.pct-slider').forEach(el => {
    el.addEventListener('input', () => onPctSlider(el));
  });
  wrap.querySelectorAll('.pct-input').forEach(el => {
    el.addEventListener('input', () => onPctChange(el));
  });
}

function setPct(idx, value) {
  state.components[idx] = Math.max(0, Math.min(100, parseFloat(value) || 0));
  state.preset = 'custom';
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.preset-btn[data-preset="custom"]').classList.add('active');

  const slider = document.querySelector(`.pct-slider[data-idx="${idx}"]`);
  const input = document.querySelector(`.pct-input[data-idx="${idx}"]`);
  if (slider) slider.value = state.components[idx];
  if (input) input.value = state.components[idx];

  calculate();
  scheduleAutoSave();
}

function onPctSlider(el) {
  setPct(parseInt(el.dataset.idx, 10), el.value);
}

function onPctChange(el) {
  setPct(parseInt(el.dataset.idx, 10), el.value);
}

function applyPreset(key, btn) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  state.preset = key;
  if (PRESETS[key]) {
    state.components = [...PRESETS[key]];
    renderComponents();
  }
  calculate();
  scheduleAutoSave();
}

function calculate() {
  const weight = parseFloat(document.getElementById('weight').value) || 0;
  const pctBody = parseFloat(document.getElementById('pctBody').value) || 0;
  const meals = parseInt(document.getElementById('meals').value, 10) || 1;

  const totalGrams = Math.round(weight * pctBody * 10);
  const perMeal = Math.round(totalGrams / meals);

  document.getElementById('totalGrams').textContent = totalGrams;
  document.getElementById('perMeal').textContent = `${perMeal} г × ${meals} кормлен${meals === 1 ? 'ие' : meals < 5 ? 'ия' : 'ий'}`;

  const pctSum = state.components.reduce((a, b) => a + b, 0);

  COMPONENTS.forEach((c, i) => {
    const grams = Math.round(totalGrams * state.components[i] / 100);
    const gramsEl = document.getElementById(`grams-${c.id}`);
    if (gramsEl) gramsEl.textContent = `${grams} г`;
  });

  const el = document.getElementById('pctTotal');
  el.textContent = `Сумма: ${pctSum}%`;
  el.className = 'pct-total ' + (pctSum === 100 ? 'ok' : pctSum > 90 && pctSum < 110 ? 'warn' : 'err');

  const summary = document.getElementById('params-summary');
  if (summary && summary.style.display !== 'none') updateSummaryBar();

  if (document.getElementById('cost-rows')) {
    if (costRowsRendered) updateCostValues();
    else renderCostRows();
  }
}

function renderCostRows() {
  const container = document.getElementById('cost-rows');
  if (!container) return;

  const days = parseInt(document.getElementById('daysCount').value, 10) || 30;
  const weight = parseFloat(document.getElementById('weight').value) || 0;
  const pctBody = parseFloat(document.getElementById('pctBody').value) || 0;
  const totalDailyGrams = Math.round(weight * pctBody * 10);

  container.innerHTML = COMPONENTS.map((c, i) => {
    const dailyGrams = Math.round(totalDailyGrams * state.components[i] / 100);
    const totalKg = ((dailyGrams * days) / 1000).toFixed(2);
    const price = state.costPrices[c.id] || '';
    return `
      <div class="cost-row" data-id="${c.id}">
        <div class="cost-name"><span style="font-size:16px;">${c.icon}</span> <strong>${c.name}</strong></div>
        <div class="cost-kg" data-kg>${totalKg} кг</div>
        <div class="cost-price">
          <input type="number" class="cost-input price-input" placeholder="0" step="10" data-id="${c.id}" value="${price || ''}">
          <span style="font-size:12px;color:#999;">₽/кг</span>
        </div>
        <div class="cost-subtotal" data-subtotal>0 ₽</div>
      </div>`;
  }).join('');

  costRowsRendered = true;
  container.oninput = e => {
    if (e.target.classList.contains('price-input')) {
      state.costPrices[e.target.dataset.id] = parseFloat(e.target.value) || 0;
      updateCostValues();
      scheduleAutoSave();
    }
  };
  updateCostValues();
}

function updateCostValues() {
  const days = parseInt(document.getElementById('daysCount').value, 10) || 30;
  const weight = parseFloat(document.getElementById('weight').value) || 0;
  const pctBody = parseFloat(document.getElementById('pctBody').value) || 0;
  const totalDailyGrams = Math.round(weight * pctBody * 10);
  let grandTotal = 0;

  COMPONENTS.forEach((c, i) => {
    const dailyGrams = Math.round(totalDailyGrams * state.components[i] / 100);
    const totalKg = ((dailyGrams * days) / 1000).toFixed(2);
    const row = document.querySelector(`.cost-row[data-id="${c.id}"]`);
    if (!row) return;

    const kgEl = row.querySelector('[data-kg]');
    if (kgEl) kgEl.textContent = `${totalKg} кг`;

    const priceInput = row.querySelector('.price-input');
    const price = priceInput ? (parseFloat(priceInput.value) || 0) : 0;
    const subtotal = (parseFloat(totalKg) * price).toFixed(0);
    grandTotal += parseFloat(subtotal);

    const subtotalEl = row.querySelector('[data-subtotal]');
    if (subtotalEl) subtotalEl.textContent = `${subtotal} ₽`;
  });

  const totalEl = document.getElementById('totalCost');
  if (totalEl) totalEl.textContent = `${Math.round(grandTotal).toLocaleString('ru-RU')} ₽`;
}

function copyShoppingList() {
  const days = parseInt(document.getElementById('daysCount').value, 10) || 30;
  const weight = parseFloat(document.getElementById('weight').value) || 0;
  const pctBody = parseFloat(document.getElementById('pctBody').value) || 0;
  const totalDailyGrams = Math.round(weight * pctBody * 10);
  const dogName = activeDogId ? (getDog(appData, activeDogId)?.name || '') : '';

  let text = `Список покупок на ${days} дней`;
  if (dogName) text += ` для ${dogName}`;
  text += ` (${weight} кг)\n\n`;

  COMPONENTS.forEach((c, i) => {
    const dailyGrams = Math.round(totalDailyGrams * state.components[i] / 100);
    const totalKg = ((dailyGrams * days) / 1000).toFixed(2);
    const row = document.querySelector(`.cost-row[data-id="${c.id}"]`);
    const price = row ? (parseFloat(row.querySelector('.price-input')?.value) || 0) : 0;
    const subtotal = (parseFloat(totalKg) * price).toFixed(0);
    text += `${c.icon} ${c.name}: ${totalKg} кг`;
    if (price > 0) text += ` — ${subtotal} ₽`;
    text += '\n';
  });

  text += `\nИТОГО: ${document.getElementById('totalCost').textContent}`;

  navigator.clipboard.writeText(text).then(() => {
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent.includes('Скопировать')) {
        const old = b.innerHTML;
        b.innerHTML = '✅ Скопировано!';
        setTimeout(() => { b.innerHTML = old; }, 2000);
      }
    });
  }).catch(() => prompt('Скопируйте список:', text));
}

function renderPurchaseSection() {
  const list = document.getElementById('purchase-list');
  const totalEl = document.getElementById('purchase-month-total');
  if (!list) return;

  if (!activeDogId) {
    list.innerHTML = '';
    if (totalEl) totalEl.textContent = '';
    return;
  }

  const purchases = getPurchasesForDog(appData, activeDogId);
  if (!purchases.length) {
    list.innerHTML = '<p class="purchase-empty">Покупок пока нет</p>';
    if (totalEl) totalEl.textContent = '';
    return;
  }

  const grouped = {};
  purchases.forEach(p => {
    const monthKey = p.date.slice(0, 7);
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(p);
  });

  let html = '';
  let allTotal = 0;

  Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(monthKey => {
    const monthTotal = grouped[monthKey].reduce((s, p) => s + p.totalAmount, 0);
    allTotal += monthTotal;
    html += `<div class="purchase-month"><div class="purchase-month-title">${formatMonth(monthKey)} — ${monthTotal.toLocaleString('ru-RU')} ₽</div>`;
    grouped[monthKey].forEach(p => {
      const item = p.items[0];
      const comp = COMPONENTS.find(c => c.id === item.componentId);
      const icon = comp ? comp.icon : '📦';
      const name = comp ? comp.name : 'Прочее';
      html += `
        <div class="purchase-item">
          <div class="purchase-item-main">
            <span class="purchase-date">${formatDate(p.date)}</span>
            <span>${icon} ${name}</span>
            <span>${item.kg} кг</span>
            <span class="purchase-amount">${p.totalAmount.toLocaleString('ru-RU')} ₽</span>
          </div>
          ${p.note ? `<div class="purchase-note">${escapeHtml(p.note)}</div>` : ''}
          <button class="purchase-delete" data-id="${p.id}" title="Удалить">✕</button>
        </div>`;
    });
    html += '</div>';
  });

  list.innerHTML = html;
  if (totalEl) totalEl.textContent = `Всего: ${allTotal.toLocaleString('ru-RU')} ₽`;

  list.querySelectorAll('.purchase-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deletePurchase(appData, btn.dataset.id);
      renderPurchaseSection();
      showToast('Запись удалена');
    });
  });
}

function addPurchaseFromForm() {
  if (!activeDogId) return;

  const date = document.getElementById('purchase-date').value;
  const componentId = document.getElementById('purchase-component').value;
  const kg = parseFloat(document.getElementById('purchase-kg').value) || 0;
  const pricePerKg = parseFloat(document.getElementById('purchase-price').value) || 0;
  const note = document.getElementById('purchase-note').value.trim();
  const updatePrice = document.getElementById('purchase-update-price').checked;

  if (!date || kg <= 0) {
    showToast('Укажите дату и количество');
    return;
  }

  const total = Math.round(kg * pricePerKg);
  addPurchase(appData, activeDogId, {
    date,
    items: [{ componentId, kg, pricePerKg, total }],
    totalAmount: total,
    note,
  });

  if (updatePrice && pricePerKg > 0) {
    state.costPrices[componentId] = pricePerKg;
    const priceInput = document.querySelector(`.price-input[data-id="${componentId}"]`);
    if (priceInput) priceInput.value = pricePerKg;
    updateCostValues();
    scheduleAutoSave();
  }

  document.getElementById('purchase-kg').value = '';
  document.getElementById('purchase-price').value = '';
  document.getElementById('purchase-note').value = '';
  renderPurchaseSection();
  showToast('Покупка добавлена');
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}`;
}

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function setupOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  const update = () => banner.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setupServiceWorkerUpdate() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          document.getElementById('update-banner').classList.add('show');
        }
      });
    });
  });

  document.getElementById('btn-update-app')?.addEventListener('click', () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      location.reload();
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

window.toggleParameters = toggleParameters;
window.applyPreset = applyPreset;
window.copyShoppingList = copyShoppingList;

document.addEventListener('DOMContentLoaded', init);