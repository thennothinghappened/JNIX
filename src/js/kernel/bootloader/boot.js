import { proj_compile, webserver_load_file, create_data_url } from '/js/lib/compiler.js';

let compile_mode = localStorage.getItem( 'compile_mode' );

if ( compile_mode === null ) {
    compile_mode = 'source';
    localStorage.setItem( 'compile_mode', compile_mode );
}

async function load_os() {
    const loc = '/js/kernel/';

    switch ( compile_mode ) {

        case 'source': {
            // @ts-ignore
            return import( loc + 'init/main.js' );
        }
    
        case 'compile' : {
            /** @type { import('/js/lib/compiler.js').JNIXBinary<'static'> } */
            // @ts-ignore
            const bin = await proj_compile( loc, webserver_load_file );
    
            return import( create_data_url( bin ) );
        }
    
        case 'load': {
    
            const file = await webserver_load_file( '/jnix_kernel' );
    
            if ( file === null ) {
                throw new Error( 'Failed to load the JNIX Kernel binary' );
            }
            
            const bin = JSON.parse( file );
    
            return import( create_data_url( bin ) );
        }
    }
}

load_os();