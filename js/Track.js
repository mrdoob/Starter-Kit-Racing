import * as THREE from 'three';

export const ORIENT_DEG = { 0: 0, 10: 180, 16: 90, 22: 270 };

export const CELL_RAW = 9.99;
export const GRID_SCALE = 0.75;

const _dummy = new THREE.Object3D();

export const TRACK_CELLS = [
	[ -3, -3, 'track-corner',   16 ],
	[ -2, -3, 'track-straight', 22 ],
	[ -1, -3, 'track-straight', 22 ],
	[  0, -3, 'track-corner',    0 ],
	[ -3, -2, 'track-straight',  0 ],
	[  0, -2, 'track-straight',  0 ],
	[ -3, -1, 'track-corner',   10 ],
	[ -2, -1, 'track-corner',    0 ],
	[  0, -1, 'track-straight',  0 ],
	[ -2,  0, 'track-straight', 10 ],
	[  0,  0, 'track-finish',    0 ],
	[ -2,  1, 'track-straight', 10 ],
	[  0,  1, 'track-straight',  0 ],
	[ -2,  2, 'track-corner',   10 ],
	[ -1,  2, 'track-straight', 16 ],
	[  0,  2, 'track-corner',   22 ],
];

const DECO_CELLS = [
	[ -4, -2, 'decoration-tents', 10 ],
	[ -1, -4, 'decoration-tents', 22 ],
	[ -1,  1, 'decoration-tents', 22 ],
	[ -8, -9, 'decoration-forest', 0 ], [ -7, -9, 'decoration-forest', 0 ],
	[ -6, -9, 'decoration-forest', 0 ], [ -5, -9, 'decoration-forest', 0 ],
	[ -4, -9, 'decoration-forest', 0 ], [ -3, -9, 'decoration-forest', 0 ],
	[ -2, -9, 'decoration-forest', 0 ], [ -1, -9, 'decoration-forest', 0 ],
	[  0, -9, 'decoration-forest', 0 ], [  1, -9, 'decoration-forest', 0 ],
	[  2, -9, 'decoration-forest', 0 ],
	[ -8, -8, 'decoration-forest', 0 ], [ -7, -8, 'decoration-forest', 0 ],
	[ -6, -8, 'decoration-forest', 0 ], [ -5, -8, 'decoration-forest', 0 ],
	[ -4, -8, 'decoration-forest', 0 ], [ -3, -8, 'decoration-forest', 0 ],
	[ -2, -8, 'decoration-forest', 0 ], [ -1, -8, 'decoration-forest', 0 ],
	[  0, -8, 'decoration-forest', 0 ], [  1, -8, 'decoration-forest', 0 ],
	[  2, -8, 'decoration-forest', 0 ],
	[ -8, -7, 'decoration-forest', 0 ], [ -7, -7, 'decoration-forest', 0 ],
	[ -6, -7, 'decoration-forest', 0 ], [ -5, -7, 'decoration-forest', 0 ],
	[ -4, -7, 'decoration-forest', 0 ], [ -3, -7, 'decoration-forest', 0 ],
	[ -2, -7, 'decoration-forest', 0 ], [ -1, -7, 'decoration-forest', 0 ],
	[  0, -7, 'decoration-forest', 0 ], [  1, -7, 'decoration-forest', 0 ],
	[  2, -7, 'decoration-forest', 0 ],
	[ -8, -6, 'decoration-forest', 0 ], [ -7, -6, 'decoration-forest', 0 ],
	[ -6, -6, 'decoration-forest', 0 ], [ -5, -6, 'decoration-forest', 0 ],
	[ -4, -6, 'decoration-forest', 0 ], [ -3, -6, 'decoration-empty', 0 ],
	[ -2, -6, 'decoration-empty', 0 ],  [ -1, -6, 'decoration-empty', 0 ],
	[  0, -6, 'decoration-empty', 0 ],  [  1, -6, 'decoration-forest', 0 ],
	[  2, -6, 'decoration-forest', 0 ],
	[ -8, -5, 'decoration-forest', 0 ], [ -7, -5, 'decoration-forest', 0 ],
	[ -6, -5, 'decoration-forest', 0 ], [ -5, -5, 'decoration-forest', 0 ],
	[ -4, -5, 'decoration-empty', 0 ],  [ -3, -5, 'decoration-empty', 0 ],
	[ -2, -5, 'decoration-empty', 0 ],  [ -1, -5, 'decoration-empty', 0 ],
	[  0, -5, 'decoration-empty', 0 ],  [  1, -5, 'decoration-forest', 0 ],
	[  2, -5, 'decoration-forest', 0 ],
	[ -8, -4, 'decoration-forest', 0 ], [ -7, -4, 'decoration-forest', 0 ],
	[ -6, -4, 'decoration-forest', 0 ], [ -5, -4, 'decoration-forest', 0 ],
	[ -4, -4, 'decoration-empty', 0 ],
	[  1, -4, 'decoration-forest', 0 ],
	[  2, -4, 'decoration-forest', 0 ],
	[ -8, -3, 'decoration-forest', 0 ], [ -7, -3, 'decoration-forest', 0 ],
	[ -6, -3, 'decoration-forest', 0 ], [ -5, -3, 'decoration-forest', 0 ],
	[ -4, -3, 'decoration-empty', 0 ],
	[  1, -3, 'decoration-forest', 0 ],
	[  2, -3, 'decoration-forest', 0 ],
	[ -8, -2, 'decoration-forest', 0 ], [ -7, -2, 'decoration-forest', 0 ],
	[ -6, -2, 'decoration-forest', 0 ], [ -5, -2, 'decoration-forest', 0 ],
	[  1, -2, 'decoration-forest', 0 ],
	[  2, -2, 'decoration-forest', 0 ],
	[ -8, -1, 'decoration-forest', 0 ], [ -7, -1, 'decoration-forest', 0 ],
	[ -6, -1, 'decoration-forest', 0 ], [ -5, -1, 'decoration-forest', 0 ],
	[ -4, -1, 'decoration-empty', 0 ],  [ -1, -1, 'decoration-empty', 0 ],
	[  1, -1, 'decoration-forest', 0 ],
	[  2, -1, 'decoration-forest', 0 ],
	[ -8,  0, 'decoration-forest', 0 ], [ -7,  0, 'decoration-forest', 0 ],
	[ -6,  0, 'decoration-forest', 0 ], [ -5,  0, 'decoration-forest', 0 ],
	[ -4,  0, 'decoration-empty', 0 ],  [ -3,  0, 'decoration-empty', 0 ],
	[ -1,  0, 'decoration-empty', 0 ],
	[  1,  0, 'decoration-forest', 0 ],
	[  2,  0, 'decoration-forest', 0 ],
	[ -8,  1, 'decoration-forest', 0 ], [ -7,  1, 'decoration-forest', 0 ],
	[ -6,  1, 'decoration-forest', 0 ], [ -5,  1, 'decoration-forest', 0 ],
	[ -4,  1, 'decoration-empty', 0 ],  [ -3,  1, 'decoration-empty', 0 ],
	[  1,  1, 'decoration-forest', 0 ],
	[  2,  1, 'decoration-forest', 0 ],
	[ -8,  2, 'decoration-forest', 0 ], [ -7,  2, 'decoration-forest', 0 ],
	[ -6,  2, 'decoration-forest', 0 ], [ -5,  2, 'decoration-forest', 0 ],
	[ -4,  2, 'decoration-empty', 0 ],  [ -3,  2, 'decoration-empty', 0 ],
	[  1,  2, 'decoration-forest', 0 ],
	[  2,  2, 'decoration-forest', 0 ],
	[ -8,  3, 'decoration-forest', 0 ], [ -7,  3, 'decoration-forest', 0 ],
	[ -6,  3, 'decoration-forest', 0 ], [ -5,  3, 'decoration-forest', 0 ],
	[ -4,  3, 'decoration-forest', 0 ], [ -3,  3, 'decoration-forest', 0 ],
	[ -2,  3, 'decoration-forest', 0 ], [ -1,  3, 'decoration-forest', 0 ],
	[  0,  3, 'decoration-forest', 0 ], [  1,  3, 'decoration-forest', 0 ],
	[  2,  3, 'decoration-forest', 0 ],
	[ -8,  4, 'decoration-forest', 0 ], [ -7,  4, 'decoration-forest', 0 ],
	[ -6,  4, 'decoration-forest', 0 ], [ -5,  4, 'decoration-forest', 0 ],
	[ -4,  4, 'decoration-forest', 0 ], [ -3,  4, 'decoration-forest', 0 ],
	[ -2,  4, 'decoration-forest', 0 ], [ -1,  4, 'decoration-forest', 0 ],
	[  0,  4, 'decoration-forest', 0 ], [  1,  4, 'decoration-forest', 0 ],
	[  2,  4, 'decoration-forest', 0 ],
];

