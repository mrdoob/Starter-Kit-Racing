import * as THREE from 'three';

const RING_COUNT = 8;
const STAR_COUNT = 48;
const STARS_PER_BURST = 8;

const RING_LIFETIME = 0.45;
const RING_MAX_SCALE = 2.8;
const STAR_LIFETIME = 0.7;
const STAR_SPEED_MIN = 3;
const STAR_SPEED_RANGE = 3;
const STAR_UP_MIN = 2.5;
const STAR_UP_RANGE = 2;
const STAR_GRAVITY = 11;

const _ringGeom = new THREE.TorusGeometry( 0.4, 0.07, 8, 28 );
const _starGeom = new THREE.IcosahedronGeometry( 0.15, 0 );

export class HitFX {

	constructor( scene ) {

		this.scene = scene;

		this.rings = [];
		for ( let i = 0; i < RING_COUNT; i ++ ) {

			const mat = new THREE.MeshBasicMaterial( { color: 0xffee55, transparent: true, opacity: 0, depthWrite: false } );
			const mesh = new THREE.Mesh( _ringGeom, mat );
			mesh.rotation.x = - Math.PI / 2;
			mesh.visible = false;
			scene.add( mesh );
			this.rings.push( { mesh, material: mat, life: 0 } );

		}
		this.ringIndex = 0;

		this.stars = [];
		for ( let i = 0; i < STAR_COUNT; i ++ ) {

			const mat = new THREE.MeshStandardMaterial( {
				color: 0xfff29a, emissive: 0xffcc33, emissiveIntensity: 1.2,
				roughness: 0.3, transparent: true, opacity: 0,
			} );
			const mesh = new THREE.Mesh( _starGeom, mat );
			mesh.visible = false;
			scene.add( mesh );
			this.stars.push( {
				mesh, material: mat, life: 0,
				vx: 0, vy: 0, vz: 0,
				rotX: 0, rotY: 0,
			} );

		}
		this.starIndex = 0;

	}

	burst( x, y, z ) {

		const ring = this.rings[ this.ringIndex ];
		this.ringIndex = ( this.ringIndex + 1 ) % RING_COUNT;
		ring.mesh.visible = true;
		ring.mesh.position.set( x, y + 0.1, z );
		ring.mesh.scale.setScalar( 0.2 );
		ring.material.opacity = 1;
		ring.life = RING_LIFETIME;

		for ( let i = 0; i < STARS_PER_BURST; i ++ ) {

			const star = this.stars[ this.starIndex ];
			this.starIndex = ( this.starIndex + 1 ) % STAR_COUNT;

			const angle = ( i / STARS_PER_BURST ) * Math.PI * 2 + Math.random() * 0.4;
			const speed = STAR_SPEED_MIN + Math.random() * STAR_SPEED_RANGE;

			star.mesh.visible = true;
			star.mesh.position.set( x, y + 0.3, z );
			star.mesh.scale.setScalar( 0.8 + Math.random() * 0.6 );
			star.material.opacity = 1;
			star.vx = Math.cos( angle ) * speed;
			star.vz = Math.sin( angle ) * speed;
			star.vy = STAR_UP_MIN + Math.random() * STAR_UP_RANGE;
			star.rotX = ( Math.random() - 0.5 ) * 20;
			star.rotY = ( Math.random() - 0.5 ) * 20;
			star.life = STAR_LIFETIME;

		}

	}

	update( dt ) {

		for ( const r of this.rings ) {

			if ( r.life <= 0 ) continue;
			r.life -= dt;
			const prog = 1 - Math.max( 0, r.life / RING_LIFETIME );
			r.mesh.scale.setScalar( 0.2 + prog * RING_MAX_SCALE );
			r.material.opacity = Math.max( 0, 1 - prog );
			if ( r.life <= 0 ) r.mesh.visible = false;

		}

		for ( const s of this.stars ) {

			if ( s.life <= 0 ) continue;
			s.life -= dt;

			s.mesh.position.x += s.vx * dt;
			s.mesh.position.y += s.vy * dt;
			s.mesh.position.z += s.vz * dt;
			s.vy -= STAR_GRAVITY * dt;

			s.mesh.rotation.x += s.rotX * dt;
			s.mesh.rotation.y += s.rotY * dt;

			s.material.opacity = Math.max( 0, s.life / STAR_LIFETIME );

			if ( s.life <= 0 ) s.mesh.visible = false;

		}

	}

}
