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
 * 
 * The compiler will also have a whole lot of false positives if you dare
 * start a string with "export " on a new line, as it splits everything by new lines!
 * 
 * This *will* be rewritten, but getting an actual OS working takes priority...
 */
///#noimports

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
 * @prop { 'static'|'dynamic' } linkingType Whether this is a static or dynamically linked binary
 * @prop { 'executable'|'library' } type Whether this is an executable binary, or a dynamic library
 * @prop { string } author Author name
 * @prop { string } description Program description
 * @prop { number } version Program version
 * @prop { string } resolutionDir Directory to use to resolve local import paths in the project
 */

/**
 * @typedef { Map<string, { line: number, wants: Set<string> }> } JCImportList
 */

/**
 * @typedef JNIXBinary Workable representation of a JNIX binary
 * @prop { 'static'|'dynamic' } linkingType Whether this is a static or dynamically linked binary
 * @prop { 'executable'|'library' } type Whether this is an executable binary, or a dynamic library
 * @prop { string } author Author name
 * @prop { string } description Program description
 * @prop { number } version Program version
 * @prop { 1 } binVersion Version of the binary, starting the count at 1.
 * @prop { string } code Executable code
 */

/**
 * @typedef JCFile
 * @prop { string } name filename
 * @prop { string } importName Name used when importing this
 * @prop { Array<string> } content file content
 * @prop { Array<JCProcInst> } insts preprocessor instructions
 * @prop { JCImportList } imports imports for this file
 * @prop { Set<string> } wantedBy which other files want this file
 * @prop { Set<string> } exports List of exports from this file
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

const test_dir = '/js/lib/';

/**
 * Load a file. At the moment we will always assume it to be on the web server.
 * @param { string } fname Filename
 * @param { string } type File MIME type
 * @returns { Promise<string?> }
 */
async function example_load_file( fname, type ) {
    const res = await fetch( fname );

    if ( !res.ok || res.headers.get( 'content-type' ) !== type ) {
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
        // @ts-ignore
        config.type = 'executable';
    }

    config.author = config.author ?? '';
    config.description = config.description ?? '';
    
    if ( !( 'linkingType' in config ) ) {
        warn( 'Project linking type not specified, defaulting to "static".' );
        // @ts-ignore
        config.linkingType = 'static';
    }

    config.version = config.version ?? 1;

    if ( typeof config.entryPoint !== 'string' ) throw new JCError( '"entryPoint" is not of type string' );
    if ( config.type !== 'executable' && config.type !== 'library' ) throw new JCError( '"type" is not of type string' );
}

/**
 * Load the project config
 * @param { string } dir Project directory
 * @param { ( fname: string, type: string ) => Promise<string?> } load_file
 * @returns { Promise<JCProj?> }
 */
