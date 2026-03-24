import * as THREE from 'three';

const POOL_SIZE = 64;
const _worldPos = new THREE.Vector3();

export class SmokeTrails {

	constructor( scene ) {

		this.particles = [];

		const map = new THREE.TextureLoader().load( 'sprites/smoke.png' );
		this.material = new THREE.SpriteMaterial( {
			map,
			transparent: true,
			depthWrite: false,
			opacity: 0,
			color: 0x5E5F6B,
		} );

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const sprite = new THREE.Sprite( this.material.clone() );
			sprite.visible = false;
			sprite.scale.setScalar( 0.25 );
			scene.add( sprite );

			this.particles.push( {
				sprite,
				life: 0,
				maxLife: 0,
				velocity: new THREE.Vector3(),
				initialScale: 0,
			} );

		}

		this.emitIndex = 0;

	}

	update( dt, vehicle ) {

		const shouldEmit = vehicle.driftIntensity > 0.25 && vehicle.colliding;

		// Emit new particles from back wheel positions
		if ( shouldEmit ) {

			if ( vehicle.wheelBL ) this.emitAtWheel( vehicle.wheelBL, vehicle );
			if ( vehicle.wheelBR ) this.emitAtWheel( vehicle.wheelBR, vehicle );

		}

		// Update existing
		for ( const p of this.particles ) {

			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				p.sprite.visible = false;
				continue;

			}

			const t = 1 - ( p.life / p.maxLife );

			// Apply damping to velocity (Godot damping = 1.0)
			const damping = Math.max( 0, 1 - dt );
			p.velocity.multiplyScalar( damping );

			p.sprite.position.addScaledVector( p.velocity, dt );

			// Alpha curve: 0 → 1 (at midlife) → 0 (matching Godot's alpha_curve)
			const alpha = t < 0.5 ? t * 2 : ( 1 - t ) * 2;
			p.sprite.material.opacity = alpha;

			// Scale curve: 0.5 → 1.0 (at midlife) → 0.2 (matching Godot's scale_curve)
			let scaleFactor;
			if ( t < 0.5 ) {

				scaleFactor = 0.5 + t * 1.0; // 0.5 → 1.0

			} else {

				scaleFactor = 1.0 - ( t - 0.5 ) * 1.6; // 1.0 → 0.2

			}

			p.sprite.scale.setScalar( p.initialScale * scaleFactor );

		}

	}

	emitAtWheel( wheel, vehicle ) {

		const p = this.particles[ this.emitIndex ];
		this.emitIndex = ( this.emitIndex + 1 ) % POOL_SIZE;

		// Get wheel world position, but use road surface Y
		wheel.getWorldPosition( _worldPos );
		_worldPos.y = vehicle.container.position.y + 0.05;

		p.sprite.position.copy( _worldPos );
		p.sprite.visible = true;
		p.sprite.material.opacity = 0;

		// Godot: scale_min = 0.25, scale_max = 0.5
		p.initialScale = 0.25 + Math.random() * 0.25;
		p.sprite.scale.setScalar( p.initialScale * 0.5 );

		// Godot: no gravity, damping = 1.0 — minimal velocity
		p.velocity.set(
			( Math.random() - 0.5 ) * 0.2,
			Math.random() * 0.1,
			( Math.random() - 0.5 ) * 0.2
		);

		// Godot: lifetime = 0.5
		p.maxLife = 0.5;
		p.life = p.maxLife;

	}

}
