/**
 * Please refer to the following files in the root directory:
 * 
 * README.md        For information about the package.
 * LICENSE          For license details, copyrights and restrictions.
 */
'use strict';

const path = require('path');
const { syslog, NunjucksShortcode, GAError, ImageHtml, merge, ComplexImage } = require('js-framework'); 

class NunjucksShortcodeImgError extends GAError {}

/**
 * Img shortcode class.
 */
class ImgShortcode extends NunjucksShortcode
{
    /**
     * Find files.
     */
    _findFiles(url)
    {
        let imageOpts = this.config.assetHandlers.image;

        let base = path.basename(url, path.extname(url));
        //let targetUrlStart = path.join(imageOpts.outputDir, path.dirname(url), base);

        if (!imageOpts.generated.has(url)) {
            throw new NunjucksShortcodeImgError(`No generated files for URL: ${url}`);
        }

        let ret = [];
        for (let item of imageOpts.generated.get(url).files) {
            if (!ret[item.format]) {
                ret[item.format] = [];
            }
            let f = item.file.replace(this.config.sitePath, '');
            if ('/' != f[0]) {
                f = '/' + f;
            }
            ret[item.format].push(f);
        }

        return ret;
    }

    /**
     * Format the files array.
     */
    formatFilesArray(files)
    {
        let sources = [];
        for (let t in files) {
            let m = this.config.assetHandlers.image.mimes[t];
            sources[m] = [];
            for (let f of files[t]) {
                let parts = f.split('-');
                let lastbit = parts.pop();
                let parts2 = lastbit.split('.');
                let width = parts2[0];
                
                sources[m].push(`${f} ${width}w`);
            }
        }

        return sources;
    }

    /**
     * Get a 'source' constuct.
     */
    getSourceConstruct(filesArr, srcsetName, extra, mime, type = 'source')
    {
        let ret = `<${type} `;

        let sources = '';
        for (let f of filesArr) {
            let parts = f.split('-');
            let lastbit = parts.pop();
            let parts2 = lastbit.split('.');
            let width = parts2[0];
            
            if ('' != sources) {
                sources += ', ';
            }

            sources += `${f} ${width}w`;
        }

        ret += `${srcsetName} ="${sources}" ${extra}`;
        if ('source' == type) {
            ret += `type="${this.config.assetHandlers.image.mimes[mime]}"`;
        }
        if (srcsetName.startsWith('data')) {
            ret += ` data-sizes="auto"`;
        }
        ret += ' />';

        return ret;
    }
 
    /**
     * Render.
     * 
     * @param   {object}    context     URL.
     * @param   {Array}     args        Other arguments.
     * 
     * @return  {string}
     */
    render(context, args)
    {
        let url = args[0];
        //let files = this._findFiles(url);

        let opts = {
            lazyload: this.config.lazyload,
            figureClass: this.config.figureClass
        }

        let imgSpec = {};

        for (let argnum of [1,2]) {
            let argdata = args[argnum];
            if (null === argdata) {
                continue;
            }
            if("object" === typeof(argdata)) {
                for (let key in argdata) {
                    imgSpec[key] = argdata[key];
                }
            } else if ("string" === typeof(argdata)) {
                let sp = argdata.trim().split('|');
                for (let subdata of sp) {
                    if (-1 !== subdata.indexOf('=')) {
                        let ds = subdata.split('=');
                        if (!ds[0].trim().startsWith('__')) {
                            imgSpec[ds[0].trim()] = ds[1].trim();
                        }
                    } else {
                        if (!subdata.trim().startsWith('__')) {
                            imgSpec[subdata.trim()] = true;
                        }
                    }
                }
            }
        } 


        let ret = '';
        //let imgHtml = new ImageHtml(this.config.assetHandlers.image, this.config.hostname);
        let imgHtml = new ComplexImage(this.config.lazyload, this.config.figureClass, this.config.sitePath, 
            this.config.hostname, this.config.assetHandlers.image);

        //let sources = this.formatFilesArray(files);

        let imageOpts = this.config.assetHandlers.image;
        if (!imageOpts.generated.has(url)) {
            throw new NunjucksShortcodeImgError(`No generated files for URL: ${url}`);
        }

        let generated = imageOpts.generated.get(url);
        /*
        let sel = generated.files[0];
        let w = sel.width;
        let h = sel.height;
        */

        ret = imgHtml.render(generated, imgSpecs, url);

        let imgs = imgHtml.metaIds;
        if (imgs.length > 0) {
            if (!this.config.imagesSaved) {
                this.config.imagesSaved = {};
            }
            if (!this.config.imagesSaved[context.ctx.permalink]) {
                this.config.imagesSaved[context.ctx.permalink] = [];
            }
            for (let item of imgs) {
                if (!this.config.imagesSaved[context.ctx.permalink].includes(item)) {
                    this.config.imagesSaved[context.ctx.permalink].push(item);
                }
            }
        }

        return ret;

    }
}
 
module.exports = ImgShortcode;
 