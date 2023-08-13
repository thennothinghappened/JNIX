/**
 * Circular ArrayBuffer implementation
 * 
 * Currently only supports Uint16, and doesn't support SharedArrayBuffer,
 * which is the whole point of this!
 * 
 * proof of concept getting this stuff to play nice at all. really awful!
 */

/**
 * Uint16 Circular ArrayBuffer
 * @param { number } length Length of the buffer in units of the buffer type
 */
export function Uint16Circular( length ) {
    const header_size = Uint32Array.BYTES_PER_ELEMENT;

    // Create our ArrayBuffer with space for current write index
    const buffer = new ArrayBuffer( Uint16Array.BYTES_PER_ELEMENT * length + header_size );

    // View for the head position
    const wi = new Uint32Array( buffer, 0, 1 );
    wi[0] = 0;

    // View for reading/writing data
    const data = new Uint16Array( buffer, header_size );

    /** Return the byteLength of the data buffer */
    function byteLength() {
        return data.byteLength;
    }

    /** Return the length in elements of the data buffer */
    function elementLength() {
        return length;
    }

    /** Returns the current head index */
    function head() {
        return wi[0];
    }

    /** Advance the head position */
    function advance() {
        let h = head() + 1;

        if ( h >= elementLength() ) {
            h = 0;
        }

        wi[0] = h;
    }

    /**
     * Write to the end of the buffer
     * @param { number } byte 
     **/
    function write( byte ) {
        console.log('writing', String.fromCharCode(byte), 'at index', head());
        data[head()] = byte;
        advance();
    }

    /** Read the last byte */
    function read() {
        return data[head()];
    }

    /**
     * Read a length of the data
     * @param { number } length 
     */
    function read_section( length ) {

        if ( length > elementLength() ) {
            throw new Error( `Tried to read length ${length} from CircularBuffer of length ${elementLength()}` );
        }

        let overflow = 0;
        if ( head() - length <= 0 ) {
            overflow = length - head();
        }

        if ( overflow === 0 ) {
            return [... data.slice( length - head(), head() ) ];
        }

        return [
            ...data.slice( elementLength() - overflow, elementLength() ),
            ...data.slice( 0, head() )
        ];

    }

    return {
        byteLength,
        elementLength,
        head,
        read,
        write,
        read_section,
        buffer
    };
}