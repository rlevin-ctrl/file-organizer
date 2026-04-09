import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { formatSize } from './utils.js';

export class Scanner extends EventEmitter {
    async scan(rootDirectory) {
        this.emit('scan-start', { directory: rootDirectory });

        const allFiles = [];
        await this.walkDirectory(rootDirectory, allFiles);

        const total = allFiles.length;
        let processed = 0;

        const now = Date.now();
        const statsByExt = new Map();
        let totalSize = 0;

        let last7 = 0;
        let last30 = 0;
        let older90 = 0;

        const largestFiles = [];
        let oldestFile = null;

        for (const file of allFiles) {
            processed += 1;
            this.emit('file-found', { processed, total, path: file });

            let stat;
            try {
                stat = await fs.stat(file);
            } catch (error) {
                continue;
            }

            const size = stat.size;
            const mtime = stat.mtime;
            totalSize += size;

            const ext = path.extname(file) || '(no ext)';
            const extStats = statsByExt.get(ext) || { count: 0, totalSize: 0 };
            extStats.count += 1;
            extStats.totalSize += size;
            statsByExt.set(ext, extStats);

            const daysOld = (now - mtime.getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld <= 7) last7 += 1;
            if (daysOld <= 30) last30 += 1;
            if (daysOld > 90) older90 += 1;
            
            largestFiles.push({ path: file, size });
            largestFiles.sort((a, b) => b.size - a.size);
            if (largestFiles.length > 3) largestFiles.pop();
            
            if (!oldestFile || mtime < oldestFile.mtime) {
                oldestFile = { path: file, mtime, daysOld: Math.floor(daysOld) };
            }
        }

        const byType = Array.from(statsByExt.entries()).map(([ext, data]) => ({
            ext,
            count: data.count,
            totalSize: data.totalSize,
            totalSizeHuman: formatSize(data.totalSize),
        }));

        const result = {
            totalFiles: total,
            totalSize,
            totalSizeHuman: formatSize(totalSize),
            byType,
            age: {
                last7,
                last30,
                older90,
            },
            largestFiles: largestFiles.map((f, i) => ({
                index: i + 1,
                path: f.path,
                size: f.size,
                sizeHuman: formatSize(f.size),
            })),
            oldestFile: oldestFile
                ? {
                    path: oldestFile.path,
                    daysOld: oldestFile.daysOld,
                    modifiedAt: oldestFile.mtime,
                }
                : null,
        };

        this.emit('scan-complete', result);
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