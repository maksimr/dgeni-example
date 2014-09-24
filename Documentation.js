var path = require('path');
var Dgeni = require('dgeni');
var Package = Dgeni.Package;

var webpack = require('webpack');
var MemoryFileSystem = require('memory-fs');
var when = require('when');

var LogLevel = {
  INFO: 'info'
};

var dgeni = new Dgeni([

  /**
   * All configuration take place
   * through creating project specific package
   */
  new Package('dgeni-example', [
    require('dgeni-packages/jsdoc'),
    require('dgeni-packages/nunjucks')
  ])

  .factory('webpackConfig', function() {
    return {};
  })

  .factory(require('dgeni-packages/examples/services/exampleMap'))
  .processor(require('dgeni-packages/examples/processors/examples-parse'))

  .processor(function webpackExampleProcessor(exampleMap, webpackConfig) {
    return {
      $runAfter: ['parseExamplesProcessor'],
      $runBefore: ['renderDocsProcessor'],
      $process: function(docs) {
        return when.all(exampleMap.map(function(example) {
          return when.all(
            this._getFileArray(example).filter(this._filter).map(this._processFile.bind(this, example.doc))
          );
        }.bind(this))).then(function() {
          return docs;
        });
      },

      /**
       * @param {Object} example
       * @return {Array} List of example's files
       */
      _getFileArray: function(example) {
        var vector = [];
        for (var file in example.files) {
          vector.push(example.files[file]);
        }
        return vector;
      },

      /**
       * @param {Object} file Example file
       * @return {Boolean} Return true if we should process it file
       */
      _filter: function(file) {
        return file.type === 'js' && file.hasOwnProperty('webpack');
      },

      /**
       * Processing file content using webpack
       * @param {Object} doc
       * @param {Object} file
       * @return {Object} Deferred object
       */
      _processFile: function(doc, file) {
        var defer = when.defer();

        var entryFilePath = this._getExampleFilePath(doc, file);
        webpackConfig.entry = entryFilePath;
        webpackConfig.output = {
          path: '/',
          filename: 'test.js'
        };

        var compiler = webpack(webpackConfig);
        compiler.inputFileSystem = this._getInputFileSystem(file, entryFilePath);
        compiler.resolvers.normal.fileSystem = compiler.inputFileSystem;
        compiler.resolvers.context.fileSystem = compiler.inputFileSystem;
        compiler.resolvers.loader.fileSystem = compiler.inputFileSystem;
        compiler.outputFileSystem = new MemoryFileSystem();

        compiler.plugin('done', function() {
          var processedFileContent = compiler
            .outputFileSystem
            .readFileSync(path.resolve(webpackConfig.output.path, webpackConfig.output.filename))
            .toString();

          file.webpack = {
            fileContents: processedFileContent
          };

          defer.resolve();
        });

        compiler.run(function(error, status) {
          if (error) {
            defer.reject();
            console.log(error, status);
          }
        });

        return defer.promise;
      },
      _getExampleFilePath: function(doc, file) {
        return path.resolve(
          path.dirname(doc.fileInfo.filePath), file.name);
      },
      _getInputFileSystem: function(file, entryFilePath) {
        var fs = require('fs');
        var inputFileSystem = {};

        inputFileSystem.stat = (function(stat) {
          return function(filePath, callback) {
            if (filePath === entryFilePath) {
              return callback(null, {
                isDirectory: function() {
                  return false;
                },
                isFile: function() {
                  return true;
                }
              });
            }
            return stat.apply(this, arguments);
          };
        }(fs.stat));

        inputFileSystem.readFile = (function(readFile) {
          return function(filePath, callback) {
            if (filePath === entryFilePath) {
              return callback(null, file.fileContents);
            }
            return readFile.apply(this, arguments);
          };
        }(fs.readFile));

        return inputFileSystem;
      }
    };
  })

  .processor(function inlineExampleToDoc(exampleMap) {
    return {
      $runAfter: ['parseExamplesProcessor'],
      $runBefore: ['renderDocsProcessor'],
      $process: function(docs) {
        exampleMap.forEach(function(example) {
          this._addExampleToDoc(example);
        }.bind(this));

        return docs;
      },
      _addExampleToDoc: function(example) {
        var doc = example.doc;
        doc.examples = doc.examples || [];
        doc.examples.push(example);
      }
    };
  })
  .config(function(log, readFilesProcessor, templateFinder, writeFilesProcessor) {
    log.level = LogLevel.INFO;
    readFilesProcessor.basePath = __dirname;
    readFilesProcessor.sourceFiles = [{
      include: 'js/**/*.js'
    }];

    /**
     * Add folder to search for our own templates to use
     * when redering docs
     */
    templateFinder.templateFolders.unshift(
      path.resolve(__dirname, 'templates'));

    templateFinder.templatePatterns.unshift(

      /**
       * Specify how to match docs to templates.
       * In this case we just use the same static template
       * for all docs
       */
      'common.template.html'
    );

    writeFilesProcessor.outputFolder = 'docs';
  })
]);

dgeni.generate();
