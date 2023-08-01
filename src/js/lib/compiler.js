/**
 * This is a test compiler, and will be *horribly bad*!
 * 
 * Purpose of this is just to get a minimal setup up and running
 * so I can focus on the actual OS, and come back to making this less
 * awful later as a drop-in replacement.
 * 
 * The compiler for now is *really* dumb, and you have to
 * tell it about everything manually. Later on, hopefully
 * I can get something better going.
 */

/**
 * @enum { string }
 */
const JCProjInstruction = {
    endImports: 'endimports',
    noImports: 'noimports',
};

/**
 * @typedef JCProj
 * @prop { string } entryPoint Entry point of the program
 * @prop { 'executable'|'library' } type Whether to compile to a final executable, or to create a dynamic library 
 * @prop { string } resolutionDir Directory to use to resolve local import paths in the project
 */

/**
 * @typedef JCFile
 * @prop { string } name filename
 * @prop { Array<string> } content file content
 * @prop { Array<JCProcInst> } insts preprocessor instructions
 * @prop { Array<JCFile> } imports imports for this file
 */

/**
 * @typedef JCProcInst
 * @prop { JCProjInstruction } name
 * @prop { Array<string> } params
 * @prop { number } line
 */

class JCError extends Error {
    /**
     * @param {string} message 
     */
    constructor( message ) {
        super( message );
        this.name = 'JNIX Compilation Error';
    }
}

const test_dir = '/js/lib/test_project/';

/**
 * Load a file. At the moment we will always assume it to be on the web server.
 * @param {string} fname Filename
 * @returns { Promise<string?> }
 */
async function load_file( fname ) {
    const res = await fetch( fname );

    if ( !res.ok ) {
        return null;
    }

    return await res.text();
}

/**
 * Check JNIX project config is valid.
 * @param { JCProj } config
 */
function check_config( config ) {
    if ( !( 'type' in config ) ) {
        warn( 'Project type not specified, defaulting to "executable".' );
        config.type = 'executable';
    }

    if ( typeof config.entryPoint !== 'string' ) throw new JCError( '"entryPoint" is not of type string' );
    if ( config.type !== 'executable' && config.type !== 'library' ) throw new JCError( '"type" is not of type string' );
}

/**
 * Load the project config
 * @param { string } dir Project directory
 * @returns { Promise<JCProj?> }
 */
async function proj_load_config( dir ) {
    const config_text = await load_file( dir + 'jnixproj.json' );
    
    if ( config_text === null ) {
        return null;
    }

    try {
        const config = JSON.parse( config_text );
        check_config( config );

        config.resolutionDir = dir;

        return config;
    } catch (error) {
        throw new JCError( `Failed to parse project config for project ${ dir }: ${ error }` );
    }
}

/**
 * Entry point to begin compiling a project
 * @param { string } dir 
 */
async function proj_compile( dir ) {
    const config = await proj_load_config( dir );
    if ( config === null ) {
        throw new JCError( `Failed to locate project config for project ${ dir }` );
    }

    const entry_point_fname = config.resolutionDir + config.entryPoint;
    const entry_point = await load_file( entry_point_fname );
    
    if ( entry_point === null ) {
        throw new JCError( `Entry point "${ entry_point_fname }" did not exist` );
    }

    file_parse( config, entry_point );
}

/**
 * Split a file by its newlines
 * @param { string } file_string 
 * @returns { Array<string> }
 */
function file_split( file_string ) {
    return file_string.split( '\n' );
}

/**
 * Parse a given file from a string
 * @param { JCProj } config
 * @param { string } file_string
 */
async function file_parse( config, file_string ) {

    const file = file_split( file_string );
    const insts = file_preproc_get( file );
    const import_lines = file_get_import_lines( config, file, insts );

    for ( const imp_ind of import_lines ) {
        // parse the line into our import format
        let imp = file[ imp_ind ].trim();

        /** @type {string} */
        let checked;

        [checked, imp] = str_split_one( imp, ' ' );
        assert( checked === 'import', `Malformed import ${ file[ imp_ind ] }` );

        [checked, imp] = str_split_one( imp, '{' );
        assert( checked.length === 0, `Malformed import ${ file[ imp_ind ] }` );

        [checked, imp] = str_split_one( imp, '}' );

        const wants = checked
            .split( ',' )
            .map( want => want.trim() );

        [checked, imp] = str_split_one( imp, 'from ' );

        [checked, imp] = str_next_char( imp );

        assert( checked === '"' || checked === '\'', `Malformed import ${ file[ imp_ind ] }` );

        const [path] = str_split_one( imp, checked );
        
        console.log(wants, path);
    }
}

/**
 * Assert a condition to be true or error.
 * @param { boolean } condition 
 * @param { string } message 
 */
function assert( condition, message ) {
    if ( !condition ) {
        throw new JCError( message );
    }
}

/**
 * Split a string once at the first instance of a delimiter
 * @param { string } string
 * @param { string } delimiter
 * @returns { [string, string] }
 */
function str_split_one( string, delimiter ) {
    const dpos = string.indexOf( delimiter );
    if ( dpos === -1 ) {
        return [ string, '' ];
    }

    return [
        string.slice( 0, dpos ),
        string.slice( dpos + delimiter.length )
    ];
}

/**
 * Get the next character of a string and return it removed
 * @param { string } string 
 * @returns { [string, string] }
 */
function str_next_char( string ) {
    return [
        string.charAt( 0 ),
        string.slice( 1 )
    ]
}

/**
 * Get list of preprocessor instructions in the file
 * @param { Array<string> } file 
 * @returns { Array<JCProcInst> }
 */
function file_preproc_get( file ) {

    /** @type { Array<JCProcInst> } */
    const insts = new Array();

    file.forEach( ( line, index ) => {
        if ( line.startsWith( '///#' ) ) {
            const data = line.slice( 4 ).split( ' ' );
            insts.push( {
                name: data[0],
                line: index,
                params: data.slice(1)
            } );
        }
    } );

    return insts;
}

/**
 * Get the list of lines imports appear in the file
 * @param { JCProj } config
 * @param { Array<string> } file
 * @param { Array<JCProcInst> } insts
 * @returns { Array<number> }
 */
function file_get_import_lines( config, file, insts ) {
    if ( insts.find( ( inst ) => inst.name === JCProjInstruction.noImports ) ) {
        return new Array();
    }

    const end_line = insts.find( ( inst ) => inst.name === JCProjInstruction.endImports );
    if ( end_line === undefined ) {
        throw new JCError( 'Found neither declaration "#noimports" or "#endimports" parsing file' );
    }

    const import_lines = file.slice( 0, end_line.line );
    
    // @ts-ignore
    // not sure why it's claiming this returns array<number?> when they're filtered.
    return import_lines
        .map( ( line, index ) => line.startsWith('import') ? index : null )
        .filter( line => line !== null );
}

/**
 * Show a compiler warning
 * @param { string } message
 */
function warn( message ) {
    console.warn( `JNIX Compilation: ${ message }` );
}

proj_compile( test_dir );