async function proj_load_config( dir, load_file ) {
    const config_text = await load_file( dir + 'jnixproj.json', 'application/json' );
    
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
 * @param { ( fname: string, type: string ) => Promise<string?> } load_file
 * @returns { Promise<JNIXBinary> }
 */
export async function proj_compile( dir, load_file ) {
    const config = await proj_load_config( dir, load_file );
    if ( config === null ) {
        throw new JCError( `Failed to locate project config for project ${ dir }` );
    }

    const entry_point_fname = config.resolutionDir + config.entryPoint;
    const entry_point = await load_file( entry_point_fname, 'application/javascript' );
    
    if ( entry_point === null ) {
        throw new JCError( `Entry point "${ entry_point_fname }" did not exist` );
    }

    /** @type { Map<string, JCFile> } */
    // List of files we know of currently
    const files = new Map();
    /** @type { Array<string> } */
    // Order of our dependencies to exist in the final file
    const order = new Array();

    const entry_file = file_parse( config, entry_point_fname, entry_point );
    await file_get_dependencies( files, config, entry_file, order, new Array(), load_file );

    /** @type { Array<string> } */
    const out = new Array();

    for ( const entry of order.slice( 0, -1 ) ) {
        /** @type { JCFile } */
        // @ts-ignore
        const file = files.get( entry );

        out.push(
            `const ${ file.importName } = await (async function() {`,
            ...file.content,
            `}());`
        );
    }

    out.push(
        `(async function() {`,
        ...entry_file.content,
        `})();`
    );

    return {
        author: config.author,
        description: config.description,
        version: config.version,
        linkingType: config.linkingType,
        binVersion: 1,
        type: config.type,
        code: out.join( '\n' ),
    }
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
 * @param { string } name
 * @param { string } file_string
 * @returns { JCFile }
 */
function file_parse( config, name, file_string ) {

    const content = file_split( file_string );
    const insts = file_preproc_get( content );
    const import_lines = file_get_import_lines( config, content, insts );
    const export_lines = file_get_export_lines( config, content );

    /** @type { JCImportList } */
    const imports = new Map();

    for ( const imp_ind of import_lines ) {
        // parse the line into our import format
        const { wants, path } = file_get_import( content[ imp_ind ].trim() );

        content[ imp_ind ] = `const { ${ Array.from( wants ).join(', ') } } = $$_${ path.replace( /[\.|\/]/g, '_' ) }_$$;`;
        
        imports.set( path, {
            line: imp_ind,
            wants
        } );
    }

    /** @type { Set<string> } */
    const exports = new Set();

    content.push(`;return {`);

    for ( const { line, name } of export_lines ) {
        exports.add( name );

        content[line] = content[line].replace( 'export ', '' );
        content.push( `    ${name},` );
    }

    content.push( '};' );

    return {
        name,
        importName: `$$_${name.replace( /[\.|\/]/g, '_' )}_$$`,
        content,
        insts,
        imports,
        exports,
        wantedBy: new Set()
    };
}

/**
 * @param { string } import_line
 */
function file_get_import( import_line ) {
    /** @type {string} */
    let checked, imp = import_line;

    // check starts with import
    [checked, imp] = str_split_one( imp, ' ' );
    assert( checked === 'import', `Malformed import ${ import_line }` );

    // check has destructuring
    [checked, imp] = str_split_one( imp, '{' );
    assert( checked.length === 0, `Malformed import ${ import_line }` );

    [checked, imp] = str_split_one( imp, '}' );

    // get list of wanted
    const wants = new Set(
        checked
            .split( ',' )
            .map( want => want.trim() ))
    ;

    [checked, imp] = str_split_one( imp, 'from ' );

    assert( imp.length > 0, `Malformed import ${ import_line }` );

    [checked, imp] = str_next_char( imp );

    assert( checked === '"' || checked === '\'', `Malformed import ${ import_line }` );

    // get path to the import
    const [path] = str_split_one( imp, checked );

    return {
        wants, path
    };
}

/**
 * @param { JCProj } config
 * @param { Array<string> } content
 * @returns { Set<{ line: number, name: string }> }
 */
function file_get_export_lines( config, content ) {
    
    /** @type { Set<{ line: number, name: string }> } */
    const exports = new Set();

    for ( let i = 0; i < content.length; i ++ ) {
        const line = content[i].trim().split( ' ' );

        if ( line.shift() !== 'export' ) {
            continue;
        }

        const type = line.shift();

        assert( type !== undefined, `Malformed export statement at line ${i}: ${ content[i] }` );

        if ( type === 'function' || type === 'const' || type === 'let' ) {
            const name = line.shift();

            assert( name !== undefined, `Malformed export statement at line ${i}: ${ content[i] }` );
            
            exports.add( {
                line: i,
                name: ( type === 'function' ? name.split('(')[0] : name )
            } );

            continue;
        }

        if ( type === 'async' ) {
            const kw = line.shift();
            
            assert( kw === 'function', `Malformed export statement at line ${i}: ${ content[i] }` );
            
            const name = line.shift();
            
            assert( name !== undefined, `Malformed export statement at line ${i}: ${ content[i] }` );
            
            exports.add( {
                line: i,
                name: name.split('(')[0]
            } );

            continue;
        }

        throw new JCError( `Malformed export statement at line ${i}: ${ content[i] }` );

    }

    return exports;

}

/**
 * Get the list of dependencies for a file and load them into the tracked list.
 * @param { Map<string, JCFile> } files
 * @param { JCProj } config 
 * @param { JCFile } file 
 * @param { Array<string> } order
 * @param { Array<string> } current_tree
 * @param { ( fname: string, type: string ) => Promise<string?> } load_file
 */
async function file_get_dependencies( files, config, file, order, current_tree, load_file ) {

    if ( current_tree.includes( file.name ) ) {
        throw new JCError( `Circular dependency exploring tree ${ current_tree.join( ' -> ' ) } -> ${ file.name }` );
    }

    const new_tree = current_tree.slice(0);
    new_tree.push( file.name );

    // debug nice list :)
    // console.log( `%c${'|  '.repeat( current_tree.length )}Searching file ${ file.name }`, 'color: gold' );

    for ( const [ name ] of file.imports ) {

        // console.log( `%c${'|  '.repeat( current_tree.length )}|--> %cimport ${ name } ${ files.has( name ) ? '(resolved)' : '' }`, 'color: gold', 'color: lightblue' );

        if ( files.has( name ) ) {
            const dep = files.get( name );
            dep?.wantedBy.add( file.name );

            continue;
        }

        const dep_string = await load_file( name, 'application/javascript' );

        if ( dep_string === null ) {
            throw new JCError( `Dependency "${ name }" for file ${ file.name } could not be resolved` );
        }

        const dep = file_parse( config, name, dep_string );
        dep.wantedBy.add( file.name );

        await file_get_dependencies( files, config, dep, order, new_tree, load_file );

        files.set( name, dep );
    }

    order.push( file.name );

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

console.log(await proj_compile( test_dir, example_load_file ));