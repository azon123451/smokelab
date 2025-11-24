const fs = require('fs');
const path = require('path');

const categoriesPath = path.join(__dirname, 'vape-bot', 'categories.json');
const productsPath = path.join(__dirname, 'vape-bot', 'products.json');
// Сохраняем data.js в vape-bot/web/ для раздачи с сервера
const dataJsPath = path.join(__dirname, 'vape-bot', 'web', 'data.js');

function main() {
  if (!fs.existsSync(categoriesPath)) {
    console.error('Не найден файл', categoriesPath);
    process.exit(1);
  }
  if (!fs.existsSync(productsPath)) {
    console.error('Не найден файл', productsPath);
    process.exit(1);
  }

  let categories, products;
  try {
    categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
  } catch (e) {
    console.error('Ошибка парсинга categories.json:', e.message);
    process.exit(1);
  }

  try {
    products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  } catch (e) {
    console.error('Ошибка парсинга products.json:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(categories)) {
    console.error('categories.json должен содержать массив каталогов');
    process.exit(1);
  }
  if (!Array.isArray(products)) {
    console.error('products.json должен содержать массив товаров');
    process.exit(1);
  }

  // Базовый URL сервера (можно задать через переменную окружения)
  const SERVER_URL = process.env.SERVER_URL || 'https://smokelab.store';
  
  // Функция для преобразования относительных путей в полные URL
  function toFullUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path; // Уже полный URL
    }
    if (path.startsWith('/')) {
      return SERVER_URL + path; // Относительный от корня
    }
    return path; // Возвращаем как есть
  }
  
  // Преобразуем пути картинок в полные URL
  const categoriesWithFullUrls = categories.map(cat => ({
    ...cat,
    img: toFullUrl(cat.img)
  }));
  
  const productsWithFullUrls = products.map(prod => ({
    ...prod,
    img: toFullUrl(prod.img)
  }));

  const header = '// Этот файл сгенерирован из vape-bot/categories.json и vape-bot/products.json\n';
  const categoriesCode = 'const categories = ' + JSON.stringify(categoriesWithFullUrls, null, 2) + ';\n\n';
  const productsCode = 'const products = ' + JSON.stringify(productsWithFullUrls, null, 2) + ';\n';

  // Создаём папку web если её нет
  const webDir = path.dirname(dataJsPath);
  if (!fs.existsSync(webDir)) {
    fs.mkdirSync(webDir, { recursive: true });
    console.log('Создана папка:', webDir);
  }

  fs.writeFileSync(dataJsPath, header + categoriesCode + productsCode, 'utf-8');
  console.log('✅ Обновлён', dataJsPath);
  console.log('📦 Источники:', categoriesPath, 'и', productsPath);
  console.log('🖼️ Картинки преобразованы в полные URL:', SERVER_URL);
  console.log('\n💡 Теперь загрузи папку vape-bot/web/ на сервер!');
}

main();


