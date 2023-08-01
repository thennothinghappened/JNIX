///#noimports

/**
 * @param {number} fd 
 * @param {string} string 
 */
export function write( fd, string ){
    if ( fd === 0 ) {
        console.log(string);
    }
}