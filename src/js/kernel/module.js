/**
 * Base Kernel module. Kernel modules may be dynamically loaded
 * at runtime during startup or by the user.
 * 
 * Kernel modules are a little bit like Processes, but run on the
 * main thread, and thus have full access to any browser resources.
 * 
 * This also means that an error in a module will crash the system.
 * 
 * Modules extend this class to implement their own functionality.
 */
export class KModule {

    /**
     * Load the module
     * 
     * @param { ( name: string ) => Promise<KModule?> } load Load a module and return it if possible
     * @param { ( name: string ) => Promise<boolean> } unload Unload a module if possible
     * 
     * @returns { Promise<boolean> }
     */
    load = async ( load, unload ) => {
        throw new Error( 'Not implemented!' );
    };

    /**
     * Unload the module if possible
     * 
     * @returns { Promise<boolean> }
     */
    unload = async () => {
        throw new Error( 'Not implemented!' );
    }
}