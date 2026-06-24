import * as THREE from 'three';

const POOL_SIZE = 1280;
const PARTICLES_PER_EMIT = 3;
const EMIT_JITTER = 0.15;
const BASE_SIZE = 1;
const MAX_LIFE = 2.5;
const INV_MAX_LIFE = 1 / MAX_LIFE;

const _blPos = new THREE.Vector3();
const _brPos = new THREE.Vector3();

const _nosFwd = new THREE.Vector3();
const _nosSpawn = new THREE.Vector3();

export class SmokeTrails {

	constructor( scene ) {

		const positions = new Float32Array( POOL_SIZE * 3 );
		const opacities = new Float32Array( POOL_SIZE );
		const sizes = new Float32Array( POOL_SIZE );

		const geometry = new THREE.BufferGeometry();

		const posAttr = new THREE.BufferAttribute( positions, 3 );
		posAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'position', posAttr );

		const opacityAttr = new THREE.BufferAttribute( opacities, 1 );
		opacityAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aOpacity', opacityAttr );

		const sizeAttr = new THREE.BufferAttribute( sizes, 1 );
		sizeAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aSize', sizeAttr );

		const map = new THREE.TextureLoader().load( 'sprites/smoke.png' );

		const material = new THREE.PointsMaterial( {
			map,
			color: 0x5E5F6B,
			size: 1,
			sizeAttenuation: true,
			transparent: true,
			depthWrite: false,
		} );

		// PointsMaterial has no per-vertex size or alpha, so inject attributes
		// and fold them into gl_PointSize and diffuseColor.a.
		material.onBeforeCompile = ( shader ) => {

			shader.vertexShader = 'attribute float aSize;\nattribute float aOpacity;\nvarying float vOpacity;\n' + shader.vertexShader;
			shader.vertexShader = shader.vertexShader.replace(
				'void main() {',
				'void main() {\n\tvOpacity = aOpacity;'
			);
			shader.vertexShader = shader.vertexShader.replace(
				'gl_PointSize = size;',
				'gl_PointSize = size * aSize;'
			);

			shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader;
			shader.fragmentShader = shader.fragmentShader.replace(
				'vec4 diffuseColor = vec4( diffuse, opacity );',
				'vec4 diffuseColor = vec4( diffuse, opacity * vOpacity );'
			);

		};

		const points = new THREE.Points( geometry, material );
		points.frustumCulled = false;
		scene.add( points );

		this.posAttr = posAttr;
		this.opacityAttr = opacityAttr;
		this.sizeAttr = sizeAttr;
		this.positions = positions;
		this.opacities = opacities;
		this.sizes = sizes;

