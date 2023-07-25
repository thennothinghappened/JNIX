/**
 * JNIX Standard Library.
 * 
 * Should be included in pretty much every program,
 * unless the author needs complete and absolute control.
 * 
 * This library deals with program instantiation, communication
 * with the Kernel, the Filesystem, and more.
 */

import { Signals, Syscalls } from '/js/lib/types.js';

/** @type { { [key: string]: string } } */
let env;

/** @type { string[] } */
let args;

/** @type { number } */
let uid;
/** @type { number } */
let gid;

/**
 * IMPORTANT!
 * 
 * This function MUST be called to initiate any program
 * using this library.
 * 
 * This handles initial communication with the Kernel, and
 * runs your 'main' function when ready.
 * 
 * Code requiring any communication with the Kernel should
 * always be called by your code in the callback here, to
 * ensure it runs when communication has been established.
 * 
 * @param { ( args: string[] ) => void } main
 */
export function init(
    main
) {

    // Initial onmessage.
    self.onmessage = function( event ) {
        init_handler( event );

        // Switch over to the proper handler
        self.onmessage = onmessage_handler;

        // Start user code
        main( args );
    };

}

/**
 * Returns an environment variable value by name.
 * @param { string } name Name of the variable
 * @returns { string }
 */
export function getenv( name ) {
    return env[name];
}

/**
 * Handler for onmessage
 * @param { MessageEvent } event 
 */
function onmessage_handler( event ) {
    /** @type { import("./types").KMessage } */
    const msg = event.data;

    // Handle Kernel messages
    switch ( msg.signal ) {

    }
}

/**
 * Handler to set up the program after INIT signal.
 * Should only ever be called once.
 * 
 * @param { MessageEvent } event 
 */
function init_handler( event ) {
    /** @type { import("./types").KMessage } */
    const msg = event.data;

    /** @type { import("./types").KInitData } */
    const init_data = msg.data;

    uid = init_data.uid;
    gid = init_data.gid;
    env = init_data.env;
    args = init_data.args;
}