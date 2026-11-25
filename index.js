import { clone, find, fromPairs, last, map, merge, reduce, uniq } from 'lodash';

class Helpers {
  constructor(config = {}, options = {}) {
    this.config = config;

    this.options = Object.assign(
      {
        groupSize: 2,
        termAttr: 'title',
        termParentDepth: 0,
        termPrefix: '',
      },
      options
    );
  }

  static _groupEntities(entities, groupSize = Infinity) {
    const grouped = [];

    let group = [];

    entities.forEach((entity) => {
      entity = clone(entity);

      if (!entity.groupBefore || group.length >= groupSize) {
        group = [];
      }

      group.push(entity);

      if (!entity.groupAfter || group.length >= groupSize) {
        group.ratio = 0;

        group.forEach((entity) => {
          group.ratio += (entity.thumbnail || entity).ratio;
        });

        group.forEach((entity) => {
          entity.groupRatio = (entity.thumbnail || entity).ratio / group.ratio;
        });

        grouped.push(group);
      }
    });

    return grouped;
  }

  groupEntities(entities, groupSize) {
    return Helpers._groupEntities(
      entities,
      groupSize || this.options.groupSize
    );
  }

  static _getTerms(
    taxonomyField,
    termAttr = 'title',
    termParentDepth = 0,
    termPrefix = ''
  ) {
    const terms = [];

    if (!taxonomyField) {
      return terms;
    }

    if (taxonomyField.terms) {
      taxonomyField.terms.forEach((term) => {
        if (termParentDepth > 0 && term.parents) {
          term.parents.forEach((parent, i) => {
            if (i < termParentDepth) {
              terms.push(parent[termAttr]);
            }
          });
        }

        terms.push(term[termAttr]);
      });
    }

    return uniq(terms).map((term) => termPrefix + term);
  }

  getTerms(taxonomyField, termAttr, termParentDepth, termPrefix) {
    return Helpers._getTerms(
      taxonomyField,
      termAttr || this.options.termAttr,
      termParentDepth || this.options.termParentDepth,
      termPrefix || this.options.termPrefix
    );
  }

  thumbnailSrc(
    thumbnail,
    settings,
    {
      noCache = undefined,
      noRedirect = undefined,
      cropSlug = undefined,
      cropFallback = undefined,
    } = {}
  ) {
    if (!thumbnail) {
      return undefined;
    }

    if (typeof settings === 'string') {
      // Convert settings to object
      settings = reduce(
        settings.split(/,|;/),
        (settingsObj, setting) =>
          merge(settingsObj, fromPairs([setting.split(/_|:/)])),
        {}
      );
    }

    if (cropSlug) {
      const crop = thumbnail.crops ? thumbnail.crops[cropSlug] : null;
      if (crop) {
        settings.x = crop[0];
        settings.y = crop[1];
        settings.x2 = crop[2];
        settings.y2 = crop[3];
      } else if (cropFallback) {
        settings.g = cropFallback;
      }
    }

    // Convert settings to string
    const settingsString = map(
      settings,
      (value, key) => `${key}:${value}`
    ).join(';');

    let query = [
      noCache ? 'noCache' : undefined,
      noRedirect ? 'noRedirect' : undefined,
    ].filter((option) => option !== undefined);

    query = `${query.length ? '?' : ''}${query.join('&')}`;

    if (/(image)/.test(thumbnail.type)) {
      if (thumbnail.ext === '.svg' && !settings.f) {
        return `${this.config.assistUrl}/${this.config.slug}/${
          thumbnail.name + thumbnail.ext
        }${query}`;
      }

      return `${this.config.assistUrl}/${
        this.config.slug
      }/transform/${settingsString}/${thumbnail.name + thumbnail.ext}${query}`;
    }

    if (/(video)/.test(thumbnail.type)) {
      // `poster` is a frame picked in the CMS (fokus-assist file/thumbnail)
      return `${this.config.assistUrl}/${this.config.slug}/transform/${settingsString}/${thumbnail.name}/${
        thumbnail.poster ? thumbnail.poster.fileName : 'thumb.jpg'
      }${query}`;
    }

    if (/(oembed|proxy)/.test(thumbnail.type)) {
      return `${this.config.assistUrl}/${
        this.config.slug
      }/proxy/transform/${settingsString}/${thumbnail.url.replace(
        /https?:\/\//,
        ''
      )}${query}`;
    }

    return '';
  }

  audioSrc(audio, settings, options) {
    return this.videoSrc(audio, settings, options);
  }

  videoSrc(
    video,
    settings,
    { noCache = undefined, noRedirect = undefined } = {}
  ) {
    if (!video) {
      return undefined;
    }

    if (typeof settings === 'string') {
      // Convert settings to object
      settings = reduce(
        settings.split(/,|;/),
        (settingsObj, setting) =>
          merge(settingsObj, fromPairs([setting.split(/_|:/)])),
        {}
      );
    }

    // Convert settings to string
    settings = map(settings, (value, key) => `${key}:${value}`).join(';');

    let query = [
      noCache ? 'noCache' : undefined,
      noRedirect ? 'noRedirect' : undefined,
    ].filter((option) => option !== undefined);

    query = `${query.length ? '?' : ''}${query.join('&')}`;

    return `${this.config.assistUrl}/${
      this.config.slug
    }/transform/${settings}/${video.name + video.ext}${query}`;
  }

  thumbnailSrcset(
    thumbnail,
    sizes,
    {
      targetWidth = undefined,
      noCache = undefined,
      noRedirect = undefined,
      cropSlug = undefined,
      cropFallback = undefined,
    } = {}
  ) {
    if (typeof targetWidth === 'string') {
      const targetWidthPercentage = parseInt(targetWidth, 10) / 100;

      if (typeof window === 'undefined') {
        targetWidth = 1280 * targetWidthPercentage;
      }

      if (typeof window !== 'undefined') {
        targetWidth =
          window.innerWidth *
          targetWidthPercentage *
          (window.devicePixelRatio || 1);
      }
    }

    if (typeof targetWidth === 'number') {
      const widths = sizes
        .map((size) => parseInt(Object.keys(size)[0], 10))
        .sort((a, b) => (a > b ? 1 : -1));
      const width =
        find(widths, (width) => width >= targetWidth) || last(widths);
      const size = find(
        sizes,
        (size) => parseInt(Object.keys(size)[0], 10) === width
      );

      return this.thumbnailSrc(thumbnail, Object.values(size)[0], {
        noCache,
        noRedirect,
        cropSlug,
        cropFallback,
      });
    }

    return sizes
      .map(
        (size) =>
          `${this.thumbnailSrc(thumbnail, Object.values(size)[0], {
            noCache,
            noRedirect,
            cropSlug,
            cropFallback,
          })} ${Object.keys(size)[0]}w`
      )
      .join(', ');
  }

  fileUrl({ file }) {
    if (!file) {
      return undefined;
    }
    return `${this.config.assistUrl}/${this.config.slug}/${
      file.name + file.ext
    }`;
  }

  attachmentUrl(attachment, download = false) {
    if (!attachment) {
      return undefined;
    }
    return `${this.config.assistUrl}/${this.config.slug}/file/${
      download ? 'download' : 'view'
    }/${attachment.file.name + attachment.file.ext}/${
      attachment.original.fileName
    }`;
  }
}

export default Helpers;
