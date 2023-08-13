import { proj_compile, webserver_load_file, create_data_url } from '/js/lib/compiler.js';

let compile_mode = localStorage.getItem( 'compile_mode' );

if ( compile_mode === null ) {
    compile_mode = 'source';
    localStorage.setItem( 'compile_mode', compile_mode );
}

const cmdline = localStorage.getItem( 'cmdline' ) ?? '';

/**
 * @param { string } compile_mode 
 * @returns { Promise<{ start_kernel: ( cmdline: string ) => void }> }
 **/
async function load_kernel( compile_mode ) {
    const loc = '/js/kernel/';
    
    switch ( compile_mode ) {

        case 'source': {
            // @ts-ignore
            return import( loc + 'init/main.js' );
        }
    
        case 'compile' : {

            console.info( 'Compiling JNIX Kernel...' );

            /** @type { import('/js/lib/compiler.js').JNIXBinary<'static'> } */
            // @ts-ignore
            const bin = await proj_compile( loc, webserver_load_file );

            try {
                localStorage.setItem( 'jnix', JSON.stringify( bin ) );
            } catch ( error ) {
                console.error( 'Bootloader: Failed to save the Kernel to localStorage' );
            }

            console.info( 'Done.' );
    
            return import( create_data_url( bin ) );
        }
    
        case 'load': {
    
            const file = localStorage.getItem( 'jnix' );
    
            if ( file === null ) {
                return await load_kernel( 'compile' );
            }
            
            const bin = JSON.parse( file );
    
            return import( create_data_url( bin ) );
        }
    }

    throw new Error( 'Bootloader: No compile type specified' );
}

load_kernel( compile_mode )
    .then( kernel => kernel.start_kernel( cmdline ) );
