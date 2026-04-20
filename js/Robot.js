import * as THREE from 'three';

const smoothstep = ( lo, hi, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - lo ) / ( hi - lo ) ) );
	return t * t * ( 3 - 2 * t );

};

const easeOutBack = ( t ) => {

	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow( t - 1, 3 ) + c1 * Math.pow( t - 1, 2 );

};

// --- Shared materials (draw-call friendly). Body color matches the yellow truck. ---
const chromeMat = new THREE.MeshStandardMaterial( { color: 0xf2c32c, metalness: 0.35, roughness: 0.45 } );
const darkPanelMat = new THREE.MeshStandardMaterial( { color: 0x25282f, metalness: 0.55, roughness: 0.45 } );
const yellowMat = new THREE.MeshStandardMaterial( { color: 0xd89418, metalness: 0.3, roughness: 0.45, emissive: 0x3a2600, emissiveIntensity: 0.2 } );
const redEmissiveMat = new THREE.MeshStandardMaterial( { color: 0xff2a1a, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.25, metalness: 0.1 } );
const blueCoreMat = new THREE.MeshStandardMaterial( { color: 0x33aaff, emissive: 0x2088ff, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.1 } );
const muzzleGlowMat = new THREE.MeshStandardMaterial( { color: 0xff9840, emissive: 0xff5a10, emissiveIntensity: 0.6, roughness: 0.3 } );

const _tmpVec = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();

function podMesh() {

	const g = new THREE.Group();
	const main = new THREE.Mesh( new THREE.BoxGeometry( 0.55, 0.5, 0.9 ), chromeMat );
	g.add( main );
	const trim = new THREE.Mesh( new THREE.BoxGeometry( 0.62, 0.12, 0.35 ), yellowMat );
	trim.position.y = 0.12;
	g.add( trim );
	const hub = new THREE.Mesh( new THREE.CylinderGeometry( 0.18, 0.18, 0.62, 12 ), darkPanelMat );
	hub.rotation.z = Math.PI / 2;
	hub.position.set( 0.26, 0, 0 );
	g.add( hub );
	return g;

}

function splitterPlate() {

	const m = new THREE.Mesh( new THREE.BoxGeometry( 0.9, 0.05, 0.35 ), darkPanelMat );
	return m;

}

function buildHead() {

	const head = new THREE.Group();

	const skull = new THREE.Mesh( new THREE.BoxGeometry( 0.55, 0.5, 0.55 ), chromeMat );
	head.add( skull );

	// Side plates
	const sideL = new THREE.Mesh( new THREE.BoxGeometry( 0.08, 0.35, 0.4 ), yellowMat );
	sideL.position.set( - 0.31, 0.02, 0 );
	head.add( sideL );
	const sideR = sideL.clone();
	sideR.position.x = 0.31;
	head.add( sideR );

	// Visor plate (rotates open). Pivot axis at its top edge — use a pivot group.
	const visorPivot = new THREE.Group();
	visorPivot.position.set( 0, 0.12, 0.28 );
	head.add( visorPivot );
	const visor = new THREE.Mesh( new THREE.BoxGeometry( 0.44, 0.22, 0.05 ), darkPanelMat );
	visor.position.y = - 0.11;
	visorPivot.add( visor );

	// Eye strip — revealed as visor opens
	const eye = new THREE.Mesh( new THREE.BoxGeometry( 0.36, 0.09, 0.02 ), redEmissiveMat );
	eye.position.set( 0, 0.02, 0.28 );
	head.add( eye );

	// Antenna pivot for overshoot animation
	const antennaPivot = new THREE.Group();
	antennaPivot.position.set( - 0.15, 0.25, 0 );
	head.add( antennaPivot );
	const antenna = new THREE.Mesh( new THREE.CylinderGeometry( 0.025, 0.035, 0.45, 6 ), chromeMat );
	antenna.position.y = 0.225;
	antennaPivot.add( antenna );
	const antennaTip = new THREE.Mesh( new THREE.SphereGeometry( 0.06, 10, 8 ), redEmissiveMat );
	antennaTip.position.y = 0.48;
	antennaPivot.add( antennaTip );

	return { head, visorPivot, antennaPivot };

}

