import { KModule } from '/js/kernel/module.js';

class TextDrawerModule extends KModule {

    /**
     * Load the module
     * 
     * @param { ( name: string ) => Promise<KModule?> } load Load a module and return it if possible
     * @param { ( name: string ) => Promise<boolean> } unload Unload a module if possible
     */
    load = async ( load, unload ) => {

        document.body.innerHTML = 'a';

        return true;
    }

    /**
     * Unload the module if possible
     * 
     * @returns { Promise<boolean> }
     */
    unload = async () => {

        document.body.innerHTML = '';

        return true;
    }

}

export default new TextDrawerModule();