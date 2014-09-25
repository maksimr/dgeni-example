var React = require('react');

/**
 * @name Unicorn
 * @description Draw unicorn
   <example name="Unicorn">
     <file name="index.html">
       <div id="example">
       </div>
     </file>

     <file name="index.js" webpack="true">
       var React = require('react');
       var Unicorn = require('./Unicorn');

       React.renderComponent(Unicorn(),
         document.getElementById('example'));
     </file>
   </example>
 */
var Unicorn = React.createClass({
  render: function() {
    var unicornImg = 'http://media.tumblr.com/9fac6d76864e0d6989d18a36e31adfb3/tumblr_inline_mhb0rw051f1qz4rgp.gif';

    return React.DOM.img({
      src: unicornImg
    });
  }
});

module.exports = Unicorn;
