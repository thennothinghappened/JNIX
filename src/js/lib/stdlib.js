/**
 * JNIX Standard Library.
 * 
 * Should be included in pretty much every program,
 * unless the author needs complete and absolute control.
 * 
 * This library deals with program instantiation, communication
 * with the Kernel, the Filesystem, and more.
 */

import { Signal, Syscall } from '/js/lib/types.js';

/** @type { { [key: string]: string } } */
let env;

/** @type { string[] } */
let args;

/** @type { number } */
let ppid;
/** @type { number } */
let pid;
/** @type { number } */
let uid;
/** @type { number } */
let gid;

/**
 * File Descriptor table for this process, used for I/O
 * 
 * This list is mirrored with the relevant data on the Kernel side.
 * 
 * @type {  }
 */
const fd_table = new Map();

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
        self.onmessage = on_message_received;

        // Send the reply message
        self.postMessage({
            syscall: Syscall.INIT,
            identifier: event.data.identifier
        });

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
 * Returns the Parent PID of the process
 */
export function getppid() {
    return ppid;
}

/**
 * Returns the Process ID of the process
 */
export function getpid() {
    return pid;
}

/**
 * Returns the Group ID of the process
 */
export function getgid() {
    return gid;
}

/**
 * Returns the User ID of the process
 */
export function getuid() {
    return uid;
}

/**
 * Message queue.
 * 
 * The message queue is a Map containing all tracked messages awaiting
 * a response from the Kernel. Each message is tied to a unique identifier,
 * which the Kernel will use when addressing this specific message.
 * 
 * This system is used as messages may be replied to in a different order
 * than they were sent.
 * 
 * When a reply to the message is received, the `Promise` will be resolved
 * with the message data.
 * 
 * @type { Map<number, ( msg: import('/js/lib/types.js').KMessage ) => void> }
 */
const kmessage_queue = new Map();

/**
 * Handler for onmessage
 * @param { MessageEvent<import('/js/lib/types.js').KMessage> } event 
 */
function on_message_received( event ) {
    const msg = event.data;

    /** 
     * Handle Kernel signals.
     * 
     * Messages are always passed through here first,
     * so that they will be replied to in the expected manor
     * immediately in the case of anything that is not used
     * by the end program, such as 
     */
    switch ( msg.signal ) {

        case Signal.HEARTBEAT: {
            // Respond immediately to say we're alive
            self.postMessage({
                syscall: Syscall.HEARTBEAT,
                identifier: msg.identifier
            });
            break;
        }
        
        case Signal.NEWPPID: {
            ppid = msg.data;
            break;
        }

        default: {
            // Pass the message on to the relevant resolver in the queue.
            const resolver = kmessage_queue.get( msg.identifier );

            if ( resolver === undefined ) {
                // This should *never* happen. If it did, something went really wrong
                // so we should error out.
                throw new Error('stdlib failed to handle a Kernel signal.');
            }

            resolver( msg );

            // Remove the entry.
            kmessage_queue.delete( msg.identifier );
            break;
        }
    }
}

/**
 * Handler to set up the program after INIT signal.
 * Should only ever be called once.
 * 
 * @param { MessageEvent<import('/js/lib/types.js').KMessage> } event 
 */
function init_handler( event ) {
    const msg = event.data;

    /** @type { import("./types").KInitData } */
    const init_data = msg.data;

    ppid = init_data.ppid;
    pid = init_data.pid;
    uid = init_data.uid;
    gid = init_data.gid;
    env = init_data.env;
    args = init_data.args;
}