export const NPC_TRUCKS = [
	[ 'vehicle-truck-green',  -3.51, -0.01,  12.70,  98.0 ],
	[ 'vehicle-truck-purple', -23.78, -0.14, -13.56,   0.0 ],
	[ 'vehicle-truck-red',    -1.36, -0.15, -23.80, 155.9 ],
];

export function buildTrack( scene, models, customCells ) {

	const trackGroup = new THREE.Group();
	trackGroup.position.y = -0.5;

	const trackPieceGroup = new THREE.Group();
	const decoGroup = new THREE.Group();

	const cells = customCells || TRACK_CELLS;

	for ( const [ gx, gz, key, orient ] of cells ) {

		const piece = placePiece( models, key, gx, gz, orient );
		if ( piece ) trackPieceGroup.add( piece );

	}

	{

		const occupied = new Set();
		let minX = Infinity, maxX = - Infinity;
		let minZ = Infinity, maxZ = - Infinity;

		for ( const [ gx, gz ] of cells ) {

			occupied.add( gx + ',' + gz );
			minX = Math.min( minX, gx );
			maxX = Math.max( maxX, gx );
			minZ = Math.min( minZ, gz );
			maxZ = Math.max( maxZ, gz );

		}

		const emptyPositions = [];
		const forestPositions = [];
		const tentPositions = [];
		const buckets = {
			'decoration-empty': emptyPositions,
			'decoration-forest': forestPositions,
			'decoration-tents': tentPositions,
		};

		if ( ! customCells ) {

			for ( const [ gx, gz, key, orient ] of DECO_CELLS ) {

				occupied.add( gx + ',' + gz );
				minX = Math.min( minX, gx );
				maxX = Math.max( maxX, gx );
				minZ = Math.min( minZ, gz );
				maxZ = Math.max( maxZ, gz );

				const x = ( gx + 0.5 ) * CELL_RAW;
				const z = ( gz + 0.5 ) * CELL_RAW;
				const rotQ = ( ( ORIENT_DEG[ orient ] ?? 0 ) / 90 ) | 0;
				buckets[ key ]?.push( x, z, rotQ );

			}

		}

		const pad = 3;

		// Simple hash for deterministic pseudo-random placement
		function hash( gx, gz ) {

			let h = gx * 374761393 + gz * 668265263;
			h = ( h ^ ( h >> 13 ) ) * 1274126177;
			return ( h ^ ( h >> 16 ) ) >>> 0;

		}

		for ( let gz = minZ - pad; gz <= maxZ + pad; gz ++ ) {

			for ( let gx = minX - pad; gx <= maxX + pad; gx ++ ) {

				if ( occupied.has( gx + ',' + gz ) ) continue;

				const distX = gx < minX ? minX - gx : gx > maxX ? gx - maxX : 0;
				const distZ = gz < minZ ? minZ - gz : gz > maxZ ? gz - maxZ : 0;
				const dist = Math.max( distX, distZ );

				const x = ( gx + 0.5 ) * CELL_RAW;
				const z = ( gz + 0.5 ) * CELL_RAW;

				if ( dist <= 1 ) {

					// ~15% chance of tents in the empty ring
					if ( hash( gx, gz ) % 7 === 0 ) {

						tentPositions.push( x, z, hash( gx, gz ) % 4 );

					} else {

						emptyPositions.push( x, z, 0 );

					}

				} else {

					forestPositions.push( x, z, 0 );

				}

			}

		}

		function createInstances( src, positions ) {

			if ( positions.length === 0 || ! src ) return;

			const count = positions.length / 3;

			src.traverse( ( child ) => {

				if ( ! child.isMesh ) return;

				const inst = new THREE.InstancedMesh( child.geometry, child.material, count );
				inst.castShadow = true;
				inst.receiveShadow = true;

				for ( let i = 0; i < count; i ++ ) {

					_dummy.position.set( positions[ i * 3 ], 0.5, positions[ i * 3 + 1 ] );
					_dummy.rotation.y = positions[ i * 3 + 2 ] * Math.PI / 2;
					_dummy.updateMatrix();
					inst.setMatrixAt( i, _dummy.matrix );

				}

				decoGroup.add( inst );

			} );

		}

		createInstances( models[ 'decoration-empty' ], emptyPositions );
		createInstances( models[ 'decoration-forest' ], forestPositions );
		createInstances( models[ 'decoration-tents' ], tentPositions );

	}

	trackGroup.add( trackPieceGroup );
	trackGroup.add( decoGroup );

	trackGroup.scale.setScalar( 0.75 );
	scene.add( trackGroup );

	trackGroup.updateMatrixWorld( true );

	trackGroup.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.castShadow = true;
			child.receiveShadow = true;

		}

	} );

}

