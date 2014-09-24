/**
 * @name Main
 * @description Hello World
   <example name="MyExample">
     <file name="index.html">
       <div>Hello World!</div>
     </file>
     <file name="app.js" webpack="true">
       var path = require('path');
       console.log(path);
     </file>
   </example>
 */
function Main() {
  console.log('Hello World!');
}

/**
 * @name Foo
 * @description Foo description
   <example name="FooExample">
     <file name="index.html">
       <div>Foo: Hello World!</div>
     </file>
     <file name="app.js" webpack="true">
       var path = require('path');
       console.log(path);
     </file>
   </example>
 */
function Foo() {
  console.log('Foo');
}

Main(Foo());
