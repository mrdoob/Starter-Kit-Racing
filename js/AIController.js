import * as THREE from 'three';
import { rigidBody } from 'crashcat';

export const TOTAL_RACE_LAPS = 3;

/**
 * Professional AI Controller System
 * Handles both Track Racing (Pure Pursuit, Predictive Braking, Overtaking)
 * and Free-Roam / Hajwalah (Drift stunts, Donuts, Wall Avoidance).
 */

/**
 * Race AI Update
 * Uses Pure Pursuit, Curvature Predictive Braking, Racing Line Offset & Stuck Recovery.
 */
export function updateRaceAIDrivers( drivers, path, dt, racing, totalTime, playerVehicle = null, updateLightsFn = null ) {

	if ( ! path || path.length < 2 ) return;

	const LOOKAHEAD_BASE = 3;

	drivers.forEach( ( d, driverIdx ) => {

		const input = { x: 0, z: 0, touchActive: false, handbrake: false };

		if ( racing && ! d.finished ) {

			// 1. Stuck Recovery Watchdog
			d.sampleTimer = ( d.sampleTimer || 0 ) + dt;
			if ( d.sampleTimer >= 0.4 ) {

				d.sampleTimer = 0;
				const moved = Math.hypot(
					d.vehicle.spherePos.x - ( d.samplePos ? d.samplePos.x : d.vehicle.spherePos.x ),
					d.vehicle.spherePos.z - ( d.samplePos ? d.samplePos.z : d.vehicle.spherePos.z )
				);
				d.samplePos = { x: d.vehicle.spherePos.x, z: d.vehicle.spherePos.z };

				if ( moved < 0.2 ) {

					d.stuckStrikes = ( d.stuckStrikes || 0 ) + 1;

				} else {

					d.stuckStrikes = 0;

				}

			}

			// If stuck for > 1.2s, resync position to current waypoint path
			if ( d.stuckStrikes >= 3 ) {

				let bestJ = d.idx, bestD = Infinity;
				for ( let j = 0; j < path.length; j ++ ) {

					const dx = path[ j ].x - d.vehicle.spherePos.x;
					const dz = path[ j ].z - d.vehicle.spherePos.z;
					const distSq = dx * dx + dz * dz;
					if ( distSq < bestD ) {

						bestD = distSq;
						bestJ = j;

					}

				}

				d.idx = bestJ;
				const p = path[ bestJ ];
				const pNext = path[ ( bestJ + 1 ) % path.length ];
				const heading = Math.atan2( pNext.x - p.x, pNext.z - p.z );

				const pWorld = d.vehicle.physicsWorld || ( d.vehicle.rigidBody ? d.vehicle.rigidBody.world : null );
				if ( pWorld && d.vehicle.rigidBody ) {

					rigidBody.setPosition( pWorld, d.vehicle.rigidBody, [ p.x, 0.5, p.z ], false );
					rigidBody.setLinearVelocity( pWorld, d.vehicle.rigidBody, [ 0, 0, 0 ] );
					rigidBody.setAngularVelocity( pWorld, d.vehicle.rigidBody, [ 0, 0, 0 ] );

				}

				d.vehicle.spherePos.set( p.x, 0.5, p.z );
				d.vehicle.sphereVel.set( 0, 0, 0 );
				d.vehicle.container.position.set( p.x, 0, p.z );
				d.vehicle.container.rotation.set( 0, heading, 0 );
				d.vehicle.linearSpeed = 0;
				d.stuckStrikes = 0;
				d.sampleTimer = 0;

			}

			// 2. Waypoint Progression Search
			let bestWindowIdx = d.idx;
			let minWindowDist = Infinity;
			for ( let step = 0; step <= 8; step ++ ) {

				const testIdx = ( d.idx + step ) % path.length;
				const pt = path[ testIdx ];
				const distSq = ( pt.x - d.vehicle.spherePos.x ) ** 2 + ( pt.z - d.vehicle.spherePos.z ) ** 2;
				if ( distSq < minWindowDist ) {

					minWindowDist = distSq;
					bestWindowIdx = testIdx;

				}

			}

			if ( bestWindowIdx !== d.idx ) {

				if ( bestWindowIdx < d.idx ) {

					d.lapsCompleted = ( d.lapsCompleted || 0 ) + 1;
					if ( d.lapsCompleted >= TOTAL_RACE_LAPS ) {

						d.finished = true;
						d.finishTime = totalTime;

					}

				}
				d.idx = bestWindowIdx;

			} else {

				const curPt = path[ ( d.idx + 1 ) % path.length ];
				const dToCur = Math.hypot( curPt.x - d.vehicle.spherePos.x, curPt.z - d.vehicle.spherePos.z );
				if ( dToCur < 2.0 ) {

					d.idx = ( d.idx + 1 ) % path.length;
					if ( d.idx === 0 ) {

						d.lapsCompleted = ( d.lapsCompleted || 0 ) + 1;
						if ( d.lapsCompleted >= TOTAL_RACE_LAPS ) {

							d.finished = true;
							d.finishTime = totalTime;

						}

					}

				}

			}

			// 3. Target Waypoint & Lateral Offset (Personal Racing Line)
			const lineOffset = ( d.lineOffset !== undefined ) ? d.lineOffset : ( ( driverIdx % 3 ) - 1 ) * 0.5;
			d.lineOffset = lineOffset;

			const targetIdx = ( d.idx + LOOKAHEAD_BASE ) % path.length;
			const targetPt = path[ targetIdx ];

			// Compute forward vector & perpendicular for racing line offset
			const nextPt = path[ ( targetIdx + 1 ) % path.length ];
			const fwdX = nextPt.x - targetPt.x;
			const fwdZ = nextPt.z - targetPt.z;
			const fwdLen = Math.hypot( fwdX, fwdZ ) || 1;
			const perpX = - fwdZ / fwdLen;
			const perpZ = fwdX / fwdLen;

			const targetX = targetPt.x + perpX * lineOffset;
			const targetZ = targetPt.z + perpZ * lineOffset;

			const dx = targetX - d.vehicle.spherePos.x;
			const dz = targetZ - d.vehicle.spherePos.z;

			// 4. Pure Pursuit Steering
			const carAngle = d.vehicle.container.rotation.y;
			const targetAngle = Math.atan2( dx, dz );
			let angleDiff = targetAngle - carAngle;
			angleDiff = ( ( angleDiff + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI;

			// Collision avoidance / Overtaking offset
			let avoidSteer = 0;
			const checkVehicles = [];
			if ( playerVehicle ) checkVehicles.push( playerVehicle );
			drivers.forEach( ( otherD, oIdx ) => {

				if ( oIdx !== driverIdx ) checkVehicles.push( otherD.vehicle );

			} );

			for ( const otherVeh of checkVehicles ) {

				const odx = otherVeh.spherePos.x - d.vehicle.spherePos.x;
				const odz = otherVeh.spherePos.z - d.vehicle.spherePos.z;
				const odist = Math.hypot( odx, odz );
				if ( odist > 0.1 && odist < 2.5 ) {

					// Nudge away laterally
					const sideAngle = Math.atan2( odx, odz ) - carAngle;
					const normalizedSide = ( ( sideAngle + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI;
					if ( normalizedSide > 0 ) avoidSteer -= ( 2.5 - odist ) * 0.4;
					else avoidSteer += ( 2.5 - odist ) * 0.4;

				}

			}

			input.x = THREE.MathUtils.clamp( angleDiff * 2.5 + avoidSteer, - 1, 1 );

			// 5. Predictive Curvature Speed Control
			let maxUpcomingCurve = Math.abs( angleDiff );
			for ( let k = 1; k <= 6; k ++ ) {

				const p1 = path[ ( d.idx + k ) % path.length ];
				const p2 = path[ ( d.idx + k + 2 ) % path.length ];
				const segAngle = Math.atan2( p2.x - p1.x, p2.z - p1.z );
				let diff = segAngle - carAngle;
				diff = ( ( diff + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI;
				if ( Math.abs( diff ) > maxUpcomingCurve ) maxUpcomingCurve = Math.abs( diff );

			}

			const sharpness = THREE.MathUtils.clamp( maxUpcomingCurve / ( Math.PI / 2.2 ), 0, 1 );
			input.z = 1.0 - sharpness * 0.6;

			// Drift / handbrake pulse on sharp turns
			if ( sharpness > 0.75 && Math.abs( d.vehicle.linearSpeed ) > 5 ) {

				input.handbrake = true;

			}

		}

		d.vehicle.update( dt, input );

		if ( d.particles ) d.particles.update( dt, d.vehicle );
		if ( d.driftMarks ) d.driftMarks.update( dt, d.vehicle );
		if ( d.vehicleFlag ) d.vehicleFlag.updateFlutter( dt, Math.abs( d.vehicle.linearSpeed / 1.5 ) );
		if ( d.vehicleLights && updateLightsFn ) updateLightsFn( d.vehicleLights, dt, d.radiusScale || 1.0, d.vehicle.linearSpeed < -0.01 );

	} );

}

/**
 * Free-Roam / Hajwalah AI Update ("هجولة وتفحيط احترافي")
 * Features multi-state AI (CRUISING, DRIFTING, DONUTS, WALL_AVOIDANCE).
 */
export function updateFreeRoamAIDrivers( drivers, dt, roadHalf, updateLightsFn = null ) {

	const wanderRadius = roadHalf * 0.45;
	const wallLimitRadius = roadHalf * 0.65;

	drivers.forEach( ( d ) => {

		// Initialize state machine if absent
		if ( ! d.aiState ) {

			d.aiState = 'CRUISING'; // CRUISING | DRIFTING | DONUT | AVOIDANCE
			d.stateTimer = 2 + Math.random() * 3;
			d.donutCenter = { x: 0, z: 0 };
			d.donutAngle = 0;

		}

		// 1. Stuck Watchdog
		d.sampleTimer = ( d.sampleTimer || 0 ) + dt;
		if ( d.sampleTimer >= 0.5 ) {

			d.sampleTimer = 0;
			const moved = Math.hypot(
				d.vehicle.spherePos.x - ( d.samplePos ? d.samplePos.x : d.vehicle.spherePos.x ),
				d.vehicle.spherePos.z - ( d.samplePos ? d.samplePos.z : d.vehicle.spherePos.z )
			);
			d.samplePos = { x: d.vehicle.spherePos.x, z: d.vehicle.spherePos.z };

			if ( moved < 0.3 ) d.stuckStrikes = ( d.stuckStrikes || 0 ) + 1;
			else d.stuckStrikes = 0;

		}

		if ( d.stuckStrikes >= 3 ) {

			// Teleport safely back inside arena
			const a = Math.random() * Math.PI * 2;
			const r = Math.random() * wanderRadius * 0.5;
			const px = Math.cos( a ) * r;
			const pz = Math.sin( a ) * r;

			const pWorld = d.vehicle.physicsWorld || ( d.vehicle.rigidBody ? d.vehicle.rigidBody.world : null );
			if ( pWorld && d.vehicle.rigidBody ) {

				rigidBody.setPosition( pWorld, d.vehicle.rigidBody, [ px, 0.5, pz ], false );
				rigidBody.setLinearVelocity( pWorld, d.vehicle.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( pWorld, d.vehicle.rigidBody, [ 0, 0, 0 ] );

			}

			d.vehicle.spherePos.set( px, 0.5, pz );
			d.vehicle.container.position.set( px, 0, pz );
			d.vehicle.linearSpeed = 0;
			d.stuckStrikes = 0;
			d.aiState = 'CRUISING';
			d.stateTimer = 2;

		}

		d.stateTimer -= dt;

		// 2. Wall / Arena Edge Safety Check
		const distFromCenter = Math.hypot( d.vehicle.spherePos.x, d.vehicle.spherePos.z );
		if ( distFromCenter > wallLimitRadius ) {

			d.aiState = 'AVOIDANCE';
			d.target = { x: 0, z: 0 };

		}

		// 3. State Transitions
		if ( d.aiState !== 'AVOIDANCE' && d.stateTimer <= 0 ) {

			const rand = Math.random();
			if ( rand < 0.45 ) {

				d.aiState = 'DRIFTING';
				d.stateTimer = 3 + Math.random() * 4;
				const a = Math.random() * Math.PI * 2;
				const r = Math.random() * wanderRadius;
				d.target = { x: Math.cos( a ) * r, z: Math.sin( a ) * r };

			} else if ( rand < 0.75 ) {

				d.aiState = 'CRUISING';
				d.stateTimer = 3 + Math.random() * 4;
				const a = Math.random() * Math.PI * 2;
				const r = Math.random() * wanderRadius;
				d.target = { x: Math.cos( a ) * r, z: Math.sin( a ) * r };

			} else {

				d.aiState = 'DONUT';
				d.stateTimer = 2.5 + Math.random() * 2.5;
				d.donutCenter = { x: d.vehicle.spherePos.x, z: d.vehicle.spherePos.z };
				d.donutAngle = Math.random() * Math.PI * 2;

			}

		}

		// 4. Execute AI Behavior Based On State
		const input = { x: 0, z: 1, touchActive: false, handbrake: false };

		if ( d.aiState === 'AVOIDANCE' ) {

			const dx = - d.vehicle.spherePos.x;
			const dz = - d.vehicle.spherePos.z;
			const carAngle = d.vehicle.container.rotation.y;
			const targetAngle = Math.atan2( dx, dz );
			let angleDiff = targetAngle - carAngle;
			angleDiff = ( ( angleDiff + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI;

			input.x = THREE.MathUtils.clamp( angleDiff * 3.0, - 1, 1 );
			input.z = 0.8;

			if ( distFromCenter < wanderRadius * 0.8 ) {

				d.aiState = 'CRUISING';
				d.stateTimer = 2;

			}

		} else if ( d.aiState === 'DONUT' ) {

			// High RPM Donut / Spin maneuver
			input.x = 1.0; // full lock
			input.z = 1.0; // full gas
			input.handbrake = ( Math.sin( Date.now() * 0.01 ) > 0.5 ); // rhythmic handbrake pulse

		} else if ( d.aiState === 'DRIFTING' ) {

			const dx = ( d.target ? d.target.x : 0 ) - d.vehicle.spherePos.x;
			const dz = ( d.target ? d.target.z : 0 ) - d.vehicle.spherePos.z;
			const carAngle = d.vehicle.container.rotation.y;
			const targetAngle = Math.atan2( dx, dz );
			let angleDiff = targetAngle - carAngle;
			angleDiff = ( ( angleDiff + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI;

			// Aggressive steering + handbrake flick to initiate drift
			input.x = THREE.MathUtils.clamp( angleDiff * 4.0, - 1, 1 );
			input.z = 1.0;

			if ( Math.abs( angleDiff ) > 0.4 ) {

				input.handbrake = true;

			}

		} else { // CRUISING

			const dx = ( d.target ? d.target.x : 0 ) - d.vehicle.spherePos.x;
			const dz = ( d.target ? d.target.z : 0 ) - d.vehicle.spherePos.z;
			const carAngle = d.vehicle.container.rotation.y;
			const targetAngle = Math.atan2( dx, dz );
			let angleDiff = targetAngle - carAngle;
			angleDiff = ( ( angleDiff + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI;

			input.x = THREE.MathUtils.clamp( angleDiff * 2.0, - 1, 1 );
			input.z = 0.85;

		}

		d.vehicle.update( dt, input );

		if ( d.particles ) d.particles.update( dt, d.vehicle );
		if ( d.driftMarks ) d.driftMarks.update( dt, d.vehicle );
		if ( d.vehicleFlag ) d.vehicleFlag.updateFlutter( dt, Math.abs( d.vehicle.linearSpeed / 1.5 ) );
		if ( d.vehicleLights && updateLightsFn ) updateLightsFn( d.vehicleLights, dt, d.radiusScale || 1.0, d.vehicle.linearSpeed < -0.01 );

	} );

}