function buildCannonArm() {

	// An arm group with pivot at shoulder. Cannon extends along +Z.
	const arm = new THREE.Group();

	const upperArm = new THREE.Mesh( new THREE.BoxGeometry( 0.22, 0.22, 0.35 ), chromeMat );
	upperArm.position.set( 0, 0, 0.17 );
	arm.add( upperArm );

	const elbow = new THREE.Mesh( new THREE.SphereGeometry( 0.14, 12, 8 ), yellowMat );
	elbow.position.set( 0, 0, 0.35 );
	arm.add( elbow );

	// Cannon barrel: stack of cylinders
	const barrelGroup = new THREE.Group();
	barrelGroup.position.set( 0, 0, 0.5 );
	arm.add( barrelGroup );

	const barrelBase = new THREE.Mesh( new THREE.CylinderGeometry( 0.13, 0.15, 0.3, 14 ), darkPanelMat );
	barrelBase.rotation.x = Math.PI / 2;
	barrelBase.position.z = 0.05;
	barrelGroup.add( barrelBase );

	const barrelMid = new THREE.Mesh( new THREE.CylinderGeometry( 0.1, 0.13, 0.35, 14 ), chromeMat );
	barrelMid.rotation.x = Math.PI / 2;
	barrelMid.position.z = 0.3;
	barrelGroup.add( barrelMid );

	const barrelTip = new THREE.Mesh( new THREE.CylinderGeometry( 0.09, 0.1, 0.2, 14 ), chromeMat );
	barrelTip.rotation.x = Math.PI / 2;
	barrelTip.position.z = 0.56;
	barrelGroup.add( barrelTip );

	// Muzzle glow at tip — also serves as fire origin pivot
	const muzzle = new THREE.Mesh( new THREE.SphereGeometry( 0.095, 12, 8 ), muzzleGlowMat.clone() );
	muzzle.position.z = 0.72;
	barrelGroup.add( muzzle );

	// Vents on the sides of the base for flavor
	for ( let i = - 1; i <= 1; i += 2 ) {

		const vent = new THREE.Mesh( new THREE.BoxGeometry( 0.05, 0.18, 0.2 ), yellowMat );
		vent.position.set( i * 0.15, 0, 0.1 );
		barrelGroup.add( vent );

	}

	return { arm, barrelGroup, muzzle };

}

export class Robot {

