import fs from 'fs/promises';
import path from 'path';
import { execFileSync } from 'node:child_process';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const isMac = process.platform === 'darwin';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: ['icons'],
    name: 'OpenConduit',
    executableName: 'openconduit',
    icon: 'icons/icon', // .icns on macOS, .ico on Windows, .png on Linux
    ...(isMac && process.env.APPLE_IDENTITY && {
      osxSign: {
        identity: process.env.APPLE_IDENTITY,
        optionsForFile: () => ({
          entitlements: 'entitlements.plist',
          entitlementsInherit: 'entitlements.plist',
          hardenedRuntime: true,
        }),
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID!,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
    }),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'openconduit',
      setupIcon: 'icons/favicon.ico',
      iconUrl: 'https://raw.githubusercontent.com/OpenConduit/Client/main/icons/favicon.ico',
    }, ['win32']),
    // ZIP for macOS — required by update.electronjs.org auto-update service.
    // Produces: OpenConduit-{version}-darwin-{arch}.zip
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      icon: 'icons/icon.icns',
      format: 'ULFO',
    }, ['darwin']),
    new MakerRpm({
      options: {
        icon: 'icons/icon-512x512.png',
      },
    }, ['linux']),
    new MakerDeb({
      options: {
        icon: 'icons/icon-512x512.png',
      },
    }, ['linux']),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    // Inject Sentry debug IDs into the bundled main + renderer JS and upload the
    // source maps using the lightweight sentry-cli (a Rust binary). This replaces
    // the in-process @sentry/vite-plugin, which held the entire decoded source-map
    // graph in the Node heap and OOM-killed the renderer build on memory-limited
    // CI runners. Runs after Vite output is copied into the app dir but before asar
    // packaging, so the shipped JS carries debug IDs; the .map files are stripped
    // afterwards so they never ship inside app.asar.
    packageAfterCopy: async (_cfg, buildPath: string) => {
      if (!process.env.SENTRY_AUTH_TOKEN) return; // skip local/dev builds
      const viteDir = path.join(buildPath, '.vite');
      try {
        await fs.access(viteDir);
      } catch {
        return; // no Vite output to process
      }
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const release = process.env.npm_package_version;
      const run = (args: string[]) =>
        execFileSync(npx, ['sentry-cli', ...args], { stdio: 'inherit' });
      run(['sourcemaps', 'inject', viteDir]);
      run([
        'sourcemaps', 'upload',
        '--org', 'openconduit',
        ...(process.env.SENTRY_PROJECT ? ['--project', process.env.SENTRY_PROJECT] : []),
        ...(release ? ['--release', release] : []),
        viteDir,
      ]);
      // Strip source maps so they aren't packaged into app.asar.
      const entries = await fs.readdir(viteDir, { recursive: true });
      await Promise.all(
        entries
          .filter((f): f is string => typeof f === 'string' && f.endsWith('.map'))
          .map((f) => fs.rm(path.join(viteDir, f), { force: true })),
      );
    },
    // Rename Squirrel outputs so x64 and arm64 assets don't collide on the
    // GitHub release page and the auto-updater can find the right RELEASES file.
    postMake: async (_cfg, results) => {
      for (const result of results) {
        if (result.platform !== 'win32') continue;
        const { arch, packageJSON: { version } } = result;
        for (let i = 0; i < result.artifacts.length; i++) {
          const artifact = result.artifacts[i];
          const dir = path.dirname(artifact);
          const base = path.basename(artifact);
          let newBase: string | null = null;
          if (base === 'RELEASES') {
            newBase = `RELEASES-${arch}`;
          } else if (base.endsWith('Setup.exe')) {
            newBase = `OpenConduit-win32-${arch}-${version}.exe`;
          }
          if (newBase) {
            const newPath = path.join(dir, newBase);
            await fs.rename(artifact, newPath);
            result.artifacts[i] = newPath;
          }
        }
      }
      return results;
    },
  },
};

export default config;
