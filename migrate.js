const fs = require('fs');
const path = require('path');

const productsPath = path.join(__dirname, 'vape-bot', 'products.json');
const categoriesPath = path.join(__dirname, 'vape-bot', 'categories.json');

function main() {
  console.log('🔄 Миграция структуры данных на новую схему (categories + products)...\n');

  if (!fs.existsSync(productsPath)) {
    console.error('❌ Не найден файл', productsPath);
    process.exit(1);
  }

  // Читаем старые товары
  let products;
  try {
    products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  } catch (e) {
    console.error('❌ Ошибка парсинга products.json:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(products)) {
    console.error('❌ products.json должен содержать массив товаров');
    process.exit(1);
  }

  // Проверяем, нужна ли миграция
  const needsMigration = products.some(p => 
    (p.category !== undefined && typeof p.category === 'string') || 
    p.categoryId === undefined
  );

  if (!needsMigration) {
    console.log('✅ Данные уже в новом формате (с categoryId), миграция не требуется.');
    return;
  }

  console.log('📦 Найдено товаров для миграции:', products.length);

  // Извлекаем уникальные категории из поля category
  const categoryNames = [...new Set(
    products
      .map(p => (p.category && typeof p.category === 'string') ? p.category.trim() : 'Другие')
      .filter(Boolean)
  )];

  console.log('📁 Найдено уникальных категорий:', categoryNames.length);
  categoryNames.forEach(name => console.log('   -', name));

  // Создаём массив categories
  const categories = categoryNames.map((name, idx) => ({
    id: idx + 1,
    name: name,
    img: '' // картинки нужно будет добавить вручную через админку
  }));

  // Обновляем товары: заменяем текстовое поле category на categoryId
  const updatedProducts = products.map(p => {
    const categoryName = (p.category && typeof p.category === 'string') 
      ? p.category.trim() 
      : 'Другие';
    const cat = categories.find(c => c.name === categoryName);
    
    return {
      id: p.id,
      name: p.name || 'Без названия',
      price: p.price || 0,
      img: p.img || '',
      ml: p.ml || '',
      nic: p.nic || '',
      categoryId: cat ? cat.id : null
    };
  });

  // Сохраняем
  fs.writeFileSync(categoriesPath, JSON.stringify(categories, null, 2), 'utf-8');
  fs.writeFileSync(productsPath, JSON.stringify(updatedProducts, null, 2), 'utf-8');

  console.log('\n✅ Миграция завершена!');
  console.log('📁 Создано категорий:', categories.length);
  console.log('📦 Обновлено товаров:', updatedProducts.length);
  console.log('\n📝 Следующие шаги:');
  console.log('   1. Загрузи categories.json и обновлённый products.json на сервер');
  console.log('   2. Перезапусти бота на сервере');
  console.log('   3. Открой админку и добавь картинки для каталогов');
  console.log('   4. Запусти: node sync-products.js');
  console.log('   5. Закоммить и запушить web/data.js на GitHub');
}

main();