	constructor() {

		this.root = new THREE.Group();
		this.root.visible = false;

		// --- Ground-level pods (old wheels become these visually) ---
		this.pods = [];
		const podOffsets = [
			[ - 0.9, - 1.0 ], [ 0.9, - 1.0 ],
			[ - 0.9, 1.0 ], [ 0.9, 1.0 ],
		];
		for ( let i = 0; i < 4; i ++ ) {

			const p = podMesh();
			p.userData.baseX = podOffsets[ i ][ 0 ];
			p.userData.baseZ = podOffsets[ i ][ 1 ];
			p.userData.side = Math.sign( podOffsets[ i ][ 0 ] );
			p.visible = false;
			this.root.add( p );
			this.pods.push( p );

		}

		// --- Chassis splitter plates (explode outward from under the body) ---
		this.splitters = [];
		for ( let i = 0; i < 4; i ++ ) {

			const s = splitterPlate();
			s.userData.angle = ( i / 4 ) * Math.PI * 2 + Math.PI / 4;
			s.visible = false;
			this.root.add( s );
			this.splitters.push( s );

		}

		// --- Torso pivot (holds everything that yaws) ---
		this.torsoPivot = new THREE.Group();
		this.torsoPivot.position.y = 0.1;
		this.root.add( this.torsoPivot );

		// Spine cylinder extruding upward
		this.spine = new THREE.Mesh( new THREE.CylinderGeometry( 0.12, 0.14, 0.9, 10 ), chromeMat );
		this.spine.position.y = 0.45;
		this.spine.scale.y = 0.001;
		this.spine.visible = false;
		this.torsoPivot.add( this.spine );

		// Chest plate group (pivot at base, swings forward briefly during deploy)
		this.chest = new THREE.Group();
		this.chest.position.y = 0.7;
		this.chest.visible = false;
		this.torsoPivot.add( this.chest );
		const chestMain = new THREE.Mesh( new THREE.BoxGeometry( 0.9, 0.65, 0.5 ), chromeMat );
		this.chest.add( chestMain );
		const chestTrim = new THREE.Mesh( new THREE.BoxGeometry( 1.0, 0.12, 0.2 ), yellowMat );
		chestTrim.position.set( 0, 0.2, 0.2 );
		this.chest.add( chestTrim );
		// Glowing core
		this.core = new THREE.Mesh( new THREE.IcosahedronGeometry( 0.14, 0 ), blueCoreMat );
		this.core.position.set( 0, 0, 0.27 );
		this.chest.add( this.core );
		const coreRing = new THREE.Mesh( new THREE.TorusGeometry( 0.18, 0.025, 8, 18 ), yellowMat );
		coreRing.position.copy( this.core.position );
		this.chest.add( coreRing );

		// Back plate (hinged up)
		this.backPivot = new THREE.Group();
		this.backPivot.position.set( 0, 0.32, - 0.25 );
		this.chest.add( this.backPivot );
		const backPlate = new THREE.Mesh( new THREE.BoxGeometry( 0.85, 0.15, 0.4 ), darkPanelMat );
		backPlate.position.y = 0.075;
		this.backPivot.add( backPlate );

		// Head
		const headAssembly = buildHead();
		this.head = headAssembly.head;
		this.visorPivot = headAssembly.visorPivot;
		this.antennaPivot = headAssembly.antennaPivot;
		this.head.position.y = 0.3; // above chest; animated
		this.head.visible = false;
		this.chest.add( this.head );
		// Find the eye mesh for pulse
		this.eyeMesh = this.head.children.find( ( m ) => m.material === redEmissiveMat );

		// Shoulder pivots (splay slightly outward)
		this.leftShoulderPivot = new THREE.Group();
		this.leftShoulderPivot.position.set( - 0.58, 0.28, 0 );
		this.leftShoulderPivot.rotation.z = 0.15;
		this.leftShoulderPivot.visible = false;
		this.chest.add( this.leftShoulderPivot );

		this.rightShoulderPivot = new THREE.Group();
		this.rightShoulderPivot.position.set( 0.58, 0.28, 0 );
		this.rightShoulderPivot.rotation.z = - 0.15;
		this.rightShoulderPivot.visible = false;
		this.chest.add( this.rightShoulderPivot );

		// Shoulder blocks
		const shoulderBlockL = new THREE.Mesh( new THREE.BoxGeometry( 0.35, 0.3, 0.35 ), chromeMat );
		this.leftShoulderPivot.add( shoulderBlockL );
		const shoulderCapL = new THREE.Mesh( new THREE.SphereGeometry( 0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2 ), yellowMat );
		shoulderCapL.position.set( - 0.12, 0.08, 0 );
		shoulderCapL.rotation.z = - Math.PI / 2;
		this.leftShoulderPivot.add( shoulderCapL );

		const shoulderBlockR = shoulderBlockL.clone();
		this.rightShoulderPivot.add( shoulderBlockR );
		const shoulderCapR = shoulderCapL.clone();
		shoulderCapR.position.x = 0.12;
		shoulderCapR.rotation.z = Math.PI / 2;
		this.rightShoulderPivot.add( shoulderCapR );

		// Cannon arms
		const leftCannon = buildCannonArm();
		this.leftArm = leftCannon.arm;
		this.leftArm.rotation.x = Math.PI; // folded back
		this.leftShoulderPivot.add( this.leftArm );
		this.leftBarrel = leftCannon.barrelGroup;
		this.leftMuzzle = leftCannon.muzzle;

		const rightCannon = buildCannonArm();
		this.rightArm = rightCannon.arm;
		this.rightArm.rotation.x = Math.PI;
		this.rightShoulderPivot.add( this.rightArm );
		this.rightBarrel = rightCannon.barrelGroup;
		this.rightMuzzle = rightCannon.muzzle;

		// Runtime state
		this.leftRecoil = 0;
		this.rightRecoil = 0;
		this.leftHeat = 0;
		this.rightHeat = 0;
		this.eyePulse = 0;
		this.idleBob = 0;
		this.progress = 0;
		this.turretYaw = 0;
		this.turretPitch = 0;
		this.time = 0;

	}

