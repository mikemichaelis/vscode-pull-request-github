/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require('path');

module.exports = {
	entry: {
		index: './preview-src/index.ts'
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/
			},
			{
				test: /\.css/,
				use: ['style-loader', 'css-loader']
			}
		]
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js']
	},
	devtool: 'inline-source-map',
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'media')
	}
};