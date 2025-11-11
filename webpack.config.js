const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')

module.exports = (env, argv) => ({
  entry: ['./src/polyfills.js', './src/components/App.js'],

  output: {
    filename: 'bundle.js',
    path: __dirname
  },

  devtool:
    argv.mode === 'production' ? 'source-map' : 'eval-cheap-module-source-map',
  target: 'electron-renderer',

  node: {
    __dirname: false,
    __filename: false
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react/jsx-runtime': 'preact/jsx-runtime'
    },
    fallback: {
      crypto: require.resolve('crypto-browserify')
    },
    extensions: ['.js', '.jsx', '.css']
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },

  plugins: [
    // 复制i18n目录到输出目录
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'i18n'),
          to: 'i18n'
        }
      ]
    })
  ],

  externals: {
    '@sabaki/i18n': 'require("@sabaki/i18n")',
    'cross-spawn': 'null',
    'iconv-lite': 'require("iconv-lite")',
    moment: 'null',
    'node:crypto': 'crypto',
    'copy-webpack-plugin': 'require("copy-webpack-plugin")'
  }
})
