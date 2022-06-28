const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require('terser-webpack-plugin');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = (nodeEnv === 'production');
const libraryName = process.env.npm_package_name;

module.exports = {
  mode: nodeEnv,
  context: path.resolve(__dirname, 'src'),
  // Disabled by default on production
  cache: true,
  optimization: {
    minimize: isProd,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress:{
            drop_console: true,
          }
        }
      }),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: `${libraryName}.css`
    }),
  ],
  entry: {
    dist: "./entries/dist.js"
  },
  output: {
    filename: `${libraryName}.js`,
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.(s[ac]ss|css)$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: ''
            }
          },
          {
            loader: "css-loader"
          },
          {
            loader: "sass-loader"
          }
        ]
      },
      {
        test: /\.eot|\.woff2|\.woff|\.ttf$/,
        include: path.join(__dirname, 'src/fonts'),
        type: 'asset/resource'
      },
      {
        test: /\.(svg)$/,
        include: path.join(__dirname, 'src/gui'),
        type: 'asset/resource'
      }
    ]
  },
  stats: {
    colors: true,
    children: true,
    errorDetails: true
  },
  externals: {
    jquery: 'H5P.jQuery'
  },
  devtool: (isProd) ? undefined : 'eval-cheap-module-source-map'
};