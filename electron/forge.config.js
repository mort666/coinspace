import appxmanifest from './support/appxmanifest.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import setLanguages from 'electron-packager-languages';
const schemes = [
  'coinspace',
  ...(await import('./dist/schemes.js')).default.map((item) => item.scheme),
];
import { languages } from '../web/src/lib/i18n/languages.js';
const pkg = JSON.parse(await fs.readFile('./package.json'));

const { VITE_DISTRIBUTION } = process.env;
const BRANCH = process.env.GITHUB_REF && process.env.GITHUB_REF.replace('refs/heads/', '');

if (!['appx', 'appx-dev', 'mac', 'mas', 'mas-dev', 'snap', 'deb', 'zip', 'flatpak'].includes(VITE_DISTRIBUTION)) {
  throw new Error(`Unsupported distribution: '${VITE_DISTRIBUTION}'`);
}

let buildVersion = pkg.version;

if (VITE_DISTRIBUTION === 'mas' && process.env.GITHUB_RUN_NUMBER) {
  buildVersion = `1.1.${process.env.GITHUB_RUN_NUMBER}`;
}

const appxVersion = `${pkg.version}.${VITE_DISTRIBUTION === 'appx' ? '0' : (process.env.GITHUB_RUN_NUMBER || '0')}`;

const protocols = {
  name: pkg.productName,
  schemes,
};
const appxPackageName = VITE_DISTRIBUTION === 'appx' ? 'CoinWallet' : 'CoinWalletDev';

