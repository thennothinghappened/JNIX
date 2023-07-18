'use strict';

const w = new Worker('/js/process.js');

// Send the script that'll get executed through.
w.postMessage(`
'use strict';
console.log(this.api.set_onmessage_handler(function(data) {
    console.log('got', data);
}), 'yes');

function evil() {
    console.log(self, 'stuff');
}

eval('evil()');
eval.call({}, 'evil()');

`);

w.postMessage({'test': 'yah'});