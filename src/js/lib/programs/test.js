import { getenv, getpid, init } from '/js/lib/stdlib.js';

/**
 * Program entry point
 * @param { string[] } args 
 */
async function main( args ) {
    
    // console.log( `Hi from PID ${getpid()}! Env TERM: ${getenv('TERM')}` );

}

init(main);