		this.particles = [];

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			this.particles.push( {
				life: 0,
				velocity: new THREE.Vector3(),
				initialSize: 0,
			} );

		}

		this.emitIndex = 0;

	}

	update( dt, vehicle ) {

		const driftSmoke = vehicle.driftIntensity > 0.7;
		const nosSmoke = vehicle.nosActive === true;
		const shouldEmit = driftSmoke || nosSmoke;
		const emitBatch = nosSmoke ? PARTICLES_PER_EMIT + 2 : PARTICLES_PER_EMIT;
		let aliveCount = 0;

		if ( shouldEmit ) {

			const roadY = vehicle.container.position.y + 0.05;
			const bl = vehicle.wheelBL ? vehicle.wheelBL.getWorldPosition( _blPos ) : null;
			const br = vehicle.wheelBR ? vehicle.wheelBR.getWorldPosition( _brPos ) : null;

			for ( let i = 0; i < emitBatch; i ++ ) {

				if ( bl ) this.emitAt( bl.x, roadY, bl.z );
				if ( br ) this.emitAt( br.x, roadY, br.z );

			}

		}

		const damping = 1 - dt;

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const p = this.particles[ i ];
			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				this.opacities[ i ] = 0;
				aliveCount ++;
				continue;

			}

			const t = 1 - p.life * INV_MAX_LIFE;

			p.velocity.multiplyScalar( damping );

			const posIdx = i * 3;
			this.positions[ posIdx ] += p.velocity.x * dt;
			this.positions[ posIdx + 1 ] += p.velocity.y * dt;
			this.positions[ posIdx + 2 ] += p.velocity.z * dt;

			this.opacities[ i ] = ( 1 - t ) * 0.25;
			this.sizes[ i ] = p.initialSize * ( 0.5 + t * 2.5 );

			aliveCount ++;

		}

		if ( shouldEmit || aliveCount > 0 ) {

			this.posAttr.needsUpdate = true;
			this.opacityAttr.needsUpdate = true;
			this.sizeAttr.needsUpdate = true;

		}

	}

	emitAt( x, y, z ) {

		const i = this.emitIndex;
		this.emitIndex = ( i + 1 ) % POOL_SIZE;

		const p = this.particles[ i ];

		const posIdx = i * 3;
		this.positions[ posIdx ] = x + ( Math.random() - 0.5 ) * EMIT_JITTER;
		this.positions[ posIdx + 1 ] = y + Math.random() * EMIT_JITTER;
		this.positions[ posIdx + 2 ] = z + ( Math.random() - 0.5 ) * EMIT_JITTER;

		p.initialSize = BASE_SIZE * ( 0.5 + Math.random() * 0.5 );

		p.velocity.set(
			( Math.random() - 0.5 ) * 0.2,
			0.5 + Math.random() * 0.5,
			( Math.random() - 0.5 ) * 0.2
		);

		p.life = MAX_LIFE;

	}

}

const NOS_POOL_SIZE = 384;
const NOS_PARTICLES_PER_EMIT = 4;
const NOS_EMIT_JITTER = 0.08;
const NOS_BASE_SIZE = 0.65;
const NOS_MAX_LIFE = 0.52;
const INV_NOS_MAX_LIFE = 1 / NOS_MAX_LIFE;
const NOS_TRAIL_SPEED = 11;

export class NosTaillightTrails {

	constructor( scene ) {

		const positions = new Float32Array( NOS_POOL_SIZE * 3 );
		const opacities = new Float32Array( NOS_POOL_SIZE );
		const sizes = new Float32Array( NOS_POOL_SIZE );

		const geometry = new THREE.BufferGeometry();

		const posAttr = new THREE.BufferAttribute( positions, 3 );
		posAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'position', posAttr );

		const opacityAttr = new THREE.BufferAttribute( opacities, 1 );
		opacityAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aOpacity', opacityAttr );

		const sizeAttr = new THREE.BufferAttribute( sizes, 1 );
		sizeAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aSize', sizeAttr );

		const map = new THREE.TextureLoader().load( 'sprites/smoke.png' );

		const material = new THREE.PointsMaterial( {
			map,
			color: 0xff2838,
			size: 1,
			sizeAttenuation: true,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			opacity: 1,
		} );

		material.onBeforeCompile = ( shader ) => {

			shader.vertexShader = 'attribute float aSize;\nattribute float aOpacity;\nvarying float vOpacity;\n' + shader.vertexShader;
			shader.vertexShader = shader.vertexShader.replace(
				'void main() {',
				'void main() {\n\tvOpacity = aOpacity;'
			);
			shader.vertexShader = shader.vertexShader.replace(
				'gl_PointSize = size;',
				'gl_PointSize = size * aSize;'
			);

			shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader;
			shader.fragmentShader = shader.fragmentShader.replace(
				'vec4 diffuseColor = vec4( diffuse, opacity );',
				'vec4 diffuseColor = vec4( diffuse, opacity * vOpacity );'
			);

		};

		const points = new THREE.Points( geometry, material );
		points.frustumCulled = false;
		scene.add( points );

		this.posAttr = posAttr;
		this.opacityAttr = opacityAttr;
		this.sizeAttr = sizeAttr;
		this.positions = positions;
		this.opacities = opacities;
		this.sizes = sizes;

