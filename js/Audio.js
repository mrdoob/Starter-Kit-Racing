import * as THREE from 'three';

function remap( value, inMin, inMax, outMin, outMax ) {

	return outMin + ( outMax - outMin ) * ( ( value - inMin ) / ( inMax - inMin ) );

}

const NUM_GEARS = 3;
const UPSHIFT_RPM = 0.92;
const DOWNSHIFT_RPM = 0.35;
const SHIFT_COOLDOWN = 0.35;

// Per-gear pitch ranges (index = gear). Higher gears peak lower so each gear
// has its own voice: gear 0 whines high, gear 2 rumbles.
const PITCH_LOW = [ 1.05, 1.25, 1.4 ];
const PITCH_HIGH = [ 3.5, 2.9, 2.3 ];

const FILTER_CUTOFF_MIN = 700;
const FILTER_CUTOFF_MAX = 7000;

export class GameAudio {

	constructor() {

		this.listener = null;
		this.engineSound = null;
		this.engineLayerSound = null;
		this.engineFilter = null;
		this.skidSound = null;
		this.impactBuffer = null;
		this.impactPool = [];
		this.impactIndex = 0;
		this.ready = false;
		this.unlocked = false;

		this.rpm = 0;
		this.gear = 0;
		this.shiftCooldown = 0;

		this.nosWhoosh = null;
		this.prevNosActive = false;

	}

	init( camera ) {

		this.listener = new THREE.AudioListener();
		camera.add( this.listener );

		const loader = new THREE.AudioLoader();

		this.engineSound = new THREE.Audio( this.listener );
		this.engineLayerSound = new THREE.Audio( this.listener );
		this.nosWhoosh = new THREE.Audio( this.listener );

		this.engineFilter = this.listener.context.createBiquadFilter();
		this.engineFilter.type = 'lowpass';
		this.engineFilter.Q.value = 0.7;
		this.engineFilter.frequency.value = FILTER_CUTOFF_MIN;
		this.engineSound.setFilter( this.engineFilter );

		this.skidSound = new THREE.Audio( this.listener );

		loader.load( 'audio/engine.ogg', ( buffer ) => {

			this.engineSound.setBuffer( buffer );
			this.engineSound.setLoop( true );
			this.engineSound.setVolume( 0 );

			this.engineLayerSound.setBuffer( buffer );
			this.engineLayerSound.setLoop( true );
			this.engineLayerSound.setVolume( 0 );

			this.nosWhoosh.setBuffer( buffer );
			this.nosWhoosh.setLoop( false );

			this.checkReady();

		} );

		loader.load( 'audio/skid.ogg', ( buffer ) => {

			this.skidSound.setBuffer( buffer );
			this.skidSound.setLoop( true );
			this.skidSound.setVolume( 0 );
			this.checkReady();

		} );

		loader.load( 'audio/impact.ogg', ( buffer ) => {

			this.impactBuffer = buffer;

			for ( let i = 0; i < 3; i ++ ) {

				const sound = new THREE.Audio( this.listener );
				sound.setBuffer( buffer );
				this.impactPool.push( sound );

			}

		} );

		const unlock = () => {

			if ( this.unlocked ) return;
			this.unlocked = true;

			const ctx = this.listener.context;

			if ( ctx.state === 'suspended' ) {

				ctx.resume();

			}

			this.startSounds();

			window.removeEventListener( 'keydown', unlock );
			window.removeEventListener( 'click', unlock );
			window.removeEventListener( 'touchstart', unlock );

		};

		window.addEventListener( 'keydown', unlock );
		window.addEventListener( 'click', unlock );
		window.addEventListener( 'touchstart', unlock );

	}

	checkReady() {

		if ( this.engineSound.buffer && this.skidSound.buffer ) {

			this.ready = true;

			if ( this.unlocked ) this.startSounds();

		}

	}

	startSounds() {

		if ( ! this.ready ) return;

		if ( ! this.engineSound.isPlaying ) this.engineSound.play();
		if ( ! this.engineLayerSound.isPlaying ) this.engineLayerSound.play();
		if ( ! this.skidSound.isPlaying ) this.skidSound.play();

	}

