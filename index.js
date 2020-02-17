import clone from 'lodash/clone';
import uniq from 'lodash/uniq';
import map from 'lodash/map';
import find from 'lodash/find';
import reduce from 'lodash/reduce';
import merge from 'lodash/merge';
import fromPairs from 'lodash/fromPairs';
import last from 'lodash/last';

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

    entities.forEach(entity => {
      entity = clone.clone(entity);

      if (!entity.groupBefore || group.length >= groupSize) {
        group = [];
      }

      group.push(entity);

      if (!entity.groupAfter || group.length >= groupSize) {
        group.ratio = 0;

        group.forEach(entity => {
          group.ratio += (entity.thumbnail || entity).ratio;
        });

        group.forEach(entity => {
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
      taxonomyField.terms.forEach(term => {
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

    return uniq(terms).map(term => termPrefix + term);
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
    cropSlug = undefined,
    cropFallback = undefined
  ) {
    if (!thumbnail) {
      return '';
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

    if (/(image)/.test(thumbnail.thumbnailType)) {
      if (thumbnail.ext === '.svg' && !settings.f) {
        return `${this.config.assistUrl}/${this.config.slug}/${thumbnail.name +
          thumbnail.ext}`;
      }

      return `${this.config.assistUrl}/${
        this.config.slug
      }/transform/${settingsString}/${thumbnail.name + thumbnail.ext}`;
    }

    if (/(video)/.test(thumbnail.thumbnailType)) {
      return `${this.config.assistUrl}/${this.config.slug}/transform/${settingsString}/${thumbnail.name}/thumb.jpg`;
    }

    if (/(oembed|proxy)/.test(thumbnail.thumbnailType)) {
      const thumbnailUrl = thumbnail.thumbnailUrl.replace(/https?:\/\//, '');

      return `${this.config.assistUrl}/${this.config.slug}/proxy/transform/${settingsString}/${thumbnailUrl}`;
    }

    return '';
  }

  videoSrc(video, settings) {
    if (!video) {
      return '';
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

    return `${this.config.assistUrl}/${
      this.config.slug
    }/transform/${settings}/${video.name + video.ext}`;
  }

  thumbnailSrcset(
    thumbnail,
    sizes,
    targetWidth = -1,
    cropSlug = undefined,
    cropFallback = undefined
  ) {
    if (typeof targetWidth === 'string' && typeof window !== 'undefined') {
      targetWidth =
        window.innerWidth *
        (parseInt(targetWidth, 10) / 100) *
        (window.devicePixelRatio || 1);
    }
    if (typeof targetWidth === 'number' && targetWidth > -1) {
      const widths = sizes
        .map(size => parseInt(Object.keys(size)[0], 10))
        .sort((a, b) => (a > b ? 1 : -1));
      const width = find(widths, width => width >= targetWidth) || last(widths);
      const size = find(
        sizes,
        size => parseInt(Object.keys(size)[0], 10) === width
      );
      return this.thumbnailSrc(thumbnail, Object.values(size)[0]);
    }
    return sizes
      .map(
        size =>
          `${this.thumbnailSrc(
            thumbnail,
            Object.values(size)[0],
            cropSlug,
            cropFallback
          )} ${Object.keys(size)[0]}w`
      )
      .join(', ');
  }

  attachmentUrl(attachment, download = false) {
    if (!attachment) {
      return '';
    }
    return `${this.config.assistUrl}/${this.config.slug}/file/${
      download ? 'download' : 'view'
    }/${attachment.file.name + attachment.file.ext}/${
      attachment.original.fileName
    }`;
  }
}

export default Helpers;