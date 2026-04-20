import * as THREE from 'three';
import { rigidBody, MotionType } from 'crashcat';

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );
const _arcA = new THREE.Vector3();
const _arcB = new THREE.Vector3();

const SPEED_SCALE = 12.5;
const LINEAR_DAMP = 0.1;
export const MAX_SPEED = 1.5;

function lerpAngle( a, b, t ) {

	let diff = b - a;
	while ( diff > Math.PI ) diff -= Math.PI * 2;
	while ( diff < -Math.PI ) diff += Math.PI * 2;
	return a + diff * t;

}

export class Vehicle {

	constructor() {

		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;

		this.spherePos = new THREE.Vector3( 3.5, 0.5, 5 );
		this.sphereVel = new THREE.Vector3();

		this.rigidBody = null;
		this.physicsWorld = null;

		this.modelVelocity = new THREE.Vector3();
		this.prevModelPos = new THREE.Vector3( 3.5, 0, 5 );

		this.container = new THREE.Group();
		this.bodyNode = null;
		this.wheels = [];
		this.wheelFL = null;
		this.wheelFR = null;
		this.wheelBL = null;
		this.wheelBR = null;

		this.inputX = 0;
		this.inputZ = 0;

		this.driftIntensity = 0;

		this.stunTimer = 0;
		this.stunDuration = 0;
		this.stunSpinVel = 0;
		this.stunHopVel = 0;

		// --- Transformer-mode state ---
		this.transformProgress = 0;
		this.transformTarget = 0;
		this.transformForwardSpeed = 1 / 0.9;
		this.transformReverseSpeed = 1 / 0.7;
		this.currentDirection = 0; // +1 forward, -1 reverse, 0 idle
		this.stageFlags = {};

		this.turretYaw = 0;
		this.turretPitch = 0;
		this.turretPitchTarget = 0;

		this.robot = null;
		this.transformFX = null;
		this.audio = null;
		this.hitFX = null;

		this.kinematicActive = false;
		this.pinnedPos = [ 3.5, 0.5, 5 ];

		this.shakeAmplitude = 0;

		this._wheelOriginalY = null; // captured on init

	}

	attachRobot( robot, transformFX, audio, hitFX ) {

		this.robot = robot;
		this.transformFX = transformFX;
		this.audio = audio;
		this.hitFX = hitFX;
		this.container.add( robot.getRoot() );

	}

	toggleTransform() {

		if ( this.stunTimer > 0 ) return;
		if ( ! this.robot ) return;

		const goingForward = this.transformTarget < 0.5;
		this.transformTarget = goingForward ? 1 : 0;
		this.currentDirection = goingForward ? 1 : - 1;
		this.stageFlags = {};

		if ( goingForward && ! this.kinematicActive && this.rigidBody ) {

			this.pinnedPos = [ this.spherePos.x, this.spherePos.y, this.spherePos.z ];
			rigidBody.setMotionType( this.physicsWorld, this.rigidBody, MotionType.KINEMATIC );
			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
			this.kinematicActive = true;
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
			if ( this.audio ) this.audio.playImpact( 3 );

		}

	}

	isTransformed() {

		return this.transformProgress >= 0.98;

	}

	isTransforming() {

		return ( this.transformProgress > 0.001 && this.transformProgress < 0.98 ) || this.transformTarget !== ( this.isTransformed() ? 1 : 0 );

	}

	_checkPhaseCross( threshold, flagName, fn ) {

		if ( this.currentDirection !== 1 ) return;
		if ( this.stageFlags[ flagName ] ) return;
		if ( this.transformProgress >= threshold ) {

			this.stageFlags[ flagName ] = true;
			fn();

		}

	}

	stun( duration = 2.2, spinVel = 24 ) {

		if ( this.transformProgress > 0.01 || this.transformTarget > 0.01 ) return;
		this.stunTimer = Math.max( this.stunTimer, duration );
		this.stunDuration = Math.max( this.stunDuration, duration );
		this.stunSpinVel = spinVel * ( Math.random() < 0.5 ? - 1 : 1 );
		this.stunHopVel = 5.5;

	}