		this.particles = [];

		for ( let i = 0; i < NOS_POOL_SIZE; i ++ ) {

			this.particles.push( {
				life: 0,
				velocity: new THREE.Vector3(),
				initialSize: 0,
			} );

		}

		this.emitIndex = 0;

	}

	update( dt, vehicle ) {

		const shouldEmit = vehicle.nosActive === true && vehicle.nosIntensity > 0.04;
		let aliveCount = 0;

		if ( shouldEmit ) {

			_nosFwd.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
			_nosFwd.y = 0;

			if ( _nosFwd.lengthSq() > 1e-6 ) _nosFwd.normalize();

			const yLift = vehicle.container.position.y + 0.1;
			const bl = vehicle.wheelBL ? vehicle.wheelBL.getWorldPosition( _blPos ) : null;
			const br = vehicle.wheelBR ? vehicle.wheelBR.getWorldPosition( _brPos ) : null;

			for ( let i = 0; i < NOS_PARTICLES_PER_EMIT; i ++ ) {

				if ( bl ) {

					_nosSpawn.copy( bl ).addScaledVector( _nosFwd, - 0.42 );
					_nosSpawn.y = yLift;
					this.emitAt(
						_nosSpawn.x + ( Math.random() - 0.5 ) * NOS_EMIT_JITTER,
						_nosSpawn.y,
						_nosSpawn.z + ( Math.random() - 0.5 ) * NOS_EMIT_JITTER,
						_nosFwd
					);

				}

				if ( br ) {

					_nosSpawn.copy( br ).addScaledVector( _nosFwd, - 0.42 );
					_nosSpawn.y = yLift;
					this.emitAt(
						_nosSpawn.x + ( Math.random() - 0.5 ) * NOS_EMIT_JITTER,
						_nosSpawn.y,
						_nosSpawn.z + ( Math.random() - 0.5 ) * NOS_EMIT_JITTER,
						_nosFwd
					);

				}

			}

		}

		const damping = 1 - dt * 0.85;

		for ( let i = 0; i < NOS_POOL_SIZE; i ++ ) {

			const p = this.particles[ i ];
			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				this.opacities[ i ] = 0;
				aliveCount ++;
				continue;

			}

			const t = 1 - p.life * INV_NOS_MAX_LIFE;

			p.velocity.multiplyScalar( damping );

			const posIdx = i * 3;
			this.positions[ posIdx ] += p.velocity.x * dt;
			this.positions[ posIdx + 1 ] += p.velocity.y * dt;
			this.positions[ posIdx + 2 ] += p.velocity.z * dt;

			this.opacities[ i ] = ( 1 - t ) * ( 0.28 + vehicle.nosIntensity * 0.22 );
			this.sizes[ i ] = p.initialSize * ( 0.45 + t * 1.9 );

			aliveCount ++;

		}

		if ( shouldEmit || aliveCount > 0 ) {

			this.posAttr.needsUpdate = true;
			this.opacityAttr.needsUpdate = true;
			this.sizeAttr.needsUpdate = true;

		}

	}

	emitAt( x, y, z, fwdXZ ) {

		const i = this.emitIndex;
		this.emitIndex = ( i + 1 ) % NOS_POOL_SIZE;

		const p = this.particles[ i ];

		const posIdx = i * 3;
		this.positions[ posIdx ] = x;
		this.positions[ posIdx + 1 ] = y;
		this.positions[ posIdx + 2 ] = z;

		p.initialSize = NOS_BASE_SIZE * ( 0.55 + Math.random() * 0.45 );

		const bx = - fwdXZ.x * NOS_TRAIL_SPEED;
		const bz = - fwdXZ.z * NOS_TRAIL_SPEED;

		p.velocity.set(
			bx + ( Math.random() - 0.5 ) * 1.2,
			0.15 + Math.random() * 0.35,
			bz + ( Math.random() - 0.5 ) * 1.2
		);

		p.life = NOS_MAX_LIFE;

	}

}

