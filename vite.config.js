// vite.config.js
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import copy from 'rollup-plugin-copy';
import stripCode from 'rollup-plugin-strip-code';
import react from '@vitejs/plugin-react';

const isDevelopment = process.env.npm_lifecycle_script.includes('mode=development');
const enableBundleVisualizer = process.env.ENABLE_BUNDLE_VISUALIZER === 'true';

const developmentVsProductionDefineConfig = isDevelopment ? {
    'Meteor.isDevelopment': JSON.stringify(true),
    'Meteor.isProduction': JSON.stringify(false),
} : {
    'Meteor.isDevelopment': JSON.stringify(false),
    'Meteor.isProduction': JSON.stringify(true),
};

function excludeBlockStrip(excludeConfig) {
    return excludeConfig?.exclude
        ? {
            ...stripCode({
                start_comment: `${excludeConfig.exclude}:start`,
                end_comment: `${excludeConfig.exclude}:end`,
            }),
            enforce: 'pre',
            apply: 'build',
        }
        : undefined;
}

const excludeBlockStripByMode = isDevelopment
    ? excludeBlockStrip({ exclude: 'production' })
    : excludeBlockStrip({ exclude: 'development' });

const clientCommonConfig = {
    main: './ui/main.jsx',
    build: {
        outDir: 'client',
        emptyOutDir: false,
        target: 'modules',
        rollupOptions: {
            input: {
                main: './ui/main.jsx',
            },
            output: {
                entryFileNames: 'client.js',
            },
            external: [
                /^(meteor.*|react|react-dom)/,
            ],
            plugins: [
                copy({ targets: [{ src: './ui/main.html', dest: 'client' }] }),
                enableBundleVisualizer && visualizer({ open: true, filename: 'public/stats.html' }),
            ].filter(Boolean),
        },
        minify: false,
    },
    define: {
        'Meteor.isClient': JSON.stringify(true),
        'Meteor.isServer': JSON.stringify(false),
        'Meteor.isTest': JSON.stringify(false),
        ...developmentVsProductionDefineConfig,
    },
    plugins: [
        react(),
        excludeBlockStrip({ exclude: 'server' }),
        excludeBlockStripByMode,
    ],
};

const serverCommonConfig = {
    main: './api/main.js',
    build: {
        outDir: 'server',
        emptyOutDir: false,
        target: 'modules',
        rollupOptions: {
            input: {
                main: './api/main.js',
            },
            output: {
                entryFileNames: 'server.js',
            },
            external: [
                /^meteor\/.*/,
            ],
            plugins: [
                enableBundleVisualizer && visualizer({ open: true, filename: 'public/stats.html' }),
            ].filter(Boolean),
        },
        polyfillDynamicImport: false,
        minify: false,
    },
    define: {
        'Meteor.isClient': JSON.stringify(true),
        'Meteor.isServer': JSON.stringify(false),
        'Meteor.isTest': JSON.stringify(false),
        ...developmentVsProductionDefineConfig,
    },
    plugins: [
        excludeBlockStrip({ exclude: 'client' }),
        excludeBlockStripByMode,
    ],
};

const clientDevelopmentConfig = {
    ...clientCommonConfig,
};

const serverDevelopmentConfig = {
    ...serverCommonConfig,
};

const clientProductionConfig = {
    ...clientCommonConfig,
    build: {
        ...clientCommonConfig.build,
        minify: true,
    },
};

const serverProductionConfig = {
    ...serverCommonConfig,
    build: {
        ...serverCommonConfig.build,
        minify: true,
    },
};

const target = process.env.TARGET || 'client';

const isClient = target === 'client';
const isServer = target === 'server';

// eslint-disable-next-line import/no-default-export
export default defineConfig(({ mode }) => {
    switch (mode) {
        case 'development':
            if (isClient) return clientDevelopmentConfig;
            if (isServer) return serverDevelopmentConfig;
            return clientDevelopmentConfig;
        case 'production':
            if (isClient) return clientProductionConfig;
            if (isServer) return serverProductionConfig;
            return clientProductionConfig;
        default:
            return clientProductionConfig;
    }
});
