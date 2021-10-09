/**
 * Please refer to the following files in the root directory:
 * 
 * README.md        For information about the package.
 * LICENSE          For license details, copyrights and restrictions.
 */
'use strict';

const { fsutils, GAError, syslog, mkdirRecurse } = require('gajn-framework');
const path = require('path');
const fs = require('fs');
const imageSize = require("image-size");
const sharp = require('sharp');
const deasync = require("deasync");

class StaticoImageAssetsHandlerError extends GAError {}
 
 /**
  * Image template handler.
  */
 class ImageAssetsHandler
 {
    /**
     * Constructor.
     * 
     * @param   {Config}    config      Global config object.
     * 
     * @return  {ImageAssetHandler}
     */
    constructor(config)
    { 
        this.config = config;
        this.loadGenerated();
    }

    /**
     * Load the generated store.
     * 
     * @return  {ImageAssetHandler}
     */
    loadGenerated()
    {
        if (this.config.assetHandlers.image.generatedStorePath) {
            if (fs.existsSync(this.config.assetHandlers.image.generatedStorePath)) {
                let serialised = fs.readFileSync(this.config.assetHandlers.image.generatedStorePath, 'utf8');
                this.config.assetHandlers.image.generated = new Map(JSON.parse(serialised));
            }
        }
        return this;
    }

    /**
     * Save the generated store.
     * 
     * @return  {ImageAssetHandler}
     */
    saveGenerated()
    {
        if (this.config.assetHandlers.image.generatedStorePath) {
            let serialised = JSON.stringify(Array.from(this.config.assetHandlers.image.generated.entries()));
            fs.writeFileSync(this.config.assetHandlers.image.generatedStorePath, serialised, 'utf8');
        }
        return this;
    }

    /**
     * Calculate the new sise to maintain aspect ratio.
     * 
     * @param   {number}    srcWidth        Image width
     * @param   {number}    srcHeight       Image height
     * @param   {boolean}   allowUpscale    Allow sizing upwards?
     * @param   {number}    maxWidth        Max width
     * @param   {number}    maxHeight       Max height
     * 
     * @return  {number[]}
     */
    aspectResize(srcWidth, srcHeight, allowUpscale = false, maxWidth = 1280, maxHeight = 720)
    {
        let resizeWidth  = srcWidth;
        let resizeHeight = srcHeight;
  
        let aspect = resizeWidth / resizeHeight;
        let scaleX = maxWidth / srcWidth;
        let scaleY = maxHeight / srcHeight;
        let scale  = Math.min(scaleX, scaleY);
  
        resizeWidth *= scale;
        resizeHeight *= scale;
  
        if (resizeWidth > maxWidth) {
            resizeWidth  = maxWidth;
            resizeHeight = resizeWidth / aspect;
        }
  
        if (resizeHeight > maxHeight) {
            aspect       = resizeWidth / resizeHeight;
            resizeHeight = maxHeight;
            resizeWidth  = resizeHeight * aspect;
        }

        if (!allowUpscale) {
            if (resizeWidth > srcWidth) {
                resizeWidth = srcWidth;
                resizeHeight = resizeWidth / aspect;
            }

            if (resizeHeight > srcHeight) {
                aspect = resizeWifth / resizeHeight;
                resizeHeight = srcHeight;
                resizeWidth = resizeHeight * aspect;
            }
        }
  
        return [
            Math.round(resizeWidth),
            Math.round(resizeHeight)
        ];
    }

    /**
     * Resize an image.
     * 
     * @param   {string}    src             Filepath to source image.
     * @param   {number}    requiredWidth   Width wanted.
     * @param   {string}    requiredFormat  Format required.
     * @param   {string}    outputPath      Output path.
     * @param   {object}    opts            Options.
     * 
     * @return
     */
    async resizeImage(src, requiredWidth, requiredFormat, outputPath, opts)
    {
        // Construct sharp.
        let sharper = sharp(src, opts.sharp.constructorOptions);

        // Resize image.
        sharper.resize({width: requiredWidth});

        // To a particular format.
        sharper.toFormat(requiredFormat, opts.sharp.imageTypeOptions[requiredFormat]);

        // Make the directory.
        fsutils.mkdirRecurse(path.dirname(outputPath));

        await sharper.toFile(outputPath).then(info => {
            syslog.debug(`Wrote image file: ${outputPath.replace(this.config.sitePath, '')}`, 'AssetsHandler:Image');
        })
        .catch(err => {
            syslog.error(`Failed to create ${outputPath}: ${err.message}.`);
        });

    }
 
    /**
     * Process a file.
     * 
     * @param   {string}    filePath    Path to file to process.
     * @param   {boolean}   skip        Skip processing?
     * 
     * @return
     */
    async process(filePath, skip = false)
    {
        // Grab the options.
        let options = this.config.assetHandlers.image;

        // Extract bits of the sourse path.
        let absPath = filePath;
        let relPath = absPath.replace(this.config.sitePath, '');
        let basename = path.basename(relPath, path.extname(relPath));
        let ext = path.extname(relPath).substring(1);
        let op = path.join(this.config.sitePath, options.outputDir, path.dirname(relPath));

        if (!skip) {

            // Aliases?
            if (options.aliases && options.aliases[ext]) {
                ext = options.aliases[ext];
            }

            // Image dimensions.
            let dims = imageSize(absPath);
            let srcWidth = dims.width;
            let srcHeight = dims.height;

            //let op = path.join(this.config.outputPath, userOptions.output, path.basename(fp, path.extname(fp)) + '.css');
            syslog.trace(`Image template handler is processing file: ${relPath}`, 'AssetsHandler:Image');
            syslog.trace(`Source image size is ${srcWidth} x ${srcHeight}.`, 'AssetsHandler:Image');
            syslog.trace(`Will output images to ${op}.`, 'AssetsHandler:Image');

            let generated = {
                files: []
            }

            await Promise.all(options.formats[ext].map(async outputFormat => {
                let processedSomething = false;
                await Promise.all(options.widths.map(async outputWidth => {
                    if (srcWidth >= outputWidth || options.allowUpscale === true) {
                        let outputLoc = path.join(op, 
                            options.filenameMask.replace('{fn}', basename)
                                .replace('{width}', outputWidth)
                                .replace('{ext}', outputFormat));
                        processedSomething = true;
                        syslog.trace(`Processing ${relPath} at ${outputWidth} (srcWidth = ${srcWidth}), format ${outputFormat}`, 'AssetsHandler:Image');
                        syslog.trace(`===> will output to ${outputLoc}`, 'AssetsHandler:Image');
                        await this.resizeImage(absPath, outputWidth, outputFormat, outputLoc, options);
                        generated.files.push({file: outputLoc, width: outputWidth, format: outputFormat});
                    } else {
                        syslog.trace(`Skipping ${relPath} because ${outputWidth} < ${srcWidth}, format ${outputFormat}`, 'AssetsHandler:Image');
                    }

                }));

                // If we processed nothing then just render at the source width.
                if (!processedSomething) {
                    let outputLoc = path.join(op, 
                        options.filenameMask.replace('{fn}', basename)
                            .replace('{width}', srcWidth)
                            .replace('{ext}', outputFormat));
                    syslog.trace(`Default processing ${relPath} at ${srcWidth}, format ${outputFormat}`, 'AssetsHandler:Image');
                    syslog.trace(`===> will output to ${outputLoc}`, 'AssetsHandler:Image');
                    await this.resizeImage(absPath, srcWidth, outputFormat, outputLoc, options);
                    generated.files.push({file: outputLoc, width: srcWidth, format: outputFormat});
                }

                // Thumbnail?
                if (options.generateThumbnail) {
                    let [widthWanted, heightWanted] = this.aspectResize(srcWidth, srcHeight, options.allowUpscale, 
                        options.thumbnailSize.width, options.thumbnailSize.height);
                    let outputLoc = path.join(op, 
                        options.thumbnailFilenameMask.replace('{fn}', basename)
                            .replace('{width}', widthWanted)
                            .replace('{ext}', outputFormat));
                    syslog.trace(`Processing ${relPath} at ${widthWanted}, format ${outputFormat}`, 'AssetsHandler:Image');
                    syslog.trace(`===> will output to ${outputLoc}`, 'AssetsHandler:Image');
                    await this.resizeImage(absPath, widthWanted, outputFormat, outputLoc, options);
                }        
            }));

            // Save generated.
            options.generated.set(relPath, generated);
            this.saveGenerated();
        }

        // Copy the file too.
        let opc = path.join(this.config.outputPath, absPath.replace(this.config.sitePath, ''));

        fsutils.mkdirRecurse(path.dirname(opc));
        syslog.warning(`${absPath} => ${opc}`);
        fsutils.copyFile(absPath, opc);

    }
 
  }
 
 module.exports = ImageAssetsHandler;
 