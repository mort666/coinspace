import { execSync } from 'node:child_process';

const { VITE_DISTRIBUTION } = process.env;

if (!['appx', 'appx-dev', 'mac', 'mas', 'mas-dev', 'deb','zip', 'snap', 'flatpak'].includes(VITE_DISTRIBUTION)) {
  console.error(`Unsupported distribution: ${VITE_DISTRIBUTION}`);
  process.exit(1);
}

function forgePlatform(distribution) {
  switch (distribution) {
    case 'mac':
      return 'darwin';
    case 'mas':
    case 'mas-dev':
      return 'mas';
    case 'appx':
    case 'appx-dev':
      return 'win32';
    case 'deb':
    case 'zip':
      return 'linux';
    default:
      return distribution;
  }
}

console.log(`Start build (electron:${VITE_DISTRIBUTION})...`);
execSync(`npm run publish -- --platform=${forgePlatform(VITE_DISTRIBUTION)} --arch=x64`, {
  stdio: [0, 1, 2],
});
console.log(`Done build  (electron:${VITE_DISTRIBUTION})`);
