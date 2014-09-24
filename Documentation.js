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
    require('dgeni-packages/examples'),
    require('dgeni-packages/nunjucks')
  ])
  .factory('webpackConfig', function() {
    return {};
  })
  .processor(function webpackExampleProcessor(exampleMap, webpackConfig) {
    return {
      $runAfter: ['parseExamplesProcessor'],
      $runBefore: ['generateExamplesProcessor'],
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

          file.originFileContents = file.fileContents;
          file.fileContents = processedFileContent;

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

  .processor(function joinDocsToComponent() {
    return {
      $runAfter: ['parseExamplesProcessor'],
      $runBefore: ['computeIdsProcessor'],
      $process: function(docs) {
        var exampleDocs = docs.filter(function(doc) {
          return doc.docType !== 'js';
        });
        var createGroup = function(doc) {
          doc.name = doc.fileInfo.baseName;
          doc.components = [];
          return doc;
        };

        var componentsMap = docs.filter(function(doc) {
          return doc.docType === 'js';
        }).reduce(function(componentGroups, doc) {
          var groupId = doc.fileInfo.filePath;
          componentGroups[groupId] = componentGroups[groupId] || createGroup(doc);
          componentGroups[groupId].components.push(doc);
          return componentGroups;
        }, {});

        var components = Object.keys(componentsMap).map(function (groupId) {
          return componentsMap[groupId];
        });

        return components.concat(exampleDocs);
      }
    };
  })

  .config(function(log, readFilesProcessor, templateFinder, writeFilesProcessor, generateExamplesProcessor, generateProtractorTestsProcessor) {
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

    templateFinder.templatePatterns = [
      '<%= doc.template %>',
      '<%= doc.docType %>.template',
      'common.template.html'
    ];

    writeFilesProcessor.outputFolder = 'docs';

    generateProtractorTestsProcessor.$enabled = false;
    generateExamplesProcessor.deployments = [{
      name: 'testDeployment',
      examples: {
        commonFiles: {
          scripts: ['']
        },
        dependencyPath: ''
      },
      scripts: [],
      stylesheets: []
    }];
  })
]);

dgeni.generate();