	getRoot() {

		return this.root;

	}

	setProgress( p ) {

		this.progress = p;
		if ( p < 0.001 ) {

			this.root.visible = false;
			return;

		}
		this.root.visible = true;

		// Phases
		const dip = smoothstep( 0.0, 0.10, p );
		const lift = smoothstep( 0.10, 0.30, p );
		const spinePhase = smoothstep( 0.30, 0.55, p );
		const chestSwingRaw = smoothstep( 0.30, 0.55, p );
		const headPhase = smoothstep( 0.55, 0.75, p );
		const armsPhase = smoothstep( 0.55, 0.75, p );
		const posePhase = smoothstep( 0.75, 1.0, p );

		const liftEB = lift > 0 ? easeOutBack( lift ) : 0;
		const headEB = headPhase > 0 ? easeOutBack( headPhase ) : 0;
		const armsEB = armsPhase > 0 ? easeOutBack( armsPhase ) : 0;
		const poseEB = posePhase > 0 ? easeOutBack( posePhase ) : 0;

		// Root dip during anticipation
		this.root.position.y = - dip * 0.08 + spinePhase * 0.1;

		// Pods splay outward
		for ( let i = 0; i < 4; i ++ ) {

			const pod = this.pods[ i ];
			pod.visible = liftEB > 0.001;
			const s = Math.max( 0.001, liftEB );
			pod.scale.setScalar( s );
			const side = pod.userData.side;
			pod.position.x = pod.userData.baseX + side * liftEB * 0.45;
			pod.position.z = pod.userData.baseZ;
			pod.position.y = - 0.1 + liftEB * 0.05;
			pod.rotation.z = - side * liftEB * 0.6;

		}

		// Chassis splitters explode outward
		for ( let i = 0; i < 4; i ++ ) {

			const s = this.splitters[ i ];
			s.visible = liftEB > 0.001;
			s.scale.setScalar( Math.max( 0.001, liftEB ) );
			const ang = s.userData.angle;
			const r = 0.25 + liftEB * 0.6;
			s.position.set( Math.cos( ang ) * r, - 0.2, Math.sin( ang ) * r );
			s.rotation.y = ang;
			s.rotation.z = liftEB * 0.4;

		}

		// Spine extrudes up
		this.spine.visible = spinePhase > 0.001;
		this.spine.scale.y = Math.max( 0.001, spinePhase );

		// Chest appears with spine, swings forward via a sin pulse
		this.chest.visible = spinePhase > 0.05;
		this.chest.scale.setScalar( Math.max( 0.001, spinePhase ) );
		const swingAmp = Math.sin( chestSwingRaw * Math.PI ) * 0.45;
		this.chest.rotation.x = swingAmp * 0.5;

		// Back plate hinges up
		this.backPivot.rotation.x = - ( Math.PI / 2 ) * ( 1 - spinePhase );

		// Core light pulses
		this.core.material.emissiveIntensity = 0.4 + spinePhase * 0.8 + Math.sin( this.time * 4 ) * 0.15 + poseEB * 0.9;

		// Head grows
		this.head.visible = headEB > 0.001;
		this.head.position.y = 0.28 + headEB * 0.55;
		this.head.scale.setScalar( Math.max( 0.001, headEB ) );

		// Visor rotates open: from flat over eye to flipped up
		this.visorPivot.rotation.x = - headEB * 1.4;

		// Eye emissive with flicker around 0.60..0.70
		const flicker = ( p > 0.60 && p < 0.70 ) ? ( Math.sin( p * 220 ) > 0 ? 1 : 0.25 ) : 1;
		const baseEye = headPhase * 1.3 + this.eyePulse;
		if ( this.eyeMesh ) this.eyeMesh.material.emissiveIntensity = baseEye * flicker;

		// Antenna pop — overshoot via poseEB
		this.antennaPivot.scale.y = 0.001 + poseEB * 1.1;

		// Shoulders visible with chest, deploy via spinePhase scale
		this.leftShoulderPivot.visible = spinePhase > 0.05;
		this.rightShoulderPivot.visible = spinePhase > 0.05;

		// Cannon arm fold→deploy. Folded at rotation.x = Math.PI, deployed at 0, with overshoot oscillation in pose.
		const deployAngle = Math.PI * ( 1 - armsEB );
		const springPhase = posePhase * 14;
		const springAmp = ( 1 - posePhase ) * 0.25;
		const leftRecoilOffset = - this.leftRecoil * 0.25;
		const rightRecoilOffset = - this.rightRecoil * 0.25;

		this.leftArm.rotation.x = deployAngle + Math.sin( springPhase ) * springAmp - this.turretPitch + leftRecoilOffset;
		this.rightArm.rotation.x = deployAngle + Math.sin( springPhase + 0.3 ) * springAmp - this.turretPitch + rightRecoilOffset;

		// Muzzle heat glow
		this.leftMuzzle.material.emissiveIntensity = 0.6 + this.leftHeat * 2.5;
		this.rightMuzzle.material.emissiveIntensity = 0.6 + this.rightHeat * 2.5;

		// Apply turret yaw
		this.torsoPivot.rotation.y = this.turretYaw;

	}

