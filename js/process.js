/**
 * Wrapper for a process on the machine.
 * Receives a script to run as the process, and abstracts away its ability
 * to access things we don't want it to.
 */

'use strict';

function Api() {
    
    function set_onmessage_handler(fn) {
        onmessage = function (e) {
            fn(e.data);
        }
    }

    return {
        set_onmessage_handler: set_onmessage_handler
    };

}

const api = Api();
const program = {
    api: api
};

// disallow eval.* since they escape the sandbox
eval.call = () => { throw new Error('Cannot use eval.call() in this context!'); }
eval.bind = () => { throw new Error('Cannot use eval.bind() in this context!'); }
eval.apply = () => { throw new Error('Cannot use eval.apply() in this context!'); }

// This isn't really a proper block list, its probably
// really easy to bypass. Purpose of this is moreso to prevent easy indexedDB access.
const blocklist = [
    'self',
    'globalThis',
    'Function',
    'indexedDB',
    'importScripts'
];

/**
 * Handle the initial message which gives us the code
 * the program wants to run.
 */
onmessage = (e) => {

    const init = new Function('api', ...blocklist, `${e.data}`);
    init.call(program, ...blocklist.map(_ => undefined));

}