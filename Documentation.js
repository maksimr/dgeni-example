var path = require('path');
var Dgeni = require('dgeni');
var Package = Dgeni.Package;

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

  .factory(require('dgeni-packages/examples/services/exampleMap'))
  .processor(require('dgeni-packages/examples/processors/examples-parse'))

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
