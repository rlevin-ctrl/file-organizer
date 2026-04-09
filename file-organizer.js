import { Scanner } from './lib/scanner.js';
import { DuplicateFinder } from './lib/duplicates.js';
import { Organizer } from './lib/organizer.js';
import { Cleanup } from './lib/cleanup.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
    try {
        switch (command) {
            case 'scan': {
                const directory = args[1] || '.';
                const scanner = new Scanner();

                scanner.on('scan-start', ({ directory }) => {
                    console.log(`📂 Scanning: ${directory}`);
                });

                scanner.on('file-found', ({ processed, total }) => {
                    process.stdout.write(`\rProcessing... ${processed}/${total} files`);
                });

                scanner.on('scan-complete', (stats) => {
                    console.log('\n\n📊 Scan Results:');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log(`Total files: ${stats.totalFiles}`);
                    console.log(`Total size: ${stats.totalSizeHuman}`);

                    console.log('\nBy File Type:');
                    for (const t of stats.byType) {
                        console.log(
                            `  ${t.ext.padEnd(7)} ${String(t.count).padStart(4)} files   ${t.totalSizeHuman}`
                        );
                    }

                    console.log('\nFile Age:');
                    console.log(`  Last 7 days:    ${stats.age.last7} files`);
                    console.log(`  Last 30 days:   ${stats.age.last30} files`);
                    console.log(`  Older than 90:  ${stats.age.older90} files`);

                    console.log('\nLargest files:');
                    stats.largestFiles.forEach((f) => {
                        console.log(
                            `  ${f.index}. ${f.path}    ${f.sizeHuman}`
                        );
                    });

                    if (stats.oldestFile) {
                        console.log(
                            `\nOldest file: ${stats.oldestFile.path} (modified ${stats.oldestFile.daysOld} days ago)`
                        );
                    } else {
                        console.log('\nOldest file: (no files)');
                    }
                });

                await scanner.scan(directory);
                break;
            }

            case 'duplicates': {
                const directory = args[1] || '.';
                const finder = new DuplicateFinder();

                finder.on('start', ({ directory }) => {
                    console.log(`🔍 Searching for duplicates in: ${directory}`);
                });

                finder.on('file-processed', ({ processed, total }) => {
                    process.stdout.write(`\rCalculating hashes... ${processed}/${total} files`);
                });

                finder.on('duplicates-found', ({ groups, totalWastedHuman }) => {
                    console.log('\n');
                    if (groups.length === 0) {
                        console.log('No duplicate files found.');
                        return;
                    }

                    console.log(
                        `\nFound ${groups.length} duplicate groups (${totalWastedHuman} wasted):\n`
                    );

                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    groups.forEach((g, index) => {
                        console.log(
                            `Group ${index + 1} (${g.copies.length} copies, ${g.sizeEachHuman} each):`
                        );
                        console.log(`  SHA-256: ${g.hash}`);
                        console.log('');
                        g.copies.forEach(f => {
                            console.log(`  📄 ${f.path}`);
                        });
                        console.log(`\n  Wasted space: ${g.wastedHuman}\n`);
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    });

                    console.log(`💾 Total wasted space: ${totalWastedHuman}`);
                });

                await finder.findDuplicates(directory);
                break;
            }

            case 'organize': {
                const sourceDir = args[1] || '.';
                const outputIndex = args.indexOf('--output');
                const targetDir = outputIndex !== -1 ? args[outputIndex + 1] : null;

                if (!targetDir) {
                    console.error('❌ Please provide --output <directory>');
                    process.exit(1);
                }

                const organizer = new Organizer();

                organizer.on('start', ({ sourceDir, targetDir }) => {
                    console.log(`📦 Organizing: ${sourceDir}`);
                    console.log(`Target: ${targetDir}`);
                });

                organizer.on('folders-create-start', () => {
                    console.log('\nCreating folders...');
                });

                organizer.on('folder-created', ({ category }) => {
                    console.log(`  ✓ ${category}/`);
                });

                organizer.on('copy-start', ({ processed, total }) => {
                    const bar = Math.round((processed / total) * 20);
                    const line =
                        'Copying files... ' +
                        '█'.repeat(bar) +
                        '░'.repeat(20 - bar) +
                        ` ${processed}/${total}`;
                    process.stdout.write(`\r${line}`);
                });

                organizer.on('copy-complete', () => {
                });

                organizer.on('copy-error', ({ source, error }) => {
                    console.error(`\n❌ Error copying ${source}: ${error.message}`);
                });

                organizer.on('complete', ({ summary, totalFiles, totalSize }) => {
                    console.log('\n\n✅ Organization complete!\n');
                    console.log('Summary:');
                    console.log(
                        `  Documents: ${summary.Documents} files → ${targetDir}/Documents/`,
                    );
                    console.log(`  Images:    ${summary.Images} files → ${targetDir}/Images/`);
                    console.log(
                        `  Archives:  ${summary.Archives} files → ${targetDir}/Archives/`,
                    );
                    console.log(`  Code:      ${summary.Code} files → ${targetDir}/Code/`);
                    console.log(
                        `  Videos:    ${summary.Videos} files → ${targetDir}/Videos/`,
                    );
                    console.log(`  Other:     ${summary.Other} files → ${targetDir}/Other/`);

                    console.log(`\nTotal copied: ${totalFiles} files`);
                });

                await organizer.organize(sourceDir, targetDir);
                break;
            }

            case 'cleanup': {
                const directory = args[1] || '.';
                const olderIndex = args.indexOf('--older-than');
                const days = olderIndex !== -1 ? Number(args[olderIndex + 1]) : null;
                const confirm = args.includes('--confirm');

                if (!days || Number.isNaN(days)) {
                    console.error('❌ Please provide --older-than <days>');
                    process.exit(1);
                }

                const cleanup = new Cleanup();

                cleanup.on('start', ({ directory, olderThanDays, confirm }) => {
                    console.log(`🧹 Cleanup: ${directory}`);
                    console.log(`Looking for files older than ${olderThanDays} days...`);
                    if (!confirm) {
                        console.log('\nDRY RUN MODE: Files will NOT be deleted.\n');
                    }
                });

                cleanup.on('file-found', (file) => {
                });

                cleanup.on('file-deleted', (file) => {
                });

                cleanup.on('delete-error', ({ file, error }) => {
                    console.error(`❌ Error deleting ${file.path}: ${error.message}`);
                });

                cleanup.on('cleanup-complete', (result) => {
                    const {
                        candidates,
                        totalCandidatesSizeHuman,
                        confirm,
                        deleted,
                        totalSizeDeletedHuman,
                    } = result;

                    if (candidates.length === 0) {
                        console.log('\nNo files to delete.');
                        return;
                    }

                    console.log(`\nFound ${candidates.length} files to delete:\n`);
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                    candidates.slice(0, 50).forEach((file) => {
                        console.log(file.path);
                        console.log(`  Size: ${file.sizeHuman}`);
                        console.log(`  Modified: ${file.daysOld} days ago (${file.modifiedAt.toISOString().slice(0, 10)})\n`);
                    });

                    if (candidates.length > 50) {
                        console.log(`... (${candidates.length - 50} more files)\n`);
                    }

                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log(`Total: ${candidates.length} files (${totalCandidatesSizeHuman})`);

                    if (!confirm) {
                        console.log('\n⚠️  DRY RUN MODE: No files were deleted.');
                        console.log('To actually delete these files, run with --confirm flag.');
                    } else {
                        console.log(
                            `\n✅ Cleanup complete!\nDeleted: ${deleted} files (${totalSizeDeletedHuman} freed)`,
                        );
                    }
                });

                await cleanup.cleanup(directory, days, confirm);
                break;
            }

            default:
                console.log('Usage: node file-organizer.js <scan|duplicates|organize|cleanup> [options]');
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    }
}

main();