	setTurretYaw( yaw ) {

		this.turretYaw = yaw;

	}

	setTurretPitch( pitch ) {

		this.turretPitch = pitch;

	}

	onShotFired( side ) {

		if ( side === 'left' ) {

			this.leftRecoil = 1;
			this.leftHeat = Math.min( 1, this.leftHeat + 0.35 );

		} else {

			this.rightRecoil = 1;
			this.rightHeat = Math.min( 1, this.rightHeat + 0.35 );

		}

		this.eyePulse = 0.5;

	}

	getCannonTransform( side, outPos, outDir ) {

		const muzzle = side === 'left' ? this.leftMuzzle : this.rightMuzzle;
		muzzle.updateWorldMatrix( true, false );
		outPos.setFromMatrixPosition( muzzle.matrixWorld );
		muzzle.getWorldQuaternion( _tmpQuat );
		outDir.set( 0, 0, 1 ).applyQuaternion( _tmpQuat );
		outDir.y = 0;
		outDir.normalize();

	}

	update( dt ) {

		this.time += dt;

		// Recoil springs: decay recoil values toward 0
		this.leftRecoil = Math.max( 0, this.leftRecoil - dt * 7 );
		this.rightRecoil = Math.max( 0, this.rightRecoil - dt * 7 );

		// Heat decay
		this.leftHeat = Math.max( 0, this.leftHeat - dt * 1.1 );
		this.rightHeat = Math.max( 0, this.rightHeat - dt * 1.1 );

		// Eye pulse decay
		this.eyePulse = Math.max( 0, this.eyePulse - dt * 3 );

		// Idle torso bob when fully transformed
		if ( this.progress >= 0.98 ) {

			this.idleBob = Math.sin( this.time * 2.2 ) * 0.05;
			this.torsoPivot.position.y = 0.1 + this.idleBob;

		} else {

			this.torsoPivot.position.y = 0.1;

		}

	}

}
