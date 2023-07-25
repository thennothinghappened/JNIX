import { Process } from './process.js';

class Scheduler {

    static #max_processes = 200;
    static #max_user_processes = 20;

    #process_table = new Map();
    #process_start_queue = new Array();
    #pid_index = 0;

    constructor() {
        
    }

    /**
     * Get a list of processes currently running for a User ID
     * @param { number } uid
     * @returns { Map<number, Process> }
     */
    #user_get_processes = ( uid ) => {

        const processes = new Map();

        for ( const p of this.#process_table.entries() ) {
            if ( p[1].uid === uid ) {
                processes.set( p[0], p[1] );
            }
        }

        return processes;
    }

    /**
     * Must be ran whenever a process ID becomes available,
     * such as a running process ending.
     */
    process_queue_allocate = () => {

        let num_procs = this.#process_start_queue.length;

        while ( 
            num_procs > 0 && 
            this.#process_table.size < Scheduler.#max_processes
        ) {
            num_procs --;

            const req = this.#process_start_queue.shift();

            if ( req === undefined ) {
                return;
            }

            if ( !this.#process_can_allocate( req.uid ) ) {
                // Return the process to the back of the queue
                this.#process_start_queue.push( req );
                continue;
            }

            // Allocate the new process
            req.resolve( this.#process_id_get() );
        }

    }

    /**
     * Find a valid available PID.
     * This MUST only be called when the table is known to have
     * available space, or WILL infinitely loop.
     * @returns {number}
     */
    #process_id_get = ( ) => {

        while ( this.#process_table.get( this.#pid_index ) !== undefined ) {
            this.#pid_index ++;

            if ( this.#pid_index >= Scheduler.#max_processes ) {
                this.#pid_index = 0;
            }
        }

        return this.#pid_index;

    }

    /**
     * Checks if a process ID is available currently to allocate for a user.
     * @param { number } uid
     * @returns { boolean }
     */
    #process_can_allocate = ( uid ) => {

        // Non-root users are subject to max_user_processes
        if ( 
            uid !== 0 &&
            this.#user_get_processes( uid ).size >= Scheduler.#max_user_processes
        ) {
            return false;
        }

        if ( this.#process_table.size >= Scheduler.#max_processes ) {
            return false;
        }

        return true;
    }

    /**
     * Add a process to the queue to be started.
     * Once successful, the process' PID will be returned.
     * @param { string } url URL or Blob URL of the code
     * @param { number } uid User ID of the process
     * @param { number } gid Group ID of the process
     * @param { { [key: string]: string } } env Environment variables for the process
     * @param { string[] } args Arguments the process was started with
     * @returns { Promise<number> }
     */
    process_start = async ( url, uid, gid, env, args ) => {
        
        // debug, prevents browser caching result for now
        url += `?a=${Math.round(Math.random() * 100000)}`;

        // some evil stuff that should be rewritten!
        let _resolve;
        const p = new Promise((resolve) => { _resolve = resolve; });

        this.#process_start_queue.push({
            uid: uid,
            resolve: _resolve
        });

        const pid = await p;

        const process = new Process( url, uid, gid, env, args, ( process, call, data ) => {
            console.log(process, call, data);
        } );

        this.#process_table.set( pid, process );

        return pid;

    }

}

export const scheduler = new Scheduler();