	init( model ) {

		const vehicleModel = model.clone();

		this.container.add( vehicleModel );

		// Find body and wheel nodes
		vehicleModel.traverse( ( child ) => {

			const name = child.name.toLowerCase();

			if ( name === 'body' ) {

				child.rotation.order = 'YXZ';
				this.bodyNode = child;

			} else if ( name.includes( 'wheel' ) ) {

				child.rotation.order = 'YXZ';
				this.wheels.push( child );

				if ( name.includes( 'front' ) && name.includes( 'left' ) ) this.wheelFL = child;
				if ( name.includes( 'front' ) && name.includes( 'right' ) ) this.wheelFR = child;
				if ( name.includes( 'back' ) && name.includes( 'left' ) ) this.wheelBL = child;
				if ( name.includes( 'back' ) && name.includes( 'right' ) ) this.wheelBR = child;

			}

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		return this.container;

	}

	update( dt, controlsInput ) {

		// --- Transformer mode: animation + phase FX + frozen physics ---
		const transformActive = this.transformProgress > 0.001 || this.transformTarget > 0.001;
		if ( transformActive ) {

			const speed = this.currentDirection >= 0 ? this.transformForwardSpeed : this.transformReverseSpeed;
			if ( this.transformProgress < this.transformTarget ) {

				this.transformProgress = Math.min( this.transformTarget, this.transformProgress + speed * dt );

			} else if ( this.transformProgress > this.transformTarget ) {

				this.transformProgress = Math.max( this.transformTarget, this.transformProgress - speed * dt );

			}

			if ( this.robot ) this.robot.setProgress( this.transformProgress );

			const px = this.pinnedPos[ 0 ];
			const py = this.pinnedPos[ 1 ];
			const pz = this.pinnedPos[ 2 ];

			if ( this.transformFX && this.audio ) {

				this._checkPhaseCross( 0.10, 'p1', () => {

					this.transformFX.shockwave( px, py - 0.5, pz, 2.2 );
					this.transformFX.steamBurst( px - 0.8, py - 0.5, pz, 3 );
					this.transformFX.steamBurst( px + 0.8, py - 0.5, pz, 3 );
					this.audio.playImpact( 4 );
					this.shakeAmplitude = Math.max( this.shakeAmplitude, 0.08 );

				} );

				this._checkPhaseCross( 0.42, 'p2', () => {

					_arcA.set( px - 0.5, py + 0.4, pz );
					_arcB.set( px + 0.5, py + 0.4, pz );
					this.transformFX.arc( _arcA, _arcB );
					_arcA.set( px, py + 0.2, pz - 0.3 );
					_arcB.set( px, py + 0.9, pz + 0.3 );
					this.transformFX.arc( _arcA, _arcB );
					this.audio.playImpact( 2 );
					this.shakeAmplitude = Math.max( this.shakeAmplitude, 0.05 );

				} );

				this._checkPhaseCross( 0.62, 'p3', () => {

					this.transformFX.steamBurst( px, py + 0.9, pz, 3 );
					this.transformFX.flash( 0.12 );
					this.audio.playImpact( 3 );
					this.shakeAmplitude = Math.max( this.shakeAmplitude, 0.06 );

				} );

				this._checkPhaseCross( 0.92, 'p4', () => {

					this.transformFX.shockwave( px, py - 0.5, pz, 5 );
					this.transformFX.flash( 0.18 );
					if ( this.hitFX ) this.hitFX.burst( px, py + 0.5, pz );
					this.audio.playImpact( 5 );
					this.shakeAmplitude = Math.max( this.shakeAmplitude, 0.1 );

				} );

			}

			this.shakeAmplitude *= Math.max( 0, 1 - dt * 6 );

			// Hide wheels and raise body as transform progresses
			const hidden = this.transformProgress > 0.15;
			for ( const wheel of this.wheels ) wheel.visible = ! hidden;
			if ( this.bodyNode ) {

				this.bodyNode.position.y = 0.3 + this.transformProgress * 0.45;
				if ( this.transformProgress > 0.08 ) {

					this.bodyNode.rotation.x *= Math.max( 0, 1 - dt * 8 );
					this.bodyNode.rotation.z *= Math.max( 0, 1 - dt * 8 );

				}

			}

			// Turret input — only when fully transformed
			if ( this.isTransformed() ) {

				this.turretYaw -= ( controlsInput.x || 0 ) * 2.5 * dt;
				this.turretPitchTarget = ( controlsInput.z || 0 ) * 0.25;

			} else {

				this.turretPitchTarget = 0;

			}
			this.turretPitch = THREE.MathUtils.lerp( this.turretPitch, this.turretPitchTarget, Math.min( 1, dt * 5 ) );
			if ( this.robot ) {

				this.robot.setTurretYaw( this.turretYaw );
				this.robot.setTurretPitch( this.turretPitch );
				this.robot.update( dt );

			}

			// Pin body while kinematic
			if ( this.kinematicActive && this.rigidBody ) {

				rigidBody.setPosition( this.physicsWorld, this.rigidBody, this.pinnedPos, false );
				rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

			}

			// Update container visual position (pinned body)
			this.spherePos.set( px, py, pz );
			this.container.position.set( px, py - 0.5, pz );
			this.prevModelPos.copy( this.container.position );
			this.modelVelocity.set( 0, 0, 0 );

			// Exit kinematic when fully reversed
			if ( this.transformProgress <= 0.001 && this.kinematicActive && this.rigidBody ) {

				rigidBody.setMotionType( this.physicsWorld, this.rigidBody, MotionType.DYNAMIC );
				this.kinematicActive = false;
				this.currentDirection = 0;
				this.transformProgress = 0;
				if ( this.robot ) this.robot.setProgress( 0 );
				// Restore wheel visibility
				for ( const wheel of this.wheels ) wheel.visible = true;

			}

			return;

		}

		if ( this.stunTimer > 0 ) {

			this.stunTimer = Math.max( 0, this.stunTimer - dt );
			this.container.rotateY( this.stunSpinVel * dt );
			this.stunSpinVel *= Math.max( 0, 1 - 0.55 * dt );
			this.linearSpeed *= Math.max( 0, 1 - 3.0 * dt );
			this.angularSpeed = 0;
			this.inputX = 0;
			this.inputZ = 0;

			// Dramatic tilt + hop on the body node
			if ( this.bodyNode ) {

				const t = this.stunDuration > 0 ? ( this.stunTimer / this.stunDuration ) : 0;
				const phase = this.stunTimer * 10;
				this.bodyNode.rotation.z = Math.sin( phase ) * 0.5 * t;
				this.bodyNode.rotation.x = Math.cos( phase * 0.6 ) * 0.35 * t;
				this.stunHopVel -= 18 * dt;
				this.bodyNode.position.y += this.stunHopVel * dt;
				if ( this.bodyNode.position.y < 0.3 ) {

					this.bodyNode.position.y = 0.3;
					if ( this.stunHopVel < 0 ) this.stunHopVel *= - 0.35;

				}

			}

			controlsInput = { x: 0, z: 0, touchActive: false, fire: false };

		}

		this.inputX = controlsInput.x;
		this.inputZ = controlsInput.z;

		if ( controlsInput.touchActive && ( this.inputX !== 0 || this.inputZ !== 0 ) ) {

			// Touch: joystick defines world-space direction, auto-gas
			const targetAngle = Math.atan2( this.inputX, this.inputZ );
			_quat.setFromAxisAngle( _up, targetAngle );
			this.container.quaternion.slerp( _quat, 1 - Math.exp( - 3 * dt ) );

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			const cross = _forward.x * this.inputZ - _forward.z * this.inputX;
			this.inputX = - cross * 2;

			this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, MAX_SPEED, dt * 1.5 );

		} else {

			// Keyboard / gamepad: standard steering + throttle
			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), 0.2, 1.0 );

			const targetAngular = - this.inputX * steeringGrip * 4 * direction;
			this.angularSpeed = THREE.MathUtils.lerp( this.angularSpeed, targetAngular, dt * 4 );

			this.container.rotateY( this.angularSpeed * dt );

			const targetSpeed = this.inputZ;

			if ( targetSpeed < 0 && this.linearSpeed > 0.01 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, 0.0, dt * 8 );

			} else if ( targetSpeed < 0 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed / 2, dt * 2 );

			} else {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed * MAX_SPEED, dt * 1.5 );

			}

		}

		_tmpVec.set( 0, 1, 0 ).applyQuaternion( this.container.quaternion );

		if ( _tmpVec.y > 0.5 ) {

			const targetQuat = this.alignWithY( this.container.quaternion, _up );
			this.container.quaternion.slerp( targetQuat, 0.2 );

		}

		this.linearSpeed *= Math.max( 0, 1 - LINEAR_DAMP * dt );

		if ( this.rigidBody ) {

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			_right.set( 1, 0, 0 ).applyQuaternion( this.container.quaternion );
			_right.y = 0;
			_right.normalize();

			const angvel = this.rigidBody.motionProperties.angularVelocity;
			const drive = this.linearSpeed * 100 * dt;

			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [
				angvel[ 0 ] + _right.x * drive,
				angvel[ 1 ],
				angvel[ 2 ] + _right.z * drive
			] );

			const pos = this.rigidBody.position;
			this.spherePos.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.sphereVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

		}

		this.acceleration = THREE.MathUtils.lerp(
			this.acceleration,
			this.linearSpeed + ( 0.25 * this.linearSpeed * Math.abs( this.linearSpeed ) ),
			dt
		);

		if ( this.spherePos.y < - 10 ) {

			if ( this.rigidBody ) {

				rigidBody.setPosition( this.physicsWorld, this.rigidBody, [ 3.5, 0.5, 5 ], false );
				rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
				rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

			}

			this.spherePos.set( 3.5, 0.5, 5 );
			this.sphereVel.set( 0, 0, 0 );
			this.linearSpeed = 0;
			this.angularSpeed = 0;
			this.acceleration = 0;
			this.container.rotation.set( 0, 0, 0 );
			this.container.quaternion.identity();

		}

		this.container.position.set(
			this.spherePos.x,
			this.spherePos.y - 0.5,
			this.spherePos.z
		);

		if ( dt > 0 ) {

			this.modelVelocity.subVectors( this.container.position, this.prevModelPos ).divideScalar( dt );
			this.prevModelPos.copy( this.container.position );

		}

		this.updateBody( dt );
		this.updateWheels( dt );

		this.driftIntensity = Math.abs( this.linearSpeed - this.acceleration ) +
			( this.bodyNode ? Math.abs( this.bodyNode.rotation.z ) * 2 : 0 );

	}

	alignWithY( quaternion, newY ) {

		_zAxis.set( 0, 0, 1 ).applyQuaternion( quaternion );
		const xAxis = _tmpVec.crossVectors( _zAxis, newY ).negate().normalize();
		_newZ.crossVectors( xAxis, newY ).normalize();

		_mat4.makeBasis( xAxis, newY, _newZ );
		return _quat.setFromRotationMatrix( _mat4 );

	}

	updateBody( dt ) {

		if ( ! this.bodyNode ) return;

		this.bodyNode.rotation.x = lerpAngle(
			this.bodyNode.rotation.x,
			-( this.linearSpeed - this.acceleration ) / 6,
			dt * 10
		);

		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / 5 ) * this.linearSpeed,
			dt * 5
		);

		this.bodyNode.position.y = THREE.MathUtils.lerp( this.bodyNode.position.y, 0.3, dt * 5 );

	}

	updateWheels( dt ) {

		for ( const wheel of this.wheels ) {

			wheel.rotation.x += this.acceleration;

		}

		if ( this.wheelFL ) {

			this.wheelFL.rotation.y = lerpAngle( this.wheelFL.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

		if ( this.wheelFR ) {

			this.wheelFR.rotation.y = lerpAngle( this.wheelFR.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

	}

}
