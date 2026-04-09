# file-organizer

CLI-застосунок на Node.js для аналізу, організації та очищення директорій (Downloads, Videos тощо).

## Вимоги

- Node.js 18+ (перевірено на 24.x)
- npm

## Встановлення

```bash
git clone https://github.com/<your-username>/file-organizer.git
cd file-organizer
npm install
```

(якщо залежностей через npm немає, `npm install` нічого не встановить, але лишити команду можна).

## Команди

### 1. scan

Рекурсивний аналіз директорії: кількість файлів, розмір, типи, вік, топ-3 найбільших, найстаріший файл.

```bash
npm run scan -- C:\Users\<імʼя>\Downloads
# або
node file-organizer.js scan C:\Users\<імʼя>\Downloads
```

### 2. duplicates

Пошук дублікатів за SHA-256 хешем вмісту файлів (використовуються streams).

```bash
npm run duplicates -- C:\Users\<імʼя>\Downloads
# або
node file-organizer.js duplicates C:\Users\<імʼя>\Downloads
```

### 3. organize

Копіювання файлів по категоріях (Documents, Images, Archives, Code, Videos, Other) у цільову директорію.

```bash
npm run organize -- C:\Users\<імʼя>\Downloads --output C:\Users\<імʼя>\Organized
# або
node file-organizer.js organize C:\Users\<імʼя>\Downloads --output C:\Users\<імʼя>\Organized
```

Оригінальні файли не видаляються.

### 4. cleanup

Пошук і видалення файлів старших за N днів.

```bash
# тільки показати список (dry run)
npm run cleanup -- C:\Users\<імʼя>\Downloads --older-than 90

# показати список і видалити (після підтвердження параметром --confirm)
npm run cleanup -- C:\Users\<імʼя>\Downloads --older-than 90 --confirm
```

## Структура проєкту

```text
file-organizer/
├── package.json
├── .gitignore
├── README.md
├── file-organizer.js
└── lib/
    ├── scanner.js      # команда scan (EventEmitter, статистика по файлам)
    ├── duplicates.js   # команда duplicates (SHA-256, streams)
    ├── organizer.js    # команда organize (категорії, копіювання, streams ≥10MB)
    └── cleanup.js      # команда cleanup (вік файлів, dry run, видалення)
```