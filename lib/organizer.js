// lib/organizer.js
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const categories = {
    Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.pptx'],
    Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
    Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
    Code: ['.js', '.py', '.java', '.cpp', '.html', '.css', '.json'],
    Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
    Other: [],
};

function getCategory(ext) {
    for (const [name, exts] of Object.entries(categories)) {
        if (exts.includes(ext.toLowerCase())) return name;
    }
    return 'Other';
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function getUniqueTargetPath(dir, filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);

    let candidate = path.join(dir, filename);
    let counter = 1;

    while (true) {
        try {
            await fs.access(candidate);
            candidate = path.join(dir, `${base}(${counter})${ext}`);
            counter += 1;
        } catch {
            return candidate;
        }
    }
}

export class Organizer extends EventEmitter {
    async organize(sourceDir, targetDir) {
        this.emit('start', { sourceDir, targetDir });
        
        const allFiles = [];
        await this.walkDirectory(sourceDir, allFiles);
        
        this.emit('folders-create-start');
        const categoryDirs = {};
        for (const category of Object.keys(categories)) {
            const dirPath = path.join(targetDir, category);
            await ensureDir(dirPath);
            categoryDirs[category] = dirPath;
            this.emit('folder-created', { category, path: dirPath });
        }
        
        const total = allFiles.length;
        let processed = 0;

        const summary = {
            Documents: 0,
            Images: 0,
            Archives: 0,
            Code: 0,
            Videos: 0,
            Other: 0,
            totalSize: 0,
        };

        for (const file of allFiles) {
            processed += 1;

            let stat;
            try {
                stat = await fs.stat(file);
            } catch {
                continue;
            }

            const size = stat.size;
            summary.totalSize += size;

            const ext = path.extname(file);
            const category = getCategory(ext);
            const targetCategoryDir = categoryDirs[category];
            const filename = path.basename(file);
            const targetPath = await getUniqueTargetPath(targetCategoryDir, filename);

            this.emit('copy-start', {
                source: file,
                target: targetPath,
                category,
                processed,
                total,
            });

            try {
                if (size < 10 * 1024 * 1024) {
                    await fs.copyFile(file, targetPath);
                } else {
                    await pipeline(
                        fssync.createReadStream(file),
                        fssync.createWriteStream(targetPath),
                    );
                }
                summary[category] += 1;

                this.emit('copy-complete', {
                    source: file,
                    target: targetPath,
                    category,
                    processed,
                    total,
                });
            } catch (error) {
                this.emit('copy-error', {
                    source: file,
                    target: targetPath,
                    category,
                    error,
                });
            }
        }

        this.emit('complete', {
            summary,
            totalFiles: total,
            totalSize: summary.totalSize,
        });
    }

    async walkDirectory(dir, files) {
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ Error: Directory not found: ${dir}`);
            } else if (error.code === 'EACCES') {
                console.error(`❌ Error: Permission denied: ${dir}`);
            } else {
                console.error(`❌ Unexpected error reading ${dir}: ${error.message}`);
            }
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await this.walkDirectory(fullPath, files);
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    }
}