export default {
  packagerConfig: {
    appVersion: pkg.version,
    buildVersion,
    //asar: true,
    icon: 'resources/icon',
    executableName: ['appx', 'appx-dev'].includes(VITE_DISTRIBUTION) ? pkg.productName : pkg.executableName,
    ignore: [
      /README.md/i,
      /HISTORY.md/i,
      /CHANGELOG.md/i,
      '^/(?!electron.js|package.json|lib|dist|resources|node_modules)',
      ['appx', 'appx-dev', 'snap', 'zip', 'deb', 'flatpak'].includes(VITE_DISTRIBUTION) ? '^/resources/(?!64x64.png)' : '^/resources',
      'Makefile',
      '.editorconfig',
      '.gitignore',
      '.gitattributes',
      '.nvmrc',
      '.npmignore',
      '.nycrc',
      '.jsfmtrc',
      '.eslintrc',
      '.eslintignore',
      '.github',
      '.coveralls.yml',
      '.istanbul.yml',
      '.jscs.json',
      'Thumbs.db',
    ],
    appBundleId: 'com.coinspace.wallet',
    appCategoryType: 'public.app-category.finance',
    extendInfo: {
      LSMinimumSystemVersion: '11.0',
      NSCameraUsageDescription: 'This app uses the camera to scan QR codes.',
      ...(['mas', 'mas-dev'].includes(VITE_DISTRIBUTION) ? {} : {
        NSLocationUsageDescription: 'Turn on location services to send or receive coins with people around you.',
      }),
    },
    osxSign: {
      type: VITE_DISTRIBUTION === 'mas-dev' ? 'development' : 'distribution',
      provisioningProfile: ['mas', 'mas-dev'].includes(VITE_DISTRIBUTION) ? 'embedded.provisionprofile' : undefined,
      optionsForFile(filePath) {
        if (VITE_DISTRIBUTION === 'mac') {
          let entitlements = 'resources/entitlements.mac.plist';
          if (filePath.includes('(Plugin).app')) {
            entitlements = 'resources/entitlements.mac.plugin.plist';
          } else if (filePath.includes('(GPU).app')) {
            entitlements = 'resources/entitlements.mac.gpu.plist';
          } else if (filePath.includes('(Renderer).app')) {
            entitlements = 'resources/entitlements.mac.renderer.plist';
          }
          return {
            hardenedRuntime: true,
            entitlements,
          };
        }
        if (['mas', 'mas-dev'].includes(VITE_DISTRIBUTION)) {
          const entitlements = filePath.includes('.app/')
            ? 'resources/entitlements.mas.inherit.plist'
            : 'resources/entitlements.mas.plist';
          return {
            hardenedRuntime: false,
            entitlements,
          };
        }
      },
    },
    osxNotarize: (VITE_DISTRIBUTION === 'mac' && process.env.APPLE_ID && process.env.APPLE_PASSWORD) ? {
      tool: 'notarytool',
      appBundleId: 'com.coinspace.wallet',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    } : undefined,
    protocols,
    afterCopy: [
      ...(['mac', 'mas', 'mas-dev'].includes(VITE_DISTRIBUTION) ? [setLanguages(languages.map((lang) => {
        return lang.value.replace('-', '_').replace(/_[a-z]+/, s => s.toUpperCase());
      }))] : []),
      ...(['appx', 'appx-dev'].includes(VITE_DISTRIBUTION) ? [appxmanifest({
        packageVersion: appxVersion,
        identityName: VITE_DISTRIBUTION === 'appx' ? process.env.APPX_IDENTITY : pkg.executableName,
        packageName: appxPackageName,
        packageDescription: pkg.description,
        //packageDisplayName: process.env.APPX_PACKAGE_NAME,
        packageDisplayName: pkg.productName,
        publisherName: VITE_DISTRIBUTION === 'appx' ? process.env.APPX_PUBLISHER : process.env.APPX_PUBLISHER_DEV,
        publisherDisplayName: process.env.APPX_PUBLISHER_NAME,
        packageExecutable: `app\\${pkg.productName}.exe`,
        languages: languages.map((lang) => {
          // https://docs.microsoft.com/en-us/windows/uwp/publish/supported-languages
          switch (lang.value) {
            case 'sr':
              return 'sr-Latn';
            default:
              return lang.value;
          }
        }),
        protocols,
      })] : []),
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: [
        'linux',
      ],
    },
    {
    name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'rtlabs',
          homepage: 'https://rtlabs.tech',
          icon: 'resources/icon.icns',
        }
      }
    },
    VITE_DISTRIBUTION === 'flatpak' && {
      name: '@electron-forge/maker-flatpak',
      config: {
        options: {
          id: 'space.coin.wallet',
          bin: pkg.executableName,
          productName: pkg.productName,
          genericName: 'Wallet',
          description: pkg.description,
          categories: ['Office', 'Finance'],
          icon: {
            scalable: 'resources/icon.svg',
          },
          runtimeVersion: '24.08',
          // Available versions: https://github.com/flathub/org.electronjs.Electron2.BaseApp/
          baseVersion: '24.08',
          modules: [{
            name: 'zypak',
            sources: [{
              type: 'git',
              url: 'https://github.com/refi64/zypak',
              tag: 'v2024.01.17',
            }],
          }],
          finishArgs: [
            // X Rendering
            '--socket=x11', '--socket=wayland', '--share=ipc',
            // OpenGL
            '--device=dri',
            // Audio output
            '--socket=pulseaudio',
            // Read/write home directory access
            '--filesystem=home',
            // Chromium uses a socket in tmp for its singleton check
            '--env=TMPDIR=/var/tmp',
            // Allow communication with network
            '--share=network',
            // System notifications with libnotify
            '--talk-name=org.freedesktop.Notifications',
            // USB and webcam
            '--device=all',
          ],
          mimeType: schemes.map((scheme) => `x-scheme-handler/${scheme}`),
        },
        rename(dest/*, src*/) {
          return path.join(dest, `${pkg.productName}.flatpak`);
        },
      },
    },
  ].filter(item => !!item),
  publishers: [
    ['mac', 'flatpak'].includes(VITE_DISTRIBUTION) && BRANCH === 'master' && {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'CoinSpace',
          name: 'CoinSpace',
        },
        draft: true,
        force: true,
      },
    },
    {
      name: '@electron-forge/publisher-gcs',
      config: {
        bucket: process.env.GOOGLE_CLOUD_BUCKET,
        keyResolver(fileName/*, platform, arch*/) {
          const dir = `${pkg.version}-${BRANCH || 'local'}`;
          return `${dir}/${fileName}`;
        },
        public: false,
      },
    },
  ].filter(item => !!item),
};
