import * as THREE from 'three';

export const CAMERA_MODE = {
	EAGLE: 0,
	THIRD: 1,
	HOOD: 2,
};

const _desired = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _lookPoint = new THREE.Vector3();
const _vehForward = new THREE.Vector3();
const _vehRight = new THREE.Vector3();
const _localOffset = new THREE.Vector3();
const _goalPos = new THREE.Vector3();
const _roofPos = new THREE.Vector3();
const _hoodPos = new THREE.Vector3();
const _thirdGoalPos = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _tmpQuatA = new THREE.Quaternion();
const _tmpQuatB = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );
const _camPosSave = new THREE.Vector3();
const _camQuatSave = new THREE.Quaternion();

function smootherstep( t ) {

	if ( t <= 0 ) return 0;
	if ( t >= 1 ) return 1;
	return t * t * t * ( t * ( t * 6 - 15 ) + 10 );

}

function transitionDuration( from, to ) {

	if ( from === CAMERA_MODE.EAGLE && to === CAMERA_MODE.THIRD ) return 0.42;
	if ( from === CAMERA_MODE.THIRD && to === CAMERA_MODE.HOOD ) return 0.58;
	if ( from === CAMERA_MODE.HOOD && to === CAMERA_MODE.EAGLE ) return 0.48;
	return 0.45;

}

export class Camera {

	constructor() {

		this.camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 60 );

		// Matches Godot View: 45° azimuth, 35° elevation, distance 16
		this.offset = new THREE.Vector3( 9.27, 9.18, 9.27 );

		this.camera.position.copy( this.offset );
		this.camera.lookAt( 0, 0, 0 );

		// Camera-aligned ground basis (XZ plane), derived from offset.
		this.camRightXZ = new THREE.Vector3( this.offset.z, 0, - this.offset.x ).normalize();
		this.camForwardXZ = new THREE.Vector3( - this.offset.x, 0, - this.offset.z ).normalize();

		this.leadFactor = 10.0;
		this.cameraSmoothing = 5.0;
		this.deadzoneRadius = 2.0;
		this.screenShiftUp = 1.0;

		this.smoothedDesired = new THREE.Vector3();
		this.smoothedThird = new THREE.Vector3();
		this.eagleInitialized = false;
		this.thirdInitialized = false;

		// Third-person chase (vehicle-local offset, rotated by yaw)
		this.thirdBack = 3.0;
		this.thirdHeight = 1.85;
		this.thirdScreenShift = .5;

		// Hood / cockpit (local space: +Z forward, +X right, +Y up)
		this.hoodLocal = new THREE.Vector3( -0.0, 0.1, 0.15 );
		this.roofApproachLocal = new THREE.Vector3( 1.15, 3.05, 2.35 );
		this.hoodLookAhead = 14;

		this.steadyMode = CAMERA_MODE.EAGLE;
		this.transitionTargetMode = CAMERA_MODE.EAGLE;
		this.transitionEnterSource = CAMERA_MODE.EAGLE;
		this.transitionActive = false;
		this.transitionElapsed = 0;
		this.transitionDuration = 0.45;

		this.startPos = new THREE.Vector3();
		this.startQuat = new THREE.Quaternion();
		this.goalQuat = new THREE.Quaternion();
		this.blendQuat = new THREE.Quaternion();

		this.baseFov = 40;
		this.closeFovMax = 58;
		this.smoothedFov = this.baseFov;

		// Hood: barrel roll from steering (same family as Vehicle body rotation.z)
		this.hoodRollMax = 0.28;
		this.hoodSteerRollGain = 1.35;
		this.smoothedHoodRoll = 0;

		const segments = 64;
		const points = [];
		for ( let i = 0; i <= segments; i ++ ) {

			const a = ( i / segments ) * Math.PI * 2;
			points.push( new THREE.Vector3( Math.cos( a ), 0, Math.sin( a ) ) );

		}
		const dzGeom = new THREE.BufferGeometry().setFromPoints( points );
		this.debug = new THREE.Line( dzGeom, new THREE.LineBasicMaterial( { color: 0xff00ff, depthTest: false } ) );
		this.debug.visible = false;
		this.debug.renderOrder = 999;
		this.debug.quaternion.setFromRotationMatrix(
			new THREE.Matrix4().makeBasis( this.camRightXZ, new THREE.Vector3( 0, 1, 0 ), this.camForwardXZ )
		);

