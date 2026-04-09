# file-organizer

CLI tool built with Node.js for analyzing, organizing, and cleaning up directories (Downloads, Videos, etc.).

## Requirements

- Node.js 18+
- npm

## Installation

```bash
git clone https://github.com/<your-username>/file-organizer.git
cd file-organizer
npm install
```

(If there are no npm dependencies, `npm install` will not install anything, but you can still keep this command.)

## Commands

### 1. scan

Recursively analyzes a directory: number of files, total size, file types, age distribution, top-3 largest files, and the oldest file.

```bash
npm run scan -- C:\Users\<username>\Downloads
# or
node file-organizer.js scan C:\Users\<username>\Downloads
```

### 2. duplicates

Finds duplicate files by SHA-256 hash of their contents (uses streams).

```bash
npm run duplicates -- C:\Users\<username>\Downloads
# or
node file-organizer.js duplicates C:\Users\<username>\Downloads
```

### 3. organize

Copies files into category folders (Documents, Images, Archives, Code, Videos, Other) in the target directory.

```bash
npm run organize -- C:\Users\<username>\Downloads --output C:\Users\<username>\Organized
# or
node file-organizer.js organize C:\Users\<username>\Downloads --output C:\Users\<username>\Organized
```

Original files are not deleted.

### 4. cleanup

Finds and deletes files older than N days.

```bash
# show list only (dry run)
npm run cleanup -- C:\Users\<username>\Downloads --older-than 90

# show list and delete (with --confirm flag)
npm run cleanup -- C:\Users\<username>\Downloads --older-than 90 --confirm
```

## Project structure

```text
file-organizer/
├── package.json
├── .gitignore
├── README.md
├── file-organizer.js
└── lib/
    ├── scanner.js      # scan command (EventEmitter, file statistics)
    ├── duplicates.js   # duplicates command (SHA-256, streams)
    ├── organizer.js    # organize command (categories, copying, streams ≥10MB)
    └── cleanup.js      # cleanup command (file age, dry run, deletion)
```