export function placePiece( models, key, gx, gz, orient ) {

	const src = models[ key ];
	if ( ! src ) return null;

	const piece = src.clone();
	piece.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW );

	const deg = ORIENT_DEG[ orient ] ?? 0;
	piece.rotation.y = THREE.MathUtils.degToRad( deg );

	return piece;

}

// ─── Track Codec ──────────────────────────────────────────

const TYPE_NAMES = [ 'track-straight', 'track-corner', 'track-bump', 'track-finish' ];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

const ORIENT_TO_GODOT = [ 0, 16, 10, 22 ];
const GODOT_TO_ORIENT = { 0: 0, 16: 1, 10: 2, 22: 3 };

export { TYPE_NAMES };

export function encodeCells( cells ) {

	const bytes = new Uint8Array( cells.length * 3 );

	for ( let i = 0; i < cells.length; i ++ ) {

		const [ gx, gz, name, godotOrient ] = cells[ i ];
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = GODOT_TO_ORIENT[ godotOrient ] ?? 0;

		bytes[ i * 3 ] = gx + 128;
		bytes[ i * 3 + 1 ] = gz + 128;
		bytes[ i * 3 + 2 ] = ( ti << 2 ) | oi;

	}

	return bytesToBase64url( bytes );

}

export function decodeCells( str ) {

	const bytes = base64urlToBytes( str );
	const cells = [];

	for ( let i = 0; i + 2 < bytes.length; i += 3 ) {

		const gx = bytes[ i ] - 128;
		const gz = bytes[ i + 1 ] - 128;
		const packed = bytes[ i + 2 ];
		const ti = ( packed >> 2 ) & 0x03;
		const oi = packed & 0x03;

		cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_TO_GODOT[ oi ] ] );

	}

	return cells;

}

