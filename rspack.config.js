// rspack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const nodeExternals = require('webpack-node-externals');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const rspack = require('@rspack/core');
const { HotModuleReplacementPlugin } = require('@rspack/core');
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');
const path = require('path');
const fs = require('fs');

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
            exclude: /node_modules|dist|\.meteor|\.meteor\/local/,
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
        exclude: /node_modules|\.meteor\/local/,
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

// Function to create HtmlWebpackPlugin instance only for client builds
function createHtmlWebpackPlugin(target) {
    // Skip HtmlWebpackPlugin for server builds
    if (target === 'node') {
        return [];
    }

    // Only use HtmlWebpackPlugin if the template file exists
    return fs.existsSync(path.resolve(__dirname, 'templates/main.html')) ? [
        new HtmlWebpackPlugin({
            template: 'templates/main.html',
            filename: '../client/main.html',
            excludeChunks: ['main'],
            // Set the context to avoid looking in .meteor/local directory
            context: path.resolve(__dirname),
        })
    ] : [];
}

const clientCommonConfig = {
    target: 'web',
    entry: path.resolve(__dirname, 'ui/main.jsx'),
    output: {
        path: path.resolve(__dirname, 'public'),
        // put client.js under public/client/client.js
        filename: 'client/client.js',
        publicPath: '/__rspack__/',
        chunkFilename: 'bundles/[id].[chunkhash].js',
        assetModuleFilename: 'assets/[hash][ext][query]',
    },
    optimization: {
        usedExports: true,
        splitChunks: {
            chunks: 'async',
        },
    },
    module: {
        rules: [
            // Explicitly exclude .meteor/local directory from being processed
            // {
            //     test: /\.meteor\/local/,
            //     exclude: /node_modules/,
            //     use: 'builtin:empty-loader',
            //     sideEffects: false,
            // },
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
        ...createHtmlWebpackPlugin('web'),
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
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'public'),
            publicPath: '/__rspack__/',
        },
        hot: true,
        port: 3005,
        client: {
            webSocketURL: 'ws://localhost:3000/ws'
        }
    },
};

const serverCommonConfig = {
    target: 'node',
    entry: path.resolve(__dirname, 'api/main.js'),
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
            // Explicitly exclude .meteor/local directory from being processed
            {
                test: /\.meteor\/local/,
                use: 'builtin:empty-loader',
                // This ensures that any files in .meteor/local are not processed
                sideEffects: false,
            },
            createSwcConfig(),
            excludeBlockStrip({ exclude: 'client' }),
            excludeBlockStrip({ exclude: 'test' }),
            ...((mode === 'development' ? ([excludeBlockStrip({ exclude: 'production' })]) : [excludeBlockStrip({ exclude: 'development' })])),
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx', '.json'],
        // Explicitly ignore .meteor/local directory
        modules: [
            'node_modules',
            path.resolve(__dirname),
        ],
        // Exclude .meteor/local directory from module resolution
        conditionNames: ['import', 'require', 'node', 'default'],
    },
    externals: [
        /^(meteor.*|react|react-dom)/,
        ...(mode === 'development' ? [ignoreNpmModules] : []),
    ],
    // Explicitly ignore .meteor/local directory
    ignoreWarnings: [
        {
            module: /\.meteor\/local/,
        },
    ],
    // Disable HtmlWebpackPlugin for server builds
    htmlWebpackPluginOptions: false,
    plugins: [
        ...createHtmlWebpackPlugin('node'),
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
    // entry: [
    //     // webpack-hot-middleware client
    //     'webpack-hot-middleware/client?path=/__webpack_hmr&reload=true',
    //     path.resolve(__dirname, 'ui/main.jsx')
    // ],
    output: {
        ...clientCommonConfig.output,
        publicPath: '/__rspack__/',
    },
    devServer: {
        ...clientCommonConfig.devServer,
        client: {
            webSocketURL: 'ws://localhost:3000/ws'
        }
    },
    // Override externals to not exclude React for HMR
    externals: [
        /^meteor.*/,
        ...(mode === 'development' ? [ignoreNpmModules] : []),
    ],
    plugins: [
        ...clientCommonConfig.plugins,
        // new rspack.BannerPlugin({
        //     banner:   'window.__rspack_require__ = __webpack_require__;',
        //     raw:      true,         // inject exactly that string, not wrapped in comments
        //     entryOnly: false        // append to every chunk (so both client.js and chunks get it)
        // }),
        new ReactRefreshPlugin(),          // fast Refresh for React
        new HotModuleReplacementPlugin()   // expose HMR hooks to middleware
    ],
};

const serverDevelopmentConfig = {
    ...serverCommonConfig,
    name: 'server-development',
    mode: 'development',
    // Add additional configuration to prevent HtmlWebpackPlugin from being used
    plugins: [
        ...serverCommonConfig.plugins,
    ],
    // Ensure paths are resolved correctly
    resolve: {
        ...serverCommonConfig.resolve,
        alias: {
            '/server/ui/main.jsx': path.resolve(__dirname, 'ui/main.jsx')
        }
    }
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
    // Ensure paths are resolved correctly
    resolve: {
        ...serverCommonConfig.resolve,
        alias: {
            '/server/ui/main.jsx': path.resolve(__dirname, 'ui/main.jsx')
        }
    }
};

module.exports = [
    clientDevelopmentConfig,
    serverDevelopmentConfig,
    clientProductionConfig,
    serverProductionConfig,
];
