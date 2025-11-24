const { Telegraf } = require('telegraf');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Токен бота от BotFather
// РЕКОМЕНДАЦИЯ: лучше хранить его в переменной окружения BOT_TOKEN, а не в коде.
const BOT_TOKEN = process.env.BOT_TOKEN || '8346882502:AAG2NZrnV6poZOx9lK3hbEUfUn75vAS1Xgo';

// Настройки HTTP-сервера для админ-панели и API
// По умолчанию слушаем порт 3000, а наружу отдаём через nginx (порт 80)
const HTTP_PORT = process.env.PORT || 3000;

// URL твоей Mini App (теперь на том же сервере)
// Telegram требует HTTPS для Mini App!
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://smokelab.store/web/';
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!BOT_TOKEN || BOT_TOKEN.startsWith('ВСТАВЬ_СЮДА')) {
  console.warn('⚠️ Не задан токен бота. Отредактируй BOT_TOKEN в bot.js или задай переменную окружения BOT_TOKEN.');
}

const bot = new Telegraf(BOT_TOKEN);

// Универсальный обработчик старта
async function sendStart(ctx) {
  // Клавиатура внизу чата с кнопкой "Старт"
  await ctx.reply('Главное меню', {
    reply_markup: {
      keyboard: [[{ text: 'Старт' }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });

  // Сообщение с кнопкой открытия магазина (inline‑кнопка)
  return ctx.reply('Добро пожаловать в VapeHouse 🔥', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть магазин',
            web_app: { url: WEB_APP_URL },
          },
        ],
      ],
    },
  });
}

// Команда /start
bot.start((ctx) => sendStart(ctx));

// Нажатие на кнопку "Старт" в клавиатуре — ведём себя так же, как на /start
bot.hears('Старт', (ctx) => sendStart(ctx));

// Принимаем данные из Mini App
bot.on('web_app_data', (ctx) => {
  try {
    const webAppData = ctx.message?.web_app_data?.data;
    if (!webAppData) {
      return ctx.reply('Не удалось прочитать данные заказа 😔');
    }

    const data = JSON.parse(webAppData);
    const user = data.user || {};
    const items = (data.items || []).map((i) => {
      const qty = i.qty || 1;
      const lineTotal = (i.price || 0) * qty;
      return `• ${i.name} x${qty} — ${lineTotal} ₽`;
    }).join('\n');
    const total = data.total || 0;
    const delivery = data.delivery || 'не указано';
    const payment = data.payment || 'не указано';
    const contactName = data.contactName || 'не указано';
    const contactPhone = data.contactPhone || 'не указано';
    const comment = data.comment || '—';

    const message = `
Новый заказ! 

От: @${user.username || 'no_username'} (${user.first_name || 'без имени'})
ID: ${user.id}

${items}

Итого: ${total} ₽

Доставка: ${delivery}
Оплата: ${payment}
Имя: ${contactName}
Телефон: ${contactPhone}
Комментарий: ${comment}
    `.trim();

    ctx.reply(message);
  } catch (err) {
    console.error('Ошибка обработки web_app_data', err);
    ctx.reply('Произошла ошибка при обработке заказа 😔');
  }
});

// --- HTTP API + Admin ---

function readProducts() {
  const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

function readCategories() {
  const raw = fs.readFileSync(CATEGORIES_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeCategories(categories) {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
}

const app = express();
app.use(cors());
app.use(express.json());

// Убеждаемся, что папка для загрузок существует
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Настройка хранилища файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 6 ? ext : '';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

// Выдаём каталог для Mini App или любых клиентов
app.get('/api/products', (req, res) => {
  try {
    const products = readProducts();
    res.json(products);
  } catch (e) {
    console.error('Ошибка чтения products.json', e);
    res.status(500).json({ error: 'Cannot read products' });
  }
});

// Простое сохранение всего каталога (использует админ-панель)
app.post('/api/products', (req, res) => {
  try {
    const products = req.body.products;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'products must be array' });
    }
    writeProducts(products);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи products.json', e);
    res.status(500).json({ error: 'Cannot write products' });
  }
});

// Получение списка категорий
app.get('/api/categories', (req, res) => {
  try {
    const categories = readCategories();
    res.json(categories);
  } catch (e) {
    console.error('Ошибка чтения categories.json', e);
    res.status(500).json({ error: 'Cannot read categories' });
  }
});

// Сохранение категорий
app.post('/api/categories', (req, res) => {
  try {
    const categories = req.body.categories;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'categories must be array' });
    }
    writeCategories(categories);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи categories.json', e);
    res.status(500).json({ error: 'Cannot write categories' });
  }
});

// Загрузка картинки с устройства, возврат публичного URL
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filename = req.file.filename;
    const publicPath = `/uploads/${filename}`;
    res.json({ ok: true, url: publicPath });
  } catch (e) {
    console.error('Ошибка загрузки файла', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Генерация data.js для Mini App
app.post('/api/generate-datajs', (req, res) => {
  try {
    const categories = readCategories();
    const products = readProducts();
    
    // Базовый URL сервера (HTTPS домен)
    const SERVER_URL = process.env.SERVER_URL || 'https://smokelab.store';
    
    // Функция для преобразования относительных путей в полные URL
    function toFullUrl(imgPath) {
      if (!imgPath) return '';
      if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        return imgPath; // Уже полный URL
      }
      if (imgPath.startsWith('/')) {
        return SERVER_URL + imgPath; // Относительный от корня
      }
      return imgPath; // Возвращаем как есть
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
    
    // Генерируем содержимое data.js
    const header = '// Этот файл сгенерирован автоматически из админ-панели Smokelab\n';
    const categoriesCode = 'const categories = ' + JSON.stringify(categoriesWithFullUrls, null, 2) + ';\n\n';
    const productsCode = 'const products = ' + JSON.stringify(productsWithFullUrls, null, 2) + ';\n';
    const content = header + categoriesCode + productsCode;
    
    // Сохраняем в папку web/
    const WEB_DIR = path.join(__dirname, 'web');
    if (!fs.existsSync(WEB_DIR)) {
      fs.mkdirSync(WEB_DIR, { recursive: true });
    }
    
    const dataJsPath = path.join(WEB_DIR, 'data.js');
    fs.writeFileSync(dataJsPath, content, 'utf-8');
    
    console.log('✅ data.js обновлён автоматически');
    res.json({ ok: true, message: 'data.js обновлён успешно' });
  } catch (e) {
    console.error('Ошибка генерации data.js', e);
    res.status(500).json({ error: 'Failed to generate data.js', details: e.message });
  }
});

// Отдаём загруженные файлы
app.use('/uploads', express.static(UPLOADS_DIR));

// Статика для админки (admin.html и т.п.)
app.use('/admin', express.static(__dirname + '/public-admin', {
  index: 'index2.html' // Используем index2.html как индексный файл
}));

// Отдаём Mini App прямо с нашего сервера
const WEB_DIR = path.join(__dirname, 'web');
if (fs.existsSync(WEB_DIR)) {
  app.use('/web', express.static(WEB_DIR));
  console.log('Mini App доступен по', WEB_APP_URL);
} else {
  console.warn('⚠️ Папка web не найдена. Создай её и скопируй туда index.html и data.js');
}

// Запуск бота и HTTP-сервера
bot.launch().then(() => {
  console.log('Бот запущен');
  console.log('Ожидаю команды /start ...');
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API/Админка запущены на порту ${HTTP_PORT}`);
});

// Корректная остановка для хостинга
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});

