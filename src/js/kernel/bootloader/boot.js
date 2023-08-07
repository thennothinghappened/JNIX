import { storage_get, storage_set } from '/js/kernel/bootloader/storage.js';
import { proj_compile, webserver_load_file, create_data_url } from '/js/lib/compiler.js';


let compile_mode = storage_get( 'compile_mode' );

if ( compile_mode === null ) {
    compile_mode = storage_set( 'compile_mode', 'source' );
}

async function load_os() {
    switch ( compile_mode ) {

        case 'source': {
            // @ts-ignore
            return import( '/js/kernel/init/main.js' );
        }
    
        case 'compile' : {
            /** @type { import('/js/lib/compiler.js').JNIXBinary<'static'> } */
            // @ts-ignore
            const bin = await proj_compile( '/js/kernel/', webserver_load_file );
    
            return import( create_data_url( bin ) );
        }
    
        case 'load': {
    
            const file = await webserver_load_file( '/js/src/kernel' );
    
            if ( file === null ) {
                throw new Error( 'Failed to load the JNIX Kernel binary' );
            }
            
            const bin = JSON.parse( file );
    
            return import( create_data_url( bin ) );
        }
    }
}

load_os();