/**
 * Please refer to the following files in the root directory:
 * 
 * README.md        For information about the package.
 * LICENSE          For license details, copyrights and restrictions.
 */
'use strict';

const { string, syslog, GAError } = require('gajn-framework');
const ImageAssetsHandler = require('./src/assetshandlers/imageAssetsHandler');
const ImgShortcode = require('./src/shortcodes/imgShortcode');
const path = require('path');

module.exports = function(config, options = {}) {

    let imageCfg = {
        exts: ['jpg', 'jpeg', 'png', 'webp'],
        widths: [1920, 1440, 1280, 1024, 768, 640, 480, 320],
        upscaling: false,
        aliases: {
            jpg: 'jpeg'
        },
        formats: {
            png: ['webp', 'png'],
            jpeg: ['webp', 'jpeg'],
            webp: ['webp', 'jpeg'],
        },
        sharp: {
            constructorOptions: {},
            imageTypeOptions: {
                png: {},
                jpeg: {},
                webp: {},
                svg: {},
                avif: {},
            }
        },
        filenameMask: '{fn}-{width}.{ext}',
        generateThumbnail: false,
        thumbnailSize: {
            width: 1280,
            height: 720
        },
        thumbnailFilenameMask: '{fn}-{width}-thumbnail.{ext}',
        genDir: '_generatedImages',
        outputDir: config.asset('_generatedImages'),
        mimes: {
            jpeg: "image/jpeg",
            webp: "image/webp",
            png: "image/png",
            svg: "image/svg+xml",
            avif: "image/avif",       
        },
        generated: new Map(),
        generatedStoreFile: '.generatedImages.json', 
        generatedStorePath: undefined,
    };

    imageCfg.generatedStorePath = path.join(config.sitePath, imageCfg.generatedStoreFile);

    config.assetHandlers.image = imageCfg;

    config.assetHandlers.addHandler('image', new ImageAssetsHandler(config), ['jpg', 'jpeg', 'png', 'webp']);

    config.addNunjucksShortcode('img', ImgShortcode, true);
    syslog.debug(`Added shortcode to Nunjucks: img`);

}
