import * as THREE from 'three';
import { rigidBody, sphere, MotionType, MotionQuality } from 'crashcat';

const SHELL_SPEED = 25;
const SHELL_RADIUS = 0.25;
const SHELL_Y = 0.25;
const SHELL_LIFETIME = 6.0;
const SHELL_IGNORE_OWNER = 0.15;
const SPAWN_OFFSET = 1.2;

const _shellDomeGeom = new THREE.SphereGeometry( SHELL_RADIUS, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2 );
_shellDomeGeom.scale( 1, 0.75, 1 );
const _shellBellyGeom = new THREE.CylinderGeometry( SHELL_RADIUS * 0.95, SHELL_RADIUS * 0.7, 0.06, 16 );
const _shellRimGeom = new THREE.TorusGeometry( SHELL_RADIUS * 0.98, 0.035, 6, 20 );

const _domeMat = new THREE.MeshStandardMaterial( { color: 0x2f7a32, roughness: 0.35, metalness: 0.0, flatShading: true } );
const _bellyMat = new THREE.MeshStandardMaterial( { color: 0xe8c373, roughness: 0.6 } );
const _rimMat = new THREE.MeshStandardMaterial( { color: 0x1f4f1f, roughness: 0.5 } );

function buildShellMesh() {

	const group = new THREE.Group();

	const dome = new THREE.Mesh( _shellDomeGeom, _domeMat );
	dome.position.y = 0.02;
	dome.castShadow = true;
	group.add( dome );

	// Darker hex segments on the shell, made from scaled-down spheres pressed into the dome
	const segGeom = new THREE.IcosahedronGeometry( SHELL_RADIUS * 0.18, 0 );
	const segMat = new THREE.MeshStandardMaterial( { color: 0x4ca64c, roughness: 0.4, flatShading: true } );
	const segRing = 6;
	for ( let i = 0; i < segRing; i ++ ) {

		const a = ( i / segRing ) * Math.PI * 2;
		const r = SHELL_RADIUS * 0.55;
		const seg = new THREE.Mesh( segGeom, segMat );
		seg.position.set( Math.cos( a ) * r, SHELL_RADIUS * 0.42, Math.sin( a ) * r );
		group.add( seg );

	}

	const crown = new THREE.Mesh( segGeom, segMat );
	crown.position.y = SHELL_RADIUS * 0.7;
	crown.scale.setScalar( 1.2 );
	group.add( crown );

	const rim = new THREE.Mesh( _shellRimGeom, _rimMat );
	rim.rotation.x = Math.PI / 2;
	rim.position.y = 0.02;
	group.add( rim );

	const belly = new THREE.Mesh( _shellBellyGeom, _bellyMat );
	belly.position.y = - 0.01;
	group.add( belly );

	return group;

}

export class Shell {

	constructor( world, scene, { position, direction, ownerBody, power = 1 } ) {

		this.world = world;
		this.scene = scene;
		this.ownerBody = ownerBody;
		this.power = power;
		this.alive = true;
		this.lifetime = SHELL_LIFETIME;
		this.ignoreOwnerTimer = SHELL_IGNORE_OWNER;

		const dir = direction.clone();
		dir.y = 0;
		dir.normalize();

		const spawnPos = [
			position.x + dir.x * SPAWN_OFFSET,
			SHELL_Y,
			position.z + dir.z * SPAWN_OFFSET,
		];

		this.body = rigidBody.create( world, {
			shape: sphere.create( { radius: SHELL_RADIUS } ),
			motionType: MotionType.DYNAMIC,
			objectLayer: world._OL_MOVING,
			position: spawnPos,
			mass: 20,
			friction: 0.0,
			restitution: 1.0,
			linearDamping: 0.0,
			angularDamping: 0.0,
			gravityFactor: 0,
			motionQuality: MotionQuality.LINEAR_CAST,
		} );

		rigidBody.setLinearVelocity( world, this.body, [
			dir.x * SHELL_SPEED,
			0,
			dir.z * SHELL_SPEED,
		] );

		this.mesh = buildShellMesh();
		this.mesh.position.set( spawnPos[ 0 ], spawnPos[ 1 ], spawnPos[ 2 ] );
		this.spinAxis = Math.atan2( dir.x, dir.z ) + Math.PI / 2;
		this.mesh.rotation.y = this.spinAxis;
		scene.add( this.mesh );

	}

	update( dt ) {

		if ( ! this.alive ) return;

		this.ignoreOwnerTimer = Math.max( 0, this.ignoreOwnerTimer - dt );
		this.lifetime -= dt;

		if ( this.lifetime <= 0 ) {

			this.alive = false;
			return;

		}

		const pos = this.body.position;
		const vel = this.body.motionProperties.linearVelocity;

		// Clamp to ground plane
		if ( pos[ 1 ] !== SHELL_Y || vel[ 1 ] !== 0 ) {

			rigidBody.setPosition( this.world, this.body, [ pos[ 0 ], SHELL_Y, pos[ 2 ] ], false );
			rigidBody.setLinearVelocity( this.world, this.body, [ vel[ 0 ], 0, vel[ 2 ] ] );

		}

		// Maintain constant horizontal speed (compensates for energy drift on bounces)
		const speedSq = vel[ 0 ] * vel[ 0 ] + vel[ 2 ] * vel[ 2 ];
		if ( speedSq > 0.01 ) {

			const scale = SHELL_SPEED / Math.sqrt( speedSq );
			if ( Math.abs( scale - 1 ) > 0.02 ) {

				rigidBody.setLinearVelocity( this.world, this.body, [
					vel[ 0 ] * scale,
					0,
					vel[ 2 ] * scale,
				] );

			}

		}

		this.mesh.position.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );
		this.mesh.rotation.y += dt * 6;

	}

	_buildImpact() {

		const vel = this.body.motionProperties.linearVelocity;
		const mag = Math.hypot( vel[ 0 ], vel[ 2 ] );
		const dirX = mag > 0.01 ? vel[ 0 ] / mag : 0;
		const dirZ = mag > 0.01 ? vel[ 2 ] / mag : 1;
		return { dirX, dirZ, power: this.power };

	}

	onContact( otherBody, bodyToNPC, vehicle, hitFX ) {

		if ( otherBody === this.ownerBody ) {

			if ( this.ignoreOwnerTimer > 0 ) return;
			if ( vehicle ) vehicle.stun( this._buildImpact() );
			if ( hitFX ) {

				const p = this.body.position;
				hitFX.burst( p[ 0 ], p[ 1 ], p[ 2 ] );

			}
			this.alive = false;
			return;

		}

		const npc = bodyToNPC.get( otherBody );
		if ( npc ) {

			npc.hit( this._buildImpact() );
			if ( hitFX ) {

				const p = this.body.position;
				hitFX.burst( p[ 0 ], p[ 1 ], p[ 2 ] );

			}
			this.alive = false;

		}
		// Walls and non-target bodies: let physics handle bounce

	}

	destroy() {

		rigidBody.remove( this.world, this.body );
		this.scene.remove( this.mesh );

	}

}