	update( dt, speed, throttle, driftIntensity, nosActive ) {

		if ( ! this.ready ) return;

		const na = nosActive === true;
		if ( na && ! this.prevNosActive && this.nosWhoosh && this.nosWhoosh.buffer ) {

			if ( this.nosWhoosh.isPlaying ) this.nosWhoosh.stop();

			this.nosWhoosh.setPlaybackRate( 1.55 + Math.random() * 0.25 );
			this.nosWhoosh.setVolume( 0.2 );
			this.nosWhoosh.play();

		}

		this.prevNosActive = na;

		const absSpeed = THREE.MathUtils.clamp( Math.abs( speed ), 0, 1 );
		// Only forward throttle counts as engine load. Brake/reverse (throttle < 0)
		// should let RPM fall so downshifts can fire as the car decelerates.
		const load = THREE.MathUtils.clamp( Math.max( 0, throttle ), 0, 1 );

		const gearWindow = 1 / NUM_GEARS;
		const gearStart = this.gear * gearWindow;
		const inGear = THREE.MathUtils.clamp( ( absSpeed - gearStart ) / gearWindow, 0, 1 );

		let targetRpm = inGear * 0.85 + load * 0.2;
		targetRpm = THREE.MathUtils.clamp( targetRpm, 0, 1.05 );

		// Rise rate is deliberately gentle so each gear holds long enough to be
		// audible given the car's ~1.5s 0→max acceleration curve.
		const riseRate = 4;
		const fallRate = 4;
		const rate = targetRpm > this.rpm ? ( riseRate * ( 0.3 + load ) ) : fallRate;
		this.rpm = THREE.MathUtils.lerp( this.rpm, targetRpm, Math.min( 1, dt * rate ) );

		this.shiftCooldown = Math.max( 0, this.shiftCooldown - dt );

		if ( this.shiftCooldown === 0 ) {

			if ( this.rpm > UPSHIFT_RPM && this.gear < NUM_GEARS - 1 && load > 0.1 ) {

				this.gear ++;
				this.rpm = 0.45;
				this.shiftCooldown = SHIFT_COOLDOWN;

			} else if ( this.rpm < DOWNSHIFT_RPM && this.gear > 0 ) {

				this.gear --;
				this.rpm = 0.78;
				this.shiftCooldown = SHIFT_COOLDOWN;

			}

		}

		const targetVol = remap( absSpeed + load * 0.5, 0, 1.5, 0.02, 0.25 );
		const currentVol = this.engineSound.getVolume();
		const newVol = THREE.MathUtils.lerp( currentVol, targetVol, dt * 5 );
		this.engineSound.setVolume( newVol );
		this.engineLayerSound.setVolume( newVol * 0.4 );

		const pitch = THREE.MathUtils.lerp( PITCH_LOW[ this.gear ], PITCH_HIGH[ this.gear ], this.rpm );
		this.engineSound.setPlaybackRate( pitch );
		this.engineLayerSound.setPlaybackRate( pitch * 0.5 );

		const targetCutoff = remap( load, 0, 1, FILTER_CUTOFF_MIN, FILTER_CUTOFF_MAX );
		this.engineFilter.frequency.setTargetAtTime(
			targetCutoff,
			this.listener.context.currentTime,
			0.05
		);

		const shouldSkid = driftIntensity > 0.5;
		let skidVol = 0;

		if ( shouldSkid ) {

			skidVol = remap(
				THREE.MathUtils.clamp( driftIntensity, 0.5, 2.5 ),
				0.5, 2.5, 0.05, 0.3
			);

		}

		const curSkidVol = this.skidSound.getVolume();
		this.skidSound.setVolume( THREE.MathUtils.lerp( curSkidVol, skidVol, dt * 10 ) );

		const skidPitch = THREE.MathUtils.clamp( Math.abs( speed ), 1, 3 );
		const curSkidPitch = this.skidSound.getPlaybackRate();
		this.skidSound.setPlaybackRate( THREE.MathUtils.lerp( curSkidPitch, skidPitch, 0.1 ) );

	}

	playImpact( impactVelocity ) {

		if ( ! this.unlocked || this.impactPool.length === 0 ) return;

		const sound = this.impactPool[ this.impactIndex ];
		this.impactIndex = ( this.impactIndex + 1 ) % this.impactPool.length;

		if ( sound.isPlaying ) sound.stop();

		const volume = THREE.MathUtils.clamp( remap( impactVelocity, 0, 6, 0.01, 1.0 ), 0.01, 1.0 );
		sound.setVolume( volume );
		sound.play();

	}

}
