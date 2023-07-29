import { Thread } from './thread.js';
import { Signal, heartbeat_interval, Syscall } from '/js/lib/types.js';

/**
 * Kernel representation of a process.
 * Wrapper around a Worker instance to make communication
 * simpler.
 */
export class Process extends Thread {

    /** @type { number[] } */
    #children = new Array();

    #syscallErrorHandler;
    
    #heartbeat;
    #heartbeat_ok = false;

    /**
     * Instantiate the process
     * @param { string } image Data URL Blob of the Process, or JS file URL to init with
     * @param { string } name Name to identify the Process by
     * @param { number } ppid Parent Process ID of the process
     * @param { number } pid Process ID of the process
     * @param { number } uid User ID of the process
     * @param { number } gid Group ID of the process
     * @param { { [key: string]: string } } env Environment variables for the process
     * @param { string[] } args Arguments the process was started with
     * @param { ( process: Process, event: import('/js/lib/types.js').ThreadMessageEvent<import('/js/lib/types.js').PMessage> ) => void } messageHandler Callback for syscalls received
     * @param { ( process: Process, error: Error ) => void } errorHandler Callback when a process crashes
     * @param { ( process: Process, event: import('/js/lib/types.js').ThreadMessageEvent<import('/js/lib/types.js').PMessage?> ) => void } syscallErrorHandler Callback when a syscall cannot be decoded or is otherwise invalid
     */
    constructor( image, name, ppid, pid, uid, gid, env, args, messageHandler, errorHandler, syscallErrorHandler ) {
        super( image, name, ppid, pid, uid, gid, messageHandler, errorHandler, ( thread, event ) => {
            // @ts-ignore
            syscallErrorHandler( thread, event );
        } );

        this.#syscallErrorHandler = syscallErrorHandler;

        // Send the INIT signal with initialisation data.
        /** @type { import('/js/lib/types.js').KInitData } */
        const init_data = {
            ppid: ppid,
            pid: pid,
            uid: uid,
            gid: gid,
            env: env,
            args: args
        };

        const init_reply = this.signal( Signal.INIT, init_data );

        init_reply.then( (event) => {
            if ( event.data.data.syscall !== Syscall.INIT ) {
                this.#syscallErrorHandler( this, event );
                return;
            }
            
            this.#heartbeat_ok = true;
        } );

        // Start heartbeat messages
        this.#heartbeat = setInterval( () => {
            if ( !this.#heartbeat_ok ) {
                super._errorHandler( this, new Error( 'Process Worker failed to respond to heartbeat in given period.' ) );
                return;
            }

            this.#heartbeat_ok = false;
            this.signal( Signal.HEARTBEAT ).then(( event ) => {

                console.log('badum');

                if ( event.data.data.syscall === Syscall.HEARTBEAT ) {
                    this.#heartbeat_ok = true;
                }
            })

        }, heartbeat_interval );

    }

    /**
     * Handler for messages received from the Worker.
     * @param { import('/js/lib/types.js').ThreadMessageEvent<import('/js/lib/types.js').PMessage> } event Message from Worker
     */
    #on_message_received = ( event ) => {
        
    }

    /**
     * Send a signal to the process, expecting a reply.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     * @param { number } [identifier] Identifier for this message, if this is an ongoing conversation, expecting another reply.
     * @returns { Promise<import('/js/lib/types.js').ThreadMessageEvent<import('/js/lib/types.js').PMessage>> }
     */
    signal = ( signal, data, transferables, identifier ) => {

        return super.message({
            signal: signal,
            data: data
        }, transferables, identifier);
    }

    /**
     * Wrapper to send a signal either as a reply, or not expecting a further response.
     * @param { number } identifier Unique identifier for the message. If 0, the signal is spontanious and expects no acknowledgement.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     */
    signal_noreply = ( identifier, signal, data, transferables ) => {
        this.#send_signal( identifier, signal, data, transferables );
    }

    /**
     * Wrapper for postMessage to talk to the process.
     * @param { number } identifier Unique identifier for the message.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     */
    #send_signal = ( identifier, signal, data, transferables = [] ) => {

        super._send_message(identifier, {
            signal: signal,
            data: data
        }, transferables);
    }

    /**
     * Terminate the process immediately.
     * 
     * This should only ever be called once the process has been unlinked
     * from any resources, and properly cleaned up.
     */
    kill = () => {
        clearInterval( this.#heartbeat );
        super.kill();
    }

    /**
     * @param { number } ppid
     */
    set ppid( ppid ) {
        super._ppid = ppid;
        this.signal_noreply( -1, Signal.NEWPPID, ppid );
    }

    get children() {
        return this.#children;
    }

}