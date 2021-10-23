/**
 * Please refer to the following files in the root directory:
 * 
 * README.md        For information about the package.
 * LICENSE          For license details, copyrights and restrictions.
 */
'use strict';

const path = require('path');
const { syslog, NunjucksShortcode, GAError, ImageHtml, merge } = require('gajn-framework'); 

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
        let files = this._findFiles(url);

        let opts = {
            lazyload: this.config.lazyload,
            figureClass: this.config.figureClass
        }

        let ret = '';
        let imgHtml = new ImageHtml(opts, this.config.hostname);

        let sources = this.formatFilesArray(files);

        let imageOpts = this.config.assetHandlers.image;
        if (!imageOpts.generated.has(url)) {
            throw new NunjucksShortcodeImgError(`No generated files for URL: ${url}`);
        }

        let generated = imageOpts.generated.get(url) || null;
        let sel = generated.files[0];
        let w = sel.width;
        let h = sel.height;
        syslog.error(`${w}/${h} = ${w/h}`);

        ret = imgHtml.render(sources, args[1], true);

        let imgs = imgHtml.metaIds;
        if (imgs.length > 0) {
            if (!this.config.imagesSaved) {
                this.config.imagesSaved = {};
            }
            if (this.config.imagesSaved[context.ctx.permalink]) {
                this.config.imagesSaved[context.ctx.permalink] = 
                    merge.merge(this.config.imagesSaved[context.ctx.permalink], imgs);
            } else {
                this.config.imagesSaved[context.ctx.permalink] = imgs;
            }
        }

        return ret;

    }
}
 
module.exports = ImgShortcode;
 