import { cp, mkdir, readFile, rm } from 'node:fs/promises';

const files = ['index.html', 'styles.css', 'app.js', 'timer-utils.js', 'wait-data-utils.js', 'weather-utils.js', 'ride-catalog.js', 'dining-data.js', 'service-worker.js', 'manifest.json'];
const output = 'dist';

try {
  JSON.parse(await readFile('manifest.json', 'utf8'));
} catch {
  throw new Error('manifest.json is not valid JSON.');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(files.map((file) => cp(file, `${output}/${file}`)));
await cp('icons', `${output}/icons`, { recursive: true });
console.log('Built PointPulse to dist/.');