export function computeSpawnPosition( cells ) {

	let cell = cells[ 0 ];

	for ( const c of cells ) {

		if ( c[ 2 ] === 'track-finish' ) {

			cell = c;
			break;

		}

	}

	if ( ! cell ) return { position: [ 3.5, 0.5, 5 ], angle: 0 };

	const gx = cell[ 0 ];
	const gz = cell[ 1 ];
	const x = ( gx + 0.5 ) * CELL_RAW * GRID_SCALE;
	const z = ( gz + 0.5 ) * CELL_RAW * GRID_SCALE;

	const orient = cell[ 3 ];
	const angle = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] || 0 );

	return { position: [ x, 0.5, z ], angle };

}

export function computeTrackBounds( cells ) {

	if ( ! cells || cells.length === 0 ) return { centerX: 0, centerZ: 0, halfWidth: 30, halfDepth: 30 };

	let minX = Infinity, maxX = - Infinity;
	let minZ = Infinity, maxZ = - Infinity;

	for ( const [ gx, gz ] of cells ) {

		minX = Math.min( minX, gx );
		maxX = Math.max( maxX, gx );
		minZ = Math.min( minZ, gz );
		maxZ = Math.max( maxZ, gz );

	}

	const S = CELL_RAW * GRID_SCALE;
	const centerX = ( minX + maxX + 1 ) / 2 * S;
	const centerZ = ( minZ + maxZ + 1 ) / 2 * S;
	const halfWidth = ( maxX - minX + 1 ) / 2 * S + S;
	const halfDepth = ( maxZ - minZ + 1 ) / 2 * S + S;

	return { centerX, centerZ, halfWidth, halfDepth };

}

function bytesToBase64url( bytes ) {

	let binary = '';
	for ( let i = 0; i < bytes.length; i ++ ) binary += String.fromCharCode( bytes[ i ] );

	return btoa( binary ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );

}

function base64urlToBytes( str ) {

	const base64 = str.replace( /-/g, '+' ).replace( /_/g, '/' );
	const binary = atob( base64 );
	const bytes = new Uint8Array( binary.length );
	for ( let i = 0; i < binary.length; i ++ ) bytes[ i ] = binary.charCodeAt( i );

	return bytes;

}
