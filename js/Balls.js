import * as THREE from 'three';
import { rigidBody, sphere, MotionType } from 'crashcat';

const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

export function spawnBalls( scene, world, bounds, count = 600 ) {

	const geometry = new THREE.IcosahedronGeometry( 1, 3 );
	const material = new THREE.MeshStandardMaterial( { roughness: 1 } );

	const mesh = new THREE.InstancedMesh( geometry, material, count );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	scene.add( mesh );

	const bodies = [];
	const radii = new Float32Array( count );

	const margin = 1;
	const halfX = bounds.halfWidth - margin;
	const halfZ = bounds.halfDepth - margin;

	const color = new THREE.Color();

	for ( let i = 0; i < count; i ++ ) {

		const x = ( Math.random() * 2 - 1 ) * halfX;
		const z = ( Math.random() * 2 - 1 ) * halfZ;
		const radius = 0.25 + Math.random() * 0.75;

		radii[ i ] = radius;

		bodies.push( rigidBody.create( world, {
			shape: sphere.create( { radius } ),
			motionType: MotionType.DYNAMIC,
			objectLayer: world._OL_MOVING,
			position: [ bounds.centerX + x, radius + 0.1, bounds.centerZ + z ],
			mass: radius * radius * radius * 20,
			friction: 0.8,
			restitution: 0.5,
			linearDamping: 0.2,
			angularDamping: 0.2,
		} ) );

		color.setHSL( Math.random(), 0.9, 0.5 );
		mesh.setColorAt( i, color );

	}

	function update() {

		for ( let i = 0; i < count; i ++ ) {

			const b = bodies[ i ];
			_position.set( b.position[ 0 ], b.position[ 1 ], b.position[ 2 ] );
			_quaternion.set( b.quaternion[ 0 ], b.quaternion[ 1 ], b.quaternion[ 2 ], b.quaternion[ 3 ] );
			_scale.setScalar( radii[ i ] );
			_matrix.compose( _position, _quaternion, _scale );
			mesh.setMatrixAt( i, _matrix );

		}

		mesh.instanceMatrix.needsUpdate = true;

	}

	return { update };

}
