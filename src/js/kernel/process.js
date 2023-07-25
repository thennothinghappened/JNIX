import { Signal } from '/js/lib/types.js';

/**
 * Kernel representation of a process.
 * Wrapper around a Worker instance to make communication
 * simpler.
 */
export class Process {

    #worker;
    #uid;
    #gid;

    #messageHandler;

    /**
     * Instantiate the process
     * @param { string } url URL or data blob URL for the Worker
     * @param { number } uid User ID of the process
     * @param { number } gid Group ID of the process
     * @param { {} } env Environment variables for the process
     * @param { string[] } args Arguments the process was started with
     * @param { ( process: Process, call: number, data?: any ) => void } messageHandler Callback for messages received
     */
    constructor( url, uid, gid, env, args, messageHandler ) {
        
        this.#uid = uid;
        this.#gid = gid;
        this.#worker = new Worker( url, { type: 'module' } );
        this.#messageHandler = messageHandler;

        this.#worker.onmessage = this.#on_message_received;

        // Send the INIT signal with initialisation data.
        this.send_message( Signal.INIT, {
            uid: uid,
            gid: gid,
            env: env,
            args: args
        } );

    }

    /**
     * Handler for messages received from the Worker.
     * @param { MessageEvent } event Message from Worker
     */
    #on_message_received = ( event ) => {
        this.#messageHandler( this, event.data.call, event.data.data );
    }

    /**
     * Wrapper for postMessage to talk to the process.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     */
    send_message = ( signal, data, transferables = [] ) => {
        this.#worker.postMessage({
            signal: signal,
            data: data
        }, transferables);
    }

    get uid() {
        return this.#uid;
    }

    get gid() {
        return this.#gid;
    }

}