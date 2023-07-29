

/**
 * Loads and controls Kernel modules.
 */
class ModuleLoader {

    /** @type { Map<string, KModule> } */
    #modules = new Map();

    /**
     * Prepend 'include' script to a module.
     * 
     * Hopefully there's a better solution to this, but this
     * at least lets us move forward.
     * @param { string } module_string
     */
    static #prepend_include = ( module_string ) => {
        return `async function include( url ) {
            return (await import( '${window.location.origin}' + url )).default;
        };${module_string}`;
    }

    /**
     * Find a module by name, and if found, return it as a string.
     * @param { string } name Module name
     * @returns { Promise<string?> }
     */
    #find = async ( name ) => {
        // For now, we just load modules by expecting them to exist at /modules/*.js
        const res = await fetch(`/js/kernel/modules/${name}.js`);

        if ( !res.ok ) {
            return null;
        }

        const text = ModuleLoader.#prepend_include( await res.text() );

        return URL.createObjectURL( new Blob( [text], { type: 'application/javascript' } ) );
    }

    /**
     * Get a loaded module by its name
     * @param { string } name Module name
     * @returns { KModule? }
     */
    #get = ( name ) => {
        const module = this.#modules.get( name );

        if ( module !== undefined ) {
            return module;
        }

        return null;
    }

    /**
     * Load a module by its name, if found, and if it can be loaded.
     * @param { string } name Module name
     * @returns { Promise<KModule?> }
     */
    load = async ( name ) => {
        
        const _module = this.#get( name );
        if ( _module !== null ) {
            return _module;
        }

        const module_string = await this.#find( name );

        if ( module_string === null ) {
            return null;
        }

        try {
            const module_namespace = await import(module_string);
            /** @type { KModule } */
            const module = module_namespace.default;

            await module.load( this.load, this.unload );

            this.#modules.set( name, module );

            return module;

        } catch ( error ) {
            console.error(error);
            URL.revokeObjectURL( module_string );
            return null;
        }

    }

    /**
     * Unload a module
     * @param { string } name Module name
     * @returns { Promise<boolean> }
     */
    unload = async ( name ) => {
        const module = this.#get( name );

        if ( module === null ) {
            return true;
        }

        try {
            await module.unload();
            this.#modules.delete( name );

            return true;
        } catch ( error ){ 
            return false;
        }
    }

}

export const moduleLoader = new ModuleLoader();