import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { formatSize } from './utils.js';

export class Cleanup extends EventEmitter {
    async cleanup(rootDirectory, olderThanDays, confirm) {
        this.emit('start', { directory: rootDirectory, olderThanDays, confirm });

        const allFiles = [];
        await this.walkDirectory(rootDirectory, allFiles);

        const candidates = [];
        let totalSize = 0;
        const now = Date.now();

        let processed = 0;

        for (const file of allFiles) {
            processed += 1;

            let stat;
            try {
                stat = await fs.stat(file);
            } catch {
                continue;
            }

            const mtime = stat.mtime;
            const ageMs = now - mtime.getTime();
            const daysOld = ageMs / (1000 * 60 * 60 * 24);

            if (daysOld > olderThanDays) {
                const size = stat.size;
                totalSize += size;

                const info = {
                    path: file,
                    size,
                    sizeHuman: formatSize(size),
                    daysOld: Math.floor(daysOld),
                    modifiedAt: mtime,
                };

                candidates.push(info);
                this.emit('file-found', {
                    ...info,
                    processed,
                    total: allFiles.length,
                });
            }
        }

        if (!confirm) {
            this.emit('cleanup-complete', {
                deleted: 0,
                totalSizeDeleted: 0,
                totalSizeDeletedHuman: formatSize(0),
                candidates,
                totalCandidatesSize: totalSize,
                totalCandidatesSizeHuman: formatSize(totalSize),
                confirm: false,
            });
            return;
        }
        
        let deleted = 0;
        let deletedSize = 0;
        for (const file of candidates) {
            try {
                await fs.unlink(file.path);
                deleted += 1;
                deletedSize += file.size;
                this.emit('file-deleted', file);
            } catch (error) {
                this.emit('delete-error', { file, error });
            }
        }

        this.emit('cleanup-complete', {
            deleted,
            totalSizeDeleted: deletedSize,
            totalSizeDeletedHuman: formatSize(deletedSize),
            candidates,
            totalCandidatesSize: totalSize,
            totalCandidatesSizeHuman: formatSize(totalSize),
            confirm: true,
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