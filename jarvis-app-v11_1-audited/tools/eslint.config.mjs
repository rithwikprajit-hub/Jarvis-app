import globals from "globals";
export default [{
  files:["all.js"],
  languageOptions:{ ecmaVersion:2022, sourceType:"script", globals:{...globals.browser, ...globals.worker} },
  rules:{
    "no-undef":"error","no-unused-vars":["warn",{args:"none",caughtErrors:"none"}],
    "no-redeclare":"error","no-dupe-keys":"error","no-dupe-else-if":"error","no-unreachable":"warn",
    "no-func-assign":"error","no-const-assign":"error","no-self-assign":"warn","no-use-before-define":["warn",{functions:false,classes:false,variables:true}],
    "no-empty":["warn",{allowEmptyCatch:true}],"eqeqeq":["off"],"no-cond-assign":["warn","except-parens"],
    "no-unsafe-finally":"error","no-fallthrough":"warn","no-shadow-restricted-names":"error","no-unsafe-optional-chaining":"error",
    "require-atomic-updates":"off","no-loss-of-precision":"error","no-sparse-arrays":"warn","valid-typeof":"error","use-isnan":"error","no-constant-condition":["warn",{checkLoops:false}],"no-prototype-builtins":"off","no-inner-declarations":"off","no-useless-escape":"warn","no-misleading-character-class":"warn","no-async-promise-executor":"warn","no-control-regex":"off","no-extra-boolean-cast":"off"
  }
}];
