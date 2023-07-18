'use strict';

const w = new Worker('/js/process.js');

// Send the script that'll get executed through.
w.postMessage(`

console.log(this.api.set_onmessage_handler(function(data) {
    console.log(data);
}), 'yes');

`);
w.postMessage({'test': 'ya'});