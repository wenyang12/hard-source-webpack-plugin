var relateContext = require('./util/relate-context');
var pluginCompat = require('./util/plugin-compat');

const SourceSchemas3 = [
  ['RawSource', 'value'],
  ['OriginalSource', 'value', 'name'],
  ['SourceMapSource', 'value', 'name', 'sourceMap', 'originalSource', 'innerSourceMap'],
  ['LineToLineMappedSource', 'value', 'name', 'originalSource'],
  ['ReplaceSource', 'source', 'name'],
  ['CachedSource', 'source'],
];

try {
  SourceSchemas3[0].Source = require('webpack-sources/lib/RawSource');
} catch (_) {}
try {
  SourceSchemas3[1].Source = require('webpack-sources/lib/OriginalSource');
} catch (_) {}
try {
  SourceSchemas3[2].Source = require('webpack-sources/lib/SourceMapSource');
} catch (_) {}
try {
  SourceSchemas3[3].Source = require('webpack-sources/lib/LineToLineMappedSource');
} catch (_) {}
try {
  SourceSchemas3[4].Source = require('webpack-sources/lib/ReplaceSource');
} catch (_) {}
try {
  SourceSchemas3[5].Source = require('webpack-sources/lib/CachedSource');
} catch (_) {}

const freezeArgument = {
  value: function(arg, source, extra, methods) {
    return source._value;
  },
  name: function(arg, source, extra, methods) {
    try {
      return relateContext.relateNormalPath(extra.compilation.compiler, source._name);
    } catch (e) {
      console.error(e.stack)
      process.exit()
    }
  },
  sourceMap: function(arg, source, extra, methods) {
    return source._sourceMap;
  },
  originalSource: function(arg, source, extra, methods) {
    return source._originalSource;
  },
  innerSourceMap: function(arg, source, extra, methods) {
    return source._innerSourceMap;
  },
  source: function(arg, source, extra, methods) {
    if (source.constructor.name === 'ReplaceSource') {
      return;
    }
    return methods.freeze('Source', null, source._source, extra);
  },
};

const thawArgument = {
  name: function(arg, source, extra, methods) {
    try {
      return relateContext.contextNormalPath(extra.compilation.compiler, arg);
    } catch (e) {
      console.error(e.stack)
      process.exit()
    }
  },
  source: function(arg, frozen, extra, methods) {
    if (frozen.type === 'ReplaceSource') {
      return extra.source;
    }
    return methods.thaw('Source', null, arg, extra);
  },
};

function freezeSource(source, extra, methods) {
  var schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (source.constructor === schemas[i].Source) {
      var frozen = {
        type: schemas[i][0],
      };
      for (let j = 1; j < schemas[i].length; j++) {
        var arg = source[schemas[i][j]];
        if (freezeArgument[schemas[i][j]]) {
          arg = freezeArgument[schemas[i][j]](arg, source, extra, methods);
        }
        frozen[schemas[i][j]] = arg;
      }
      return frozen;
    }
  }
  console.log(source.constructor.type);
  console.log(source);
  process.exit()
}

function thawSource(frozen, extra, methods) {
  var schemas = extra.schemas;
  for (let i = 0; i < schemas.length; i++) {
    if (frozen.type === schemas[i][0]) {
      var Source = schemas[i].Source;
      var args = [];
      for (let j = 1; j < schemas[i].length; j++) {
        var arg = frozen[schemas[i][j]];
        if (thawArgument[schemas[i][j]]) {
          arg = thawArgument[schemas[i][j]](arg, frozen, extra, methods);
        }
        args.push(arg);
      }
      try {
        return new Source(...args);
      } catch (_) {
        return new (Function.prototype.bind.apply(Source, [null].concat(args)))();
      }
    }
  }
}

function HardSourceSourcePlugin() {}

HardSourceSourcePlugin.prototype.apply = function(compiler) {
  var methods;

  pluginCompat.tap(compiler, '_hardSourceMethods', 'HardSourceSourcePlugin', function(_methods) {
    methods = _methods;
  });

  pluginCompat.tap(compiler, '_hardSourceFreezeSource', 'HardSourceSourcePlugin freeze', function(frozen, source, extra) {
    extra.schemas = SourceSchemas3;
    frozen = freezeSource(source, extra, methods);
    if (frozen.type === 'ReplaceSource') {
      frozen.replacements = source.replacements;
    }
    else if (frozen.type === 'CachedSource') {
      frozen.cachedSource = source._cachedSource;
      frozen.cachedSize = source._cachedSize;
      frozen.cachedMaps = source._cachedMaps;
    }
    return frozen;
  });

  pluginCompat.tap(compiler, '_hardSourceThawSource', 'HardSourceSourcePlugin thaw', function(source, frozen, extra) {
    extra.schemas = SourceSchemas3;
    source = thawSource(frozen, extra, methods);
    if (frozen.type === 'ReplaceSource') {
      source.replacements = frozen.replacements;
    }
    else if (frozen.type === 'CachedSource') {
      source._cachedSource = frozen.cachedSource;
      source._cachedSize = frozen.cachedSize;
      source._cachedMaps = frozen.cachedMaps;
    }
    return source;
  });
};

module.exports = HardSourceSourcePlugin;
