const STORAGE_KEY = 'dogPaikaData';
const DATA_VERSION = 1;

function isMobileStorageAllowed() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const narrowScreen = window.matchMedia('(max-width: 768px)').matches;
  return standalone || mobileUA || narrowScreen;
}

function canUseStorage() {
  return isMobileStorageAllowed();
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function emptyData() {
  return {
    version: DATA_VERSION,
    activeDogId: null,
    dogs: [],
    purchases: [],
    settings: { paramsCollapsed: true },
  };
}

function loadData() {
  if (!canUseStorage()) return emptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyData();
    return {
      version: data.version || DATA_VERSION,
      activeDogId: data.activeDogId ?? null,
      dogs: Array.isArray(data.dogs) ? data.dogs : [],
      purchases: Array.isArray(data.purchases) ? data.purchases : [],
      settings: { paramsCollapsed: true, ...(data.settings || {}) },
    };
  } catch {
    return emptyData();
  }
}

function saveData(data) {
  if (!canUseStorage()) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function getDog(data, id) {
  return data.dogs.find(d => d.id === id) || null;
}

function createDog(data, name, snapshot) {
  if (!canUseStorage()) return null;
  const now = new Date().toISOString();
  const dog = {
    id: generateId(),
    name: name.trim() || 'Без имени',
    createdAt: now,
    updatedAt: now,
    params: { ...snapshot.params },
    components: [...snapshot.components],
    preset: snapshot.preset || 'custom',
    costPrices: { ...snapshot.costPrices },
    daysCount: snapshot.daysCount || 30,
  };
  data.dogs.push(dog);
  data.activeDogId = dog.id;
  saveData(data);
  return dog;
}

function updateDog(data, id, patch) {
  if (!canUseStorage()) return null;
  const dog = getDog(data, id);
  if (!dog) return null;
  Object.assign(dog, patch, { updatedAt: new Date().toISOString() });
  saveData(data);
  return dog;
}

function deleteDog(data, id) {
  if (!canUseStorage()) return;
  data.dogs = data.dogs.filter(d => d.id !== id);
  data.purchases = data.purchases.filter(p => p.dogId !== id);
  if (data.activeDogId === id) {
    data.activeDogId = null;
  }
  saveData(data);
}

function renameDog(data, id, name) {
  return updateDog(data, id, { name: name.trim() || 'Без имени' });
}

function addPurchase(data, dogId, purchase) {
  if (!canUseStorage()) return null;
  const entry = {
    id: generateId(),
    dogId,
    date: purchase.date,
    items: purchase.items.map(item => ({
      componentId: item.componentId,
      kg: item.kg,
      pricePerKg: item.pricePerKg,
      total: item.total,
    })),
    totalAmount: purchase.totalAmount,
    note: purchase.note || '',
  };
  data.purchases.push(entry);
  saveData(data);
  return entry;
}

function deletePurchase(data, purchaseId) {
  if (!canUseStorage()) return;
  data.purchases = data.purchases.filter(p => p.id !== purchaseId);
  saveData(data);
}

function getPurchasesForDog(data, dogId) {
  return data.purchases
    .filter(p => p.dogId === dogId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function dogSnapshotFromUI(state) {
  return {
    params: { ...state.params },
    components: [...state.components],
    preset: state.preset,
    costPrices: { ...state.costPrices },
    daysCount: state.daysCount,
  };
}

function applyDogToState(dog) {
  return {
    params: { ...dog.params },
    components: [...dog.components],
    preset: dog.preset || 'custom',
    costPrices: { ...(dog.costPrices || {}) },
    daysCount: dog.daysCount || 30,
  };
}