/**
 * Kernel Panic, which halts the systems immediately
 * and should be reserved for unrecoverable errors.
 */



///#endimports

/** Whether a Kernel Panic is already triggered. */
export let currently_panicking = false;

/**
 * Stop the system immediately with an error.
 * 
 * @param { string } message
 */
export function panic( message ) {

    if ( currently_panicking ) {
        return;
    }

    currently_panicking = true;

    // Show message, and attempt to shut everything down
    try {

        console.error( `KERNEL PANIC! ${ message }` );

    } catch( error ) {

        // Something went seriously wrong.
        // Tell the user directly via the browser, as we
        // have no guarentees now.

        const fault_banner =`
========================================
Exception occured during Kernel Panic :(
========================================`;

        console.error( fault_banner, error );
        alert( `${ fault_banner }\nCheck browser console for details.` );

    }

}