		window.addEventListener( 'resize', () => {

			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();

		} );

	}

	_fovCloseModeWeight() {

		if ( ! this.transitionActive ) {

			return ( this.steadyMode === CAMERA_MODE.THIRD || this.steadyMode === CAMERA_MODE.HOOD ) ? 1 : 0;

		}

		const u = THREE.MathUtils.clamp( this.transitionElapsed / this.transitionDuration, 0, 1 );
		const e = smootherstep( u );

		if ( this.transitionTargetMode === CAMERA_MODE.EAGLE ) return 1 - e;

		if ( this.transitionTargetMode === CAMERA_MODE.THIRD && this.transitionEnterSource === CAMERA_MODE.EAGLE ) return e;

		return 1;

	}

	_hoodGForceBlend() {

		if ( ! this.transitionActive ) {

			return this.steadyMode === CAMERA_MODE.HOOD ? 1 : 0;

		}

		const u = THREE.MathUtils.clamp( this.transitionElapsed / this.transitionDuration, 0, 1 );
		const e = smootherstep( u );

		const thirdToHood = this.transitionEnterSource === CAMERA_MODE.THIRD &&
			this.transitionTargetMode === CAMERA_MODE.HOOD;

		if ( thirdToHood ) {

			const split = 0.48;
			if ( u <= split ) return 0;

			return smootherstep( ( u - split ) / ( 1 - split ) );

		}

		if ( this.transitionTargetMode === CAMERA_MODE.EAGLE && this.transitionEnterSource === CAMERA_MODE.HOOD ) {

			return 1 - e;

		}

		return 0;

	}

	_applyHoodSteerRoll( dt, vehicle ) {

		const w = this._hoodGForceBlend();
		// Match bodyNode.rotation.z drive: -(inputX/5)*linearSpeed — tilt against steering side.
		const steer = vehicle.inputX ?? 0;
		const speed = vehicle.linearSpeed ?? 0;
		const raw = - ( steer / 10 ) * speed * this.hoodSteerRollGain;
		const target = THREE.MathUtils.clamp( raw, - this.hoodRollMax, this.hoodRollMax ) * w;
		const alpha = 1 - Math.exp( - dt * 2 );
		this.smoothedHoodRoll += ( target - this.smoothedHoodRoll ) * alpha;
		this.camera.rotateZ( -this.smoothedHoodRoll );

	}

	_applySpeedFov( dt, speedNorm ) {

		const w = this._fovCloseModeWeight();
		const s = THREE.MathUtils.clamp( speedNorm, 0, 1 );
		const se = s * s * ( 3 - 2 * s );
		const targetFov = THREE.MathUtils.lerp( this.baseFov, this.closeFovMax, w * se );
		const alpha = 1 - Math.exp( - dt * 14 );
		this.smoothedFov += ( targetFov - this.smoothedFov ) * alpha;
		this.camera.fov = this.smoothedFov;
		this.camera.updateProjectionMatrix();

	}

	advanceMode( spherePos ) {

		const prevDest = this.transitionActive ? this.transitionTargetMode : this.steadyMode;
		const next = ( prevDest + 1 ) % 3;

		this.transitionEnterSource = prevDest;
		this.transitionTargetMode = next;
		this.transitionDuration = transitionDuration( prevDest, next );
		this.transitionElapsed = 0;
		this.transitionActive = true;
		this.startPos.copy( this.camera.position );
		this.startQuat.copy( this.camera.quaternion );

		if ( next === CAMERA_MODE.THIRD && prevDest === CAMERA_MODE.EAGLE && spherePos ) {

			this.smoothedThird.copy( spherePos );
			this.thirdInitialized = true;

		}

		if ( next === CAMERA_MODE.EAGLE && prevDest === CAMERA_MODE.HOOD && spherePos ) {

			this.smoothedDesired.copy( spherePos );
			this.eagleInitialized = true;

		}

	}

	/** Mode index for HUD highlight (0 eagle, 1 third, 2 hood). */
	getHudMode() {

		return this.transitionActive ? this.transitionTargetMode : this.steadyMode;

	}

	_applyLeadDeadzone( target, velocity, rightXZ, forwardXZ, smoothed, initializedFlag, dt ) {

		const radius = this.deadzoneRadius;
		const radiusSq = radius * radius;
		const leadMul = this.transitionActive ? 0.42 : 1;

		let leadX = velocity.dot( rightXZ ) * this.leadFactor * leadMul;
		let leadY = velocity.dot( forwardXZ ) * this.leadFactor * leadMul;
		const leadLenSq = leadX * leadX + leadY * leadY;
		if ( leadLenSq > radiusSq ) {

			const k = radius / Math.sqrt( leadLenSq );
			leadX *= k;
			leadY *= k;

		}

		_desired.copy( target )
			.addScaledVector( rightXZ, leadX )
			.addScaledVector( forwardXZ, leadY );

		const alpha = initializedFlag ? 1 - Math.exp( - dt * this.cameraSmoothing ) : 1;
		smoothed.lerp( _desired, alpha );

		_delta.subVectors( target, smoothed );
		const offsetX = _delta.dot( rightXZ );
		const offsetY = _delta.dot( forwardXZ );
		const offsetLenSq = offsetX * offsetX + offsetY * offsetY;
		if ( offsetLenSq > radiusSq ) {

			const offsetLen = Math.sqrt( offsetLenSq );
			const k = ( offsetLen - radius ) / offsetLen;
			smoothed
				.addScaledVector( rightXZ, offsetX * k )
				.addScaledVector( forwardXZ, offsetY * k );

		}

		return radius;

	}

	_vehicleYawBasis( vehicle ) {

		const g = vehicle.container;
		_vehForward.set( 0, 0, 1 ).applyQuaternion( g.quaternion );
		_vehForward.y = 0;
		const fl = _vehForward.length();
		if ( fl < 1e-5 ) _vehForward.set( 0, 0, 1 );
		else _vehForward.multiplyScalar( 1 / fl );

		_vehRight.crossVectors( _up, _vehForward ).normalize();

		const yaw = Math.atan2( _vehForward.x, _vehForward.z );
		_yawQuat.setFromAxisAngle( _up, yaw );

	}

	_poseFromLookAt( eye, lookAt, outPos, outQuat ) {

		// Must use PerspectiveCamera.lookAt: plain Object3D.lookAt swaps eye/target in three.js,
		// so a dummy object yields the wrong quaternion for this.camera.
		const cam = this.camera;
		_camPosSave.copy( cam.position );
		_camQuatSave.copy( cam.quaternion );
		cam.position.copy( eye );
		cam.lookAt( lookAt );
		outPos.copy( eye );
		outQuat.copy( cam.quaternion );
		cam.position.copy( _camPosSave );
		cam.quaternion.copy( _camQuatSave );

	}

	_eagleGoal( dt, target, velocity, outPos, outQuat ) {

		const radius = this._applyLeadDeadzone(
			target, velocity, this.camRightXZ, this.camForwardXZ,
			this.smoothedDesired, this.eagleInitialized, dt
		);
		this.eagleInitialized = true;

		_lookPoint.copy( this.smoothedDesired ).addScaledVector( this.camForwardXZ, - this.screenShiftUp );
		outPos.copy( _lookPoint ).add( this.offset );
		this._poseFromLookAt( outPos, _lookPoint, outPos, outQuat );

		this.debug.position.copy( this.smoothedDesired );
		this.debug.position.y += 0.05;
		this.debug.scale.set( radius, 1, radius );

		return radius;

	}

	_thirdGoal( dt, target, velocity, vehicle, outPos, outQuat ) {

		this._vehicleYawBasis( vehicle );

		const radius = this._applyLeadDeadzone(
			target, velocity, _vehRight, _vehForward,
			this.smoothedThird, this.thirdInitialized, dt
		);
		this.thirdInitialized = true;

		_lookPoint.copy( this.smoothedThird ).addScaledVector( _vehForward, - this.thirdScreenShift );

		_localOffset.set( 0, this.thirdHeight, - this.thirdBack );
		_localOffset.applyQuaternion( _yawQuat );

		outPos.copy( _lookPoint ).add( _localOffset );
		this._poseFromLookAt( outPos, _lookPoint, outPos, outQuat );

		return radius;

	}

	_roofGoal( spherePos, vehicle, outPos, outQuat ) {

		this._vehicleYawBasis( vehicle );

		outPos.copy( this.roofApproachLocal ).applyQuaternion( _yawQuat ).add( spherePos );
		_lookAt.copy( _vehForward ).multiplyScalar( 10 ).add( outPos );
		_lookAt.y -= 0.35;
		this._poseFromLookAt( outPos, _lookAt, outPos, outQuat );

	}

	_hoodGoal( spherePos, vehicle, outPos, outQuat ) {

		this._vehicleYawBasis( vehicle );

		outPos.copy( this.hoodLocal ).applyQuaternion( _yawQuat ).add( spherePos );
		_lookAt.copy( _vehForward ).multiplyScalar( this.hoodLookAhead ).add( outPos );
		_lookAt.y -= 0.22;
		this._poseFromLookAt( outPos, _lookAt, outPos, outQuat );

	}

	_rawModeGoal( mode, dt, spherePos, velocity, vehicle, outPos, outQuat ) {

		switch ( mode ) {

			case CAMERA_MODE.EAGLE:
				this._eagleGoal( dt, spherePos, velocity, outPos, outQuat );
				break;
			case CAMERA_MODE.THIRD:
				this._thirdGoal( dt, spherePos, velocity, vehicle, outPos, outQuat );
				break;
			default:
				this._hoodGoal( spherePos, vehicle, outPos, outQuat );

		}

	}

	_transitionGoal( dt, spherePos, velocity, vehicle, outPos, outQuat ) {

		const u = this.transitionElapsed / this.transitionDuration;

		const thirdToHood = this.transitionEnterSource === CAMERA_MODE.THIRD &&
			this.transitionTargetMode === CAMERA_MODE.HOOD;

		if ( thirdToHood ) {

			this._thirdGoal( dt, spherePos, velocity, vehicle, _thirdGoalPos, _tmpQuatA );
			this._roofGoal( spherePos, vehicle, _roofPos, _tmpQuatB );

			const split = 0.48;
			let k;
			if ( u <= split ) {

				k = smootherstep( u / split );
				outPos.copy( _thirdGoalPos ).lerp( _roofPos, k );
				this.blendQuat.copy( _tmpQuatA ).slerp( _tmpQuatB, k );

			} else {

				k = smootherstep( ( u - split ) / ( 1 - split ) );
				this._hoodGoal( spherePos, vehicle, _hoodPos, this.goalQuat );
				outPos.copy( _roofPos ).lerp( _hoodPos, k );
				this.blendQuat.copy( _tmpQuatB ).slerp( this.goalQuat, k );

			}

			outQuat.copy( this.blendQuat );
			return;

		}

		this._rawModeGoal( this.transitionTargetMode, dt, spherePos, velocity, vehicle, outPos, outQuat );

	}

	update( dt, spherePos, velocity, vehicle, speedNorm ) {

		if ( ! this.transitionActive ) {

			this._rawModeGoal( this.steadyMode, dt, spherePos, velocity, vehicle, _goalPos, this.goalQuat );
			this.camera.position.copy( _goalPos );
			this.camera.quaternion.copy( this.goalQuat );

		} else {

			this._transitionGoal( dt, spherePos, velocity, vehicle, _goalPos, this.goalQuat );

			const u = smootherstep( this.transitionElapsed / this.transitionDuration );
			this.camera.position.copy( this.startPos ).lerp( _goalPos, u );
			this.blendQuat.copy( this.startQuat ).slerp( this.goalQuat, u );
			this.camera.quaternion.copy( this.blendQuat );

			this.transitionElapsed += dt;
			if ( this.transitionElapsed >= this.transitionDuration ) {

				this.transitionActive = false;
				this.steadyMode = this.transitionTargetMode;
				this.transitionElapsed = this.transitionDuration;

			}

		}

		this._applyHoodSteerRoll( dt, vehicle );
		this._applySpeedFov( dt, speedNorm ?? 0 );

	}

}
