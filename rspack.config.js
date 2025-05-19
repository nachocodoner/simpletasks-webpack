// rspack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const nodeExternals = require('webpack-node-externals');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const rspack = require('@rspack/core');

const enableBundleVisualizer = process.env.ENABLE_BUNDLE_VISUALIZER === 'true';

const configNameIndex = process.argv.findIndex((arg) => arg.startsWith('--config-name'));
const configName = configNameIndex !== -1 ? process.argv[configNameIndex].replace(/--config-name=?/, '') : 'default';

const mode = process.argv.find(_arg => _arg.includes('--mode=production')) ? 'production' : 'development';

// eslint-disable-next-line no-console
console.log('[i] Mode:', mode);
// eslint-disable-next-line no-console
console.log('[i] Config:', configName);

const ignoreNpmModules = nodeExternals({
    modulesFromFile: true,
    allowlist: [/^[./]/],
});

function excludeBlockStrip(excludeConfig) {
    return excludeConfig?.exclude
        ? {
            test: /\.jsx?$/i,
            enforce: 'pre',
            exclude: /node_modules|dist|\.meteor/,
            use: [
                {
                    loader: 'webpack-strip-block',
                    options: {
                        start: `${excludeConfig.exclude}:start`,
                        end: `${excludeConfig.exclude}:end`,
                    },
                },
            ],
        }
        : undefined;
}

function createEsbuildConfig() {
    return {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'esbuild-loader',
        options: {
            target: 'es2015',
        }
    };
}

function createSwcConfig() {
    return {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
            jsc: {
                baseUrl: __dirname,
                paths: {
                    '/*': ['*']
                },
                parser: {
                    syntax: 'ecmascript',
                    jsx: true, // enable if you use JSX
                },
                target: 'es2015', // specify the JavaScript version you want
            },
        }
    };
}

function createCacheStrategy() {
    return {
        cache: true,
        experiments: {
            cache: {
                version: `esbuild-${mode}`,
                type: 'persistent',
                storage: {
                    type: 'filesystem',
                    directory: 'node_modules/.cache/rspack',
                },
            },
        },
    };
}

const watchOptions = {
    ignored: [
        '**/main.html',
        '**/dist/**',
        '**/.meteor/local/**',
        '**/public/bundles/**',
        '**/node_modules/**',
        '**/node_modules/.cache/**',
    ],
};

const clientCommonConfig = {
    target: 'web',
    entry: './ui/main.jsx',
    output: {
        path: `${__dirname}/public`,
        filename: ({ chunk }) => (chunk?.name === 'main' ? '../client/client.js' : '../client/[name].js'),
        libraryTarget: 'commonjs',
        publicPath: '/',
        chunkFilename: 'bundles/[id].[chunkhash].js',
        assetModuleFilename: 'public/assets/[hash][ext][query]',
    },
    optimization: {
        usedExports: true,
        splitChunks: {
            chunks: 'async',
        },
    },
    module: {
        rules: [
            createSwcConfig(),
            excludeBlockStrip({ exclude: 'server' }),
            excludeBlockStrip({ exclude: 'test' }),
            ...((mode === 'development' ? ([excludeBlockStrip({ exclude: 'production' })]) : [excludeBlockStrip({ exclude: 'development' })])),
        ].filter(Boolean),
    },
    resolve: {
        extensions: ['.js', '.jsx', '.json'],
    },
    externals: [
        /^(meteor.*|react|react-dom)/,
        ...(mode === 'development' ? [ignoreNpmModules] : []),
    ],
    plugins: [
        new HtmlWebpackPlugin({
            template: 'templates/main.html',
            filename: '../client/main.html',
            excludeChunks: ['main'],
        }),
        new rspack.DefinePlugin({
            'Meteor.isClient': JSON.stringify(true),
            'Meteor.isServer': JSON.stringify(false),
            'Meteor.isTest': JSON.stringify(false),
            ...(mode === 'development' ? {
                'Meteor.isDevelopment': JSON.stringify(true),
                'Meteor.isProduction': JSON.stringify(false),
            } : {
                'Meteor.isDevelopment': JSON.stringify(false),
                'Meteor.isProduction': JSON.stringify(true),
            }),
        }),
        ...(enableBundleVisualizer ? [new BundleAnalyzerPlugin({ analyzerPort: 8888 })] : []),
    ],
    watchOptions,
    devtool: 'cheap-source-map',
    ...createCacheStrategy(),
};

const serverCommonConfig = {
    target: 'node',
    entry: './api/main.js',
    output: {
        path: `${__dirname}/server`,
        filename: 'server.js',
        libraryTarget: 'commonjs',
        assetModuleFilename: 'public/assets/[hash][ext][query]',
    },
    optimization: {
        usedExports: true,
    },
    module: {
        rules: [
            createSwcConfig(),
            excludeBlockStrip({ exclude: 'client' }),
            excludeBlockStrip({ exclude: 'test' }),
            ...((mode === 'development' ? ([excludeBlockStrip({ exclude: 'production' })]) : [excludeBlockStrip({ exclude: 'development' })])),
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx', '.json'],
    },
    externals: [
        /^(meteor.*|react|react-dom)/,
        ...(mode === 'development' ? [ignoreNpmModules] : []),
    ],
    plugins: [
        new rspack.DefinePlugin({
            'Meteor.isServer': JSON.stringify(true),
            'Meteor.isClient': JSON.stringify(false),
            'Meteor.isTest': JSON.stringify(false),
            ...(mode === 'development' ? {
                'Meteor.isDevelopment': JSON.stringify(true),
                'Meteor.isProduction': JSON.stringify(false),
            } : {
                'Meteor.isDevelopment': JSON.stringify(false),
                'Meteor.isProduction': JSON.stringify(true),
            }),
        }),
        ...(enableBundleVisualizer ? [new BundleAnalyzerPlugin({ analyzerPort: 8889 })] : []),
    ].filter(Boolean),
    watchOptions,
    devtool: 'cheap-source-map',
    ...createCacheStrategy(),
};

const clientDevelopmentConfig = {
    ...clientCommonConfig,
    name: 'client-development',
    mode: 'development',
};

const serverDevelopmentConfig = {
    ...serverCommonConfig,
    name: 'server-development',
    mode: 'development',
};

const clientProductionConfig = {
    ...clientCommonConfig,
    name: 'client-production',
    mode: 'production',
    devtool: false,
};

const serverProductionConfig = {
    ...serverCommonConfig,
    name: 'server-production',
    mode: 'production',
    devtool: false,
};

module.exports = [
    clientDevelopmentConfig,
    serverDevelopmentConfig,
    clientProductionConfig,
    serverProductionConfig,
];
