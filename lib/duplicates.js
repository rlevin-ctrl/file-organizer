import { EventEmitter } from 'events';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { formatSize } from './utils.js';


function calculateHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fssync.createReadStream(filePath);

        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

export class DuplicateFinder extends EventEmitter {
    async findDuplicates(rootDirectory) {
        this.emit('start', { directory: rootDirectory });

        const allFiles = [];
        await this.walkDirectory(rootDirectory, allFiles);

        const total = allFiles.length;
        let processed = 0;

        const hashMap = new Map(); 

        for (const file of allFiles) {
            processed += 1;
            this.emit('file-processed', { processed, total, path: file });

            let stat;
            try {
                stat = await fs.stat(file);
            } catch {
                continue;
            }

            const size = stat.size;
            let hash;
            try {
                hash = await calculateHash(file);
            } catch {
                continue;
            }

            const list = hashMap.get(hash) || [];
            list.push({ path: file, size });
            hashMap.set(hash, list);
        }

        const groups = [];
        let totalWasted = 0;

        for (const [hash, files] of hashMap.entries()) {
            if (files.length <= 1) continue;

            const sizeEach = files[0].size;
            const wasted = sizeEach * (files.length - 1);
            totalWasted += wasted;

            groups.push({
                hash,
                copies: files,
                sizeEach,
                sizeEachHuman: formatSize(sizeEach),
                wasted,
                wastedHuman: formatSize(wasted),
            });
        }

        this.emit('duplicates-found', {
            groups,
            totalWasted,
            totalWastedHuman: formatSize(totalWasted),
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