import * as THREE from 'three';
import { rigidBody, box, MotionType } from 'crashcat';

const NPC_HALF_EXTENTS = [ 0.5, 0.4, 1.0 ];
const HIT_DURATION = 2.2;
const HIT_SPIN_VEL = 22;
const SPIN_DECAY = 0.45;
const HIT_HOP_VEL = 5.5;
const HIT_GRAVITY = 18;
const HIT_TILT = 0.35;
const KNOCKBACK_VEL = 5.5;
const KNOCKBACK_DECAY = 2.3;
const ARRIVAL_DIST_SQ = 4.0;
const DEFAULT_SPEED = 5.5;
const ROT_LERP = 5;

// Outer loop waypoints around the figure-8 track, in driving order
export const WAYPOINTS = [
	[   3.75,  11.25 ],
	[   3.75,  18.75 ],
	[  -3.75,  18.75 ],
	[ -11.25,  18.75 ],
	[ -11.25,  11.25 ],
	[ -11.25,  -3.75 ],
	[ -18.75, -11.25 ],
	[ -18.75, -18.75 ],
	[ -11.25, -18.75 ],
	[  -3.75, -18.75 ],
	[   3.75, -18.75 ],
	[   3.75, -11.25 ],
	[   3.75,  -3.75 ],
	[   3.75,   3.75 ],
];

function lerpAngle( a, b, t ) {

	let diff = b - a;
	while ( diff > Math.PI ) diff -= Math.PI * 2;
	while ( diff < - Math.PI ) diff += Math.PI * 2;
	return a + diff * t;

}

function nearestWaypointIndex( x, z ) {

	let best = 0;
	let bestDist = Infinity;
	for ( let i = 0; i < WAYPOINTS.length; i ++ ) {

		const [ wx, wz ] = WAYPOINTS[ i ];
		const d = ( wx - x ) * ( wx - x ) + ( wz - z ) * ( wz - z );
		if ( d < bestDist ) {

			bestDist = d;
			best = i;

		}

	}

	return best;

}

export class NPC {

	constructor( world, scene, modelSource, x, y, z, rotDeg, speed = DEFAULT_SPEED ) {

		this.world = world;

		this.mesh = modelSource.clone();
		this.mesh.position.set( x, y, z );
		this.mesh.rotation.y = THREE.MathUtils.degToRad( rotDeg + 180 );
		this.mesh.traverse( ( c ) => {

			if ( c.isMesh ) {

				c.castShadow = true;
				c.receiveShadow = true;

			}

		} );
		scene.add( this.mesh );

		this.bodyY = y + NPC_HALF_EXTENTS[ 1 ];
		this.body = rigidBody.create( world, {
			shape: box.create( { halfExtents: NPC_HALF_EXTENTS } ),
			motionType: MotionType.KINEMATIC,
			objectLayer: world._OL_MOVING,
			position: [ x, this.bodyY, z ],
			quaternion: [ 0, Math.sin( this.mesh.rotation.y / 2 ), 0, Math.cos( this.mesh.rotation.y / 2 ) ],
		} );

		this.speed = speed;
		this.waypointIndex = ( nearestWaypointIndex( x, z ) + 1 ) % WAYPOINTS.length;

		this.hitTimer = 0;
		this.spinVel = 0;
		this.hopVel = 0;
		this.knockVx = 0;
		this.knockVz = 0;
		this.baseY = y;

	}

	hit( impact = null ) {

		const power = impact ? impact.power : 1;
		this.hitTimer = HIT_DURATION * power;
		this.spinVel = HIT_SPIN_VEL * power * ( Math.random() < 0.5 ? - 1 : 1 );
		this.hopVel = HIT_HOP_VEL * ( 0.7 + 0.3 * power );
		if ( impact ) {

			this.knockVx = impact.dirX * KNOCKBACK_VEL * power;
			this.knockVz = impact.dirZ * KNOCKBACK_VEL * power;

		}

	}

	update( dt ) {

		if ( this.hitTimer > 0 ) {

			this.hitTimer = Math.max( 0, this.hitTimer - dt );
			this.mesh.rotation.y += this.spinVel * dt;
			this.spinVel *= Math.max( 0, 1 - SPIN_DECAY * dt );

			this.hopVel -= HIT_GRAVITY * dt;
			this.mesh.position.y = Math.max( this.baseY, this.mesh.position.y + this.hopVel * dt );
			if ( this.mesh.position.y <= this.baseY && this.hopVel < 0 ) {

				this.hopVel *= - 0.35;
				this.mesh.position.y = this.baseY;

			}

			// Knockback slide — carries the truck in the impact direction
			if ( this.knockVx !== 0 || this.knockVz !== 0 ) {

				this.mesh.position.x += this.knockVx * dt;
				this.mesh.position.z += this.knockVz * dt;
				const decay = Math.max( 0, 1 - KNOCKBACK_DECAY * dt );
				this.knockVx *= decay;
				this.knockVz *= decay;
				rigidBody.setPosition( this.world, this.body, [
					this.mesh.position.x, this.bodyY, this.mesh.position.z,
				], false );

			}

			const tiltPhase = this.hitTimer * 9;
			this.mesh.rotation.z = Math.sin( tiltPhase ) * HIT_TILT * ( this.hitTimer / HIT_DURATION );
			this.mesh.rotation.x = Math.cos( tiltPhase * 0.7 ) * HIT_TILT * 0.5 * ( this.hitTimer / HIT_DURATION );
			return;

		}

		this.knockVx = 0;
		this.knockVz = 0;

		if ( this.mesh.rotation.z !== 0 || this.mesh.rotation.x !== 0 ) {

			this.mesh.rotation.z *= Math.max( 0, 1 - dt * 6 );
			this.mesh.rotation.x *= Math.max( 0, 1 - dt * 6 );

		}

		const [ tx, tz ] = WAYPOINTS[ this.waypointIndex ];
		const dx = tx - this.mesh.position.x;
		const dz = tz - this.mesh.position.z;
		const distSq = dx * dx + dz * dz;

		if ( distSq < ARRIVAL_DIST_SQ ) {

			this.waypointIndex = ( this.waypointIndex + 1 ) % WAYPOINTS.length;
			return;

		}

		const dist = Math.sqrt( distSq );
		const dirX = dx / dist;
		const dirZ = dz / dist;
		const step = this.speed * dt;

		const newX = this.mesh.position.x + dirX * step;
		const newZ = this.mesh.position.z + dirZ * step;
		this.mesh.position.x = newX;
		this.mesh.position.z = newZ;

		const targetRot = Math.atan2( dirX, dirZ );
		this.mesh.rotation.y = lerpAngle( this.mesh.rotation.y, targetRot, Math.min( 1, dt * ROT_LERP ) );

		const halfAngle = this.mesh.rotation.y * 0.5;
		rigidBody.setPosition( this.world, this.body, [ newX, this.bodyY, newZ ], false );
		rigidBody.setQuaternion( this.world, this.body, [ 0, Math.sin( halfAngle ), 0, Math.cos( halfAngle ) ], false );
		rigidBody.setLinearVelocity( this.world, this.body, [ dirX * this.speed, 0, dirZ * this.speed ] );

	}

}

export function createNPCs( world, scene, models, npcDefs ) {

	const npcs = [];
	const bodyToNPC = new Map();

	for ( const [ key, x, y, z, rotDeg ] of npcDefs ) {

		const src = models[ key ];
		if ( ! src ) continue;

		const npc = new NPC( world, scene, src, x, y, z, rotDeg );
		npcs.push( npc );
		bodyToNPC.set( npc.body, npc );

	}

	return { npcs, bodyToNPC };

}
